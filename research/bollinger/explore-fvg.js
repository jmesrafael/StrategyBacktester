// explore-fvg.js — Pullback FVG grid on TRAIN data only (entries < 2023-01-01), BTC / ETH / SOL.
// usage: node explore-fvg.js 240 60 15 5      (timeframes in minutes)
const L = require('./lib.js'), { fvgpb } = require('./fvg.js'), fs = require('fs');
const COINS = (process.env.COINS || 'BTC,ETH,SOL').split(','), END = L.ts(2023);
const tfs = process.argv.slice(2).map(Number);
const cfgs = [];
for (const minGap of [0.2, 0.5]) for (const disp of [0, 1]) for (const depth of [0, 0.5]) for (const stop of ['gap', 'c2', 'origin'])
  for (const tp of [1.5, 2, 3]) for (const expire of [6, 20]) for (const trend of [0, 'htf']) cfgs.push({ minGap, disp, depth, stop, tp, expire, trend, maxHold: 0 });
for (const tf of tfs) {
  const t0 = Date.now(), rows = [];
  for (const c of cfgs) {
    const per = {}; let all = [];
    for (const s of COINS) { const tr = L.slice(fvgpb(s, { ...c, tf }), 0, END); per[s] = L.stats(tr); all = all.concat(tr); }
    rows.push({ c, per, pool: L.stats(all) });
  }
  fs.writeFileSync(`${__dirname}/results-fvg-explore-${COINS.join('')}-${tf}.json`, JSON.stringify(rows));
  const f = rows.filter((r) => r.pool.n >= 100);
  const sorted = f.map((r) => r.pool.avg).sort((a, b) => a - b);
  console.log(`\n=== ${tf}m: ${rows.length} configs (${((Date.now() - t0) / 1000).toFixed(0)}s). Profitable pooled: ${f.filter((r) => r.pool.sum > 0).length}/${f.length}; all 3 coins positive: ${f.filter((r) => COINS.every((s) => r.per[s].sum > 0)).length}; median avg R/trade ${L.f2(sorted[Math.floor(sorted.length / 2)] || 0)}; trades median ${f.map((r) => r.pool.n).sort((a, b) => a - b)[Math.floor(f.length / 2)]}`);
  for (const r of f.sort((a, b) => b.pool.t - a.pool.t).slice(0, 6))
    console.log(`  ${JSON.stringify({ ...r.c, maxHold: undefined })} | n=${r.pool.n} sum=${L.f2(r.pool.sum)} avg=${L.f2(r.pool.avg)} t=${r.pool.t.toFixed(2)} PF=${r.pool.pf.toFixed(2)} win=${(r.pool.win * 100).toFixed(0)}% | ` + COINS.map((s) => `${s} ${L.f2(r.per[s].sum)}`).join(' '));
}
