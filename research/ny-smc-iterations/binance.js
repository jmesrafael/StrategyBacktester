// binance.js — frozen v7 on Binance USDT-M futures 15m (official source from 2026-10-19), $1 risk per trade.
// Part 1: Binance vs Bybit on the overlap (candles + trades). Part 2: full history stats, yearly + monthly per coin.
// usage: node binance.js → results/binance-v7.md, results/binance-v7.json
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
let seed = 4242; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const sum = (a) => a.reduce((x, y) => x + y, 0), mean = (a) => (a.length ? sum(a) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / Math.max(1, a.length - 1)); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
const f = (x, d = 2) => (Math.abs(x) < 0.005 ? ' 0.00' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(d));
const L = [], J = {};
const END = D0('2026-10-18');
// periods: U = never seen before (Binance-only years), A = Check A years, IS = 2023–26 (v7 was tuned here)
const PER = { U: [D0('2019-12-15'), D0('2021-10-18')], A: [D0('2021-10-18'), D0('2023-10-18')], IS: [D0('2023-10-18'), END] };
const PNAME = { U: 'Dec 2019 – Oct 2021 (never seen)', A: 'Oct 2021 – Oct 2023 (Check A)', IS: 'Oct 2023 – Oct 2026 (tuned here)' };
const inP = (t, p) => t.t >= PER[p][0] && t.t < PER[p][1];

const bin = {}, byb = {};
for (const s of ['SOL', 'ETH']) {
  const raw = JSON.parse(fs.readFileSync(`data/binance-${s.toLowerCase()}15.json`, 'utf8'));
  const D = E.analyze(s + '-binance', raw, C.swingLen);
  bin[s] = { D, raw, trades: E.execute(D, C, E.setupsFor(D, C)).filter((t) => t.t < END) };
  byb[s] = T.build(s);
}
// ---------- Part 1: Binance vs Bybit ----------
L.push('# v7 on Binance USDT-M futures (15m) — $1 risk per trade', '', 'Rules frozen (ie.js unchanged), fees and slippage as before. 1R = $1.', '', '## 1. Is Binance data good? (vs Bybit on the overlap)', '');
L.push('| Coin | Binance candles | Zero-volume candles | Overlap candles | Avg close difference | Avg range difference | Bybit trades | Binance trades | Same trade | Same outcome | Bybit P&L | Binance P&L |', '|---|---|---|---|---|---|---|---|---|---|---|---|');
J.check = {};
for (const s of ['SOL', 'ETH']) {
  const bm = new Map(byb[s].D.B.map((b) => [b.time, b]));
  let n = 0, dc = 0, dr = 0;
  for (const b of bin[s].D.B) { const o = bm.get(b.time); if (!o) continue; n++; dc += Math.abs(b.close - o.close) / o.close; const r1 = b.high - b.low, r2 = o.high - o.low; if (r2 > 0) dr += Math.abs(r1 - r2) / r2; }
  const zero = bin[s].raw.filter((r) => r[5] === 0).length;
  const lo = Math.max(D0('2021-10-18'), byb[s].D.B[300].time), hi = END;
  const a = byb[s].trades.filter((t) => t.t >= lo && t.t < hi), b = bin[s].trades.filter((t) => t.t >= lo && t.t < hi);
  const am = new Map(a.map((t) => [t.t, t])); let same = 0, so = 0;
  for (const t of b) { const o = am.get(t.t) || am.get(t.t - 900) || am.get(t.t + 900); if (o && o.long === t.long) { same++; if (Math.abs(o.R - t.R) < 0.3) so++; } }
  J.check[s] = { n, closeDiff: dc / n, rangeDiff: dr / n, zero, bybitN: a.length, binN: b.length, same, so, bybitR: sum(a.map((t) => t.R)), binR: sum(b.map((t) => t.R)) };
  L.push(`| ${s} | ${bin[s].raw.length} | ${zero} | ${n} | ${(dc / n * 100).toFixed(3)}% | ${(dr / n * 100).toFixed(1)}% | ${a.length} | ${b.length} | ${same} | ${so} | ${f(sum(a.map((t) => t.R)))} | ${f(sum(b.map((t) => t.R)))} |`);
}
// per-year comparison on the overlap
L.push('', '| Year | Bybit SOL | Binance SOL | Bybit ETH | Binance ETH |', '|---|---|---|---|---|');
const YRS = []; for (let y = 2019; y <= 2025; y++) YRS.push([`Oct ${String(y).slice(2)} – Oct ${String(y + 1).slice(2)}`, D0(`${y}-10-18`), D0(`${y + 1}-10-18`)]);
for (const [n, a, b] of YRS.filter(([, a]) => a >= D0('2021-10-18'))) {
  const r = (arr) => f(sum(arr.filter((t) => t.t >= a && t.t < b).map((t) => t.R)));
  L.push(`| ${n} | ${r(byb.SOL.trades)} | ${r(bin.SOL.trades)} | ${r(byb.ETH.trades)} | ${r(bin.ETH.trades)} |`);
}
// ---------- Part 2: full Binance history ----------
const all = [];
for (const s of ['SOL', 'ETH']) { const { D, trades } = bin[s];
  const start = s === 'SOL' ? D0('2020-10-18') : PER.U[0]; // ~1 month warm-up after listing
  for (const t of trades) if (t.t >= start && t.t < END) all.push({ sym: s, t: t.t, R: t.R, long: t.long, atrPct: D.atr[t.fillIdx] / t.fillPx,
    kind: t.R > 1.5 ? 'tp' : t.R > -0.15 ? 'be' : t.R > -0.8 ? 'cut' : 'stop' }); }
all.sort((a, b) => a.t - b.t);
function st(a) {
  const R = a.map((t) => t.R), n = R.length; if (!n) return null;
  const gp = sum(R.filter((x) => x > 0)), gl = -sum(R.filter((x) => x <= 0));
  let c = 0, pk = 0, dd = 0, run = 0, ls = 0; for (const x of R) { c += x; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); if (x <= 0.15) ls = Math.max(ls, ++run); else run = 0; }
  const bs = []; for (let i = 0; i < 4000; i++) { let s2 = 0; for (let j = 0; j < n; j++) s2 += R[Math.floor(rnd() * n)]; bs.push(s2 / n); }
  const k = (x) => a.filter((t) => t.kind === x).length / n;
  return { n, total: sum(R), avg: mean(R), ci: [q(bs, 0.025), q(bs, 0.975)], t: mean(R) / (sd(R) / Math.sqrt(n)), pf: gl ? gp / gl : 99, tp: k('tp'), be: k('be'), cut: k('cut'), stop: k('stop'), dd, ls };
}
L.push('', '## 2. Core stats by period', '', 'SOL trades start Oct 2020 (Binance listing Sep 2020 + warm-up); ETH trades start Dec 2019.', '',
  '| Period | Coin | Trades | Total | Avg/trade | 95% range of avg | t-stat | PF | 3R hit | BE | −0.5R cut | Full stop | Max DD | Worst run |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
J.core = {};
for (const p of ['U', 'A', 'IS', 'ALL']) for (const s of ['SOL', 'ETH', 'Both']) {
  const a = all.filter((t) => (p === 'ALL' || inP(t, p)) && (s === 'Both' || t.sym === s)), r = st(a); if (!r) continue; J.core[`${p}/${s}`] = r;
  const pc = (x) => (x * 100).toFixed(0) + '%';
  L.push(`| ${p === 'ALL' ? 'All years' : PNAME[p]} | ${s} | ${r.n} | ${f(r.total)} | ${f(r.avg, 2)}R | ${f(r.ci[0], 2)} … ${f(r.ci[1], 2)} | ${r.t.toFixed(2)} | ${r.pf.toFixed(2)} | ${pc(r.tp)} | ${pc(r.be)} | ${pc(r.cut)} | ${pc(r.stop)} | ${r.dd.toFixed(1)}R | ${r.ls} |`);
}
// yearly Oct–Oct
L.push('', '## 3. By year (Oct–Oct, $1 risk)', '', '| Year | SOL trades | SOL | ETH trades | ETH | Both | Net |', '|---|---|---|---|---|---|---|');
J.years = [];
for (const [n, a, b] of YRS) {
  const x = all.filter((t) => t.t >= a && t.t < b), sv = x.filter((t) => t.sym === 'SOL'), ev = x.filter((t) => t.sym === 'ETH'), tot = sum(x.map((t) => t.R));
  J.years.push({ n, sol: sum(sv.map((t) => t.R)), eth: sum(ev.map((t) => t.R)), tot });
  L.push(`| ${n} | ${sv.length || '—'} | ${sv.length ? f(sum(sv.map((t) => t.R))) : 'not listed'} | ${ev.length} | ${f(sum(ev.map((t) => t.R)))} | **${f(tot)}** | ${tot > 0 ? '✅' : '❌'} |`);
}
// monthly by calendar year per coin
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mk = (t) => new Date(t * 1000).toISOString().slice(0, 7);
J.monthly = {};
for (const s of ['SOL', 'ETH', 'Both']) {
  L.push('', `## 4${s === 'SOL' ? 'a' : s === 'ETH' ? 'b' : 'c'}. Monthly — ${s === 'Both' ? 'SOL + ETH combined' : s} ($1 risk, · = no trades)`, '', `| Year | ${MON.join(' | ')} | **Year** | Net | + months |`, `|---|${MON.map(() => '---').join('|')}|---|---|---|`);
  let grand = 0;
  for (let y = 2019; y <= 2026; y++) {
    let tot = 0, pos = 0, cnt = 0;
    const cells = MON.map((_, i) => { const k = `${y}-${String(i + 1).padStart(2, '0')}`; const x = all.filter((t) => mk(t.t) === k && (s === 'Both' || t.sym === s));
      if (!x.length) return '·'; const v = sum(x.map((t) => t.R)); tot += v; cnt++; if (v > 0) pos++; (J.monthly[s] = J.monthly[s] || {})[k] = v; return f(v); });
    if (!cnt) continue; grand += tot;
    L.push(`| ${y} | ${cells.join(' | ')} | **${f(tot)}** | ${tot > 0 ? '✅' : '❌'} | ${pos}/${cnt} |`);
  }
  L.push(`| **All** | ${MON.map(() => '').join(' | ')} | **${f(grand)}** | | |`);
}
// rolling 12 months + Monte Carlo
{ const ms = []; for (let d = new Date('2020-12-01T00:00:00Z'); d < new Date('2026-11-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1)) ms.push(d.getTime() / 1000);
  J.rolling = ms.map((e) => { const s0 = new Date(e * 1000); s0.setUTCFullYear(s0.getUTCFullYear() - 1); return [new Date(e * 1000 - 1).toISOString().slice(0, 7), sum(all.filter((t) => t.t >= s0 / 1000 && t.t < e).map((t) => t.R))]; });
  const neg = J.rolling.filter(([, v]) => v < 0).length;
  L.push('', '## 5. Rolling 12-month P&L (both coins, $1 risk)', '', J.rolling.map(([m, v]) => `${m} ${f(v, 1)}`).join(' · '), '', `Negative 12-month windows: ${neg} of ${J.rolling.length}.`); }
J.mc = {};
L.push('', '## 6. Next 12 months, simulated (~54 trades, $1 risk)', '', '| If the future looks like | Worst 5% | Median | Best 5% | Chance of losing year | Bad-case DD (95th) |', '|---|---|---|---|---|---|');
for (const [lab, src] of [['Oct 2023 – Oct 2026', all.filter((t) => inP(t, 'IS'))], ['All Binance years', all], ['Everything except 2023–26', all.filter((t) => !inP(t, 'IS'))]]) {
  const R = src.map((t) => t.R), res = [], dds = [];
  for (let i = 0; i < 10000; i++) { let c = 0, pk = 0, dd = 0; for (let j = 0; j < 54; j++) { c += R[Math.floor(rnd() * R.length)]; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); } res.push(c); dds.push(dd); }
  J.mc[lab] = { p5: q(res, 0.05), p50: q(res, 0.5), p95: q(res, 0.95), pLoss: res.filter((x) => x <= 0).length / res.length, dd95: q(dds, 0.95) };
  L.push(`| ${lab} | ${f(q(res, 0.05))} | ${f(q(res, 0.5))} | ${f(q(res, 0.95))} | ${(J.mc[lab].pLoss * 100).toFixed(1)}% | ${q(dds, 0.95).toFixed(1)}R |`);
}
fs.writeFileSync('results/binance-v7.md', L.join('\n') + '\n');
fs.writeFileSync('results/binance-v7.json', JSON.stringify(J, null, 1));
console.log(L.join('\n'));
