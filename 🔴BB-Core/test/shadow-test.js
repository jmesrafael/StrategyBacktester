// test/shadow-test.js - the shadow recorder sidecar, the shared match key, and compare-live-vs-backtest.js in BOTH modes (journal, and recorder + state file).
//   node test/shadow-test.js        No network (a fake transport answers the recorder), no money, no keys; writes only to the OS temp folder.
// Proves: the recorder never writes outside its own folder and never reads the bot's files or keys; it never calls a private endpoint; killing it has no effect
// on the bot; its lines carry the SAME match key as the bot's journal; rotation and the disk cap work; compare joins the recorder to the journal, and works
// from the recorder + the bot's state file alone (and says what it cannot check).
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const H = require('./helpers.js');
const TMP = H.tmp('shadow');
process.env.LUCIDIO_STATE_DIR = path.join(TMP, 'state'); process.env.LUCIDIO_JOURNAL_DIR = path.join(TMP, 'journal'); process.env.LUCIDIO_ENV_FILE = path.join(TMP, 'none.env'); process.env.LUCIDIO_NO_NOTIFY = '1';
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
const ROOT = path.join(__dirname, '..'), REC_FILE = path.join(ROOT, 'sidecar', 'shadow-recorder.js');
const R = require(REC_FILE), MK = require('../matchkey.js'), READER = require('../shadow-reader.js');
const core = require('../lucidio-core.js'), journal = require('../journal.js'), cmp = require('../compare-live-vs-backtest.js');

let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const IV = 14400, cfg = { mode: 'paper', coins: ['SOL', 'ZEC'], riskPct: 0.01 };
const sha = (f) => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const listTree = (d) => { const out = []; const walk = (x) => { for (const n of fs.readdirSync(x, { withFileTypes: true })) { const f = path.join(x, n.name); if (n.isDirectory()) walk(f); else out.push(path.relative(d, f).replace(/\\/g, '/') + ':' + fs.statSync(f).size); } }; try { walk(d); } catch {} return out.sort(); };

// ---------------------------------------------------------------- fixture: real SOL candles, the backtest trades in a window, exactly like compare-test.js
const all = H.load('SOL'), W = 700, END = 1500, fin = all.slice(0, END), fromSig = all[W].time, startIdx = W - core.DEFAULTS.warmup;
const bt = core.backtest(all.slice(startIdx, END), {}, null).trades.filter((t) => t.t - IV >= fromSig);
const closesTo = (sec) => fin.filter((c) => c.time <= sec).map((c) => c.close);
function tradeEvents(t, { withExit = true } = {}) {   // the bot's REAL journal builders
  const sigSec = t.t - IV, sigC = all.find((c) => c.time === sigSec), oneR = Math.abs(t.entry - t.stop);
  const entry = journal.entryEvent({ symbol: 'SOL_USDT', dir: t.dir, sigTime: sigSec, sigCandle: sigC, indicators: journal.indicators(closesTo(sigSec), 0.1), decisionSec: sigSec + IV + 5, intended: t.entry, fill: t.entry, nextOpenSec: t.t,
    nextOpen: all.find((c) => c.time === t.t).open, delaySec: 5, slipR: 0, stop: t.stop, tp: t.tp, qty: 1, riskUsd: 1, balance: 100, oneR, live: false, costs: { kind: 'estimate (paper)' } }, cfg, 'paper', (sigSec + IV + 5) * 1000);
  const exit = journal.exitEvent({ symbol: 'SOL_USDT', dir: t.dir, sigTime: sigSec, why: t.why, exit: t.exit, entry: t.entry, stop: t.stop, tp: t.tp, t0: t.t, R: t.R, usd: t.R, balanceAfter: 100, exitSec: t.tExit, exitCandleOpenSec: t.tExit - IV, holdSec: t.tExit - t.t,
    costs: { kind: 'estimate (paper)' } }, cfg, 'paper', (t.tExit + 5) * 1000);
  return withExit ? [entry, exit] : [entry];
}
const sessionEv = journal.sessionEvent({ coins: ['SOL', 'ZEC'], note: 'loop started' }, cfg, 'paper', (fromSig + IV + 20) * 1000);
const report = (events, extra = {}) => cmp.buildReport({ events, candles: { SOL_USDT: fin }, tolerance: 0.05, now: all[END].time + 100, mode: 'paper', ...extra });
const sigOf = (t) => t.t - IV;

// a recorder folder as the REAL recorder code writes it (R.append: keyed, rotated by day), one decision per backtest trade's signal candle + a few quiet candles
function recorderDir(name, { skipSig = null, lag = 2.3 } = {}) {
  const dir = path.join(TMP, name); fs.mkdirSync(dir, { recursive: true }); const prev = R.__getOut(); R.__setOut(dir);
  const sigs = new Set(bt.map(sigOf));
  for (let k = 0; k < 40 && sigs.size < bt.length + 6; k++) { const c = all[W + 3 + k * 5], i = all.findIndex((x) => x.time === c.time); if (R.decide(all.slice(0, i + 1)).signal === 'none') sigs.add(c.time); }   // quiet candles only
  for (const sig of sigs) {
    if (sig === skipSig) continue;
    const i = all.findIndex((c) => c.time === sig), d = R.decide(all.slice(0, i + 1));
    const c = all[i], fetch = { fetched_at_ms: (sig + IV) * 1000 + Math.round(lag * 1000), request_ms: 120, lag_sec: lag, late: lag > 30 };
    R.append({ ts: new Date().toISOString(), kind: 'candle', snap: 't2s', coin: 'SOL', candle: sig, closeT: sig + IV, wakeLagSec: lag, fetch, mexc: { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }, binance: null });
    R.append({ ts: new Date().toISOString(), kind: 'decision', snap: 't2s', coin: 'SOL', candle: sig, wakeLagSec: lag, fetch, mexc: d, binance: d, agree: true });
  }
  R.__setOut(prev); return dir;
}

// ---------------------------------------------------------------- the fake transport: answers every PUBLIC endpoint from real SOL candles; records every URL
const sc = H.scenario('SOL', 40), cutI = sc.i0, closeT = sc.all[cutI].time;
function mkTransport(seen) {
  const rows = (n) => sc.all.slice(Math.max(0, cutI - n + 1), cutI + 1);
  return async (url) => {
    seen.push(url); const u = new URL(url), p = u.pathname;
    if (p.endsWith('/ping')) return { success: true, data: (closeT + 2) * 1000 };
    if (p.endsWith('/time')) return { serverTime: (closeT + 2) * 1000 };
    if (p.includes('/contract/kline/')) { const r = rows(499); return { success: true, data: { time: r.map((x) => x.time), open: r.map((x) => x.open), high: r.map((x) => x.high), low: r.map((x) => x.low), close: r.map((x) => x.close), vol: r.map(() => 1) } }; }
    if (p.endsWith('/klines')) return rows(499).map((x) => [x.time * 1000, x.open, x.high, x.low, x.close, 1, (x.time + IV) * 1000 - 1]);
    if (p.includes('/ticker')) return { success: true, data: { lastPrice: sc.all[cutI].open * 1.0001, bid1: sc.all[cutI].open, ask1: sc.all[cutI].open * 1.0002, fairPrice: sc.all[cutI].open, indexPrice: sc.all[cutI].open } };
    if (p.includes('/depth')) { const px = sc.all[cutI].open, mk = (s) => Array.from({ length: 20 }, (_, i) => [px * (1 + s * (0.0001 + i * 0.0001)), 5000, 1]); return p.includes('/contract/') ? { success: true, data: { bids: mk(-1), asks: mk(1), timestamp: 0 } } : { bids: mk(-1), asks: mk(1) }; }
    if (p.includes('/detail')) return { success: true, data: { contractSize: 0.1, takerFeeRate: 0.0001, makerFeeRate: 0 } };
    if (p.includes('/funding_rate')) return { success: true, data: { fundingRate: 0.0001, nextSettleTime: (closeT + 3600) * 1000, collectCycle: 8 } };
    throw new Error('unexpected url in the test: ' + url);
  };
}
const withNow = async (ms, fn) => { const real = Date.now; Date.now = () => ms; try { return await fn(); } finally { Date.now = real; } };
const spyFs = () => {   // records every path the recorder code reads or writes through fs
  const w = [], r = [], orig = {}, W_ = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'rmSync', 'copyFileSync', 'rmdirSync', 'utimesSync'], R_ = ['readFileSync', 'readdirSync', 'existsSync', 'statSync', 'lstatSync', 'statfsSync', 'readSync', 'accessSync'];
  for (const n of W_) { orig[n] = fs[n]; fs[n] = (...a) => { if (typeof a[0] === 'string') w.push(path.resolve(a[0])); if (n === 'renameSync' && typeof a[1] === 'string') w.push(path.resolve(a[1])); return orig[n](...a); }; }
  for (const n of R_) { orig[n] = fs[n]; fs[n] = (...a) => { if (typeof a[0] === 'string') r.push(path.resolve(a[0])); return orig[n](...a); }; }
  const origOpen = fs.openSync; orig.openSync = origOpen; fs.openSync = (f, flags, ...a) => { if (typeof f === 'string') (/[wa+]/.test(String(flags || 'r')) ? w : r).push(path.resolve(f)); return origOpen(f, flags, ...a); };
  return { w, r, stop() { for (const [n, f] of Object.entries(orig)) fs[n] = f; } };
};

(async () => {
  ok(bt.length >= 4, `fixture: the backtest takes ${bt.length} trades in the window (need >= 4)`);

  // ============================================================ 1. match key: recorder == journal == matchkey.js
  const sides = [1, -1, 'LONG', 'SHORT'], syms = ['SOL_USDT', 'ZEC_USDT'], times = [fromSig, fromSig + 14400 + 0.4, 1700000000];
  let same = 0, n = 0; for (const s of syms) for (const d of sides) for (const t of times) { n++; if (MK.tradeId(s, d, t) === journal.tradeId(s, d, t)) same++; }
  ok(same === n, `matchkey.tradeId equals journal.tradeId for every symbol / side / time (${same}/${n})`);
  ok(MK.tradeId('SOL', 'LONG', fromSig) === MK.tradeId('SOL_USDT', 'LONG', fromSig) && JSON.stringify(MK.matchKey('SOL', 1, fromSig)) === JSON.stringify({ symbol: 'SOL_USDT', side: 'LONG', signal_candle_open_ms: fromSig * 1000 }), 'a coin name and a symbol give the same key; the key is { symbol, side, signal_candle_open_ms }');
  let keyOk = 0;
  for (const t of bt.slice(0, 8)) {
    const sig = sigOf(t), i = all.findIndex((c) => c.time === sig), d = R.decide(all.slice(0, i + 1)), jev = tradeEvents(t)[0];
    const line = R.keyed({ kind: 'decision', coin: 'SOL', candle: sig, mexc: d });
    if (line.trade_id === jev.trade_id && JSON.stringify(line.match_key) === JSON.stringify(jev.match_key) && line.symbol === jev.symbol && line.signal_candle_open_ms === jev.match_key.signal_candle_open_ms) keyOk++;
  }
  ok(keyOk === Math.min(8, bt.length), `the recorder's decision line has the SAME trade_id and match_key as the bot's real journal entry event, for every backtest trade (${keyOk}/${Math.min(8, bt.length)})`);
  const quiet = R.keyed({ kind: 'decision', coin: 'SOL', candle: all[W + 3].time, mexc: { signal: 'none', reasons: [] } });
  ok(quiet.trade_id === undefined && quiet.symbol === 'SOL_USDT' && quiet.signal_candle_open_ms === all[W + 3].time * 1000, 'a candle without a signal still carries symbol + signal candle open ms, and no side / trade_id');

  // ============================================================ 2. recorder: writes only inside its folder, reads nothing of the bot's, only public GETs
  const OUT = path.join(TMP, 'shadow-out'); fs.mkdirSync(OUT, { recursive: true }); R.__setOut(OUT); R.__setClock({ mexcOffsetMs: 0, binOffsetMs: 0 });
  const seen = [], spy = spyFs(); R.__setTransport(mkTransport(seen));
  let cycleErr = null;
  try {
    await withNow((closeT + 2) * 1000 + 300, async () => { await R.cycle(closeT, 't2s'); await Promise.all(R.COINS.map((c) => R.collectMinutes(c, closeT - IV))); });
    await withNow((closeT + 45) * 1000 + 300, async () => { await R.cycle(closeT, 'late'); });
    R.maintain((closeT + 2) * 1000 + 3 * 86400000);   // three days later: yesterday's files get gzipped
  } catch (e) { cycleErr = e; } finally { spy.stop(); R.__setTransport(null); }
  ok(!cycleErr, 'a full cycle (all coins, t+2s and a late one, 1m candles, housekeeping) ran without throwing' + (cycleErr ? ': ' + cycleErr.message : ''));
  const outside = [...new Set(spy.w.filter((p) => p !== OUT && !p.startsWith(OUT + path.sep)))];
  ok(spy.w.length > 10 && outside.length === 0, `every file the recorder wrote, created, renamed or deleted is inside its own folder (${spy.w.length} operations, ${outside.length} outside${outside.length ? ': ' + outside.slice(0, 3).join(', ') : ''})`);
  const SECRETY = /mexc-keys|[\\/]\.env\b|[\\/]state[\\/]|[\\/]journal[\\/]|[\\/]audit[\\/]|bot-config|bot\.pid/i, readsBad = [...new Set(spy.r.filter((p) => (p === OUT || p.startsWith(OUT + path.sep) ? false : SECRETY.test(p))))];
  ok(readsBad.length === 0, `it read none of the bot's files: keys, .env, state, journal, config (${spy.r.length} reads checked)`);
  const bare = (p) => path.relative(OUT, p).replace(/\\/g, '/'), written = new Set(listTree(OUT).map((x) => x.split(':')[0]));
  ok([...written].some((f) => /^records-\d{4}-\d{2}-\d{2}\.jsonl(\.gz)?$/.test(f)) && [...written].some((f) => /^windows-\d{4}-\d{2}-\d{2}\.jsonl(\.gz)?$/.test(f)) && written.has('status.json'), `its folder holds records, windows and status.json: ${[...written].join(', ')}`);
  const bad = seen.filter((u) => { const x = new URL(u); return x.protocol !== 'https:' || !['contract.mexc.com', 'fapi.binance.com'].includes(x.hostname) || /private|order|account|position|stoporder|asset|trade/i.test(x.pathname); });
  ok(seen.length > 20 && bad.length === 0, `it called only public endpoints: ${seen.length} requests, all https GET to contract.mexc.com / fapi.binance.com, none with a private path (${[...new Set(seen.map((u) => new URL(u).pathname.replace(/\/[A-Z]+_USDT/, '/<coin>')))].length} distinct paths)`);
  let refused = 0; for (const u of ['https://contract.mexc.com/api/v1/private/account/assets', 'https://contract.mexc.com/api/v1/private/order/create', 'https://contract.mexc.com/api/v1/private/position/open_positions', 'https://fapi.binance.com/fapi/v1/order', 'https://fapi.binance.com/fapi/v2/account', 'https://api.mexc.com/api/v3/ping', 'http://contract.mexc.com/api/v1/contract/ping', 'https://evil.example/api/v1/contract/ping']) { try { await R.httpGet(u); } catch (e) { if (/read-only/.test(e.message)) refused++; } }
  ok(refused === 8, `httpGet refuses private paths, other hosts and plain http (${refused}/8 refused)`);
  const fullSrc = fs.readFileSync(REC_FILE, 'utf8');   // the selfcheck at the end lists the forbidden tokens on purpose: analyse everything before it
  const code = fullSrc.slice(0, fullSrc.indexOf('// ------------------------------------------------------------------ selfcheck')).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const reqs = [...code.matchAll(/require\(([^)]*)\)/g)].map((m) => m[1].replace(/['"]/g, '').trim()), allowed = new Set(['fs', 'path', 'zlib', 'crypto']);
  ok(reqs.every((r) => allowed.has(r) || /^here\(lucidio-core\.js$|^here\(matchkey\.js$|^here\(shadow-reader\.js$/.test(r)) && !/mexc\.js|live\.js|journal|telegram|ledger-sync|dashboard-push|envfile|lucidio\.js/.test(reqs.join(' ')), `the recorder requires only fs, path, zlib, crypto and three pure files: ${reqs.join(', ')}`);
  ok(!/method:\s*['"](POST|PUT|DELETE|PATCH)/i.test(code) && (code.match(/method:\s*'GET'/g) || []).length === 1 && !/createHmac|ApiKey|signature|mexc-keys|createOrder/i.test(code), 'in its code: one fetch, method GET, no HMAC, no API key header, no keys file, no order call');
  // the path guard itself
  const evil = [path.join(OUT, '..', 'evil.txt'), path.join(OUT, 'm1', '..', '..', 'evil2.txt'), OUT + '-sibling' + path.sep + 'x.txt', path.resolve(path.sep, 'tmp-evil-shadow.txt')];
  const results = evil.map((p) => R.safeWrite(p, (f) => fs.writeFileSync(f, 'x'))), made = evil.filter((p) => fs.existsSync(p));
  ok(results.every((r) => r === false) && made.length === 0 && /outside SHADOW_DIR/.test(R.stats.lastError), 'a write outside the recorder folder (parent, ../.., a sibling with the same prefix, an absolute path) is refused and nothing is created');

  // ============================================================ 3. the window record: 200 candles + the new one, indicators, decision, fetch time (and a late fetch is visible)
  const wins = READER.readWindows(OUT).rows, w0 = wins.find((x) => x.snap === 't2s' && x.coin === 'SOL'), wl = wins.find((x) => x.snap === 'late' && x.coin === 'SOL');
  const dec = READER.readRecords(OUT).rows.find((x) => x.kind === 'decision' && x.snap === 't2s' && x.coin === 'SOL');
  ok(w0 && w0.candles.length === 200 && w0.forming && w0.forming[0] === closeT && w0.candles[199][0] === closeT - IV && w0.candles[0][0] === closeT - 200 * IV, `window: the last 200 closed candles (${new Date(w0.candles[0][0] * 1000).toISOString().slice(0, 16)} .. ${new Date(w0.candles[199][0] * 1000).toISOString().slice(0, 16)}) plus the new candle ${new Date(w0.forming[0] * 1000).toISOString().slice(0, 16)}`);
  const ind = w0.indicators; ok(ind && ind.bb_upper > ind.bb_mid && ind.bb_lower < ind.bb_mid && ind.sma200 > 0 && ind.atr14 > 0 && ind.nearest_threshold_pct >= 0 && w0.decision.signal === dec.mexc.signal, `window: indicators (BB ${ind.bb_lower.toFixed(3)} / ${ind.bb_mid.toFixed(3)} / ${ind.bb_upper.toFixed(3)}, SMA200, ATR14) and the decision (${w0.decision.signal}) are recorded`);
  const closedSeries = w0.candles.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })), indJ = journal.indicators(closedSeries.map((c) => c.close), ind.atr14);
  ok(Math.abs(indJ.bb_upper - ind.bb_upper) < 1e-9 && Math.abs(indJ.sma200 - ind.sma200) < 1e-9 && Math.abs(indJ.nearest_threshold_pct - ind.nearest_threshold_pct) < 1e-9, "the recorder's indicator values and nearest-threshold distance equal journal.indicators on the same candles");
  ok(w0.fetch.fetched_at_ms > 0 && w0.fetch.fetched_at_iso && w0.fetch.request_ms >= 0 && w0.fetch.lag_sec > 2 && w0.fetch.lag_sec < 3 && w0.fetch.late === false && w0.core_sha256 === sha(path.join(ROOT, 'lucidio-core.js')), `window: fetch time ${w0.fetch.fetched_at_iso}, ${w0.fetch.lag_sec} s after the close, late=${w0.fetch.late}, engine file hash recorded`);
  ok(wl && wl.fetch.late === true && wl.fetch.lag_sec > 44 && wl.fetch.lag_sec < 46, `a fetch 45 s after the close is flagged late (lag ${wl && wl.fetch.lag_sec} s): late-fetch timing is visible`);

  // ============================================================ 4. rotation, gzip and the size cap (own process: the limits are read at start)
  const capDir = path.join(TMP, 'cap'); fs.mkdirSync(path.join(capDir, 'm1'), { recursive: true });
  const old = (n, kb, ageDays) => { const f = path.join(capDir, n); fs.writeFileSync(f, require('crypto').randomBytes(kb * 1024)); const t = new Date(Date.now() - ageDays * 86400000); fs.utimesSync(f, t, t); return f; };
  old('records-2026-01-01.jsonl', 40, 30); old('records-2026-01-02.jsonl', 40, 29); old('windows-2026-01-03.jsonl', 40, 28); old('m1/SOL-1.json', 30, 27);
  const today = new Date().toISOString().slice(0, 10); fs.writeFileSync(path.join(capDir, `records-${today}.jsonl`), '{"kind":"candle"}\n');
  const child = cp.spawnSync(process.execPath, ['-e', `const R=require(${JSON.stringify(REC_FILE)}); R.__setOut(${JSON.stringify(capDir)}); R.maintain(); R.maintain(); console.log(JSON.stringify(R.stats))`], { env: { ...process.env, SHADOW_MAX_MB: '0.02', SHADOW_GZIP_AFTER_DAYS: '1' }, encoding: 'utf8' });
  const left = listTree(capDir).map((x) => x.split(':')[0]), st = JSON.parse((child.stdout || '{}').trim().split('\n').pop() || '{}');
  ok(child.status === 0 && left.includes(`records-${today}.jsonl`) && !left.some((f) => /^records-2026-01-01/.test(f)), `size cap 20 KB: the oldest files were deleted, today's file was never touched (left: ${left.join(', ')})`);
  ok(st.deleted && st.deleted.length >= 1 && (st.rotated || []).length >= 1, `old files were gzipped first (${(st.rotated || []).length}) and the oldest deleted (${(st.deleted || []).length}); status.json is written (${left.includes('status.json')})`);
  const gzs = left.filter((f) => f.endsWith('.gz')); ok(gzs.length === 0 || READER.readFamily(capDir, 'records').bad === 0, 'a rotated .gz file is read back by the reader without errors');

  // ============================================================ 5. compare, mode A: with the journal (+ recorder joined on the match key)
  const ev = [sessionEv, ...bt.flatMap((t) => tradeEvents(t))];
  const dirS = recorderDir('rec-all'), shadow = cmp.readShadow([dirS]);
  const rA = report(ev, { shadow, source: 'journal' });
  ok(rA.match === true && rA.counts.matched === bt.length && rA.source === 'journal', `journal mode: MATCH, ${rA.counts.matched}/${bt.length} trades matched`);
  ok(rA.recorder_join.available && rA.recorder_join.with_signal >= bt.length && rA.recorder_join.recorder_only.length === 0 && rA.recorder_join.side_disagree.length === 0 && rA.recorder_join.bot_only.length === 0 && rA.recorder_join.joined === rA.recorder_join.with_signal,
    `journal mode: the recorder's ${rA.recorder_join.with_signal} signals are all joined to the bot's entries on the match key, with no manual work (recorder-only ${rA.recorder_join.recorder_only.length}, opposite side ${rA.recorder_join.side_disagree.length}, bot-only ${rA.recorder_join.bot_only.length})`);
  ok(rA.cannot_check.length === 0 && rA.recorder_join.median_fetch_lag_sec === 2.3 && rA.recorder_join.late_fetches === 0, 'journal mode with the recorder: nothing is on the "cannot check" list; the fetch lag is reported');
  const rA0 = report(ev, { source: 'journal' });
  ok(rA0.match === true && rA0.recorder_join.available === false && rA0.cannot_check.length === 1 && /no shadow recorder data/.test(rA0.cannot_check[0]), 'journal mode without a recorder: still MATCH, and it says the decision-at-fetch-time evidence is missing');
  const missed = bt[2], rA1 = report([sessionEv, ...bt.filter((t) => t !== missed).flatMap((t) => tradeEvents(t))], { shadow, source: 'journal' });
  const bo = rA1.investigation.find((i) => i.kind === 'backtest-only');
  ok(rA1.match === false && bo && /recorder \(t2s, fetched 2\.3 s after the close\) saw (LONG|SHORT)/.test(bo.why) && rA1.recorder_join.recorder_only.length === 1 && rA1.recorder_join.recorder_only[0].signal_candle_open_ms === sigOf(missed) * 1000, 'journal mode, the bot "missed" a trade: backtest-only AND the recorder shows it saw the signal at t+2.3 s (recorder-only list names the candle)');
  const txtA = cmp.renderText(rA1); ok(/RECORDER vs BOT/.test(txtA) && /RECORDER-ONLY/.test(txtA), 'the text report has the recorder-vs-bot section');
  const dirQ = recorderDir('rec-skip', { skipSig: sigOf(bt[1]) }), rA2 = report(ev, { shadow: cmp.readShadow([dirQ]), source: 'journal' });
  ok(rA2.match === true && rA2.recorder_join.available, 'a candle the recorder missed (it was down) does not make the comparison fail');

  // rotated (gz) recorder files are read by compare
  const dirG = recorderDir('rec-gz'); for (const f of fs.readdirSync(dirG)) { fs.writeFileSync(path.join(dirG, f + '.gz'), zlib.gzipSync(fs.readFileSync(path.join(dirG, f)))); fs.unlinkSync(path.join(dirG, f)); }
  const sg = cmp.readShadow([dirG]); ok(sg.decisions.size === shadow.decisions.size && sg.decisions.size > 0 && report(ev, { shadow: sg, source: 'journal' }).recorder_join.joined === rA.recorder_join.joined, `compare reads rotated .gz recorder files (${sg.decisions.size} decisions)`);

  // ============================================================ 6. compare, mode B: NO journal: the bot's state file + the recorder
  const mkState = (trades, over = {}) => ({ coins: { SOL: { lastTime: all[END - 1].time, pos: null, realizedR: 0, n: trades.length, trades }, ZEC: { lastTime: all[END - 1].time, pos: null, realizedR: 0, n: 0, trades: [] } }, startedAt: new Date((fromSig + IV + 20) * 1000).toISOString(), mode: 'paper', balance: 100, ...over });
  const rec = (t, o = {}) => ({ coin: 'SOL', dir: t.dir, t: t.t, tExit: t.tExit, entry: t.entry, exit: t.exit, why: t.why, R: t.R, usd: t.R, balance: 100, entryDelaySec: 5, ...o });
  const stFile = path.join(TMP, 'state-ok.json'); fs.writeFileSync(stFile, JSON.stringify(mkState(bt.map((t) => rec(t)))));
  const evS = cmp.eventsFromState(stFile);
  ok(evS.filter((e) => e.type === 'entry').length === bt.length && evS.every((e) => e.mode === 'paper') && evS.find((e) => e.type === 'entry').trade_id === tradeEvents(bt[0])[0].trade_id, `state mode: ${bt.length} trades read from state.json with the SAME trade_id as the journal would give (${evS.find((e) => e.type === 'entry').trade_id})`);
  const rB = report(evS, { shadow, source: 'state' });
  ok(rB.match === true && rB.counts.matched === bt.length && rB.source === 'state', `state mode (no journal): MATCH, ${rB.counts.matched}/${bt.length} trades matched on entry price, exit reason and R`);
  ok(rB.cannot_check.length === 8 && rB.cannot_check.some((x) => /skipped signals/.test(x)) && rB.cannot_check.some((x) => /exit candle/.test(x)) && rB.cannot_check.some((x) => /provenance/.test(x)) && rB.cannot_check.some((x) => /indicator values/.test(x)), `state mode says what it cannot check (${rB.cannot_check.length} items: skipped signals, the bot's own indicators and candles, exit candle, slippage, provenance, downtime, fees)`);
  ok(rB.recorder_join.available && rB.recorder_join.joined === rB.recorder_join.with_signal && rB.recorder_join.recorder_only.length === 0, `state mode: the recorder is joined to the bot's state records on the match key (${rB.recorder_join.joined}/${rB.recorder_join.with_signal})`);
  const txtB = cmp.renderText(rB); ok(/CANNOT CHECK in this mode \(8\)/.test(txtB) && /NO journal/.test(txtB), 'the text report states the mode and lists the checks it cannot do');
  const evB1 = cmp.eventsFromState((() => { const f = path.join(TMP, 'state-miss.json'); fs.writeFileSync(f, JSON.stringify(mkState(bt.filter((t) => t !== missed).map((t) => rec(t))))); return f; })());
  const rB1 = report(evB1, { shadow, source: 'state' }), boS = rB1.investigation.find((i) => i.kind === 'backtest-only');
  ok(rB1.match === false && boS && /state file has no such trade/.test(boS.why) && /cannot be told apart/.test(boS.why) && /recorder \(t2s/.test(boS.why), 'state mode, a trade missing from the state file: backtest-only, explained honestly (skip / down / missed cannot be told apart) with the recorder evidence');
  const evB2 = cmp.eventsFromState((() => { const f = path.join(TMP, 'state-diff.json'); fs.writeFileSync(f, JSON.stringify(mkState(bt.map((t, k) => rec(t, k === 1 ? { why: t.why === 'stop' ? 'target' : 'stop', R: t.R + 1 } : {}))))); return f; })());
  const rB2 = report(evB2, { shadow, source: 'state' });
  ok(rB2.match === false && rB2.investigation.some((i) => i.kind === 'differs' && /exit reason/.test(i.why) && /R differs/.test(i.why)), 'state mode: a different exit reason and R are flagged');
  const evB3 = cmp.eventsFromState((() => { const f = path.join(TMP, 'state-open.json'); const last = bt[bt.length - 1]; const s = mkState(bt.slice(0, -1).map((t) => rec(t))); s.coins.SOL.pos = { coin: 'SOL', dir: last.dir, entry: last.entry, stop: last.stop, tp: last.tp, t0: last.t }; fs.writeFileSync(f, JSON.stringify(s)); return f; })());
  ok(evB3.filter((e) => e.type === 'entry').length === bt.length && evB3.filter((e) => e.type === 'exit').length === bt.length - 1, 'state mode: the open position is read too (an entry without an exit; its signal candle is the one before the entry candle)');
  ok(cmp.eventsFromState(path.join(TMP, 'nope.json')).length === 0 && cmp.eventsFromState((() => { const f = path.join(TMP, 'bad.json'); fs.writeFileSync(f, '{not json'); return f; })()).length === 0, 'a missing or damaged state file gives no events instead of crashing');

  // ---- the CLI end to end, both modes + the automatic fallback
  const stub = new Proxy({ klines: async (s, iv, a, b) => { if (s !== 'SOL_USDT') return []; return fin.concat([{ time: all[END].time, open: 1, high: 1, low: 1, close: 1 }]).filter((c) => c.time >= a && c.time <= b); } }, { get: (t, k) => { if (k in t) return t[k]; throw new Error(`compare tried to use client.${String(k)}: it must only read public data`); } });
  const out1 = path.join(TMP, 'out1'), out2 = path.join(TMP, 'out2'), out3 = path.join(TMP, 'out3'), nowS = all[END].time + 100, silent = async (fn) => { const w = process.stdout.write.bind(process.stdout), l = console.log, e = console.error; process.stdout.write = () => true; console.log = () => {}; console.error = () => {}; try { return await fn(); } finally { process.stdout.write = w; console.log = l; console.error = e; } };
  const c1 = await silent(() => cmp.main(['node', 'x', '--no-journal', '--state', stFile, '--shadow-dir', dirS, '--out-dir', out1, '--quiet', '--mode', 'paper'], { client: stub, nowSec: nowS }));
  const j1 = JSON.parse(fs.readFileSync(path.join(out1, fs.readdirSync(out1).find((f) => f.endsWith('.json'))), 'utf8'));
  ok(c1 === 0 && j1.source === 'state' && j1.match === true && j1.cannot_check.length === 8, `CLI --no-journal --state ... --shadow-dir ...: exit 0, report.source = ${j1.source}, ${j1.cannot_check.length} things it cannot check`);
  const c2 = await silent(() => cmp.main(['node', 'x', '--journal', path.join(TMP, 'does-not-exist.jsonl'), '--state', stFile, '--shadow-dir', dirS, '--out-dir', out2, '--quiet', '--mode', 'paper'], { client: stub, nowSec: nowS }));
  const j2 = JSON.parse(fs.readFileSync(path.join(out2, fs.readdirSync(out2).find((f) => f.endsWith('.json'))), 'utf8'));
  ok(c2 === 0 && j2.source === 'state', 'CLI: no journal file at all -> it falls back to the state file by itself (exit 0)');
  const jf = path.join(TMP, 'trades.jsonl'); fs.writeFileSync(jf, ev.map((e) => JSON.stringify(e)).join('\n') + '\n');
  const c3 = await silent(() => cmp.main(['node', 'x', '--journal', jf, '--shadow-dir', dirS, '--out-dir', out3, '--quiet', '--mode', 'paper'], { client: stub, nowSec: nowS }));
  const j3 = JSON.parse(fs.readFileSync(path.join(out3, fs.readdirSync(out3).find((f) => f.endsWith('.json'))), 'utf8'));
  ok(c3 === 0 && j3.source === 'journal' && j3.recorder_join.available && j3.cannot_check.length === 0, 'CLI with a journal: unchanged behaviour (source journal, recorder joined, exit 0)');
  const c4 = await silent(() => cmp.main(['node', 'x', '--journal', path.join(TMP, 'nope.jsonl'), '--state', path.join(TMP, 'nope.json'), '--out-dir', path.join(TMP, 'out4'), '--quiet'], { client: stub, nowSec: nowS }));
  ok(c4 === 2, 'CLI: neither a journal nor a state file -> exit 2 with a clear message, nothing invented');

  // ============================================================ 7. killing the recorder has no effect on the bot
  const botRun = () => new Promise((resolve) => {   // asynchronous on purpose: a blocking spawn would also block the timer that kills the recorder
    const dir = fs.mkdtempSync(path.join(TMP, 'bot-')); let out = '';
    const c = cp.spawn(process.execPath, [path.join(ROOT, 'lucidio.js'), 'replay', 'SOL'], { cwd: ROOT, env: { ...process.env, LUCIDIO_STATE_DIR: dir, LUCIDIO_JOURNAL_DIR: path.join(dir, 'journal'), LUCIDIO_NO_NOTIFY: '1' } });
    c.stdout.on('data', (d) => { out += d; }); c.stderr.on('data', (d) => { out += d; });
    c.on('exit', (code) => resolve({ dir, out, code, tree: listTree(dir) }));
  });
  const control = await botRun();
  const SDIR = path.join(TMP, 'live-shadow'); fs.mkdirSync(SDIR, { recursive: true });
  const boot = `const R=require(${JSON.stringify(REC_FILE)}); R.__setTransport(async()=>({success:true,data:Date.now(),serverTime:Date.now()})); R.loop();`;
  const rec1 = cp.spawn(process.execPath, ['-e', boot], { env: { ...process.env, SHADOW_DIR: SDIR }, stdio: 'ignore' });
  for (let k = 0; k < 100 && !fs.existsSync(path.join(SDIR, 'recorder.pid')); k++) await new Promise((r) => setTimeout(r, 100));
  const alive = fs.existsSync(path.join(SDIR, 'recorder.pid'));
  const botPromise = botRun();
  setTimeout(() => { try { rec1.kill('SIGKILL'); } catch {} }, 300);
  const withKill = await botPromise;
  await new Promise((r) => setTimeout(r, 200));
  ok(alive && control.code === 0 && withKill.code === 0, `the bot's deterministic paper run exits 0 with and without a recorder process that is SIGKILLed mid-run (recorder had started: ${alive})`);
  ok(control.out === withKill.out && control.out.length > 100, `the bot's output is identical with and without the recorder (${control.out.length} characters)`);
  ok(JSON.stringify(control.tree) === JSON.stringify(withKill.tree), `the bot's own folder holds exactly the same files either way (${control.tree.length} files) and nothing of the recorder's (${listTree(SDIR).join(', ')} lives elsewhere)`);
  // a killed recorder leaves a stale pid file: a new one starts anyway, and a normal stop is recorded
  const rec2 = cp.spawn(process.execPath, ['-e', boot], { env: { ...process.env, SHADOW_DIR: SDIR }, stdio: 'ignore' });
  for (let k = 0; k < 100; k++) { try { if (JSON.parse(fs.readFileSync(path.join(SDIR, 'recorder.pid'), 'utf8')).pid === rec2.pid) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  let pid2 = null; try { pid2 = JSON.parse(fs.readFileSync(path.join(SDIR, 'recorder.pid'), 'utf8')).pid; } catch {}
  rec2.kill('SIGTERM'); await new Promise((r) => rec2.on('exit', r)); await new Promise((r) => setTimeout(r, 200));
  let stj = {}; try { stj = JSON.parse(fs.readFileSync(path.join(SDIR, 'status.json'), 'utf8')); } catch {}
  ok(pid2 === rec2.pid && (stj.stopped === true || process.platform === 'win32'), `after a SIGKILL a fresh recorder starts over the stale pid file${process.platform === 'win32' ? ' (SIGTERM is not delivered as a signal on Windows: the stop record is only asserted on Linux)' : ' and a SIGTERM is recorded as a clean stop'}`);

  // ============================================================ 8. the recorder's own selfcheck, and the deployment files
  const sc2 = cp.spawnSync(process.execPath, [REC_FILE, 'selfcheck'], { encoding: 'utf8', timeout: 120000 }); ok(sc2.status === 0 && /\d+ passed, 0 failed/.test(sc2.stdout), 'node sidecar/shadow-recorder.js selfcheck: ' + (sc2.stdout.trim().split('\n').pop() || sc2.stderr));
  const svc = fs.readFileSync(path.join(ROOT, 'deploy', 'lucidio-shadow.service'), 'utf8'), inst = fs.readFileSync(path.join(ROOT, 'deploy', 'install-shadow.sh'), 'utf8'), setup = fs.readFileSync(path.join(ROOT, 'deploy', 'setup-vps.sh'), 'utf8'), pkg = fs.readFileSync(path.join(ROOT, 'deploy', 'package.sh'), 'utf8');
  const svcLines = svc.split('\n').filter((l) => !l.trim().startsWith('#'));
  ok(/^User=lucidio-shadow$/m.test(svc) && /^Restart=always$/m.test(svc) && /^ProtectSystem=strict$/m.test(svc) && /^ReadWritePaths=\/var\/lib\/lucidio-shadow$/m.test(svc) && /^InaccessiblePaths=.*\/opt\/lucidio\b/m.test(svc) && /^NoNewPrivileges=true$/m.test(svc) && /SHADOW_MAX_MB=/.test(svc), 'service unit: own user, restarts itself, read-only system, writes only its data folder, the bot folder is inaccessible, disk cap set');
  ok(!svcLines.some((l) => /^(Requires|BindsTo|PartOf|Wants|After|Before|OnFailure|Conflicts)=.*\blucidio(\.service)?\b(?!-)/.test(l)) && !svcLines.some((l) => /EnvironmentFile|mexc-keys|\.env/.test(l)), "service unit: no dependency on, ordering with or failure hook into the bot's service, and no environment or key file");
  const instCode = inst.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  ok(!/systemctl\s+(stop|start|restart|reload|disable|enable|kill|mask|try-restart)\b[^\n]*\blucidio\b(?!-)/.test(instCode.replace(/lucidio-shadow/g, 'SHADOWSVC')) && !/(install|cp|mv|rm|chown|chmod|tee|ln|mkdir|touch)\s[^\n]*"?\$APP\b/.test(instCode) && !/>\s*"?\$APP/.test(instCode), "the installer never stops, starts or restarts the bot's service and never writes under the bot's folder (it only reads lucidio-core.js to compare hashes)");
  const iShadow = setup.indexOf('SHADOW_ONLY" = 1'), iFirstSystemctl = setup.indexOf('systemctl'), iStep0 = setup.indexOf('step "0. OS"');
  ok(iShadow > 0 && iShadow < iStep0 && iShadow < iFirstSystemctl && /exec bash "\$SRC\/deploy\/install-shadow\.sh"/.test(setup), 'setup-vps.sh --shadow-only hands over to the installer before any other step: nothing of the bot is touched');
  ok(/matchkey\.js shadow-reader\.js/.test(pkg) && /FILES\+=\(deploy sidecar\)/.test(pkg) && /sidecar\/shadow-recorder\.js/.test(pkg), 'package.sh puts matchkey.js, shadow-reader.js and sidecar/ in the bundle');
  const bash = ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find((p) => fs.existsSync(p)) || 'bash';
  const sh = (args, env = {}) => cp.spawnSync(bash, args, { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 60000 });
  const hasBash = !sh(['-c', 'echo ok']).error;
  if (hasBash) {
    const pf = path.join(ROOT, 'deploy', 'preflight-upgrade.sh').replace(/\\/g, '/'), mkApp = (state, coreSame = true) => { const app = path.join(TMP, 'pf-app-' + Math.random().toString(36).slice(2)), nw = app + '-new'; for (const d of [app, nw]) fs.mkdirSync(d, { recursive: true }); fs.mkdirSync(path.join(app, 'state'));
      fs.writeFileSync(path.join(app, 'bot-config.json'), '{"mode":"paper"}'); fs.writeFileSync(path.join(app, 'state', 'state.json'), JSON.stringify(state)); fs.copyFileSync(path.join(ROOT, 'lucidio-core.js'), path.join(app, 'lucidio-core.js'));
      for (const f of ['lucidio.js', 'journal.js']) fs.writeFileSync(path.join(nw, f), '//'); fs.writeFileSync(path.join(nw, 'lucidio-core.js'), fs.readFileSync(path.join(ROOT, 'lucidio-core.js'), 'utf8') + (coreSame ? '' : '\n// changed\n')); return { app: app.replace(/\\/g, '/'), nw: nw.replace(/\\/g, '/') }; };
    const flat = { coins: { SOL: { pos: null }, ZEC: { pos: null } }, mode: 'paper', lastRun: { ts: new Date().toISOString() } };
    const SAFE = String(1700000000 - (1700000000 % 14400) + 3600), CLOSE = String(1700000000 - (1700000000 % 14400) + 60);   // 1 h after a close / 1 min after a close
    const run = (m, env) => sh([pf, '--app', m.app, '--bundle', m.nw], env);
    let r = run(mkApp(flat), { PREFLIGHT_NOW: SAFE }); ok(r.status === 0 && /GO: nothing in the way/.test(r.stdout) && /IDENTICAL/.test(r.stdout), 'preflight: flat, safe time of day, same engine file -> GO');
    r = run(mkApp({ ...flat, coins: { SOL: { pos: { dir: 1, t0: 1700000000 } }, ZEC: { pos: null } } }), { PREFLIGHT_NOW: SAFE }); ok(r.status === 1 && /SOL has an OPEN LONG/.test(r.stdout), 'preflight: an open position -> NO-GO that names it');
    r = run(mkApp(flat), { PREFLIGHT_NOW: CLOSE }); ok(r.status === 1 && /a candle closed 1 min ago/.test(r.stdout), 'preflight: 1 minute after a candle close -> NO-GO (wait 12 minutes)');
    r = run(mkApp(flat, false), { PREFLIGHT_NOW: SAFE }); ok(r.status === 1 && /lucidio-core\.js DIFFERS/.test(r.stdout), 'preflight: a different decision engine file in the new bundle -> NO-GO');
    r = run(mkApp({ ...flat, coins: { SOL: { pos: null, pending: { oid: '1' } }, ZEC: { pos: null } } }), { PREFLIGHT_NOW: SAFE }); ok(r.status === 1 && /UNFINISHED ORDER/.test(r.stdout), 'preflight: an unfinished order -> NO-GO');
    ok(sh(['-n', pf]).status === 0 && sh(['-n', path.join(ROOT, 'deploy', 'install-shadow.sh').replace(/\\/g, '/')]).status === 0 && sh(['-n', path.join(ROOT, 'deploy', 'package-shadow.sh').replace(/\\/g, '/')]).status === 0 && sh(['-n', path.join(ROOT, 'deploy', 'setup-vps.sh').replace(/\\/g, '/')]).status === 0, 'every shell script parses (bash -n)');
  } else console.log('SKIP  preflight tests: no bash available on this machine');

  console.log(`\n${pass} passed, ${failN} failed`);
  process.exit(failN ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
