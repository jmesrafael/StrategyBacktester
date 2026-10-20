// one-coin.js — which single coin to fund first on MEXC, and what budget does $1 risk per trade need?
// BB Breakout, MEXC 4h candles, the user's MEXC fees: DOGE and ZEC 0% fees, SOL 0.05% per side; 0.02% slippage on market orders / stops.
// Funding: MEXC history from Apr 2025, Binance before. usage: node one-coin.js -> results-one-coin.md
const fs = require('fs'), path = require('path'), L = require('./lib.js');
const COINS = ['ZEC', 'DOGE', 'SOL'], RISK = 1, YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
const FEES = { DOGE: { taker: 0, maker: 0 }, ZEC: { taker: 0, maker: 0 }, SOL: { taker: 0.0005, maker: 0.0005 } }, SLIP = 0.0002;
const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
const funding = (c) => { const m = load(`datafund/MEXC_${c}.json`), b = load(`datafund/${c}.json`), m0 = m.length ? m[0][0] : Infinity; return b.filter((r) => r[0] < m0).concat(m); };
function bot(B, fd, fee) {
  const trades = [], closes = [], trs = []; let atr = null, pos = null, pend = null, pendClose = false, fi = 0;
  for (let i = 0; i < B.length; i++) {
    const c = B[i];
    if (pend) { const d = pend.dir, fill = c.open * (1 + d * SLIP), dist = Math.abs(fill - pend.stop) / fill;
      if (dist > 0 && (d === 1 ? pend.stop < fill : pend.stop > fill)) pos = { dir: d, entry: fill, stop: pend.stop, tp: pend.tp, i0: i, dist }; pend = null; }
    if (pendClose && pos) exit(c.open * (1 - pos.dir * SLIP), i, fee.taker, 'time'); pendClose = false;
    if (pos) { const d = pos.dir;
      if (d === 1 ? c.low <= pos.stop : c.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, c.open) : Math.max(pos.stop, c.open)) * (1 - d * SLIP), i, fee.taker, 'stop');
      else if (d === 1 ? c.high >= pos.tp : c.low <= pos.tp) exit(d === 1 ? Math.max(pos.tp, c.open) : Math.min(pos.tp, c.open), i, fee.maker, 'target'); }
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
    pend = { dir, stop: mid, tp: c.close + dir * 3 * dist };
  }
  return trades;
  function exit(px, i, f, why) {
    let fr = 0; const te = B[pos.i0].time, tx = B[i].time + 7200;
    while (fi < fd.length && fd[fi][0] <= te) fi++; for (let j = fi; j < fd.length && fd[j][0] <= tx; j++) fr += fd[j][1];
    trades.push({ t: te, x: B[i].time, R: (pos.dir * (px - pos.entry) / pos.entry - fee.taker - f - pos.dir * fr) / pos.dist, dist: pos.dist, bars: i - pos.i0, why }); pos = null;
  }
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f2 = (v) => (v >= 0 ? '+$' : '−$') + Math.abs(v).toFixed(2);
const out = []; const P = (s = '') => { out.push(s); console.log(s); };
P('# One coin first — BB Breakout on MEXC at $1 risk per trade\n');
P('MEXC 4h candles, your fees (DOGE and ZEC 0%, SOL 0.05% per side), 0.02% slippage on market orders and stops, funding included. Trades counted in the year they close. 2026 is to Oct 20.\n');
P('| Year | ' + COINS.join(' | ') + ' |'); P('|---|' + COINS.map(() => '---').join('|') + '|');
const res = {};
for (const c of COINS) res[c] = bot(L.bars('MEXC_' + c, 240), funding(c), FEES[c]).filter((t) => t.x >= L.ts(2021));
for (const y of YEARS) P(`| ${y}${y === 2026 ? ' (to Oct)' : ''} | ${COINS.map((c) => { const t = res[c].filter((x) => x.x >= L.ts(y) && x.x < L.ts(y + 1)); return `${f2(L.sum(t.map((x) => x.R)) * RISK)} (${t.length})`; }).join(' | ')} |`);
P('\n| 2021 → Oct 2026 | ' + COINS.join(' | ') + ' |'); P('|---|' + COINS.map(() => '---').join('|') + '|');
const row = (label, fn) => P(`| ${label} | ${COINS.map((c) => fn(res[c], c)).join(' | ')} |`);
const yearsPos = (tr) => YEARS.filter((y) => L.sum(tr.filter((x) => x.x >= L.ts(y) && x.x < L.ts(y + 1)).map((x) => x.R)) > 0).length;
const ddR = (tr) => { let e = 0, pk = 0, dd = 0; for (const t of [...tr].sort((a, b) => a.x - b.x)) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); } return dd; };
const streak = (tr) => { let s = 0, m = 0; for (const t of [...tr].sort((a, b) => a.x - b.x)) { s = t.R < 0 ? s + 1 : 0; m = Math.max(m, s); } return m; };
const monthsPos = (tr) => { const m = {}; for (const t of tr) { const k = new Date(t.x * 1000).toISOString().slice(0, 7); m[k] = (m[k] || 0) + t.R; } const v = Object.values(m); return `${v.filter((x) => x > 0).length} of ${v.length}`; };
row('Total profit', (tr) => `**${f2(L.sum(tr.map((x) => x.R)) * RISK)}**`);
row('Last 12 months (Nov 25 → Oct 26)', (tr) => f2(L.sum(tr.filter((x) => x.x >= L.ts(2025, 11)).map((x) => x.R)) * RISK));
row('Average per year', (tr) => f2(L.sum(tr.map((x) => x.R)) * RISK / 5.8));
row('Years positive', (tr) => `${yearsPos(tr)} of 6`);
row('Months positive', (tr) => monthsPos(tr));
row('Trades per year', (tr) => (tr.length / 5.8).toFixed(0));
row('Win rate', (tr) => (tr.filter((x) => x.R > 0).length / tr.length * 100).toFixed(0) + '%');
row('Avg R per trade', (tr) => L.f2(L.sum(tr.map((x) => x.R)) / tr.length));
row('Max drawdown (closed trades)', (tr) => `−$${(ddR(tr) * RISK).toFixed(2)}`);
row('Longest losing streak', (tr) => `${streak(tr)} trades`);
row('Stop distance: median / 90% of trades below', (tr) => `${(q(tr.map((x) => x.dist), 0.5) * 100).toFixed(1)}% / ${(q(tr.map((x) => x.dist), 0.9) * 100).toFixed(1)}%`);
row('Position size at $1 risk: median / 90%', (tr) => `$${(RISK / q(tr.map((x) => x.dist), 0.5)).toFixed(0)} / $${(RISK / q(tr.map((x) => x.dist), 0.1)).toFixed(0)}`);
row('Average time in trade', (tr) => `${(L.sum(tr.map((x) => x.bars)) / tr.length * 4 / 24).toFixed(1)} days`);
fs.writeFileSync(__dirname + '/results-one-coin.md', out.join('\n') + '\n');
