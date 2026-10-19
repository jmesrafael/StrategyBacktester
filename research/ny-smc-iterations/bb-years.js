// bb-years.js — v7 vs v7 + A11 (CHoCH leg beyond Bollinger(20,2)), SOL + ETH, year by year and combined risk. Live-style, $1 risk.
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js'), I = require('./ind.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000, START = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') }, END = D0('2026-10-18');
const res = { v7: [], bb: [] };
for (const sym of ['SOL', 'ETH']) {
  const D = E.analyze(sym + '-binance', JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}15.json`, 'utf8')), C.swingLen), B = D.B, S = E.setupsFor(D, C);
  const bb = I.bb(B.map((b) => b.close), 20, 2), ok = (s) => { const b = bb[s.legXi]; return b && (s.long ? B[s.legXi].low < b.lo : B[s.legXi].high > b.up); };
  for (const [k, set] of [['v7', S], ['bb', S.filter(ok)]]) for (const t of E.execute(D, C, set)) if (t.t >= START[sym] && t.t < END) res[k].push({ sym, t: t.t, R: t.R });
}
const f = (x) => (x < 0 ? '−' : '+') + Math.abs(x).toFixed(1);
const L = ['| Year | v7 SOL | +BB SOL | v7 ETH | +BB ETH | **v7 both** | **+BB both** |', '|---|---|---|---|---|---|---|'];
for (let y = 2019; y <= 2025; y++) { const a = D0(`${y}-10-18`), b = D0(`${y + 1}-10-18`), s = (k, sym) => res[k].filter((t) => t.t >= a && t.t < b && (!sym || t.sym === sym)).reduce((p, t) => p + t.R, 0);
  L.push(`| Oct ${String(y).slice(2)}–${String(y + 1).slice(2)} | ${f(s('v7', 'SOL'))} | ${f(s('bb', 'SOL'))} | ${f(s('v7', 'ETH'))} | ${f(s('bb', 'ETH'))} | **${f(s('v7'))}** | **${f(s('bb'))}** |`); }
console.log(L.join('\n'));
for (const k of ['v7', 'bb']) { const a = res[k].sort((p, q) => p.t - q.t); let c = 0, pk = 0, dd = 0; for (const t of a) { c += t.R; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); }
  const mo = {}; for (const t of a) { const m = new Date(t.t * 1000).toISOString().slice(0, 7); mo[m] = (mo[m] || 0) + t.R; } const mv = Object.values(mo);
  const yrs = []; for (let y = 2019; y <= 2025; y++) yrs.push(a.filter((t) => t.t >= D0(`${y}-10-18`) && t.t < D0(`${y + 1}-10-18`)).reduce((p, t) => p + t.R, 0));
  console.log(k, 'trades', a.length, 'total', c.toFixed(1), 'maxDD', dd.toFixed(1), 'total/DD', (c / dd).toFixed(2), 'avg/trade', (c / a.length).toFixed(3), '3R hits', (a.filter((t) => t.R > 1.5).length / a.length * 100).toFixed(0) + '%',
    'profitable months', mv.filter((x) => x > 0).length + '/' + mv.length, 'worst month', Math.min(...mv).toFixed(1), 'losing years', yrs.filter((x) => x < 0).length + '/7'); }
