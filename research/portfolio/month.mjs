import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const D = process.argv[2] || fileURLToPath(new URL('./trades', import.meta.url)), coins = ['SOL','ZEC','NEAR','ADA','GALA'];
const bb = [], ic = [];
for (const c of coins) {
  for (const l of fs.readFileSync(`${D}/bb_${c}.txt`, 'utf8').split('\n')) { const m = l.match(/^\s+(\d{4}-\d\d-\d\d)\s+[LS]\s+\S+\s+→\s+\S+\s+\w+\s+([+-]\d+\.\d+)R\s+(\d+) bars/); if (m) bb.push({ bot: 'bb', t: Date.parse(m[1]) + (+m[3]) * 4 * 3600e3, r: +m[2] }); }
  for (const l of fs.readFileSync(`${D}/ic_${c}.txt`, 'utf8').split('\n')) { const m = l.match(/^\s+\d{4}-\d\d-\d\d\s+→\s+(\d{4}-\d\d-\d\d)\s+(?:LONG|SHORT)\s+\S+\s+→\s+\S+\s+\w+\s+([+-]\d+\.\d+)R/); if (m) ic.push({ bot: 'ic', t: Date.parse(m[1]) + 12 * 3600e3, r: +m[2] }); }
}
const S0 = { bb: 201.23, ic: 49.98 }, RISK = 0.025, CAP = 10, START = S0.bb + S0.ic;
// one month of trades, both bots, in time order -> end balance, worst drop, how it started
function runMonth(tr) {
  const b = { ...S0 }; let pk = START, dd = 0, first = null, streak = 0, done = false;
  for (const x of tr) {
    const riskUsd = Math.min(CAP, b[x.bot] * RISK); b[x.bot] += riskUsd * x.r;
    const tot = b.bb + b.ic; pk = Math.max(pk, tot); dd = Math.max(dd, (pk - tot) / pk);
    if (!done) { if (x.r <= 0) streak++; else done = true; }
  }
  return { end: b.bb + b.ic, dd, startLosses: streak, n: tr.length };
}
const key = (t) => new Date(t).toISOString().slice(0, 7);
const months = new Map();
for (const x of [...bb, ...ic]) { const k = key(x.t); if (!months.has(k)) months.set(k, []); months.get(k).push(x); }
const hist = [...months.keys()].sort().slice(1, -1).map((k) => ({ k, tr: months.get(k).sort((a, b) => a.t - b.t) }));   // full months only
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const usd = (v) => '$' + v.toFixed(0);
function report(title, rows) {
  const ends = rows.map((r) => r.end), dds = rows.map((r) => r.dd);
  console.log(`\n${title}  (${rows.length} months)`);
  console.log(`  ended up ${(100 * rows.filter((r) => r.end > START).length / rows.length).toFixed(0)}% · bad (1 in 20) ${usd(pct(ends, .05))} · typical ${usd(pct(ends, .5))} · good (1 in 20) ${usd(pct(ends, .95))} · worst ${usd(Math.min(...ends))} · best ${usd(Math.max(...ends))}`);
  console.log(`  biggest dip inside the month: typical ${(100 * pct(dds, .5)).toFixed(0)}% · 1 in 20 ${(100 * pct(dds, .95)).toFixed(0)}% · worst ${(100 * Math.max(...dds)).toFixed(0)}%`);
}
// 1) every real month of history, replayed on your capital
const real = hist.map((m) => ({ ...runMonth(m.tr), k: m.k }));
report('A. Every real month 2020-2026, replayed on your $251', real);
for (const k of [3, 5, 7]) report(`   …only months that STARTED with ${k}+ straight losses`, real.filter((r) => r.startLosses >= k));
// 2) block bootstrap: random real months, 20,000 times (keeps real streaks and both bots' timing together)
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const sims = []; for (let i = 0; i < 20000; i++) sims.push(runMonth(hist[Math.floor(rnd() * hist.length)].tr));
// 3) the same, but the month is forced to START with k straight losses (losing trades drawn from history), then a random real month follows
const losers = { bb: bb.filter((x) => x.r <= 0), ic: ic.filter((x) => x.r <= 0) };
function forced(k) { const out = []; for (let i = 0; i < 20000; i++) { const pre = []; for (let j = 0; j < k; j++) { const who = rnd() < 2 / 3 ? 'bb' : 'ic'; const L = losers[who]; pre.push(L[Math.floor(rnd() * L.length)]); } const m = hist[Math.floor(rnd() * hist.length)].tr; out.push(runMonth(pre.concat(m.slice(0, Math.max(0, m.length - k))))); } return out; }
for (const k of [3, 5, 8]) report(`B. Forced bad start: first ${k} trades all losses, rest of a real month`, forced(k));
// 4) recent years only (2023+), the weaker period
const recent = hist.filter((m) => m.k >= '2023-01'); report('C. Real months 2023-2026 only (weaker years)', recent.map((m) => runMonth(m.tr)));
console.log(`\ntrades per month: median ${pct(hist.map((m) => m.tr.length), .5)} (both bots) · cost of straight losses from $251 at 2.5%: 3 → -${usd(START * (1 - 0.975 ** 3)).slice(1)}, 5 → -${usd(START * (1 - 0.975 ** 5)).slice(1)}, 8 → -${usd(START * (1 - 0.975 ** 8)).slice(1)}`);
