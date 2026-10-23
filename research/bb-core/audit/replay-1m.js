// replay-1m.js — replay every trade's stop / target / time exit on 1-MINUTE candles and compare with the 4h backtest.
//   node audit/replay-1m.js binance   all trades of the Binance 4h backtest, on Binance 1m   (data: audit/cache-1m/, made by fetch-1m.js binance)
//   node audit/replay-1m.js mexc      MEXC 4h trades whose entry is inside the ~30 days of MEXC 1m history  (data: audit/out/v2/mexc-1m-*.json)
// 1m rules = the same rules as the 4h engine, only the clock is finer. Entry = the 4h model's entry (open of the entry candle + slip), so the comparison
// isolates EXIT behaviour. From the entry minute on, every minute: time exit if minute >= open of candle i0+49 (fills at that minute's open);
// else stop if low<=stop (long) / high>=stop (short), gap fills at the minute's open; else target if high >= tp*(1+0.05%) (long).
// Stop is checked first inside a minute. Compared per trade: exit reason, 4h candle containing the exit, price-only R
// (funding is a calendar term, reported separately in the table of the 4h engine).
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS } = require('../../../🔴BB-Core/lucidio-core.js');
const D = path.join(__dirname, '..', '..', '..', '🔴BB-Core', 'data'), IV = 14400, C = DEFAULTS.cost;
const venue = process.argv[2] === 'mexc' ? 'mexc' : 'binance';
const rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const yr = (t) => new Date(t * 1000).getUTCFullYear(), iso = (t) => new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ');
const m1file = (c) => (venue === 'mexc' ? path.join(__dirname, 'out', 'v2', `mexc-1m-${c}.json`) : path.join(__dirname, 'cache-1m', `binance-1m-${c}.json`));

function replay(t, B, M) {
  const d = t.dir, dist = Math.abs(t.entry - t.stop) / t.entry, tExit = B[t.i0 + 49] ? B[t.i0 + 49].time : Infinity;
  let missing = 0;
  for (let s = B[t.i0].time; s < B[t.i0].time + 50 * IV; s += 60) {
    const m = M.get(s);
    if (!m) { if (s <= t.tExit) missing++; if (s > t.tExit + 2 * IV) return { incomplete: true, missing }; continue; }
    const o = m[1], h = m[2], l = m[3];
    let px, fee, why;
    if (s >= tExit) { px = o * (1 - d * C.slip); fee = C.timeFee; why = 'time'; }
    else if (d === 1 ? l <= t.stop : h >= t.stop) { px = (d === 1 ? Math.min(t.stop, o) : Math.max(t.stop, o)) * (1 - d * C.slip); fee = C.stopFee; why = 'stop'; }
    else if (d === 1 ? h >= t.tp * (1 + C.tpBuf) : l <= t.tp * (1 - C.tpBuf)) { px = (d === 1 ? Math.max(t.tp, o) : Math.min(t.tp, o)) * (1 - d * C.tpSlip); fee = C.tpFee; why = 'target'; }
    else continue;
    const bothMin = why === 'stop' && (d === 1 ? h >= t.tp * (1 + C.tpBuf) : l <= t.tp * (1 - C.tpBuf)); // stop and target in the same minute: stop-first assumed
    return { why, s, candle: Math.floor(s / IV) * IV, R: (d * (px - t.entry) / t.entry - C.entryFee - fee) / dist, missing, bothMin };
  }
  return { incomplete: true, missing };
}
const rows = [], bad = [], cand = { checked: 0, ohlcDiff: 0, maxRel: 0, examples: [] };
const tot = { n: 0, reason: 0, candle: 0, any: 0, dR: 0, absdR: 0, incomplete: 0, bothMin: 0, rDiff: 0, same4hBoth: 0 };
const byYear = {};
for (const coin of ['SOL', 'ZEC']) {
  const name = (venue === 'mexc' ? 'MEXC_' : '') + coin;
  if (!fs.existsSync(m1file(coin))) { console.log(`no 1m data for ${coin} (${m1file(coin)}) — run: node audit/fetch-1m.js ${venue}`); continue; }
  const M = new Map(JSON.parse(fs.readFileSync(m1file(coin), 'utf8')).map((r) => [r[0], r])), first = [...M.keys()].reduce((a, b) => (b < a ? b : a), Infinity);
  const B = rd(name + '.json').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
  let F = rd('funding/' + name + '.json'); if (venue === 'mexc') { const bin = rd('funding/' + coin + '.json'); F = [...bin.filter((r) => r[0] < F[0][0]), ...F]; }
  const trades = backtest(B, {}, F).trades.filter((t) => t.t >= first);
  console.log(`\n${coin} (${venue} 4h trades with entry >= first 1m row ${iso(first)}): ${trades.length} trades; 1m rows ${M.size}`);
  // data sanity: aggregate 1m -> 4h and compare with the 4h file (candles that are fully covered by 1m rows)
  const bi = new Map(B.map((b) => [b.time, b]));
  for (let ct = Math.ceil(first / IV) * IV; ct <= B[B.length - 1].time; ct += IV) {
    const b = bi.get(ct); if (!b) continue;
    let o = null, h = -Infinity, l = Infinity, c = null, n = 0;
    for (let s = ct; s < ct + IV; s += 60) { const m = M.get(s); if (!m) continue; if (o == null) o = m[1]; h = Math.max(h, m[2]); l = Math.min(l, m[3]); c = m[4]; n++; }
    if (n < 240) continue;
    cand.checked++;
    const rel = Math.max(Math.abs(o / b.open - 1), Math.abs(h / b.high - 1), Math.abs(l / b.low - 1), Math.abs(c / b.close - 1));
    if (rel > 1e-9) { cand.ohlcDiff++; cand.maxRel = Math.max(cand.maxRel, rel); if (cand.examples.length < 12) cand.examples.push(`${coin} ${iso(ct)} rel ${(rel * 100).toFixed(4)}%`); }
  }
  for (const t of trades) {
    const r = replay(t, B, M), y = yr(t.tExit); tot.n++;
    byYear[y] = byYear[y] || { n: 0, mis: 0 }; byYear[y].n++;
    if (r.incomplete) { tot.incomplete++; bad.push(`${coin} ${iso(t.t)} ${t.dir > 0 ? 'L' : 'S'}: 1m data incomplete (${r.missing} minutes missing)`); continue; }
    const rPrice = t.R - t.fundR, reasonDiff = r.why !== t.why, candleDiff = r.candle !== B[t.i1].time, dR = r.R - rPrice;
    tot.reason += reasonDiff; tot.candle += candleDiff; tot.any += reasonDiff || candleDiff; tot.dR += dR; tot.absdR += Math.abs(dR); tot.rDiff += Math.abs(dR) > 0.01; tot.bothMin += r.bothMin;
    if (reasonDiff || candleDiff || Math.abs(dR) > 0.01) { byYear[y].mis++; bad.push(`${coin} ${iso(t.t)} ${t.dir > 0 ? 'LONG ' : 'SHORT'} 4h: ${t.why.padEnd(6)} candle ${iso(B[t.i1].time)} R ${rPrice.toFixed(3)} | 1m: ${r.why.padEnd(6)} ${iso(r.s)} (candle ${iso(r.candle)}) R ${r.R.toFixed(3)} dR ${dR.toFixed(3)}`); }
    for (let i = t.i0; i <= t.i1; i++) { const b = B[i]; if ((t.dir === 1 ? b.low <= t.stop : b.high >= t.stop) && (t.dir === 1 ? b.high >= t.tp * (1 + C.tpBuf) : b.low <= t.tp * (1 - C.tpBuf))) tot.same4hBoth++; }
    rows.push({ coin, why4: t.why, why1: r.why });
  }
}
const done = tot.n - tot.incomplete, pc = (a, b) => (b ? (100 * a / b).toFixed(2) : 'n/a') + '%';
console.log(`\n================ ${venue.toUpperCase()} 1-minute replay vs 4h backtest ================`);
console.log(`trades replayed: ${done} of ${tot.n} (${tot.incomplete} with incomplete 1m data)`);
console.log(`exit REASON differs   : ${tot.reason}  (${pc(tot.reason, done)})`);
console.log(`exit 4h CANDLE differs: ${tot.candle}  (${pc(tot.candle, done)})`);
console.log(`reason OR candle differs (= mismatch): ${tot.any}  (${pc(tot.any, done)})   |  trades with |dR|>0.01 (price-only): ${tot.rDiff}`);
console.log(`R: sum dR (1m - 4h, price-only) = ${tot.dR.toFixed(4)}R, mean |dR| = ${(tot.absdR / Math.max(1, done)).toFixed(5)}R`);
console.log(`4h candles inside trades where stop AND target were both touched (the only case where the 4h order is an assumption): ${tot.same4hBoth}; trades whose exit minute touched both: ${tot.bothMin}`);
console.log(`1m->4h aggregation check: ${cand.checked} fully covered 4h candles compared, ${cand.ohlcDiff} differ in O/H/L/C (max rel ${(cand.maxRel * 100).toFixed(4)}%)${cand.examples.length ? '\n   ' + cand.examples.join('\n   ') : ''}`);
console.log('by exit year (replayed / mismatches): ' + Object.keys(byYear).sort().map((y) => `${y}: ${byYear[y].n}/${byYear[y].mis}`).join('  '));
if (bad.length) { console.log('\nEvery mismatch / problem:'); bad.forEach((b) => console.log('  ' + b)); } else console.log('\nNo mismatches.');
const cnt = {}; rows.forEach((r) => { const k = r.why4 + '->' + r.why1; cnt[k] = (cnt[k] || 0) + 1; });
console.log('exit reason 4h->1m counts:', JSON.stringify(cnt));
