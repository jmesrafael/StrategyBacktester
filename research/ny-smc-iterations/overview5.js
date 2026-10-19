// overview5.js — v7 Standard vs Less risk (Bollinger stretch), SOL and ETH each on its own $500 account, $5 risk per trade
// (= 1%). Fixed: always $5. Compounding: 1% of the current balance. Binance 15m, fees + slippage, research engine.
// usage: node overview5.js → results/overview-5usd.md
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js'), I = require('./ind.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000, END = D0('2026-10-18');
const START = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') }, BAL0 = 500, RISK = 5, PCT = 0.01;
const usd = (x) => (x < 0 ? '−$' : '+$') + Math.abs(x).toFixed(0), money = (x) => '$' + x.toFixed(0);
function trades(sym, less) {
  const D = E.analyze(sym + '-binance', JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}15.json`, 'utf8')), C.swingLen), B = D.B;
  let S = E.setupsFor(D, C);
  if (less) { const bb = I.bb(B.map((b) => b.close), 20, 2); S = S.filter((s) => { const b = bb[s.legXi]; return b && (s.long ? B[s.legXi].low < b.lo : B[s.legXi].high > b.up); }); }
  return E.execute(D, C, S).filter((t) => t.t >= START[sym] && t.t < END).map((t) => ({ t: t.t, R: t.R }));
}
// equity path: fixed $ risk or compounding % risk
function path(tr, compound) {
  let bal = BAL0, peak = BAL0, ddUsd = 0, ddPct = 0, under = 0, maxUnder = 0, peakT = tr.length ? tr[0].t : 0, streak = 0, maxStreak = 0;
  const out = tr.map((t) => {
    const risk = compound ? bal * PCT : RISK, pnl = t.R * risk; bal += pnl;
    if (bal > peak) { peak = bal; peakT = t.t; } else maxUnder = Math.max(maxUnder, (t.t - peakT) / 86400 / 30.44);
    ddUsd = Math.max(ddUsd, peak - bal); ddPct = Math.max(ddPct, (peak - bal) / peak);
    if (t.R <= 0.05) maxStreak = Math.max(maxStreak, ++streak); else streak = 0;
    return { ...t, pnl, bal, risk };
  });
  return { rows: out, end: bal, ddUsd, ddPct, maxUnder, maxStreak };
}
const L = ['# v7 at $5 risk per trade — Standard vs Less risk, fixed vs compounding', '',
  `Each coin trades its own $${BAL0} account. **Fixed** = always $${RISK} per trade. **Compounding** = 1% of the current balance (starts at $5, grows and shrinks with the account).`,
  'Binance USDT-M futures 15m, fees + slippage included, same engine the app matches trade-for-trade. Years run 18 Oct → 17 Oct. SOL starts Oct 2020, ETH Dec 2019.', ''];
for (const sym of ['SOL', 'ETH']) {
  const tS = trades(sym, false), tL = trades(sym, true);
  const P = { 'Std fixed': path(tS, false), 'Std comp': path(tS, true), 'Less fixed': path(tL, false), 'Less comp': path(tL, true) };
  L.push(`## ${sym}`, '', '### Year by year (profit in $)', '', '| Year | Std trades | **Std fixed** | Std compounding | Less-risk trades | **Less fixed** | Less compounding |', '|---|---|---|---|---|---|---|');
  for (let y = 2019; y <= 2025; y++) {
    const a = D0(`${y}-10-18`), b = D0(`${y + 1}-10-18`), sel = (p) => p.rows.filter((r) => r.t >= a && r.t < b);
    if (!sel(P['Std fixed']).length && !sel(P['Less fixed']).length) continue;
    const s = (k) => usd(sel(P[k]).reduce((x, r) => x + r.pnl, 0));
    L.push(`| Oct ${String(y).slice(2)}–${String(y + 1).slice(2)} | ${sel(P['Std fixed']).length} | **${s('Std fixed')}** | ${s('Std comp')} | ${sel(P['Less fixed']).length} | **${s('Less fixed')}** | ${s('Less comp')} |`);
  }
  L.push('', '### Whole period', '', '| | Std fixed | Std compounding | Less fixed | Less compounding |', '|---|---|---|---|---|');
  const row = (name, f) => L.push(`| ${name} | ${Object.values(P).map(f).join(' | ')} |`);
  row('Trades', (p) => p.rows.length);
  row('End balance (from $500)', (p) => money(p.end));
  row('Total profit', (p) => usd(p.end - BAL0));
  row('Return on $500', (p) => ((p.end / BAL0 - 1) * 100).toFixed(0) + '%');
  row('Max drawdown ($)', (p) => '−$' + p.ddUsd.toFixed(0));
  row('Max drawdown (% of peak)', (p) => '−' + (p.ddPct * 100).toFixed(1) + '%');
  row('Profit ÷ max drawdown', (p) => ((p.end - BAL0) / p.ddUsd).toFixed(2));
  row('Longest time below a previous high', (p) => p.maxUnder.toFixed(0) + ' months');
  row('Worst run of non-winning trades', (p) => p.maxStreak);
  row('Risk on the last trade', (p) => '$' + (p.rows.length ? p.rows[p.rows.length - 1].risk : RISK).toFixed(2));
  // monthly worst / profitable months (fixed)
  for (const k of ['Std fixed', 'Less fixed']) { const mo = {}; for (const r of P[k].rows) { const m = new Date(r.t * 1000).toISOString().slice(0, 7); mo[m] = (mo[m] || 0) + r.pnl; }
    const v = Object.values(mo); L.push('', `${k}: profitable months ${v.filter((x) => x > 0).length} of ${v.length}, worst month ${usd(Math.min(...v))}, best month ${usd(Math.max(...v))}.`); }
  L.push('');
}
fs.writeFileSync('results/overview-5usd.md', L.join('\n') + '\n'); console.log(L.join('\n'));
