import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const D = process.argv[2] || fileURLToPath(new URL('./trades', import.meta.url)), coins = ['SOL','ZEC','NEAR','ADA','GALA'];
const bb = [], ic = [];
for (const c of coins) {
  for (const l of fs.readFileSync(`${D}/bb_${c}.txt`, 'utf8').split('\n')) { const m = l.match(/^\s+(\d{4}-\d\d-\d\d)\s+[LS]\s+\S+\s+→\s+\S+\s+\w+\s+([+-]\d+\.\d+)R\s+(\d+) bars/); if (m) bb.push({ t: Date.parse(m[1]) + (+m[3]) * 4 * 3600e3, r: +m[2] }); }
  for (const l of fs.readFileSync(`${D}/ic_${c}.txt`, 'utf8').split('\n')) { const m = l.match(/^\s+\d{4}-\d\d-\d\d\s+→\s+(\d{4}-\d\d-\d\d)\s+(?:LONG|SHORT)\s+\S+\s+→\s+\S+\s+\w+\s+([+-]\d+\.\d+)R/); if (m) ic.push({ t: Date.parse(m[1]), r: +m[2] }); }
}
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length, sd = (x) => { const m = mean(x); return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1)); };
const pct = (x, p) => { const s = [...x].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function boot(R, n = 10000) { const out = []; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < R.length; j++) s += R[Math.floor(rnd() * R.length)]; out.push(s / R.length); } return out; }
const years = 6.6;
for (const [name, T] of [['BB-Core', bb], ['I-Core', ic]]) {
  const R = T.map((x) => x.r), s = [...R].sort((a, b) => b - a), b = boot(R);
  const trim = (k) => mean(s.slice(k));
  const wins = R.filter((r) => r > 0), loss = R.filter((r) => r <= 0);
  console.log(`\n== ${name}: n=${R.length}, ${(R.length / years).toFixed(0)}/yr, win ${(100 * wins.length / R.length).toFixed(1)}%, avg win ${mean(wins).toFixed(2)}R, avg loss ${mean(loss).toFixed(2)}R`);
  console.log(`  expectancy ${mean(R).toFixed(3)}R  sd ${sd(R).toFixed(2)}R  t=${(mean(R) / (sd(R) / Math.sqrt(R.length))).toFixed(1)}  bootstrap 95% [${pct(b, .025).toFixed(3)}, ${pct(b, .975).toFixed(3)}]  P(E<=0)=${(b.filter((v) => v <= 0).length / b.length * 100).toFixed(2)}%`);
  console.log(`  without best 5/10/20/40 trades: ${[5, 10, 20, 40].map((k) => trim(k).toFixed(3)).join(' / ')} R  | best trade ${s[0].toFixed(1)}R  | R/yr ${(mean(R) * R.length / years).toFixed(0)}`);
  const half = R.length / 2, early = T.filter((x) => x.t < Date.parse('2023-01-01')).map((x) => x.r), late = T.filter((x) => x.t >= Date.parse('2023-01-01')).map((x) => x.r);
  console.log(`  2020-22 avg ${mean(early).toFixed(3)}R (n=${early.length})  2023-26 avg ${mean(late).toFixed(3)}R (n=${late.length})  median trade ${pct(R, .5).toFixed(2)}R`);
}
// monthly series and mean-variance split
const mon = (T) => { const m = {}; for (const x of T) { const k = new Date(x.t).toISOString().slice(0, 7); m[k] = (m[k] || 0) + x.r; } return m; };
const mb = mon(bb), mi = mon(ic), ks = [...new Set([...Object.keys(mb), ...Object.keys(mi)])].sort(), a = ks.map((k) => mb[k] || 0), c = ks.map((k) => mi[k] || 0);
const ma = mean(a), mc = mean(c), sa = sd(a), sc = sd(c), cov = a.reduce((s, v, i) => s + (v - ma) * (c[i] - mc), 0) / (a.length - 1), rho = cov / (sa * sc);
const tang = (m1, m2) => { const det = sa * sa * sc * sc - cov * cov, w1 = (sc * sc * m1 - cov * m2) / det, w2 = (-cov * m1 + sa * sa * m2) / det; return w1 / (w1 + w2); };
const icTrimMonthly = (() => { const s = [...ic].sort((p, q) => q.r - p.r), top = new Set(s.slice(0, 10)); const m = mon(ic.filter((x) => !top.has(x))); return mean(ks.map((k) => m[k] || 0)); })();
console.log(`\n== monthly R: BB mean ${ma.toFixed(2)} sd ${sa.toFixed(2)} (ratio ${(ma / sa).toFixed(2)}) | IC mean ${mc.toFixed(2)} sd ${sc.toFixed(2)} (ratio ${(mc / sc).toFixed(2)}) | correlation ${rho.toFixed(2)}`);
console.log(`  best-ratio BB share: as tested ${(100 * tang(ma, mc)).toFixed(0)}% | IC edge halved ${(100 * tang(ma, mc / 2)).toFixed(0)}% | IC without its 10 best trades (monthly mean ${icTrimMonthly.toFixed(2)}) ${(100 * tang(ma, icTrimMonthly)).toFixed(0)}%`);
// one-year simulation, separate sub-accounts, $250.39 total, each bot risks rp of its own balance, trades drawn at random from history
function year(w, rp, icPool, n = 20000) {
  const S = 250.39, nb = Math.round(bb.length / years), ni = Math.round(ic.length / years), BR = bb.map((x) => x.r), out = [], dd = [];
  for (let i = 0; i < n; i++) {
    let eb = S * w, ei = S * (1 - w);
    const seq = []; for (let j = 0; j < nb; j++) seq.push(['b', BR[Math.floor(rnd() * BR.length)]]); for (let j = 0; j < ni; j++) seq.push(['i', icPool[Math.floor(rnd() * icPool.length)]]);
    for (let j = seq.length - 1; j > 0; j--) { const k = Math.floor(rnd() * (j + 1)); [seq[j], seq[k]] = [seq[k], seq[j]]; }
    let pk = S, m = 0;
    for (const [s, r] of seq) { if (s === 'b' && w > 0) eb += eb * rp * r; else if (s === 'i' && w < 1) ei += ei * rp * r; const tot = eb + ei; pk = Math.max(pk, tot); m = Math.max(m, (pk - tot) / pk); }
    out.push(eb + ei); dd.push(m);
  }
  return { p5: pct(out, .05), med: pct(out, .5), down: out.filter((v) => v < S).length / n, dd95: pct(dd, .95), ddMed: pct(dd, .5), dd20: dd.filter((v) => v > .2).length / n };
}
const icR = ic.map((x) => x.r), icNoTop = [...icR].sort((p, q) => q - p).slice(10);
for (const [label, pool] of [['I-Core as tested', icR], ['I-Core WITHOUT its 10 best trades (big winners do not repeat)', icNoTop]]) {
  console.log(`\n== 1 year from $250.39, ${label}`);
  console.log('risk | BB/IC | bad year (5th pct) | median end | P(year down) | median worst drop | 95th pct worst drop | P(drop>20%)');
  for (const rp of [0.005, 0.01, 0.025]) for (const w of [1, 0.8, 0.7, 0.5]) { const r = year(w, rp, pool); console.log(`${(rp * 100).toFixed(1)}% | ${w * 100}/${Math.round((1 - w) * 100)} | $${r.p5.toFixed(0)} | $${r.med.toFixed(0)} | ${(r.down * 100).toFixed(1)}% | ${(r.ddMed * 100).toFixed(0)}% | ${(r.dd95 * 100).toFixed(0)}% | ${(r.dd20 * 100).toFixed(0)}%`); }
}
