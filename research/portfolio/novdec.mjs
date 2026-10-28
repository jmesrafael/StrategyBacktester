import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const D = process.argv[2] || fileURLToPath(new URL('./trades', import.meta.url)), coins = ['SOL','ZEC','NEAR','ADA','GALA'];
const all = [];
for (const c of coins) {
  for (const l of fs.readFileSync(`${D}/bb_${c}.txt`, 'utf8').split('\n')) { const m = l.match(/^\s+(\d{4}-\d\d-\d\d)\s+[LS]\s+\S+\s+→\s+\S+\s+\w+\s+([+-]\d+\.\d+)R\s+(\d+) bars/); if (m) all.push({ bot: 'bb', t: Date.parse(m[1]) + (+m[3]) * 4 * 3600e3, r: +m[2] }); }
  for (const l of fs.readFileSync(`${D}/ic_${c}.txt`, 'utf8').split('\n')) { const m = l.match(/^\s+\d{4}-\d\d-\d\d\s+→\s+(\d{4}-\d\d-\d\d)\s+(?:LONG|SHORT)\s+\S+\s+→\s+\S+\s+\w+\s+([+-]\d+\.\d+)R/); if (m) all.push({ bot: 'ic', t: Date.parse(m[1]) + 12 * 3600e3, r: +m[2] }); }
}
all.sort((a, b) => a.t - b.t);
const S0 = { bb: 201.23, ic: 49.98 }, START = S0.bb + S0.ic;
function run(tr, b) { let pk = b.bb + b.ic, dd = 0; for (const x of tr) { b[x.bot] += Math.min(10, b[x.bot] * 0.025) * x.r; const tot = b.bb + b.ic; pk = Math.max(pk, tot); dd = Math.max(dd, (pk - tot) / pk); } return dd; }
const ym = (t) => new Date(t).toISOString().slice(0, 7);
const sumR = (tr, bot) => tr.filter((x) => x.bot === bot).reduce((a, x) => a + x.r, 0);
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(0);
console.log('year | NOVEMBER: trades, BB R, IC R, end ($251 start) | DECEMBER: trades, BB R, IC R, end | Nov+Dec end, change, worst dip');
const rows = [];
for (let y = 2020; y <= 2025; y++) {
  const nov = all.filter((x) => ym(x.t) === `${y}-11`), dec = all.filter((x) => ym(x.t) === `${y}-12`);
  const b = { ...S0 }; const dn = run(nov, b); const endNov = b.bb + b.ic; const dd2 = run(dec, b); const endDec = b.bb + b.ic;
  const bd = { ...S0 }; run(dec, bd); const decAlone = bd.bb + bd.ic;
  rows.push({ y, endNov, decAlone, endDec });
  console.log(`${y} | ${nov.length} tr, BB ${f(sumR(nov, 'bb'))}R, IC ${f(sumR(nov, 'ic'))}R -> $${endNov.toFixed(0)} (${f((endNov / START - 1) * 100)}%) | ${dec.length} tr, BB ${f(sumR(dec, 'bb'))}R, IC ${f(sumR(dec, 'ic'))}R -> $${decAlone.toFixed(0)} (${f((decAlone / START - 1) * 100)}%) | $${endDec.toFixed(0)} (${f((endDec / START - 1) * 100)}%), dip ${(Math.max(dn, dd2) * 100).toFixed(0)}%`);
}
// all other months, for comparison: how often a 2-month stretch ends up, using every consecutive pair of real months
const months = [...new Set(all.map((x) => ym(x.t)))].sort().slice(1, -1);
const pairs = []; for (let i = 0; i + 1 < months.length; i++) { const b = { ...S0 }; run(all.filter((x) => ym(x.t) === months[i] || ym(x.t) === months[i + 1]), b); pairs.push(b.bb + b.ic); }
const s = [...pairs].sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
console.log(`\nany 2 consecutive months (${pairs.length} pairs): ended up ${(100 * pairs.filter((v) => v > START).length / pairs.length).toFixed(0)}% · bad 1-in-20 $${q(.05).toFixed(0)} · typical $${q(.5).toFixed(0)} · good 1-in-20 $${q(.95).toFixed(0)}`);
const nd = rows.map((r) => r.endDec).sort((a, b) => a - b);
console.log(`Nov+Dec, the 6 years: up in ${rows.filter((r) => r.endDec > START).length}/6 · median $${((nd[2] + nd[3]) / 2).toFixed(0)} · range $${nd[0].toFixed(0)} – $${nd[5].toFixed(0)}`);
