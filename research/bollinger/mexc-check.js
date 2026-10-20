// mexc-check.js — BB Breakout on MEXC's own 4h candles (SOL / DOGE / ZEC): price agreement with Binance, same-trade agreement, and year-by-year
// results with MEXC fee scenarios. Same bot replay as live-parity.js (closed candles only, next-open fills). $5 risk per trade.
// Funding: MEXC history where it exists (Apr 2025 →), Binance funding before that as a stand-in. usage: node mexc-check.js -> results-mexc-check.md
const fs = require('fs'), path = require('path'), L = require('./lib.js');
const COINS = ['SOL', 'DOGE', 'ZEC'], RISK = 5, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
function funding(c) { const m = load(`datafund/MEXC_${c}.json`), b = load(`datafund/${c}.json`), m0 = m.length ? m[0][0] : Infinity; return b.filter((r) => r[0] < m0).concat(m); }
function bot(B, fd, cost) {
  const trades = [], closes = [], trs = []; let atr = null, pos = null, pendEntry = null, pendClose = false, fi = 0;
  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    if (pendEntry) { const d = pendEntry.dir, fill = c.open * (1 + d * cost.slip), dist = Math.abs(fill - pendEntry.stop) / fill;
      if (dist > 0 && (d === 1 ? pendEntry.stop < fill : pendEntry.stop > fill)) pos = { dir: d, entry: fill, stop: pendEntry.stop, tp: pendEntry.tp, i0: i, dist }; pendEntry = null; }
    if (pendClose && pos) exit(c.open * (1 - pos.dir * cost.slip), i, cost.taker); pendClose = false;
    if (pos) { const d = pos.dir;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * cost.slip), i, cost.taker);
      else if (d === 1 ? c.high >= pos.tp * (1 + cost.tpBuf) : c.low <= pos.tp * (1 - cost.tpBuf)) exit(d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open), i, cost.maker); }
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === 13) atr = trs.slice(0, 14).reduce((a, b) => a + b, 0) / 14; else if (i > 13) atr = (atr * 13 + trs[i]) / 14;
    if (pos) { if (i - pos.i0 >= 48) pendClose = true; continue; }
    if (i < 202) continue;
    const w = closes.slice(-20), mid = w.reduce((a, b) => a + b, 0) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / 20);
    const up = mid + 2 * sd, lo = mid - 2 * sd, sma = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;
    const dir = c.close > up ? 1 : c.close < lo ? -1 : 0;
    if (!dir || (dir === 1 ? c.close < sma : c.close > sma)) continue;
    const dist = Math.abs(c.close - mid); if (!(dist > 0) || dist < 0.3 * atr) continue;
    pendEntry = { dir, stop: mid, tp: c.close + dir * 3 * dist };
  }
  return trades;
  function exit(px, i, fee) {
    let fr = 0; const te = B[pos.i0].time, tx = B[i].time + 7200;
    while (fi < fd.length && fd[fi][0] <= te) fi++; for (let j = fi; j < fd.length && fd[j][0] <= tx; j++) fr += fd[j][1];
    trades.push({ t: B[pos.i0].time, x: B[i].time, R: (pos.dir * (px - pos.entry) / pos.entry - cost.taker - fee - pos.dir * fr) / pos.dist, dir: pos.dir }); pos = null;
  }
}
const out = []; const P = (s = '') => { out.push(s); console.log(s); };
const f0 = (v) => (v >= 0 ? '+$' : '−$') + Math.abs(v).toFixed(0);
P('# BB Breakout on MEXC — SOL / DOGE / ZEC, 4h\n');
P('MEXC USDT-M perpetual 4h candles (Sep 2020 / Oct 2020 / Jun 2020 → Oct 20 2026). Same rules and the same closed-candle bot replay as the Binance tests. $5 risk per trade, trades counted in the year they close. Funding: MEXC history from Apr 2025, Binance funding as a stand-in before that.\n');
P('## 1. Are MEXC prices the same as Binance?\n'); P('| Coin | Overlapping 4h candles | Avg close difference | Avg high–low range difference | BB trades on MEXC | on Binance | Same entry candle |'); P('|---|---|---|---|---|---|---|');
const BASE = { taker: 0.0005, maker: 0.0002, slip: 0.0002, tpBuf: 0 };
for (const c of COINS) {
  const M = L.bars('MEXC_' + c, 240), Bn = L.bars(c, 240), bm = new Map(Bn.map((b) => [b.time, b]));
  let n = 0, dc = 0, dr = 0; for (const m of M) { const b = bm.get(m.time); if (!b) continue; n++; dc += Math.abs(m.close - b.close) / b.close; dr += Math.abs((m.high - m.low) - (b.high - b.low)) / Math.max(1e-12, b.high - b.low); }
  const start = Math.max(M[0].time, Bn[0].time) + 260 * 14400;
  const tm = bot(M, funding(c), BASE).filter((t) => t.t >= start), tb = bot(Bn, load(`datafund/${c}.json`), BASE).filter((t) => t.t >= start), sb = new Set(tb.map((t) => t.t));
  P(`| ${c} | ${n} | ${(dc / n * 100).toFixed(3)}% | ${(dr / n * 100).toFixed(1)}% | ${tm.length} | ${tb.length} | ${tm.filter((t) => sb.has(t.t)).length} (${(tm.filter((t) => sb.has(t.t)).length / tm.length * 100).toFixed(0)}%) |`);
}
const CASES = [
  ['MEXC, fees 0.02% maker / 0.06% taker (docs example), 0.02% slippage', { taker: 0.0006, maker: 0.0002, slip: 0.0002, tpBuf: 0 }],
  ['MEXC, low fees 0% maker / 0.02% taker, 0.02% slippage', { taker: 0.0002, maker: 0, slip: 0.0002, tpBuf: 0 }],
  ['MEXC, 0.06% taker + 0.05% slippage + target must trade 0.05% through', { taker: 0.0006, maker: 0.0002, slip: 0.0005, tpBuf: 0.0005 }],
  ['Binance candles, Binance base fees (for comparison)', null],
];
P('\n## 2. Year by year, all three coins together ($5 risk)\n'); P('| Case | ' + YEARS.join(' | ') + ' | Total | Years + |'); P('|---|' + YEARS.map(() => '---').join('|') + '|---|---|');
const perCoin = {};
for (const [label, cost] of CASES) {
  const tr = COINS.flatMap((c) => { const t = cost ? bot(L.bars('MEXC_' + c, 240), funding(c), cost) : bot(L.bars(c, 240), load(`datafund/${c}.json`), BASE); return t.map((x) => ({ ...x, c })); });
  const ys = YEARS.map((y) => L.sum(tr.filter((t) => t.x >= L.ts(y) && t.x < L.ts(y + 1)).map((t) => t.R)) * RISK);
  P(`| ${label} | ${ys.map(f0).join(' | ')} | **${f0(L.sum(ys))}** | ${ys.filter((v) => v > 0).length} of 7 |`);
  if (label.startsWith('MEXC, fees 0.02%')) perCoin.tr = tr;
}
P('\n## 3. Each coin on MEXC (0.06% taker / 0.02% maker), profit and trades per year\n'); P('| Year | SOL | DOGE | ZEC |'); P('|---|---|---|---|');
for (const y of YEARS) P(`| ${y} | ${COINS.map((c) => { const t = perCoin.tr.filter((x) => x.c === c && x.x >= L.ts(y) && x.x < L.ts(y + 1)); return t.length ? `${f0(L.sum(t.map((x) => x.R)) * RISK)} (${t.length})` : '·'; }).join(' | ')} |`);
P(`| **Total** | ${COINS.map((c) => '**' + f0(L.sum(perCoin.tr.filter((x) => x.c === c).map((x) => x.R)) * RISK) + '**').join(' | ')} |`);
P(`| Years positive | ${COINS.map((c) => { const ys = YEARS.map((y) => perCoin.tr.filter((x) => x.c === c && x.x >= L.ts(y) && x.x < L.ts(y + 1))).filter((t) => t.length); return ys.filter((t) => L.sum(t.map((x) => x.R)) > 0).length + ' of ' + ys.length; }).join(' | ')} |`);
fs.writeFileSync(__dirname + '/results-mexc-check.md', out.join('\n') + '\n');
