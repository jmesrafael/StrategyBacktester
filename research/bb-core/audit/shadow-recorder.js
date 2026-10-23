// shadow-recorder.js — READ-ONLY shadow recorder for the paper-trading parity test (AUDIT-REPORT section 8).
//   node audit/shadow-recorder.js loop                 record every 4h close: snapshot at t+2 s, again at t+5 min, 1m candles of the finished period
//   node audit/shadow-recorder.js once [--wait]        one snapshot of the newest closed candle now (labelled with its lag); --wait also takes the t+5min one
//   node audit/shadow-recorder.js reconcile [--min-age-hours 24]   compare the records with FINAL candles re-downloaded later (revisions, indicator and signal parity)
//   node audit/shadow-recorder.js selfcheck            offline tests: read-only guard, order-book maths, record shape, decision == backtest()
//
// It places NO orders and cannot: no API keys are read, mexc.js is not imported, and the only network function (httpGet) refuses anything that is not an https GET
// to contract.mexc.com / fapi.binance.com or whose path looks private (private, order, account, position, stoporder, asset). `selfcheck` proves that.
//
// Output (shadow/, gitignored; override with SHADOW_DIR). records.jsonl has one line per event, field "kind":
//   candle    raw closed-candle OHLCV from MEXC and Binance at t+2s ("t2s") and t+5min ("t5m"), server times, request latency, wake lag, polls until the new candle existed
//   decision  per venue: BB upper/mid/lower, SMA200, ATR14, signal (LONG/SHORT/none), stop, target, skip reasons (warm-up / band / trend / ATR filter / gap)
//   book      MEXC best bid/ask, spread, depth within +/-0.05% and +/-0.1%, simulated market-order slippage for several notionals, Binance best bid/ask
//   fill      only if the bot would enter: bot-style paper fill (price now +slip), backtest fill (forming-candle open +slip), order-book walk for the real notional
//   fees      contract fee rates (public), current funding rate and next settlement (settlements themselves are fetched in reconcile)
// and m1/<COIN>-<periodStart>.json holds the 1-minute candles (both venues) of the finished 4h period, so stop/target touches can be replayed exactly.
'use strict';
const fs = require('fs'), path = require('path');
const { signalFrom, gapInWindow, DEFAULTS } = require('../../../🔴BB-Core/lucidio-core.js');

const IV = 14400, S = DEFAULTS, SLIP = DEFAULTS.cost.slip, COINS = (process.env.SHADOW_COINS || 'SOL,ZEC').split(',');
let OUT = process.env.SHADOW_DIR || path.join(__dirname, '..', '..', '..', '🔴BB-Core', 'shadow');
const MEXC = 'https://contract.mexc.com', BIN = 'https://fapi.binance.com';
const HOSTS = new Set(['contract.mexc.com', 'fapi.binance.com']);
const NOTIONALS = (process.env.SHADOW_NOTIONALS || '100,1000,10000,50000').split(',').map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (t) => new Date(t * 1000).toISOString().replace('T', ' ').slice(0, 19) + 'Z';

// ------------------------------------------------------------------ the one and only network function
let transport = null; // tests replace this; production uses fetch
async function httpGet(url, timeoutMs = 10000) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !HOSTS.has(u.hostname) || /private|order|account|position|stoporder|asset|trade/i.test(u.pathname)) throw new Error('shadow-recorder is read-only: refused ' + url);
  const t0 = Date.now();
  if (transport) { const json = await transport(url); return { json, ms: Date.now() - t0, at: Date.now() }; }
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctl.signal, headers: { Accept: 'application/json' } });
    const text = await res.text();
    return { json: JSON.parse(text), ms: Date.now() - t0, at: Date.now(), status: res.status };
  } finally { clearTimeout(timer); }
}
async function retry(fn, tries = 3) { let e; for (let k = 0; k < tries; k++) { try { return await fn(); } catch (err) { e = err; if (/read-only/.test(err.message)) throw err; await sleep(700 * (k + 1)); } } throw e; }

// ------------------------------------------------------------------ venue adaptors (public GETs)
const mexc = {
  async ping() { const r = await httpGet(MEXC + '/api/v1/contract/ping'); return { serverMs: r.json.data, rttMs: r.ms, localMs: r.at - r.ms / 2 }; },
  async klines(coin, interval, start, end) {
    const r = await httpGet(`${MEXC}/api/v1/contract/kline/${coin}_USDT?interval=${interval}&start=${start}&end=${end}`), d = r.json.data;
    return { ms: r.ms, rows: d.time.map((t, i) => ({ time: t, open: +d.open[i], high: +d.high[i], low: +d.low[i], close: +d.close[i], vol: +d.vol[i] })) };
  },
  async ticker(coin) { return (await httpGet(`${MEXC}/api/v1/contract/ticker?symbol=${coin}_USDT`)).json.data; },
  async depth(coin) { const r = await httpGet(`${MEXC}/api/v1/contract/depth/${coin}_USDT?limit=50`); return { ...r.json.data, ms: r.ms }; },
  async detail(coin) { return (await httpGet(`${MEXC}/api/v1/contract/detail?symbol=${coin}_USDT`)).json.data; },
  async funding(coin) { return (await httpGet(`${MEXC}/api/v1/contract/funding_rate/${coin}_USDT`)).json.data; },
  async fundingHistory(coin, n = 30) { return (await httpGet(`${MEXC}/api/v1/contract/funding_rate/history?symbol=${coin}_USDT&page_num=1&page_size=${n}`)).json.data.resultList; },
};
const binance = {
  async time() { const r = await httpGet(BIN + '/fapi/v1/time'); return { serverMs: r.json.serverTime, rttMs: r.ms, localMs: r.at - r.ms / 2 }; },
  async klines(coin, interval, limit, startMs, endMs) {
    const r = await httpGet(`${BIN}/fapi/v1/klines?symbol=${coin}USDT&interval=${interval}&limit=${limit}` + (startMs ? `&startTime=${startMs}` : '') + (endMs ? `&endTime=${endMs}` : ''));
    if (!Array.isArray(r.json)) throw new Error('binance: ' + JSON.stringify(r.json).slice(0, 120));
    return { ms: r.ms, rows: r.json.map((k) => ({ time: k[0] / 1000, open: +k[1], high: +k[2], low: +k[3], close: +k[4], vol: +k[5], closeMs: k[6] })) };
  },
  async depth(coin) { const r = await httpGet(`${BIN}/fapi/v1/depth?symbol=${coin}USDT&limit=50`); return { ...r.json, ms: r.ms }; },
};

// ------------------------------------------------------------------ decision (the same rules as the bot: shared signalFrom + the bot's ATR + the C3 gap rule)
function atrSeries(B) {
  const n = B.length, atr = new Array(n).fill(null); let a = null;
  const tr = (i) => (i === 0 ? B[0].high - B[0].low : Math.max(B[i].high - B[i].low, Math.abs(B[i].high - B[i - 1].close), Math.abs(B[i].low - B[i - 1].close)));
  for (let i = 0; i < n; i++) {
    if (i === 13) { let s = 0; for (let j = 0; j < 14; j++) s += tr(j); a = s / 14; } else if (i > 13) a = (a * 13 + tr(i)) / 14;
    atr[i] = a;
  }
  return atr;
}
// Bclosed = closed candles only, oldest first. Returns the full decision record for the newest closed candle.
function decide(Bclosed) {
  const n = Bclosed.length, i = n - 1, out = { n, candle: n ? Bclosed[i].time : null, reasons: [], signal: 'none' };
  if (n < S.warmup) { out.reasons.push(`warm-up: ${n} candles < ${S.warmup}`); return out; }
  const closes = Bclosed.map((b) => b.close), atr = atrSeries(Bclosed)[i], c = closes[i];
  const w = closes.slice(-S.bbLen), mid = w.reduce((a, b) => a + b, 0) / S.bbLen, sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / S.bbLen);
  const sma = closes.slice(-S.trendLen).reduce((a, b) => a + b, 0) / S.trendLen, up = mid + S.bbMult * sd, lo = mid - S.bbMult * sd, dist = Math.abs(c - mid);
  Object.assign(out, { close: c, upper: up, mid, lower: lo, sma200: sma, atr14: atr, stopDistPct: 100 * dist / c, stopDistAtr: dist / atr });
  const gap = S.gapSkip && gapInWindow(Bclosed, i, Math.max(S.bbLen, S.trendLen), IV);
  const sig = signalFrom(closes.slice(Math.max(0, i - 399), i + 1), atr, S);
  if (gap) out.reasons.push('gap in the last 200 candles (C3): no signal');
  if (!sig || gap) {
    if (!(c > up || c < lo)) out.reasons.push(`close inside the bands (${(100 * (c > mid ? (up - c) : (c - lo)) / c).toFixed(3)}% from the nearest band)`);
    else if (c > up ? c < sma : c > sma) out.reasons.push(`trend filter: close ${c > up ? 'below' : 'above'} SMA200`);
    else if (dist < S.minStopAtr * atr) out.reasons.push(`stop-too-tight filter: ${out.stopDistAtr.toFixed(2)} ATR < ${S.minStopAtr}`);
    return out;
  }
  out.signal = sig.dir === 1 ? 'LONG' : 'SHORT'; Object.assign(out, { dir: sig.dir, stop: sig.stop, target: sig.tp });
  return out;
}

// ------------------------------------------------------------------ order book maths
// levels: [[price, contracts, orders]...] best first; contractSize converts contracts to coins (MEXC), Binance levels are already in coins (contractSize 1)
function bookStats(bids, asks, contractSize, notionals) {
  const b = bids.map((l) => ({ p: +l[0], usd: +l[0] * +l[1] * contractSize })), a = asks.map((l) => ({ p: +l[0], usd: +l[0] * +l[1] * contractSize }));
  if (!b.length || !a.length) return { error: 'empty book' };
  const mid = (b[0].p + a[0].p) / 2, within = (pct) => ({ bidUsd: b.filter((x) => x.p >= mid * (1 - pct)).reduce((s, x) => s + x.usd, 0), askUsd: a.filter((x) => x.p <= mid * (1 + pct)).reduce((s, x) => s + x.usd, 0) });
  const walk = (lv, usdWanted, sign) => { // sign +1 = buy (walk asks up), -1 = sell (walk bids down); slippage vs mid in bp
    let left = usdWanted, cost = 0, qty = 0;
    for (const x of lv) { const take = Math.min(left, x.usd); cost += take; qty += take / x.p; left -= take; if (left <= 1e-9) break; }
    if (left > 1e-9) return { filled: false, filledUsd: usdWanted - left, note: `book (${lv.length} levels) too thin` };
    const avg = cost / qty; return { filled: true, avg, slipBp: sign * (avg / mid - 1) * 1e4 };
  };
  return { bid: b[0].p, ask: a[0].p, mid, spreadBp: (a[0].p / b[0].p - 1) * 1e4, levels: Math.min(b.length, a.length),
    depth05: within(0.0005), depth10: within(0.001), market: notionals.map((n) => ({ notionalUsd: n, buy: walk(a, n, 1), sell: walk(b, n, -1) })), walk: (usd, dir) => (dir === 1 ? walk(a, usd, 1) : walk(b, usd, -1)) };
}

// ------------------------------------------------------------------ recording
const append = (rec) => { fs.mkdirSync(OUT, { recursive: true }); fs.appendFileSync(path.join(OUT, 'records.jsonl'), JSON.stringify(rec) + '\n'); };
const closedOnly = (rows, nowSec) => rows.filter((b) => b.time + IV <= nowSec);
let clock = { mexcOffsetMs: 0, binOffsetMs: 0 }; // server minus local
const nowMs = () => Date.now() + clock.mexcOffsetMs, nowSec = () => nowMs() / 1000;
async function syncClocks() {
  const [m, b] = await Promise.all([retry(() => mexc.ping()), retry(() => binance.time())]);
  clock = { mexcOffsetMs: m.serverMs - m.localMs, binOffsetMs: b.serverMs - b.localMs, mexcRttMs: m.rttMs, binRttMs: b.rttMs };
  return clock;
}
// kind: 't2s' | 't5m' | 'late' (adhoc). closeT = close time (= open of the new candle) of the candle being recorded.
async function snapshot(coin, kind, closeT, o = {}) {
  const tStart = nowMs(), rec = { ts: new Date().toISOString(), kind: 'candle', snap: kind, coin, candle: closeT - IV, closeT, wakeLagSec: +(tStart / 1000 - closeT).toFixed(3), mexcServerMs: Math.round(tStart), binOffsetMs: Math.round(clock.binOffsetMs), mexcRttMs: clock.mexcRttMs, binRttMs: clock.binRttMs };
  // 1) candles from both venues; poll until the NEW candle (time == closeT) exists on MEXC (the bot's C4 behaviour), at most maxWait seconds
  let m, polls = 0;
  for (;;) {
    polls++;
    m = await retry(() => mexc.klines(coin, 'Hour4', Math.floor(nowSec()) - 500 * IV, Math.floor(nowSec())));
    if (m.rows.some((b) => b.time >= closeT) || nowSec() - closeT > (o.maxWaitSec ?? 30)) break;
    await sleep(o.pollMs ?? 1000);
  }
  const bn = await retry(() => binance.klines(coin, '4h', 500));
  const mClosed = closedOnly(m.rows, nowSec()), bClosed = bn.rows.filter((b) => b.closeMs < Date.now() + clock.binOffsetMs);
  const pick = (rows) => rows.find((b) => b.time === closeT - IV) || null, mc = pick(mClosed), bc = pick(bClosed);
  const formingM = m.rows.find((b) => b.time === closeT) || null;
  Object.assign(rec, { polls, mexcFetchMs: m.ms, binFetchMs: bn.ms, newCandleOnMexc: !!formingM, mexc: mc, binance: bc ? { ...bc, closeMs: undefined } : null, mexcForming: formingM, nMexc: mClosed.length, nBinance: bClosed.length });
  append(rec);
  // 2) decisions for both venues
  const dM = decide(mClosed.filter((b) => b.time <= closeT - IV)), dB = decide(bClosed.filter((b) => b.time <= closeT - IV));
  append({ ts: new Date().toISOString(), kind: 'decision', snap: kind, coin, candle: closeT - IV, wakeLagSec: rec.wakeLagSec, mexc: dM, binance: dB, agree: dM.signal === dB.signal });
  // 3) order book + ticker + fees (MEXC), Binance top of book
  const [det, tk, dp, fd, bd] = await Promise.all([retry(() => mexc.detail(coin)), retry(() => mexc.ticker(coin)), retry(() => mexc.depth(coin)), retry(() => mexc.funding(coin)), retry(() => binance.depth(coin))]);
  const cs = +det.contractSize, book = bookStats(dp.bids, dp.asks, cs, NOTIONALS), bbook = bookStats(bd.bids, bd.asks, 1, NOTIONALS);
  const strip = (b) => { const { walk, ...rest } = b; return rest; };
  append({ ts: new Date().toISOString(), kind: 'book', snap: kind, coin, candle: closeT - IV, mexc: strip(book), mexcBookMs: dp.ms, mexcTicker: { last: tk.lastPrice, bid1: tk.bid1, ask1: tk.ask1, fair: tk.fairPrice, index: tk.indexPrice }, binance: strip(bbook), binBookMs: bd.ms });
  append({ ts: new Date().toISOString(), kind: 'fees', snap: kind, coin, candle: closeT - IV, takerFeeRate: det.takerFeeRate, makerFeeRate: det.makerFeeRate, contractSize: cs, fundingRate: fd.fundingRate, nextSettleTime: fd.nextSettleTime, collectCycleH: fd.collectCycle,
    note: 'public contract defaults; the account fee tier is private and is NOT read here' });
  // 4) would the bot enter? three fills side by side
  if (kind !== 't5m' && dM.signal !== 'none') {
    const d = dM.dir, riskUsd = o.riskUsd ?? 1, entryRef = tk.lastPrice, distFrac = Math.abs(entryRef - dM.stop) / entryRef, notional = riskUsd / distFrac;
    const botFill = tk.lastPrice * (1 + d * SLIP), btFill = formingM ? formingM.open * (1 + d * SLIP) : null, w = book.walk(notional, d);
    const toR = (px) => (px == null ? null : +(d * (px - btFill) / Math.abs(btFill - dM.stop)).toFixed(4));
    append({ ts: new Date().toISOString(), kind: 'fill', snap: kind, coin, candle: closeT - IV, dir: d, stop: dM.stop, target: dM.target, riskUsd, notionalUsd: +notional.toFixed(2), wakeLagSec: rec.wakeLagSec,
      botPaperFill: botFill, backtestFill: btFill, bookWalkFill: w.filled ? w.avg : null, bookWalk: w, bestBid: book.bid, bestAsk: book.ask,
      botMinusBacktestR: btFill == null ? null : toR(botFill), bookMinusBacktestR: btFill == null || !w.filled ? null : toR(w.avg) });
  }
  return rec;
}
// the 4h period that just ended, minute by minute, both venues (replay of stop/target touches; MEXC only keeps ~30 days of 1m)
async function collectMinutes(coin, periodStart) {
  const endSec = periodStart + IV, m = await retry(() => mexc.klines(coin, 'Min1', periodStart, endSec - 1)), b = await retry(() => binance.klines(coin, '1m', 1000, periodStart * 1000, endSec * 1000 - 1));
  const bm = new Map(b.rows.map((r) => [r.time, [r.time, r.open, r.high, r.low, r.close]]));
  fs.mkdirSync(path.join(OUT, 'm1'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'm1', `${coin}-${periodStart}.json`), JSON.stringify({ coin, periodStart, mexc: m.rows.filter((r) => r.time >= periodStart && r.time < endSec).map((r) => [r.time, r.open, r.high, r.low, r.close]), binance: [...bm.values()].sort((x, y) => x[0] - y[0]) }));
  return { mexc: m.rows.length, binance: bm.size };
}

async function cycle(closeT, label) { // all coins at t+2s together, then 1m candles, wait, t+5min
  await Promise.all(COINS.map((c) => snapshot(c, label, closeT).catch((e) => append({ ts: new Date().toISOString(), kind: 'error', coin: c, snap: label, candle: closeT - IV, msg: e.message }))));
}
async function loop() {
  const lock = path.join(OUT, 'recorder.pid'); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
  console.log(`shadow recorder: READ-ONLY, coins ${COINS}, output ${OUT}`);
  for (;;) {
    await syncClocks().catch((e) => console.log('clock sync failed: ' + e.message));
    const closeT = (Math.floor(nowSec() / IV) + 1) * IV;
    while (nowSec() < closeT + 2) await sleep(Math.min(5000, Math.max(20, (closeT + 2 - nowSec()) * 1000)));
    await cycle(closeT, 't2s'); console.log(`${iso(closeT)} t+2s recorded`);
    await Promise.all(COINS.map((c) => collectMinutes(c, closeT - IV).catch((e) => append({ ts: new Date().toISOString(), kind: 'error', coin: c, msg: 'm1: ' + e.message }))));
    while (nowSec() < closeT + 300) await sleep(Math.min(5000, Math.max(20, (closeT + 300 - nowSec()) * 1000)));
    await cycle(closeT, 't5m'); console.log(`${iso(closeT)} t+5min recorded`);
  }
}
async function once(wait) {
  await syncClocks();
  const closeT = Math.floor(nowSec() / IV) * IV, lag = nowSec() - closeT, label = lag <= 30 ? 't2s' : 'late';
  console.log(`candle ${iso(closeT - IV)} closed ${lag.toFixed(0)} s ago -> snapshot labelled "${label}"`);
  await cycle(closeT, label); const mm = await Promise.all(COINS.map((c) => collectMinutes(c, closeT - IV)));
  console.log('1m candles stored', JSON.stringify(mm));
  if (wait) { while (nowSec() < closeT + 300) await sleep(1000); await cycle(closeT, 't5m'); }
  summary();
}
function summary() {
  const f = path.join(OUT, 'records.jsonl'); if (!fs.existsSync(f)) return console.log('no records');
  const rs = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)), by = {}; rs.forEach((r) => (by[r.kind] = (by[r.kind] || 0) + 1));
  console.log('records.jsonl:', JSON.stringify(by));
  for (const r of rs.slice(-40)) if (r.kind === 'decision') console.log(`  decision ${r.coin} candle ${iso(r.candle)} [${r.snap}] MEXC ${r.mexc.signal}${r.mexc.reasons.length ? ' (' + r.mexc.reasons[0] + ')' : ''} | Binance ${r.binance.signal} | agree ${r.agree} | ATR ${r.mexc.atr14 && r.mexc.atr14.toPrecision(5)}`);
  for (const r of rs.slice(-40)) if (r.kind === 'book') console.log(`  book ${r.coin} [${r.snap}] MEXC bid ${r.mexc.bid} ask ${r.mexc.ask} spread ${r.mexc.spreadBp.toFixed(2)} bp, depth +/-0.1% $${Math.round(r.mexc.depth10.askUsd)} ask / $${Math.round(r.mexc.depth10.bidUsd)} bid; market buy slippage ${r.mexc.market.map((m) => '$' + m.notionalUsd + ': ' + (m.buy.filled ? m.buy.slipBp.toFixed(2) + 'bp' : 'thin')).join(', ')}`);
  for (const r of rs.slice(-40)) if (r.kind === 'fees') console.log(`  fees ${r.coin} taker ${r.takerFeeRate} maker ${r.makerFeeRate} funding ${r.fundingRate} next ${iso(r.nextSettleTime / 1000)}`);
  for (const r of rs.slice(-40)) if (r.kind === 'fill') console.log(`  FILL ${r.coin} ${r.dir > 0 ? 'LONG' : 'SHORT'} bot ${r.botPaperFill} backtest ${r.backtestFill} book ${r.bookWalkFill} (bot-bt ${r.botMinusBacktestR}R, book-bt ${r.bookMinusBacktestR}R)`);
}

// ------------------------------------------------------------------ reconcile: records vs FINAL candles fetched later
async function reconcile(minAgeH) {
  const f = path.join(OUT, 'records.jsonl'); if (!fs.existsSync(f)) return console.log('no records in ' + OUT);
  await syncClocks();
  const rs = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)), cut = nowSec() - minAgeH * 3600;
  const keys = [...new Set(rs.filter((r) => r.kind === 'candle' && r.closeT <= cut).map((r) => r.coin + ':' + r.candle))];
  if (!keys.length) return console.log(`no recorded candle is older than ${minAgeH} h yet`);
  const stat = { n: 0, revM: 0, revB: 0, maxRelM: 0, maxRelB: 0, t2s5m: 0, indErr: 0, maxInd: 0, sigDiff: 0, venueDiff: 0, noNew: 0, late: 0, lags: [], agg: 0, aggBad: 0 }, detail = [];
  for (const k of keys) {
    const [coin, candleS] = k.split(':'), candle = +candleS, mine = rs.filter((r) => r.coin === coin && r.candle === candle);
    const mf = (await retry(() => mexc.klines(coin, 'Hour4', candle - 450 * IV, candle + IV - 1))).rows, bf = (await retry(() => binance.klines(coin, '4h', 500, null, (candle + IV) * 1000 - 1))).rows.map((r) => ({ ...r, closeMs: undefined }));
    const fm = mf.find((b) => b.time === candle), fb = bf.find((b) => b.time === candle), snaps = mine.filter((r) => r.kind === 'candle');
    const rel = (a, b) => (a && b ? Math.max(...['open', 'high', 'low', 'close'].map((x) => Math.abs(a[x] / b[x] - 1))) : NaN);
    stat.n++; if (snaps.some((s) => !s.newCandleOnMexc)) stat.noNew++;
    for (const s of snaps) { if (s.snap === 't2s') stat.lags.push(s.wakeLagSec); if (s.snap === 'late') stat.late++; const rm = rel(s.mexc, fm), rb = rel(s.binance, fb); if (rm > 0) { stat.revM++; stat.maxRelM = Math.max(stat.maxRelM, rm); detail.push(`${coin} ${iso(candle)} [${s.snap}] MEXC recorded vs final differs by ${(rm * 100).toFixed(4)}%`); } if (rb > 0) { stat.revB++; stat.maxRelB = Math.max(stat.maxRelB, rb); detail.push(`${coin} ${iso(candle)} [${s.snap}] Binance recorded vs final differs by ${(rb * 100).toFixed(4)}%`); } }
    const a = snaps.find((s) => s.snap === 't2s' || s.snap === 'late'), b5 = snaps.find((s) => s.snap === 't5m'); if (a && b5 && rel(a.mexc, b5.mexc) > 0) { stat.t2s5m++; detail.push(`${coin} ${iso(candle)} MEXC t+2s vs t+5min differ by ${(rel(a.mexc, b5.mexc) * 100).toFixed(4)}%`); }
    const ref = decide(mf.filter((x) => x.time <= candle)), recd = mine.find((r) => r.kind === 'decision' && (r.snap === 't2s' || r.snap === 'late'));
    if (recd) {
      for (const key of ['upper', 'mid', 'lower', 'sma200', 'atr14']) if (recd.mexc[key] != null && ref[key] != null) { const e = Math.abs(recd.mexc[key] / ref[key] - 1); stat.maxInd = Math.max(stat.maxInd, e); if (e > 1e-6) stat.indErr++; }
      if (recd.mexc.signal !== ref.signal || (ref.signal !== 'none' && (Math.abs(recd.mexc.stop / ref.stop - 1) > 1e-9 || Math.abs(recd.mexc.target / ref.target - 1) > 1e-9))) { stat.sigDiff++; detail.push(`${coin} ${iso(candle)} signal recorded ${recd.mexc.signal} vs reference ${ref.signal}`); }
      if (!recd.agree) { stat.venueDiff++; detail.push(`${coin} ${iso(candle)} venues disagreed at the time: MEXC ${recd.mexc.signal}, Binance ${recd.binance.signal}`); }
    }
    const m1f = path.join(OUT, 'm1', `${coin}-${candle}.json`); // 1m aggregated vs final 4h
    if (fs.existsSync(m1f) && fm) { const m1 = JSON.parse(fs.readFileSync(m1f, 'utf8')).mexc; if (m1.length === 240) { stat.agg++; const hi = Math.max(...m1.map((r) => r[2])), lo = Math.min(...m1.map((r) => r[3])); if (Math.abs(hi / fm.high - 1) > 1e-9 || Math.abs(lo / fm.low - 1) > 1e-9 || m1[0][1] !== fm.open || m1[239][4] !== fm.close) { stat.aggBad++; detail.push(`${coin} ${iso(candle)} 1m aggregate != final 4h`); } } }
  }
  const lags = stat.lags.sort((x, y) => x - y), pq = (p) => (lags.length ? lags[Math.min(lags.length - 1, Math.floor(p * lags.length))].toFixed(2) : 'n/a');
  console.log(`RECONCILE ${keys.length} recorded candle(s) older than ${minAgeH} h against final data`);
  console.log(`  feed revision  : MEXC recorded vs final differing snapshots ${stat.revM}, Binance ${stat.revB}; t+2s vs t+5min differing ${stat.t2s5m}  (max rel MEXC ${(stat.maxRelM * 100).toFixed(5)}%, Binance ${(stat.maxRelB * 100).toFixed(5)}%)`);
  console.log(`  new candle absent at snapshot: ${stat.noNew};  late (non-t+2s) snapshots: ${stat.late};  wake lag at t+2s: median ${pq(0.5)} s, p99 ${pq(0.99)} s, max ${pq(1)} s (n=${lags.length})`);
  console.log(`  indicator parity: ${stat.indErr} values with relative error > 1e-6 (max ${stat.maxInd.toExponential(2)});  signal parity vs reference: ${stat.sigDiff} difference(s);  Binance-vs-MEXC signal disagreement at the time: ${stat.venueDiff}`);
  console.log(`  1m aggregate == final 4h: ${stat.agg - stat.aggBad}/${stat.agg}`);
  detail.forEach((d) => console.log('   ! ' + d));
}

// ------------------------------------------------------------------ selfcheck (offline)
async function selfcheck() {
  let pass = 0, fail = 0; const ok = (c, w) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
  // 1) read-only guard
  const src = fs.readFileSync(__filename, 'utf8');
  const bad = ['ApiKey', 'Signature', 'createHmac', "require('../mexc", 'mexc-keys', 'createOrder', 'order/create', 'placeTpSl', "method: 'POST'", "method: 'PUT'", "method: 'DELETE'"].filter((s) => src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.includes('const bad =') && !l.includes('let refused')).join('\n').includes(s));
  ok(bad.length === 0, `source (code lines, comments excluded) contains none of the 11 trading / auth / write tokens listed in this check: API key header, signature, HMAC, mexc.js import, keys file, order creation, TP/SL placement, POST/PUT/DELETE ${bad.length ? 'FOUND ' + bad : ''}`);
  const urls = [...src.matchAll(/\$\{(?:MEXC|BIN)\}([^`'"?]*)|(?:MEXC|BIN) \+ '([^']*)'/g)].map((m) => m[1] || m[2]);
  ok(urls.length > 8 && urls.every((u) => !/private|order|account|position|stoporder|asset|trade/i.test(u)), `all ${urls.length} endpoint paths used are public market-data paths: ${[...new Set(urls)].join(' ')}`);
  let refused = 0; for (const u of ['https://contract.mexc.com/api/v1/private/order/create', 'https://api.mexc.com/api/v1/contract/ping', 'http://contract.mexc.com/api/v1/contract/ping', 'https://fapi.binance.com/fapi/v1/order', 'https://fapi.binance.com/fapi/v2/account']) { try { await httpGet(u); } catch (e) { if (/read-only/.test(e.message)) refused++; } }
  ok(refused === 5, `httpGet refuses private paths, other hosts and plain http (${refused}/5 refused)`);
  // 2) order book maths on a synthetic book
  const bk = bookStats([[99, 100], [98, 100]], [[101, 50], [102, 100]], 1, [1000, 100000]); // asks: 50@101 = $5050, 100@102 = $10200
  ok(Math.abs(bk.mid - 100) < 1e-9 && Math.abs(bk.spreadBp - (101 / 99 - 1) * 1e4) < 1e-9, 'book: mid and spread');
  const w1 = bk.market[0].buy, w2 = bk.walk(7000, 1);
  ok(w1.filled && Math.abs(w1.avg - 101) < 1e-9 && Math.abs(w1.slipBp - 100) < 1e-6, 'book: $1000 market buy fills at the best ask 101 -> 100 bp vs mid');
  ok(w2.filled && w2.avg > 101 && w2.avg < 102 && !bk.market[1].buy.filled, 'book: $7000 walks into the second level; $100000 reports "too thin"');
  // 3) decide() == engine on real history: every backtest trade's signal candle gives the same direction, stop and target; and indicators match an independent formula
  const { backtest } = require('../../../🔴BB-Core/lucidio-core.js'), rd = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '🔴BB-Core', 'data', f + '.json'), 'utf8'));
  for (const name of ['SOL', 'MEXC_ZEC']) {
    const B = rd(name).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })), trades = backtest(B).trades.slice(-60);
    let same = 0; for (const t of trades) { const d = decide(B.slice(0, t.i0)); if (d.dir === t.dir && Math.abs(d.stop / t.stop - 1) < 1e-12 && Math.abs(d.target / t.tp - 1) < 1e-12) same++; }
    ok(same === trades.length, `${name}: decide() reproduces direction, stop and target of the last ${trades.length} backtest trades (${same}/${trades.length})`);
    let worst = 0; for (const i of [300, 700, 1200, 2500, 5000, B.length - 1]) { const d = decide(B.slice(0, i + 1)), w = B.slice(i - 19, i + 1).map((b) => b.close), m = w.reduce((a, b) => a + b) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / 20);
      const sma = B.slice(i - 199, i + 1).reduce((a, b) => a + b.close, 0) / 200; let a = null; const tr = (j) => (j === 0 ? B[0].high - B[0].low : Math.max(B[j].high - B[j].low, Math.abs(B[j].high - B[j - 1].close), Math.abs(B[j].low - B[j - 1].close)));
      for (let j = 0; j <= i; j++) { if (j === 13) { let s = 0; for (let k = 0; k < 14; k++) s += tr(k); a = s / 14; } else if (j > 13) a = (a * 13 + tr(j)) / 14; }
      worst = Math.max(worst, Math.abs(d.upper / (m + 2 * sd) - 1), Math.abs(d.lower / (m - 2 * sd) - 1), Math.abs(d.sma200 / sma - 1), Math.abs(d.atr14 / a - 1), Math.abs(d.mid / m - 1)); }
    ok(worst < 1e-12, `${name}: BB upper/mid/lower, SMA200, ATR14 equal an independent recomputation (max relative error ${worst.toExponential(1)})`);
  }
  // 4) full pipeline with a fake transport: records have the expected shape, a signal produces a fill record, nothing else is requested
  const dir0 = fs.mkdtempSync(path.join(require('os').tmpdir(), 'shadow-'));
  const B = rd('MEXC_SOL').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })), t = backtest(B).trades.slice(-1)[0], cutI = t.i0; // candle cutI-1 is a signal candle; cutI = the new candle
  const closeT = B[cutI].time, seen = [];
  transport = async (url) => {
    seen.push(url); const u = new URL(url);
    if (u.pathname.endsWith('/ping')) return { success: true, data: (closeT + 2) * 1000 };
    if (u.pathname.endsWith('/time')) return { serverTime: (closeT + 2) * 1000 };
    if (u.pathname.includes('/contract/kline/')) { const rows = B.slice(Math.max(0, cutI - 499), cutI + 1); return { success: true, data: { time: rows.map((r) => r.time), open: rows.map((r) => r.open), high: rows.map((r) => r.high), low: rows.map((r) => r.low), close: rows.map((r) => r.close), vol: rows.map(() => 1) } }; }
    if (u.pathname.endsWith('/klines')) { const rows = B.slice(Math.max(0, cutI - 499), cutI + 1); return rows.map((r) => [r.time * 1000, r.open, r.high, r.low, r.close, 1, (r.time + IV) * 1000 - 1]); }
    if (u.pathname.includes('/ticker')) return { success: true, data: { lastPrice: B[cutI].open * 1.0001, bid1: B[cutI].open, ask1: B[cutI].open * 1.0002, fairPrice: B[cutI].open, indexPrice: B[cutI].open } };
    if (u.pathname.includes('/depth')) { const p = B[cutI].open, mk = (s) => Array.from({ length: 20 }, (_, i) => [p * (1 + s * (0.0001 + i * 0.0001)), 5000, 1]); return u.hostname.includes('mexc') ? { success: true, data: { bids: mk(-1), asks: mk(1), timestamp: 1 } } : { bids: mk(-1), asks: mk(1) }; }
    if (u.pathname.includes('/detail')) return { success: true, data: { contractSize: 0.1, takerFeeRate: 0.0001, makerFeeRate: 0 } };
    if (u.pathname.includes('/funding_rate')) return { success: true, data: { fundingRate: 0.0001, nextSettleTime: (closeT + 3600) * 1000, collectCycle: 8 } };
    throw new Error('unexpected url in selfcheck: ' + url);
  };
  clock = { mexcOffsetMs: 0, binOffsetMs: 0 }; const realNow = Date.now; Date.now = () => (closeT + 2) * 1000 + 300; // the recorder believes it is close + 2.3 s
  const savedDir = OUT; OUT = dir0;
  try { await snapshot('SOL', 't2s', closeT, { maxWaitSec: 1, pollMs: 1 }); } finally { OUT = savedDir; Date.now = realNow; transport = null; }
  const recs = fs.readFileSync(path.join(dir0, 'records.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const kinds = recs.map((r) => r.kind).sort().join(',');
  ok(kinds === 'book,candle,decision,fees,fill', `one snapshot with a live signal wrote records: ${kinds}`);
  const dec = recs.find((r) => r.kind === 'decision'), fill = recs.find((r) => r.kind === 'fill'), cd = recs.find((r) => r.kind === 'candle');
  ok(dec.mexc.signal !== 'none' && dec.mexc.dir === t.dir && Math.abs(dec.mexc.stop / t.stop - 1) < 1e-12, `decision record shows the backtest's last trade signal (${dec.mexc.signal}, stop ${dec.mexc.stop})`);
  ok(cd.wakeLagSec > 2 && cd.wakeLagSec < 3 && cd.newCandleOnMexc === true && cd.mexc.time === closeT - IV && cd.polls === 1, `candle record: wake lag ${cd.wakeLagSec}s, new candle present, closed candle ${iso(cd.mexc.time)}`);
  ok(fill.botPaperFill > 0 && fill.backtestFill > 0 && fill.bookWalkFill > 0 && fill.notionalUsd > 0, `fill record has bot paper fill ${fill.botPaperFill.toFixed(4)}, backtest fill ${fill.backtestFill.toFixed(4)}, book-walk fill ${fill.bookWalkFill.toFixed(4)}, notional $${fill.notionalUsd}`);
  ok(seen.every((u) => /^https:\/\/(contract\.mexc\.com|fapi\.binance\.com)\//.test(u)) && seen.length === 7, `snapshot made exactly ${seen.length} requests (MEXC candles, Binance candles, MEXC detail/ticker/depth/funding, Binance depth), all HTTPS GET to the two public hosts`);
  fs.rmSync(dir0, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;
}

const cmd = process.argv[2];
if (require.main === module) {
  if (cmd === 'loop') loop();
  else if (cmd === 'once') once(process.argv.includes('--wait')).catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); });
  else if (cmd === 'reconcile') { const i = process.argv.indexOf('--min-age-hours'); reconcile(i > 0 ? +process.argv[i + 1] : 24).catch((e) => { console.error('FAILED: ' + e.message); process.exit(1); }); }
  else if (cmd === 'selfcheck') selfcheck().catch((e) => { console.error(e); process.exit(1); });
  else if (cmd === 'summary') summary();
  else console.log('usage: node audit/shadow-recorder.js loop | once [--wait] | reconcile [--min-age-hours N] | summary | selfcheck');
}
module.exports = { decide, bookStats, atrSeries, httpGet };
