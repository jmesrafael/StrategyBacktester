// execdiag.js — execution-model diagnostics: same-candle exits, both-touched candles, stop gaps, worst loss, Binance-vs-MEXC signal parity,
// early MEXC volume sanity, funding comparison, Monte-Carlo drawdown.   node audit/execdiag.js
'use strict';
const fs = require('fs'), path = require('path');
const { backtest, DEFAULTS } = require('../lucidio-core.js');
const D = path.join(__dirname, '..', 'data'), rd = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const yr = (t) => new Date(t * 1000).getUTCFullYear();
const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function load(c) {
  const raw = rd(c + '.json');
  const B = raw.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], vol: r[5] }));
  let F = fs.existsSync(path.join(D, 'funding', c + '.json')) ? rd('funding/' + c + '.json') : null;
  if (c.startsWith('MEXC_')) { const bin = rd('funding/' + c.slice(5) + '.json'); F = [...bin.filter((r) => r[0] < F[0][0]), ...F]; }
  return { B, F };
}
const T = {};
for (const c of ['SOL', 'ZEC', 'MEXC_SOL', 'MEXC_ZEC']) {
  const { B, F } = load(c), tr = backtest(B, {}, F).trades; T[c] = { B, tr };
  let same = 0, both = 0, gap = 0, nobuf = 0;
  for (const t of tr) {
    if (t.bars === 1) same++;
    if (t.why === 'stop') { const b = B[t.i1]; if (t.dir === 1 ? b.open < t.stop : b.open > t.stop) gap++; }
  }
  for (const t of tr) for (let i = t.i0; i <= t.i1; i++) {
    const b = B[i], hitS = t.dir === 1 ? b.low <= t.stop : b.high >= t.stop, hitT = t.dir === 1 ? b.high >= t.tp : b.low <= t.tp;
    if (hitS && hitT) both++;
  }
  const free = backtest(B, { cost: { ...DEFAULTS.cost, tpBuf: 0 } }, F).trades;
  const withBuf = new Set(tr.filter((t) => t.why === 'target').map((t) => t.i0));
  nobuf = free.filter((t) => t.why === 'target' && !withBuf.has(t.i0)).length;
  const R = tr.map((t) => t.R), stops = tr.filter((t) => t.why === 'stop').map((t) => t.R);
  console.log(`${c.padEnd(9)} n=${tr.length} entry-candle exits=${same} stop-gaps(open beyond stop)=${gap} both-touched candles=${both} target touched-but-not-through-buffer=${nobuf} worst R=${Math.min(...R).toFixed(2)} avg stop R=${mean(stops).toFixed(2)} stops<-1.2R=${stops.filter((r) => r < -1.2).length} best R=${Math.max(...R).toFixed(2)}`);
}
console.log('\nBinance-vs-MEXC candle parity of the TRADE SET (same signal bar & direction):');
for (const c of ['SOL', 'ZEC']) {
  const a = T[c].tr, b = T['MEXC_' + c].tr, key = (B, t) => B[t.i0 - 1].time + ':' + t.dir;
  const mb = new Map(b.map((t) => [key(T['MEXC_' + c].B, t), t]));
  let m = 0, rA = 0, rB = 0; const diffR = [];
  for (const t of a) { const o = mb.get(key(T[c].B, t)); if (o) { m++; diffR.push(Math.abs(o.R - t.R)); rA += t.R; rB += o.R; } }
  console.log(`  ${c}: Binance ${a.length} trades, MEXC ${b.length}; matched signal ${m} (${(100 * m / a.length).toFixed(0)}%); R on matched: Binance ${rA.toFixed(1)} vs MEXC ${rB.toFixed(1)}; mean |dR| ${mean(diffR).toFixed(2)}; unmatched Binance R ${(a.reduce((s, t) => s + t.R, 0) - rA).toFixed(1)}, unmatched MEXC R ${(b.reduce((s, t) => s + t.R, 0) - rB).toFixed(1)}`);
  const by = {};
  for (const [n, tr] of [['B', a], ['M', b]]) tr.forEach((t) => { const y = yr(t.tExit); by[y] = by[y] || {}; by[y][n] = (by[y][n] || 0) + t.R; });
  console.log('     yearly netR  ' + Object.keys(by).sort().map((y) => `${y}: Bin ${(by[y].B || 0).toFixed(0)} / MEXC ${(by[y].M || 0).toFixed(0)}`).join(' | '));
}
console.log('\nMEXC vs Binance volume by year, is pre-2025 MEXC history real?');
for (const c of ['SOL', 'ZEC']) {
  const out = [];
  for (const y of [2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
    const s = (B) => B.filter((b) => yr(b.time) === y).reduce((a, b) => a + b.vol, 0), bs = s(T[c].B), ms = s(T['MEXC_' + c].B);
    out.push(`${y}: MEXC/Binance=${bs ? (ms / bs).toFixed(3) : 'n/a'}`);
  }
  console.log('  ' + c + '  ' + out.join('  '));
}
console.log('  first MEXC_ZEC rows:', JSON.stringify(T.MEXC_ZEC.B.slice(0, 3).map((b) => [new Date(b.time * 1000).toISOString().slice(0, 16), b.close, b.vol])));
{
  const B = T.MEXC_ZEC.B; let gi = -1;
  for (let i = 1; i < B.length; i++) if (B[i].time - B[i - 1].time > 14400) gi = i;
  const tr = T.MEXC_ZEC.tr;
  console.log(`  MEXC_ZEC gap at index ${gi} (${new Date(B[gi - 1].time * 1000).toISOString().slice(0, 10)} to ${new Date(B[gi].time * 1000).toISOString().slice(0, 10)}); trades with signal within 200 bars after the gap (indicators span it): ${tr.filter((t) => t.i0 - 1 >= gi && t.i0 - 1 < gi + 200).length}`);
}
console.log('\nFunding on the overlap window, Binance vs MEXC:');
for (const c of ['SOL', 'ZEC']) {
  const b = rd('funding/' + c + '.json'), m = rd('funding/MEXC_' + c + '.json'), t0 = m[0][0];
  const sumB = b.filter((r) => r[0] >= t0).reduce((s, r) => s + r[1], 0), sumM = m.reduce((s, r) => s + r[1], 0);
  console.log(`  ${c}: Binance sum ${(sumB * 100).toFixed(2)}% vs MEXC ${(sumM * 100).toFixed(2)}% over ${m.length} events; mean |rate| B ${(mean(b.filter((r) => r[0] >= t0).map((r) => Math.abs(r[1]))) * 1e4).toFixed(2)}bp M ${(mean(m.map((r) => Math.abs(r[1]))) * 1e4).toFixed(2)}bp`);
}
let seed = 5; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const R = [...T.SOL.tr, ...T.ZEC.tr].map((t) => t.R), dds = [], st = [];
for (let k = 0; k < 5000; k++) {
  let eq = 0, pk = 0, dd = 0, s = 0, ms = 0;
  for (let i = 0; i < R.length; i++) { const r = R[Math.floor(rnd() * R.length)]; eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (r <= 0) { s++; ms = Math.max(ms, s); } else s = 0; }
  dds.push(dd); st.push(ms);
}
dds.sort((a, b) => a - b); st.sort((a, b) => a - b);
const q = (a, p) => a[Math.floor(a.length * p)];
console.log(`\nMC (5000 reshuffles of ${R.length} combined SOL+ZEC trades, i.i.d.): max DD median ${q(dds, .5).toFixed(1)}R, 95% ${q(dds, .95).toFixed(1)}R, 99% ${q(dds, .99).toFixed(1)}R; longest losing streak median ${q(st, .5)}, 99% ${q(st, .99)}. Historical max DD (chronological) = 16.0R.`);
console.log(`   => at 1% risk/trade the 99% DD is ~${(100 * (1 - Math.pow(0.99, q(dds, .99)))).toFixed(0)}% of equity (compounded); at 5% risk it is ~${(100 * (1 - Math.pow(0.95, q(dds, .99)))).toFixed(0)}%.`);
const mo = (tr) => { const m = {}; tr.forEach((t) => { const k = new Date(t.tExit * 1000).toISOString().slice(0, 7); m[k] = (m[k] || 0) + t.R; }); return m; };
const ms = mo(T.SOL.tr), mz = mo(T.ZEC.tr), keys = Object.keys(ms).filter((k) => k in mz);
const xa = keys.map((k) => ms[k]), xb = keys.map((k) => mz[k]), ma = mean(xa), mb2 = mean(xb);
const cor = xa.reduce((s, v, i) => s + (v - ma) * (xb[i] - mb2), 0) / Math.sqrt(xa.reduce((s, v) => s + (v - ma) ** 2, 0) * xb.reduce((s, v) => s + (v - mb2) ** 2, 0));
console.log(`monthly-R correlation SOL vs ZEC: ${cor.toFixed(2)} over ${keys.length} months`);
const Rs = T.SOL.tr.map((t) => t.R), m1 = mean(Rs);
const ac = Rs.slice(1).reduce((s, v, i) => s + (v - m1) * (Rs[i] - m1), 0) / Rs.reduce((s, v) => s + (v - m1) ** 2, 0);
console.log(`lag-1 autocorrelation of SOL trade R: ${ac.toFixed(3)}`);
