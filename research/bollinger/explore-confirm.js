// explore-confirm.js — confirmation pullback (market entry after a rejection candle in the gap), TRAIN data only (entries < 2023-01-01).
// usage: COINS=SOL,ZEC,DOGE node explore-confirm.js 240 60 15
const L = require('./lib.js'), { fvgpb } = require('./fvg.js');
const COINS = (process.env.COINS || 'BTC,ETH,SOL').split(','), END = L.ts(2023);
const cfgs = [];
for (const minGap of [0.2, 0.5]) for (const depth of [0, 0.5]) for (const stop of ['gap', 'c2', 'origin']) for (const tp of [1.5, 2, 3])
  for (const expire of [6, 20]) for (const trend of [0, 'htf']) cfgs.push({ minGap, disp: 0, depth, stop, tp, expire, trend, maxHold: 0, confirm: true });
for (const tf of process.argv.slice(2).map(Number)) {
  const rows = cfgs.map((c) => { const per = {}; let all = []; for (const s of COINS) { const tr = L.slice(fvgpb(s, { ...c, tf }), 0, END); per[s] = L.stats(tr); all = all.concat(tr); } return { c, per, pool: L.stats(all) }; });
  const f = rows.filter((r) => r.pool.n >= 60), avg = f.map((r) => r.pool.avg).sort((a, b) => a - b);
  console.log(`\n=== ${tf}m confirm [${COINS}]: ${f.length} configs, profitable ${f.filter((r) => r.pool.sum > 0).length}, all coins positive ${f.filter((r) => COINS.every((s) => r.per[s].sum > 0)).length}, median avg R ${L.f2(avg[Math.floor(avg.length / 2)] || 0)}`);
  for (const r of f.sort((a, b) => b.pool.t - a.pool.t).slice(0, 5))
    console.log(`  ${JSON.stringify({ ...r.c, maxHold: undefined, confirm: undefined, disp: undefined })} | n=${r.pool.n} sum=${L.f2(r.pool.sum)} avg=${L.f2(r.pool.avg)} t=${r.pool.t.toFixed(2)} PF=${r.pool.pf.toFixed(2)} | ` + COINS.map((s) => `${s} ${L.f2(r.per[s].sum)}`).join(' '));
  const base = { minGap: 0.5, disp: 0, depth: 0, stop: 'origin', tp: 3, expire: 20, trend: 'htf', maxHold: 0, confirm: true };
  const per = {}; let all = []; for (const s of COINS) { const tr = L.slice(fvgpb(s, { ...base, tf }), 0, END); per[s] = L.stats(tr); all = all.concat(tr); }
  const p = L.stats(all); console.log(`  FROZEN-BASE confirm: n=${p.n} sum=${L.f2(p.sum)} avg=${L.f2(p.avg)} t=${p.t.toFixed(2)} PF=${p.pf.toFixed(2)} | ` + COINS.map((s) => `${s} ${L.f2(per[s].sum)}`).join(' '));
}
