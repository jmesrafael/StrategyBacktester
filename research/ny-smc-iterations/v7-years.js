// v7-years.js — double-check of frozen v7 across every available year ($1 risk = 1R).
// Binance 15m (official) per coin per year, double costs, Bybit 15m cross-check, SOL re-run on Binance 1m candles.
// usage: node v7-years.js → results/v7-years.md
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js'), V = require('./v7m.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const sum = (a) => a.reduce((x, t) => x + t.R, 0), f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(1);
const YRS = [2019, 2020, 2021, 2022, 2023, 2024, 2025], lab = (y) => `Oct ${String(y).slice(2)}–${String(y + 1).slice(2)}`;
const inY = (t, y) => t.t >= D0(`${y}-10-18`) && t.t < D0(`${y + 1}-10-18`);
const bin = {}, bin2 = {}, byb = {};
for (const s of ['SOL', 'ETH']) {
  const D = E.analyze(s + '-binance', JSON.parse(fs.readFileSync(`data/binance-${s.toLowerCase()}15.json`, 'utf8')), C.swingLen);
  const S = E.setupsFor(D, C);
  bin[s] = E.execute(D, C, S); bin2[s] = E.execute(D, { ...C, costMult: 2 }, S); byb[s] = T.build(s).trades;
}
const firstTrade = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') }; // warm-up after listing
const stat = (a) => {
  const R = a.map((t) => t.R), gp = R.filter((x) => x > 0).reduce((p, x) => p + x, 0), gl = -R.filter((x) => x <= 0).reduce((p, x) => p + x, 0);
  let c = 0, pk = 0, dd = 0; for (const x of R) { c += x; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); }
  const mo = {}; for (const t of a) { const k = new Date(t.t * 1000).toISOString().slice(0, 7); mo[k] = (mo[k] || 0) + t.R; }
  const mv = Object.values(mo);
  return { n: a.length, R: sum(a), pf: gl ? gp / gl : 99, tp: a.filter((t) => t.R > 1.5).length, dd, pos: mv.filter((x) => x > 0).length, months: mv.length, worst: mv.length ? Math.min(...mv) : 0 };
};
const L = ['# v7 double-check, year by year ($1 risk per trade = 1R)', '',
  'Frozen v7 (ie.js sha 6539c98f…, unchanged). Binance USDT-M futures = official source. Years run 18 Oct → 17 Oct.', ''];
for (const s of ['SOL', 'ETH']) {
  L.push(`## ${s}`, '', '| Year | Trades | **Binance R** | PF | 3R hits | Max DD | Profitable months | Worst month | Costs ×2 | Bybit R | 1m re-run R |', '|---|---|---|---|---|---|---|---|---|---|---|');
  let tot = { b: 0, b2: 0, y: 0, m: 0, n: 0 };
  for (const y of YRS) {
    if (D0(`${y + 1}-10-18`) <= firstTrade[s]) continue;
    const sel = (a) => a.filter((t) => inY(t, y) && t.t >= firstTrade[s]);
    const b = stat(sel(bin[s])), b2 = sum(sel(bin2[s]));
    const yb = y >= (s === 'SOL' ? 2021 : 2021) ? sum(byb[s].filter((t) => inY(t, y))) : null;
    let m1 = null;
    if (s === 'SOL' && fs.existsSync(`data/binance-sol1-${y}.json`)) m1 = sum(V.run('SOL', {}, [`${y}-10-18`, `${y + 1}-10-18`], y));
    tot.b += b.R; tot.b2 += b2; tot.n += b.n; if (yb != null) tot.y += yb; if (m1 != null) tot.m += m1;
    L.push(`| ${lab(y)} | ${b.n} | **${f(b.R)}** | ${b.pf.toFixed(2)} | ${b.tp} (${(b.tp / b.n * 100).toFixed(0)}%) | ${b.dd.toFixed(1)}R | ${b.pos}/${b.months} | ${f(b.worst)} | ${f(b2)} | ${yb == null ? '—' : f(yb)} | ${m1 == null ? '—' : f(m1)} |`);
  }
  L.push(`| **All** | ${tot.n} | **${f(tot.b)}** | | | | | | ${f(tot.b2)} | ${f(tot.y)} (from Oct 21) | ${s === 'SOL' ? f(tot.m) : '—'} |`, '');
}
// combined
L.push('## SOL + ETH combined (Binance)', '', '| Year | Trades | R | Profitable months | Worst month | Max DD |', '|---|---|---|---|---|---|');
for (const y of YRS) {
  const a = ['SOL', 'ETH'].flatMap((s) => bin[s].filter((t) => inY(t, y) && t.t >= firstTrade[s])).sort((p, q) => p.t - q.t), b = stat(a);
  L.push(`| ${lab(y)} | ${b.n} | **${f(b.R)}** | ${b.pos}/${b.months} | ${f(b.worst)} | ${b.dd.toFixed(1)}R |`);
}
fs.writeFileSync('results/v7-years.md', L.join('\n') + '\n');
console.log(L.join('\n'));
