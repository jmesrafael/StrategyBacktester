// zec-dd.js — BB Breakout on MEXC ZEC (4h, 0% fees, 0.02% slippage, funding), $1 risk per trade: drawdown per year, measured three ways:
//   closed   = running P&L of closed trades only
//   marked   = account equity marked at every 4h close, open trade included
//   intrabar = the same but at the worst price inside each candle (low for a long, high for a short) — what margin has to survive
// Each measured two ways: within the year (from that year's own peak) and against the all-time peak (a drawdown carried over from last year
// counts). Plus losing streaks, worst month and time to recover. usage: node zec-dd.js [COIN] -> results-dd-<coin>.md
const fs = require('fs'), path = require('path'), L = require('./lib.js');
const COIN = process.argv[2] || 'ZEC', RISK = 1, SLIP = 0.0002, FEE = COIN === 'SOL' ? 0.0005 : 0;
const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const m = load(`datafund/MEXC_${COIN}.json`), b = load(`datafund/${COIN}.json`), FD = b.filter((r) => r[0] < (m.length ? m[0][0] : Infinity)).concat(m);
const B = L.bars('MEXC_' + COIN, 240);
const trades = [], eq = []; // eq: { t, closed, marked, worst }
let realized = 0;
{
  const closes = [], trs = []; let atr = null, pos = null, pend = null, pendClose = false, fi = 0;
  const fundTo = (te, tx) => { let fr = 0; while (fi < FD.length && FD[fi][0] <= te) fi++; for (let j = fi; j < FD.length && FD[j][0] <= tx; j++) fr += FD[j][1]; return fr; };
  const exit = (px, i, why) => { const fr = fundTo(B[pos.i0].time, B[i].time + 7200); const R = (pos.dir * (px - pos.entry) / pos.entry - 2 * FEE - pos.dir * fr) / pos.dist; realized += R; trades.push({ t: B[pos.i0].time, x: B[i].time, R, why }); pos = null; };
  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    if (pend) { const d = pend.dir, fill = c.open * (1 + d * SLIP), dist = Math.abs(fill - pend.stop) / fill; if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = { dir: d, entry: fill, stop: pend.stop, tp: pend.tp, i0: i, dist }; pend = null; }
    if (pendClose && pos) exit(c.open * (1 - pos.dir * SLIP), i, 'time'); pendClose = false;
    let worst = realized;
    if (pos) { const d = pos.dir, adverse = d === 1 ? Math.max(c.low, pos.stop) : Math.min(c.high, pos.stop); worst = realized + (d * (adverse - pos.entry) / pos.entry) / pos.dist;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * SLIP), i, 'stop');
      else if (d === 1 ? c.high >= pos.tp : c.low <= pos.tp) exit(d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open), i, 'target'); }
    const marked = realized + (pos ? (pos.dir * (c.close - pos.entry) / pos.entry) / pos.dist : 0);
    eq.push({ t: c.time, closed: realized, marked, worst: Math.min(worst, marked, realized) });
    closes.push(c.close);
    trs.push(i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - B[i - 1].close), Math.abs(c.low - B[i - 1].close)));
    if (i === 13) atr = trs.slice(0, 14).reduce((a, x) => a + x, 0) / 14; else if (i > 13) atr = (atr * 13 + trs[i]) / 14;
    if (pos) { if (i - pos.i0 >= 48) pendClose = true; continue; }
    if (i < 202) continue;
    const w = closes.slice(-20), mid = w.reduce((a, x) => a + x, 0) / 20, sd = Math.sqrt(w.reduce((a, x) => a + (x - mid) ** 2, 0) / 20);
    const up = mid + 2 * sd, lo = mid - 2 * sd, sma = closes.slice(-200).reduce((a, x) => a + x, 0) / 200;
    const dir = c.close > up ? 1 : c.close < lo ? -1 : 0;
    if (!dir || (dir === 1 ? c.close < sma : c.close > sma)) continue;
    const dist = Math.abs(c.close - mid); if (!(dist > 0) || dist < 0.3 * atr) continue;
    pend = { dir, stop: mid, tp: c.close + dir * 3 * dist };
  }
}
const first = trades.length ? new Date(trades[0].t * 1000).getUTCFullYear() : 2021;
const YEARS = []; for (let y = Math.max(2021, first); y <= 2026; y++) YEARS.push(y);
const iso = (t) => new Date(t * 1000).toISOString().slice(0, 10);
// drawdown of series key over [a, b); allTime: peak may come from before a
function dd(key, a, b, allTime) {
  let pk = -Infinity, best = 0, pkT = null, from = null, to = null;
  if (allTime) for (const e of eq) { if (e.t >= a) break; pk = Math.max(pk, e.closed, e.marked); }
  for (const e of eq) { if (e.t < a || e.t >= b) continue; const v = e[key];
    const hi = key === 'worst' ? Math.max(e.closed, e.marked) : v; // a candle's best value can set a new peak before its worst
    if (pk === -Infinity) { pk = hi; pkT = e.t; }
    if (v < pk && pk - v > best) { best = pk - v; from = pkT; to = e.t; }
    if (hi > pk) { pk = hi; pkT = e.t; } }
  return { dd: best, from, to };
}
const out = []; const P = (s = '') => { out.push(s); console.log(s); };
const d2 = (v) => '−$' + v.toFixed(2);
P(`# ${COIN} on MEXC, BB Breakout 4h — drawdown every year at $1 risk per trade\n`);
P(`Fees ${FEE * 100}% per side, 0.02% slippage, funding included. **Closed** = closed trades only. **Marked** = equity at every 4h close with the open trade included. **Intrabar** = the worst price inside a candle (what your margin actually feels). "Within year" starts each January at the year's own peak; "all-time" measures from the highest point ever reached (so a slide that began the previous year counts). Multiply every $ by your risk per trade (e.g. ×5 at $5 risk).\n`);
P('| Year | Profit | Trades | Closed DD (within year) | Marked DD (within year) | **Intrabar DD (within year)** | Intrabar DD (vs all-time peak) | Longest losing streak | Worst month |');
P('|---|---|---|---|---|---|---|---|---|');
let worstAll = 0;
for (const y of YEARS) {
  const a = L.ts(y), b = L.ts(y + 1), tr = trades.filter((t) => t.x >= a && t.x < b);
  let s = 0, ms = 0; for (const t of tr) { s = t.R < 0 ? s + 1 : 0; ms = Math.max(ms, s); }
  const mo = {}; for (const t of tr) { const k = iso(t.x).slice(0, 7); mo[k] = (mo[k] || 0) + t.R; }
  const wm = Object.entries(mo).sort((p, q) => p[1] - q[1])[0] || ['—', 0];
  const c = dd('closed', a, b, false), mk = dd('marked', a, b, false), w = dd('worst', a, b, false), wa = dd('worst', a, b, true);
  worstAll = Math.max(worstAll, wa.dd);
  P(`| ${y}${y === 2026 ? ' (to Oct)' : ''} | ${(L.sum(tr.map((t) => t.R)) >= 0 ? '+$' : '−$') + Math.abs(L.sum(tr.map((t) => t.R))).toFixed(2)} | ${tr.length} | ${d2(c.dd)} | ${d2(mk.dd)} | **${d2(w.dd)}** (${w.from ? iso(w.from) : ''} → ${w.to ? iso(w.to) : ''}) | ${d2(wa.dd)} | ${ms} | ${wm[0]} ${(wm[1] >= 0 ? '+$' : '−$') + Math.abs(wm[1]).toFixed(2)} |`);
}
const all = dd('worst', L.ts(2000), L.ts(2100), true), allC = dd('closed', L.ts(2000), L.ts(2100), true);
let maxStreak = 0, s = 0; for (const t of trades) { s = t.R < 0 ? s + 1 : 0; maxStreak = Math.max(maxStreak, s); }
// longest time below a previous closed-equity peak
let pk = 0, pkT = eq[0].t, longest = 0, lf = null, lt = null; for (const e of eq) { if (e.closed >= pk) { if (e.t - pkT > longest) { longest = e.t - pkT; lf = pkT; lt = e.t; } pk = e.closed; pkT = e.t; } }
P('');
P(`**Whole history:** worst intrabar drawdown ${d2(all.dd)} (${iso(all.from)} → ${iso(all.to)}); worst closed-trade drawdown ${d2(allC.dd)}; longest losing streak ${maxStreak} trades; longest time to get back to a new high ${(longest / 86400).toFixed(0)} days (${iso(lf)} → ${iso(lt)}).`);
fs.writeFileSync(__dirname + `/results-dd-${COIN.toLowerCase()}.md`, out.join('\n') + '\n');
