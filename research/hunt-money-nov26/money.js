// money.js - risk metrics + PHP 1,000 accounts for ICHI-X4 (4h), VOL-MOM-2H, BB-1H-WIDE (reference). Nov 26, 2026. Read-only study.
// Account model = hunt-1h-nov26/pesos.js: risk 2.5% -> 2% (>=USD 500 peak) -> 1.5% (>=USD 1000 peak) of the realised balance fixed at entry,
// PHP 60/USD, P/L = R x risk$ at exit (fees 0.05%, slippage 0.02%, real funding are already inside R). Drawdown = realised balance, trade by trade.
// Min-order rules (Binance USDT-M assumed): notional = risk$/stop% must be >= min notional (5 USD; ETH 20; BTC 100) else the trade is SKIPPED;
// total open notional capped at 10x the balance, else SKIPPED. Skipped trades earn nothing and cost nothing.
'use strict';
const fs = require('fs');
const L4 = require('../hunt-4h-nov26/lib.js'), F4 = require('../hunt-4h-nov26/fam.js');
const L2 = require('../hunt-intraday-nov26/lib.js'), F2 = require('../hunt-intraday-nov26/fam.js');
const L1 = require('../hunt-1h-nov26/lib.js'), FV = require('../hunt-1h-nov26/fam-vol.js');
const START = 1000, PHP = 60, TIERS = [[0, 0.025], [500 * PHP, 0.02], [1000 * PHP, 0.015]], LEV = 10;
const riskPct = (pk) => { let p = TIERS[0][1]; for (const [b, r] of TIERS) if (pk >= b) p = r; return p; };
const minNot = (c) => (c === 'BTC' ? 100 : c === 'ETH' ? 20 : 5);
const Y = [2020, 2021, 2022, 2023, 2024, 2025, 2026], yOf = (t) => new Date(t * 1000).getUTCFullYear();
const ALL24 = [...L4.MAIN, ...L4.HOLD];

function ichi(coins) {
  const cand = { fam: 'ichi', p: { t: 9, k: 26, s: 52, mode: 'cross' }, trend: 0, exit: { k: 2, bars: 12 } };
  const tr = L4.evaluate((x) => F4.build(x, cand), F4.exOf(cand), coins, 1, true).trades;
  for (const t of tr) t.dist = 2 * L4.coin(t.coin).atr14[t.i0 - 1] / t.entry;
  return tr;
}
function volmom(coins) {
  const P = { fam: 'f2', kv: 2.5, kr: 1.2, trend: 400 }, EX = { kInit: 2, kTrail: 8, maxBars: 0, sigExit: false };
  const tr = L2.evaluate(F2.strat(P), EX, coins, 1, true).trades;
  for (const t of tr) t.dist = 2 * L2.coin(t.coin).atr14[t.i0 - 1] / t.entry;
  return tr;
}
function wide(coins) {
  const E = { kind: 'M', bars: 192 };
  const tr = L1.evaluate(FV.strat({ len: 80, mult: 2.6, trend: 800, minStop: 0.3, filt: null }, E), FV.mkEx(E), coins, 1, true).trades;
  for (const t of tr) { const c = L1.coin(t.coin), m = c.m('sma80x', () => L1.I.sma(c.C, 80)); t.dist = Math.abs(t.entry - m[t.i0 - 1]) / t.entry; }
  return tr;
}

function account(trades, fresh) {
  const K = process.env.SCALE6 ? 6 / new Set(trades.map((t) => t.coin)).size : 1;
  const ev = []; trades.forEach((t, i) => { ev.push([t.t, 0, i]); ev.push([t.tExit, 1, i]); });
  ev.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const accs = {}, owner = {}, st = { skipMin: 0, skipLev: 0, taken: 0 };
  const get = (k) => accs[k] || (accs[k] = { bal: START, peak: START, dd: 0, risk: {}, notional: {}, open: 0, curve: [], gp: 0, gl: 0, w: 0, n: 0, mon: {} });
  for (const [ts, kind, i] of ev) {
    const t = trades[i];
    if (kind === 0) {
      const k = fresh ? yOf(ts) : 'all', a = get(k); owner[i] = k;
      const risk = a.bal * riskPct(a.peak) * K, usd = risk / PHP, notional = usd / t.dist;
      if (notional < minNot(t.coin)) { st.skipMin++; owner[i] = null; continue; }
      if (a.open + notional > LEV * (a.bal / PHP)) { st.skipLev++; owner[i] = null; continue; }
      a.risk[i] = risk; a.notional[i] = notional; a.open += notional; st.taken++;
    } else {
      if (owner[i] == null) continue;
      const a = get(owner[i]), pl = t.R * a.risk[i];
      a.bal += pl; a.open -= a.notional[i]; delete a.risk[i]; delete a.notional[i]; a.n++;
      if (pl > 0) { a.gp += pl; a.w++; } else a.gl -= pl;
      a.peak = Math.max(a.peak, a.bal); a.dd = Math.max(a.dd, 1 - a.bal / a.peak);
      a.curve.push([ts, a.bal]);
      const d = new Date(ts * 1000), mk = d.getUTCFullYear() * 12 + d.getUTCMonth(); a.mon[mk] = a.bal;
    }
  }
  return { accs, st };
}
function monthly(a) {
  const ks = Object.keys(a.mon).map(Number).sort((x, y) => x - y), out = []; let prev = START, last = START;
  for (let m = 2020 * 12; m <= ks[ks.length - 1]; m++) { if (a.mon[m] != null) last = a.mon[m]; out.push(last / prev - 1); prev = last; }
  return out;
}
const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
function ratios(r) {
  const m = mean(r), sd = Math.sqrt(mean(r.map((x) => (x - m) ** 2))), dn = Math.sqrt(mean(r.map((x) => Math.min(0, x) ** 2)));
  return { sharpe: sd ? (m / sd) * Math.sqrt(12) : 0, sortino: dn ? (m / dn) * Math.sqrt(12) : 0 };
}
const php = (v) => (v >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.round(v).toLocaleString('en-US'));
const pc = (v) => (v >= 0 ? '+' : '') + Math.round(v * 100) + '%';

const SETS = [
  ['ICHI-X4 (4h), main 12', ichi(L4.MAIN)], ['ICHI-X4 (4h), hold-out 12', ichi(L4.HOLD)], ['ICHI-X4 (4h), all 24', ichi(ALL24)],
  ['VOL-MOM-2H, main 12', volmom(L2.MAIN)], ['VOL-MOM-2H, hold-out 12', volmom(L2.HOLD)], ['VOL-MOM-2H, all 24', volmom(ALL24)],
  ['BB-1H-WIDE (ref), main 12', wide(L1.MAIN)], ['BB-1H-WIDE (ref), all 24', wide(ALL24)],
];
let o = '# Risk and PHP 1,000 accounts: ICHI-X4, VOL-MOM-2H (+ BB-1H-WIDE reference), Nov 26 2026\n\n';
if (process.env.SCALE6) o += 'RISK SCALED: per-trade risk x 6 / number of coins (same total risk as the 6 live coins: x0.5 for 12 coins, x0.25 for 24).\n\n';
o += 'Realised-balance model (see top of money.js). Costs per side: 0.05% fee + 0.02% slippage + real funding, already inside R. Min order: notional >= 5 USD (ETH 20, BTC 100), open notional <= 10x balance; otherwise the trade is skipped. PHP 60/USD. Sharpe/Sortino from monthly returns of the compounded account, annualised sqrt(12), risk-free 0. Open-trade swings are not in the drawdown.\n\n';
o += '## 1. Risk and quality (one PHP 1,000 account compounding Jan 2020 to Nov 2026)\n| Set | Trades taken | Skipped (min order / leverage) | Win rate | Profit factor | Max peak-to-trough DD | Sharpe | Sortino | PHP 1,000 ends at |\n|---|---|---|---|---|---|---|---|---|\n';
const rows = [];
for (const [nm, tr] of SETS) {
  const { accs, st } = account(tr, false), a = accs.all, r = ratios(monthly(a));
  rows.push([nm, tr, a]);
  o += `| ${nm} | ${a.n} of ${tr.length} | ${st.skipMin} / ${st.skipLev} | ${((100 * a.w) / a.n).toFixed(0)}% | ${(a.gp / a.gl).toFixed(2)} | -${(a.dd * 100).toFixed(0)}% | ${r.sharpe.toFixed(2)} | ${r.sortino.toFixed(2)} | PHP ${php(a.bal)} |\n`;
}
o += '\n## 2. R view without any account rules (unlimited size, no min order)\n| Set | Trades | Win rate | Profit factor (R) | Total R | Max DD (R) | R per trade |\n|---|---|---|---|---|---|---|\n';
for (const [nm, tr] of SETS) {
  const s = [...tr].sort((a, b) => a.tExit - b.tExit); let eq = 0, pk = 0, dd = 0, gp = 0, gl = 0, w = 0;
  for (const t of s) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (t.R > 0) { gp += t.R; w++; } else gl -= t.R; }
  o += `| ${nm} | ${s.length} | ${((100 * w) / s.length).toFixed(0)}% | ${(gp / gl).toFixed(2)} | ${eq.toFixed(0)} | ${dd.toFixed(0)} | ${(eq / s.length).toFixed(3)} |\n`;
}
o += `\n## 3. PHP 1,000 compounding from Jan 2020 (balance at each year end)\n| Set | ${Y.join(' | ')} |\n|${'---|'.repeat(Y.length + 1)}\n`;
for (const [nm, , a] of rows) {
  let last = START; const byY = {};
  for (const [ts, b] of a.curve) byY[yOf(ts)] = b;
  o += `| ${nm} | ${Y.map((y) => { if (byY[y] != null) last = byY[y]; return php(last); }).join(' | ')} |\n`;
}
o += `\n## 4. Each year on its own: a fresh PHP 1,000 on Jan 1 (year result, worst realised fall inside that year)\n| Set | ${Y.join(' | ')} |\n|${'---|'.repeat(Y.length + 1)}\n`;
for (const [nm, tr] of SETS) {
  const { accs } = account(tr, true);
  o += `| ${nm} | ${Y.map((y) => (accs[y] ? `${pc(accs[y].bal / START - 1)} (PHP ${php(accs[y].bal)}, -${Math.round(accs[y].dd * 100)}%)` : '-')).join(' | ')} |\n`;
}
fs.writeFileSync(process.env.SCALE6 ? 'money-scaled.md' : 'money.md', o); console.log(o);
