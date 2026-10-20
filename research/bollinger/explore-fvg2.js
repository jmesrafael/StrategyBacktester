// explore-fvg2.js — Pullback FVG: one-factor sensitivity + controls, TRAIN data only (entries < 2023-01-01), BTC / ETH / SOL.
// usage: node explore-fvg2.js 240 60          (timeframes in minutes)
const L = require('./lib.js'), { fvgpb } = require('./fvg.js');
const COINS = (process.env.COINS || 'BTC,ETH,SOL').split(','), END = L.ts(2023);
const BASE = { minGap: 0.5, disp: 0, depth: 0, stop: 'origin', tp: 3, expire: 20, trend: 'htf', maxHold: 0, fillBuf: 0, direct: false };
const SWEEP = { minGap: [0.1, 0.2, 0.3, 0.5, 0.8, 1.2], disp: [0, 0.5, 1, 1.5], depth: [0, 0.25, 0.5, 0.75, 1], stop: ['gap', 'c2', 'origin'], tp: [1, 1.5, 2, 3, 4, 5],
  expire: [3, 6, 12, 20, 40], trend: [0, 'htf'], maxHold: [0, 12, 24, 48], fillBuf: [0, 0.05, 0.1, 0.25], direct: [false, true] };
const line = (name, c) => {
  const per = {}, all = [];
  for (const s of COINS) { const tr = L.slice(fvgpb(s, c), 0, END); per[s] = L.stats(tr); all.push(...tr); }
  const p = L.stats(all), yrs = [2019, 2020, 2021, 2022].map((y) => L.sum(L.slice(all, L.ts(y), L.ts(y + 1)).map((t) => t.R)));
  return `${name.padEnd(14)} n=${String(p.n).padStart(4)} sum=${L.f2(p.sum).padStart(7)} avg=${L.f2(p.avg)} t=${p.t.toFixed(2).padStart(5)} PF=${p.pf.toFixed(2)} win=${(p.win * 100).toFixed(0)}% dd=${p.dd.toFixed(1).padStart(4)} | ` +
    COINS.map((s) => `${s} ${L.f2(per[s].sum)}`).join(' ') + ' | yr19-22 ' + yrs.map(L.f2).join(' ');
};
for (const tf of process.argv.slice(2).map(Number)) {
  console.log(`\n######## ${tf}m  (train)`);
  const base = { ...BASE, tf };
  console.log(line('BASE', base));
  for (const [key, vals] of Object.entries(SWEEP)) {
    console.log(`-- ${key}`);
    for (const v of vals) { if (v === base[key]) continue; console.log('  ' + line(`${key}=${v}`, { ...base, [key]: v })); }
  }
}
