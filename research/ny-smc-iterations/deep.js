// deep.js — deep statistics for frozen v7 at $1 risk. Part 1: MEXC vs Bybit on the overlapping year. Part 2: 5-year Bybit stats.
// usage: node deep.js → results/deep-stats.json (printed summary)
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js');
const D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000, C = T.C;
const P = { pre: [D0('2021-10-18'), D0('2023-10-18')], post: [D0('2023-10-18'), D0('2026-10-18')], all: [D0('2021-10-18'), D0('2026-10-18')] };
const out = {};
let seed = 777; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const sum = (a) => a.reduce((x, y) => x + y, 0), mean = (a) => (a.length ? sum(a) / a.length : 0);
const sd = (a) => { const m = mean(a); return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / Math.max(1, a.length - 1)); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };

// ---------- Part 1: MEXC vs Bybit ----------
{
  const lo = D0('2025-10-23'), hi = D0('2026-10-18'), res = {};
  for (const s of ['SOL', 'ETH']) {
    const Dm = E.analyze(s + '-mexc', JSON.parse(fs.readFileSync(`data/mexc-${s.toLowerCase()}15.json`, 'utf8')), C.swingLen);
    const m = E.execute(Dm, C, E.setupsFor(Dm, C)).filter((t) => t.t >= lo && t.t < hi);
    const b = T.build(s).trades.filter((t) => t.t >= lo && t.t < hi);
    let matched = 0, sameOutcome = 0; const bt = new Map(b.map((t) => [t.t, t]));
    for (const t of m) { const o = bt.get(t.t) || bt.get(t.t - 900) || bt.get(t.t + 900); if (o && o.long === t.long) { matched++; if (Math.abs(o.R - t.R) < 0.3) sameOutcome++; } }
    res[s] = { mexcN: m.length, bybitN: b.length, matched, sameOutcome, mexcR: sum(m.map((t) => t.R)), bybitR: sum(b.map((t) => t.R)) };
  }
  out.mexc = res;
}

// ---------- Part 2: 5-year stats (Bybit) ----------
const all = [];
for (const s of ['SOL', 'ETH']) {
  const { D, trades } = T.build(s);
  for (const t of trades) {
    if (t.t < P.all[0] || t.t >= P.all[1]) continue;
    const ch = D.B[t.s.chochIdx].time, h = (ch - t.s.sessStart) / 3600, et = new Date((ch - 4 * 3600) * 1000);
    all.push({ sym: s, t: t.t, R: t.R, long: t.long, win: h < 1 ? '08:30-09:30' : '10:30-11:30', dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][et.getUTCDay()],
      atrPct: D.atr[t.fillIdx] / t.fillPx, hold: t.exitIdx - t.fillIdx + 1,
      kind: t.R > 1.5 ? 'TP 3R' : t.R > 0.15 ? 'small win' : t.R > -0.15 ? 'breakeven' : t.R > -0.8 ? 'cut -0.5R' : 'full stop' });
  }
}
all.sort((a, b) => a.t - b.t);
const inP = (t, p) => t.t >= P[p][0] && t.t < P[p][1];
function st(a) {
  const R = a.map((t) => t.R), n = R.length; if (!n) return { n: 0 };
  const gp = sum(R.filter((x) => x > 0)), gl = -sum(R.filter((x) => x <= 0));
  let c = 0, pk = 0, dd = 0, run = 0, ls = 0;
  for (const x of R) { c += x; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); if (x <= 0.15) ls = Math.max(ls, ++run); else run = 0; }
  const bs = []; for (let i = 0; i < 5000; i++) { let s2 = 0; for (let j = 0; j < n; j++) s2 += R[Math.floor(rnd() * n)]; bs.push(s2 / n); }
  const kinds = {}; for (const t of a) kinds[t.kind] = (kinds[t.kind] || 0) + 1;
  return { n, total: sum(R), avg: mean(R), ci: [q(bs, 0.025), q(bs, 0.975)], pLoss: bs.filter((x) => x <= 0).length / bs.length, t: mean(R) / (sd(R) / Math.sqrt(n)), pf: gl ? gp / gl : 99,
    winRate: R.filter((x) => x > 0.15).length / n, avgWin: mean(R.filter((x) => x > 0.15)), avgLoss: mean(R.filter((x) => x < -0.15)), maxDD: dd, streak: ls, kinds };
}
out.table = {};
for (const p of ['pre', 'post', 'all']) for (const s of ['SOL', 'ETH', 'BOTH']) out.table[`${p}/${s}`] = st(all.filter((t) => inP(t, p) && (s === 'BOTH' || t.sym === s)));
out.splits = {};
for (const [name, f] of [['direction', (t) => (t.long ? 'long' : 'short')], ['window', (t) => t.win], ['dow', (t) => t.dow], ['kind', (t) => t.kind]])
  for (const p of ['pre', 'post']) {
    const g = {}; for (const t of all.filter((x) => inP(x, p))) (g[f(t)] = g[f(t)] || []).push(t);
    out.splits[`${name}/${p}`] = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { n: v.length, total: sum(v.map((x) => x.R)), avg: mean(v.map((x) => x.R)) }]));
  }
// volatility: ATR% at fill, quintiles over all 5 years
{
  const cuts = [0.2, 0.4, 0.6, 0.8].map((p) => q(all.map((t) => t.atrPct), p)), g = [[], [], [], [], []];
  for (const t of all) g[cuts.filter((c) => t.atrPct > c).length].push(t);
  out.vol = g.map((v, i) => ({ band: i + 1, lo: i ? cuts[i - 1] : 0, hi: cuts[i] || Infinity, n: v.length, avg: mean(v.map((x) => x.R)),
    preAvg: mean(v.filter((x) => inP(x, 'pre')).map((x) => x.R)), postAvg: mean(v.filter((x) => inP(x, 'post')).map((x) => x.R)), pre: v.filter((x) => inP(x, 'pre')).length, post: v.filter((x) => inP(x, 'post')).length }));
  out.atrMedian = { pre: q(all.filter((t) => inP(t, 'pre')).map((t) => t.atrPct), 0.5), post: q(all.filter((t) => inP(t, 'post')).map((t) => t.atrPct), 0.5) };
}
// pre vs post: permutation test on mean R
{
  const a = all.filter((t) => inP(t, 'pre')).map((t) => t.R), b = all.filter((t) => inP(t, 'post')).map((t) => t.R), obs = mean(b) - mean(a), pool = [...a, ...b];
  let ge = 0;
  for (let i = 0; i < 5000; i++) { for (let j = pool.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [pool[j], pool[k]] = [pool[k], pool[j]]; } if (mean(pool.slice(a.length)) - mean(pool.slice(0, a.length)) >= obs) ge++; }
  out.prePostP = ge / 5000; out.prePostDiff = obs;
}
// 12-month Monte Carlo at $1 risk (54 trades/yr)
out.mc = {};
for (const [lab, src] of [['post', all.filter((t) => inP(t, 'post'))], ['all5y', all]]) {
  const R = src.map((t) => t.R), res = [], dds = [];
  for (let i = 0; i < 10000; i++) { let c = 0, pk = 0, dd = 0; for (let j = 0; j < 54; j++) { c += R[Math.floor(rnd() * R.length)]; pk = Math.max(pk, c); dd = Math.max(dd, pk - c); } res.push(c); dds.push(dd); }
  out.mc[lab] = { p5: q(res, 0.05), p50: q(res, 0.5), p95: q(res, 0.95), pLoss: res.filter((x) => x <= 0).length / res.length, dd50: q(dds, 0.5), dd95: q(dds, 0.95) };
}
// rolling 12-month P&L
{
  const months = []; for (let d = new Date('2022-10-01T00:00:00Z'); d < new Date('2026-11-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.getTime() / 1000);
  out.rolling = months.map((e) => { const s = new Date(e * 1000); s.setUTCFullYear(s.getUTCFullYear() - 1); return [new Date(e * 1000 - 1).toISOString().slice(0, 7), sum(all.filter((t) => t.t >= s / 1000 && t.t < e).map((t) => t.R))]; });
}
out.hold = { median: q(all.map((t) => t.hold), 0.5) * 15, p90: q(all.map((t) => t.hold), 0.9) * 15 };
fs.writeFileSync('results/deep-stats.json', JSON.stringify(out, null, 1));

const f = (x, d = 2) => (x < 0 ? '-' : '+') + Math.abs(x).toFixed(d);
console.log('== MEXC vs Bybit (23 Oct 25 - 17 Oct 26), $1 risk');
for (const s of ['SOL', 'ETH']) { const r = out.mexc[s]; console.log(s, 'mexc', r.mexcN, f(r.mexcR), '| bybit', r.bybitN, f(r.bybitR), '| same trade', r.matched, 'same outcome', r.sameOutcome); }
console.log('\n== Core stats ($1 = 1R)');
for (const [k, v] of Object.entries(out.table)) console.log(k.padEnd(10), 'n', v.n, 'tot', f(v.total), 'avg', f(v.avg, 3), 'CI', v.ci.map((x) => f(x, 3)).join('..'), 'P(avg<=0)', v.pLoss.toFixed(3), 't', v.t.toFixed(2), 'PF', v.pf.toFixed(2), 'win', (v.winRate * 100).toFixed(0) + '%', 'avgW', f(v.avgWin), 'avgL', f(v.avgLoss), 'DD', v.maxDD.toFixed(1), 'streak', v.streak, JSON.stringify(v.kinds));
console.log('\n== Splits'); for (const [k, v] of Object.entries(out.splits)) console.log(k, Object.entries(v).map(([a, b]) => `${a}: n${b.n} ${f(b.total, 1)} (${f(b.avg, 2)}/tr)`).join(' | '));
console.log('\n== Volatility (ATR% at fill) quintiles'); for (const v of out.vol) console.log(`Q${v.band} ${(v.lo * 100).toFixed(2)}-${(v.hi * 100).toFixed(2)}%  n ${v.n} avg ${f(v.avg, 3)}  pre ${v.pre} (${f(v.preAvg, 2)}) post ${v.post} (${f(v.postAvg, 2)})`);
console.log('median ATR% pre', (out.atrMedian.pre * 100).toFixed(3), 'post', (out.atrMedian.post * 100).toFixed(3));
console.log('\npre vs post mean diff', f(out.prePostDiff, 3), 'perm p', out.prePostP);
console.log('MC 12 months', JSON.stringify(out.mc));
console.log('hold minutes', JSON.stringify(out.hold));
console.log('rolling 12m', out.rolling.map(([m, v]) => m + ' ' + f(v, 1)).join(', '));
