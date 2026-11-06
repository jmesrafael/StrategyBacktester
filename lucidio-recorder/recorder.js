// recorder.js - the Lucid'io data recorder. Public MEXC data only: no key, no orders, no account. It writes down what the market and the order book look like, all day,
// so research uses the data the bots actually saw (real candles with no holes, real funding, real order-book slippage) instead of guesses.
//
//   every 5 minutes   1m candles of the five coins · an order-book snapshot per coin (spread, depth, slippage of a $100 ... $20,000 market order, funding rate)
//   every hour        1h and 4h candles · MEXC's settled funding rates · the regime of every coin and of the market · the slippage summary the 1h paper bot reads
//   every day         gzip finished months and days · the optional copy off the server (RECORDER_SYNC_CMD)
//   every 5 minutes   a small heartbeat to the dashboard: regime, measured slippage, the recorder's own health
//
//   node recorder.js run        the service (loops forever)         node recorder.js once      one full cycle, then exit
//   node recorder.js status     what it has recorded                node recorder.js verify    holes in the stored candles
// A failing task is logged and counted, never fatal: the others still run and the next cycle tries again. Files: archive.js.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { createClient, IV } = require('./mexcpub.js');
const { createArchive, holesIn, STEP } = require('./archive.js');
const bookstats = require('./bookstats.js');
const regime = require('./regime.js');
const push = require('./push.js');

const VERSION = 1;
const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'], SYMBOLS = COINS.map((c) => `${c}_USDT`);
const ROOT = process.env.RECORDER_DIR || path.join(__dirname, 'data');
const TICK_MS = 5 * 60e3;
const INITIAL_SEC = { '1m': 3 * 86400, '1h': 200 * 86400, '4h': 400 * 86400 };   // how far back the very first run goes (the regime needs ~125 days of 1h)
const MIN_FREE_GB = 1.5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(' ')}`; console.log(line); };

const client = createClient(), archive = createArchive(ROOT);
const st = { started: Date.now(), ok: { candles: 0, book: 0, funding: 0, regime: 0, upload: 0 }, errors: [], lastHour: null, lastDay: null, specs: new Map(), holes: { h1_7d: 0, m1_24h: 0 }, disk: { free_gb: null, low: 0 }, regimeNow: null, slipNow: null };
const fail = (task, e) => { st.errors.push(Date.now()); st.errors = st.errors.filter((t) => Date.now() - t < 3600e3); log(`ERROR ${task}: ${(e && e.message) || e}`); };

async function specFor(sym) {
  const hit = st.specs.get(sym);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.spec;
  try { const spec = await client.detail(sym); st.specs.set(sym, { at: Date.now(), spec }); return spec; } catch (e) { if (hit) return hit.spec; throw e; }
}

// ---------------- candles ----------------
async function syncCandles(sym, tf) {
  const step = STEP[tf]; let total = 0;
  for (let guard = 0; guard < 400; guard++) {
    const nowSec = Math.floor(Date.now() / 1000), last = archive.newestCandle(sym, tf);
    const start = last != null ? last + step : nowSec - INITIAL_SEC[tf];
    if (start > nowSec - step) break;
    const end = Math.min(nowSec, start + 1999 * step), rows = await client.klines(sym, tf, start, end);
    const closed = rows.filter((c) => c[0] + step <= nowSec);                 // the forming candle is not stored
    const written = archive.appendCandles(sym, tf, closed); total += written;
    if (!written) break;                                                       // nothing new in that range: MEXC has no more, or we are caught up
    if (end >= nowSec) break;
    await sleep(150);
  }
  return total;
}
async function syncAllCandles(tfs) {
  let n = 0;
  for (const sym of SYMBOLS) for (const tf of tfs) { try { n += await syncCandles(sym, tf); } catch (e) { fail(`candles ${sym} ${tf}`, e); } await sleep(100); }
  st.ok.candles = Date.now(); return n;
}

// ---------------- order book ----------------
async function snapshotBooks() {
  let ok = 0;
  for (const sym of SYMBOLS) {
    try {
      const [spec, book, fr] = await Promise.all([specFor(sym), client.depth(sym, 100), client.fundingRate(sym).catch(() => null)]);
      const snap = bookstats.snapshotOf(book, spec, Date.now());
      if (!snap) { fail(`book ${sym}`, new Error('empty or unreadable order book')); continue; }
      if (fr && Number.isFinite(+fr.fundingRate)) snap.fr = +fr.fundingRate;
      archive.appendBook(sym, snap); ok++;
    } catch (e) { fail(`book ${sym}`, e); }
    await sleep(100);
  }
  if (ok) st.ok.book = Date.now();
  return ok;
}

// ---------------- funding ----------------
async function syncFunding() {
  let n = 0;
  for (const sym of SYMBOLS) { try { n += archive.appendFunding(sym, await client.fundingHistory(sym, 60)); } catch (e) { fail(`funding ${sym}`, e); } await sleep(100); }
  st.ok.funding = Date.now(); return n;
}

// ---------------- summaries: slippage (the paper bot reads this file) and regime ----------------
function computeSlippage(nowMs = Date.now()) {
  const coins = {};
  for (const sym of SYMBOLS) {
    const snaps = archive.readBook(sym, nowMs - 7 * 86400e3);
    if (snaps.length < 12) continue;                                          // an hour of data at least
    const s = bookstats.summarize(snaps), pick = (side) => Object.fromEntries(Object.entries(s[side]).filter(([, v]) => v.n >= 12).map(([k, v]) => [k, { med: v.med, p90: v.p90, n: v.n }]));
    coins[sym] = { n: s.n, spread_bp: s.spread_bp, buy: pick('buy'), sell: pick('sell'), ask_d05: s.ask_d05, bid_d05: s.bid_d05, heartbeat: bookstats.heartbeatSlip(s) };
  }
  const out = { updated_ms: nowMs, window_days: 7, sizes_usd: bookstats.SIZES_USD, coins };
  archive.writeSummary('slippage.json', out); return out;
}
function computeRegime(nowMs = Date.now()) {
  const byCoin = {};
  for (const sym of SYMBOLS) byCoin[sym] = archive.readCandles(sym, '1h', 3000);
  const res = regime.marketRegime(byCoin), hourStart = Math.floor(nowMs / 3600e3) * 3600e3;
  const out = { updated_ms: nowMs, coins: res.coins, market: res.market };
  archive.writeSummary('regime.json', out);
  if (res.market && st.lastRegimeHour !== hourStart) {
    st.lastRegimeHour = hourStart;
    archive.appendRegime({ t: hourStart, coins: Object.fromEntries(Object.entries(res.coins).filter(([, v]) => v).map(([k, v]) => [k, { state: v.state, atr_pct: v.atr_pct, rv24: v.rv24, trend_pct: v.trend_pct, er48: v.er48, bbw_pctile: v.bbw_pctile, bb_pos: v.bb_pos }])), market: res.market });
  }
  st.ok.regime = Date.now(); return out;
}
function countHoles() {
  let h1 = 0, m1 = 0;
  for (const sym of SYMBOLS) {
    const now = Math.floor(Date.now() / 1000);
    h1 += holesIn(archive.readCandles(sym, '1h', 24 * 7).filter((c) => c[0] > now - 7 * 86400), STEP['1h']);
    m1 += holesIn(archive.readCandles(sym, '1m', 1440).filter((c) => c[0] > now - 86400), STEP['1m']);
  }
  st.holes = { h1_7d: h1, m1_24h: m1 };
}
function checkDisk() {
  try { const s = fs.statfsSync(ROOT), free = (s.bavail * s.bsize) / 1073741824; st.disk = { free_gb: Math.round(free * 10) / 10, low: free < MIN_FREE_GB ? 1 : 0 }; } catch { /* statfs not available: leave the last value */ }
}

// ---------------- the optional copy off the server ----------------
// RECORDER_SYNC_CMD is any shell command that copies the data folder somewhere safe (it gets RECORDER_DIR in its environment), e.g. an rclone or rsync line. Once a day.
function runSync() {
  const cmd = process.env.RECORDER_SYNC_CMD;
  if (!cmd) return Promise.resolve(false);
  return new Promise((resolve) => {
    cp.execFile('/bin/sh', ['-c', cmd], { timeout: 30 * 60e3, env: { ...process.env, RECORDER_DIR: ROOT }, maxBuffer: 1 << 20 }, (err, out, errOut) => {
      if (err) { fail('off-server copy', new Error(`${err.message}`.slice(0, 200) + ' ' + String(errOut || '').slice(0, 200))); resolve(false); }
      else { st.ok.upload = Date.now(); log('off-server copy done'); resolve(true); }
    });
  });
}

// ---------------- what the dashboard sees ----------------
const finite = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && Number.isFinite(+v)).map(([k, v]) => [k, +v]));
function heartbeatData() {
  const rg = st.regimeNow || archive.readSummary('regime.json'), sl = st.slipNow || archive.readSummary('slippage.json'), fp = archive.footprint();
  const data = { recorder: finite({ version: VERSION, started_ms: st.started, uptime_sec: Math.round((Date.now() - st.started) / 1000), candles_ok_ms: st.ok.candles, book_ok_ms: st.ok.book, funding_ok_ms: st.ok.funding,
    regime_ok_ms: st.ok.regime, upload_ok_ms: st.ok.upload, upload_on: process.env.RECORDER_SYNC_CMD ? 1 : 0, errors_1h: st.errors.length, holes_1h_7d: st.holes.h1_7d, holes_1m_24h: st.holes.m1_24h,
    disk_free_gb: st.disk.free_gb, disk_low: st.disk.low, archive_mb: fp.mb, first_ms: fp.first_ms, coins: SYMBOLS.length }) };
  if (rg && rg.market) {
    const coinKeys = ['atr_pct', 'rv24', 'rv7d', 'trend_pct', 'er48', 'bbw', 'bbw_pctile', 'bb_pos'];
    data.regime = {}; data.regime_state = {};
    for (const [sym, v] of Object.entries(rg.coins || {})) if (v) { data.regime[sym] = finite(Object.fromEntries(coinKeys.map((k) => [k, v[k]]))); data.regime_state[sym] = v.state; }
    const { market_state, ...m } = rg.market; data.market = finite(m); data.market_state = market_state;
  }
  if (sl && sl.coins) { data.slippage = {}; for (const [sym, v] of Object.entries(sl.coins)) if (v.heartbeat) data.slippage[sym] = finite(v.heartbeat); }
  return data;
}
async function report() {
  archive.writeSummary('status.json', { ts: Date.now(), version: VERSION, ...heartbeatData().recorder, started_ms: st.started });
  if (!push.enabled()) return;
  const r = await push.send(push.heartbeatEvent(heartbeatData()));
  if (!r.ok && !r.skipped) log(`dashboard heartbeat not delivered: ${r.error || 'HTTP ' + r.status}`);
}

// ---------------- the schedule ----------------
async function cycle(first = false) {
  const now = Date.now(), hour = Math.floor(now / 3600e3), day = new Date(now).toISOString().slice(0, 10);
  checkDisk();
  const writeHeavy = !st.disk.low;
  if (writeHeavy) { await syncAllCandles(['1m']).catch((e) => fail('candles 1m', e)); await snapshotBooks().catch((e) => fail('book', e)); }
  else log(`WARNING disk almost full (${st.disk.free_gb} GB free): 1m candles and order books are paused`);
  if (first || st.lastHour !== hour) {
    st.lastHour = hour;
    await syncAllCandles(['1h', '4h']).catch((e) => fail('candles', e));
    await syncFunding().catch((e) => fail('funding', e));
    try { st.slipNow = computeSlippage(); } catch (e) { fail('slippage summary', e); }
    try { st.regimeNow = computeRegime(); } catch (e) { fail('regime', e); }
    try { countHoles(); } catch (e) { fail('holes', e); }
  }
  if (first || st.lastDay !== day) {
    st.lastDay = day;
    try { const n = archive.rotate(now); if (n) log(`gzipped ${n} finished file(s)`); } catch (e) { fail('rotate', e); }
    if (process.env.RECORDER_SYNC_CMD && !st.syncing) { st.syncing = true; runSync().finally(() => { st.syncing = false; });   // in the background: a slow upload never delays the 5-minute recording
    }
  }
  await report();
}

let stopping = false;
async function loop() {
  log(`recorder v${VERSION} started: ${SYMBOLS.join(', ')} -> ${ROOT}${push.enabled() ? ' · reporting to the dashboard' : ' · dashboard off (DASHBOARD_URL / DASHBOARD_PUSH_SECRET not set)'}${process.env.RECORDER_SYNC_CMD ? ' · off-server copy on' : ' · off-server copy OFF'}`);
  fs.mkdirSync(ROOT, { recursive: true, mode: 0o755 });
  for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { stopping = true; log(`${s}: stopping after this cycle`); setTimeout(() => process.exit(0), 20000).unref(); });
  let first = true;
  while (!stopping) {
    const t0 = Date.now();
    try { await cycle(first); } catch (e) { fail('cycle', e); }
    first = false;
    log(`cycle ${Date.now() - t0} ms · errors in the last hour: ${st.errors.length}`);
    if (stopping) break;
    const wait = TICK_MS - (Date.now() % TICK_MS) + 20000;                      // next 5-minute mark + 20 s (the minute's candle has closed)
    await sleep(wait);
  }
  log('stopped'); process.exit(0);
}

function status() {
  const s = archive.readSummary('status.json'), rg = archive.readSummary('regime.json'), sl = archive.readSummary('slippage.json'), ago = (ms) => (ms ? `${Math.round((Date.now() - ms) / 60000)} min ago` : 'never');
  if (!s) { console.log('no status yet: the recorder has not completed a cycle'); return; }
  console.log(`recorder v${s.version} · up ${Math.round(s.uptime_sec / 3600)} h · archive ${s.archive_mb} MB · disk free ${s.disk_free_gb} GB`);
  console.log(`candles ${ago(s.candles_ok_ms)} · book ${ago(s.book_ok_ms)} · funding ${ago(s.funding_ok_ms)} · regime ${ago(s.regime_ok_ms)} · off-server copy ${s.upload_on ? ago(s.upload_ok_ms) : 'not set up'}`);
  console.log(`errors in the last hour ${s.errors_1h} · holes: 1h ${s.holes_1h_7d} (7 d), 1m ${s.holes_1m_24h} (24 h)`);
  if (rg && rg.market) { console.log(`market: ${rg.market.market_state} · correlation ${rg.market.avg_corr_7d}`); for (const [k, v] of Object.entries(rg.coins)) if (v) console.log(`  ${k.padEnd(10)} ${v.state.padEnd(14)} ATR ${v.atr_pct}% · trend ${v.trend_pct}% · ER ${v.er48} · band width p${v.bbw_pctile}`); }
  if (sl) for (const [k, v] of Object.entries(sl.coins)) console.log(`  ${k.padEnd(10)} spread ${v.spread_bp.med} bp · buy $1,000 ${v.buy['1000'] ? v.buy['1000'].med + ' bp (p90 ' + v.buy['1000'].p90 + ')' : '-'} · $5,000 ${v.buy['5000'] ? v.buy['5000'].med + ' bp' : '-'} · ${v.n} snapshots`);
}
function verify() {
  for (const sym of SYMBOLS) for (const tf of ['1h', '4h', '1m']) {
    const rows = archive.readCandles(sym, tf, tf === '1m' ? 20000 : 5000);
    console.log(`${sym.padEnd(10)} ${tf.padEnd(3)} ${String(rows.length).padStart(6)} candles${rows.length ? ` ${new Date(rows[0][0] * 1000).toISOString().slice(0, 16)} -> ${new Date(rows[rows.length - 1][0] * 1000).toISOString().slice(0, 16)}` : ''} · holes ${holesIn(rows, STEP[tf])}`);
  }
}

module.exports = { cycle, computeSlippage, computeRegime, syncCandles, snapshotBooks, heartbeatData, archive, SYMBOLS, st };
const cmd = require.main === module ? process.argv[2] : 'lib';
if (cmd === 'run') loop();
else if (cmd === 'once') cycle(true).then(() => { log('one cycle done'); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
else if (cmd === 'status') status();
else if (cmd === 'verify') verify();
else if (cmd !== 'lib') { console.log('usage: node recorder.js run | once | status | verify'); process.exit(cmd ? 2 : 0); }
