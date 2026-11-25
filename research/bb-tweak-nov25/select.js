// select.js: THE selection procedure. It is given a cut date and may only use candles before it.
// Written before any result was seen. The same code picks the final tweak (cut = 2024-01-01) and each walk-forward year.
//
// A tweak qualifies when, on the LIVE coins and compared with BB-CORE v3 over the past data:
//   (a) total R is higher, (b) drawdown marked to market is lower, (c) closed-trade drawdown is not higher,
//   (d) R / drawdown is not lower in either half of the past data, (e) with double costs: R higher and drawdown lower,
//   (f) on 60 random 6-coin baskets of OTHER coins, R / drawdown improves in more than 60% of baskets.
// Winner = highest score; score = (R/DD ratio to baseline, worst of the two halves) x (basket share).
// Risk is rescaled so the average risk per trade over the past data equals BB-CORE's (fixed from past data only).
'use strict';
const L = require('./engine');
const C = require('../../candles/candles.js');
const T0 = Date.UTC(2020, 0, 1) / 1000;

// ---------- the candidate list ----------
function singles() {
  const out = [], add = (fam, label, cfg) => out.push({ fam, label, cfg });
  for (const len of [10, 14, 21, 28, 35]) for (const th of [-0.05, 0, 0.05, 0.1]) for (const lo of [0, 0.5]) add('ii', `II(${len})>${th} ${lo ? 'half' : 'skip'}`, { ii: { len, th, lo } });
  for (const side of ['L', 'S']) for (const lo of [0, 0.5]) add('ii', `II(21)>0 ${side} only ${lo ? 'half' : 'skip'}`, { ii: { len: 21, th: 0, lo, side } });
  for (const max of [22, 25, 27, 30, 35, 40]) for (const lo of [0, 0.5]) add('adx', `ADX>${max} ${lo ? 'half' : 'skip'}`, { adx: { max, lo } });
  for (const min of [15, 18, 20]) add('adx', `ADX<${min} half`, { adx: { min, lo: 0.5 } });
  for (const atr of [2, 2.5, 3, 4]) for (const lo of [0, 0.5]) add('ext', `stop>${atr}ATR ${lo ? 'half' : 'skip'}`, { ext: { atr, lo } });
  for (const a of [0.15, 0.25, 0.4, 0.6, 1]) add('dir', `same-direction size ${a}`, { dirSize: a });
  for (const n of [2, 3, 4, 5]) add('dir', `max ${n} per direction`, { dirCap: n });
  for (const dd of [8, 12, 16, 20]) for (const mult of [0.5, 0.75]) add('throttle', `risk x${mult} in ${dd}R drawdown`, { throttle: { dd, mult } });
  for (const atR of [1, 2, 3]) for (const bars of [54, 66, 84]) add('extend', `extend to ${bars} if >=${atR}R`, { extend: { atR, bars } });
  for (const bars of [18, 24, 30]) for (const r of [0, -0.25]) add('stale', `exit after ${bars} if <${r}R`, { stale: { bars, r } });
  for (const [atR, toR] of [[1.5, 0], [2, 0], [3, 0], [3, 1], [5, 2]]) add('lock', `at +${atR}R stop to +${toR}R`, { lock: { atR, toR } });
  for (const lo of [0, 0.5]) { add('btc', `against BTC trend ${lo ? 'half' : 'skip'}`, { btc: { lo } }); for (const len of [600, 1200]) add('slow', `against ${len} average ${lo ? 'half' : 'skip'}`, { slow: { len, lo } }); }
  for (const len of [15, 25, 30]) add('len', `band length ${len}`, { len });
  for (const mult of [1.6, 1.7, 1.9, 2.0, 2.2]) add('mult', `band width ${mult}`, { mult });
  for (const maxBars of [30, 36, 48, 60, 72]) add('time', `time exit ${maxBars}`, { maxBars });
  for (const cool of [0, 6, 12]) add('cool', `wait ${cool} after loss`, { cool });
  for (const minStop of [0.75, 1, 1.5]) add('minStop', `min stop ${minStop} ATR`, { minStop });
  for (const trend of [100, 150, 300]) add('trend', `trend average ${trend}`, { trend });
  return out;
}

function baskets(cut, count = 60) {
  const pool = C.coins().filter((c) => !L.LIVE.includes(c) && c !== 'BTC' && L.load(c, cut).n > 2000);
  let s = 99; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  return Array.from({ length: count }, () => { const a = pool.slice(); for (let i = 0; i < 6; i++) { const j = i + Math.floor(rnd() * (a.length - i)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 6); });
}

function select(cut, { log = () => {} } = {}) {
  const mid = Math.round((T0 + cut) / 2), run = (cfg, extra = {}) => L.replay(cfg, { endT: cut, ...extra });
  const bRes = run({}), b2Res = run({}, { cost: 2 });
  const B = { all: L.measure(bRes, T0, cut), h1: L.measure(bRes, T0, mid), h2: L.measure(bRes, mid, cut), two: L.measure(b2Res, T0, cut) };
  const live = (c) => {
    const res = run(c.cfg), k = 1 / L.meanW(res, T0, cut), all = L.measure(res, T0, cut, k);
    const r = { ...c, k, all };
    if (!(all.R > B.all.R && all.mdd < B.all.mdd && all.dd <= B.all.dd + 1e-9)) return r;
    r.h1 = L.measure(res, T0, mid, k); r.h2 = L.measure(res, mid, cut, k);
    r.worstHalf = Math.min(r.h1.rdd / B.h1.rdd, r.h2.rdd / B.h2.rdd); if (r.worstHalf < 1) return r;
    const res2 = run(c.cfg, { cost: 2 }), two = L.measure(res2, T0, cut, 1 / L.meanW(res2, T0, cut));
    r.liveOk = two.R > B.two.R && two.mdd < B.two.mdd; return r;
  };
  const sets = baskets(cut), baseBk = sets.map((coins) => L.measure(run({}, { coins }), T0, cut));
  const basketShare = (cfg) => { let win = 0; sets.forEach((coins, i) => { if (L.measure(run(cfg, { coins }), T0, cut).rdd > baseBk[i].rdd) win++; }); return win / sets.length; };
  const finish = (list) => {
    for (const r of list.filter((q) => q.liveOk)) { r.share = basketShare(r.cfg); r.ok = r.share > 0.6; r.score = r.worstHalf * r.share; }
    return list;
  };
  const one = finish(singles().map(live));
  log(`singles ${one.length}: pass live ${one.filter((r) => r.liveOk).length}, pass baskets too ${one.filter((r) => r.ok).length}`);
  // combine the best qualifying tweaks, at most one per family: pairs and triples of the top 8
  const best = {}; for (const r of one.filter((q) => q.ok).sort((p, q) => q.score - p.score)) best[r.fam] ||= r;
  const top = Object.values(best).sort((p, q) => q.score - p.score).slice(0, 8), combos = [];
  const merge = (...a) => ({ fam: a.map((r) => r.fam).join('+'), label: a.map((r) => r.label).join(' + '), cfg: Object.assign({}, ...a.map((r) => r.cfg)) });
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) { combos.push(merge(top[i], top[j])); for (let m = j + 1; m < top.length; m++) combos.push(merge(top[i], top[j], top[m])); }
  const two = finish(combos.map(live));
  log(`combos ${two.length}: pass everything ${two.filter((r) => r.ok).length}`);
  const ranked = [...one, ...two].filter((r) => r.ok).sort((p, q) => q.score - p.score);
  return { cut, base: B, tested: one.length + two.length, ranked, all: [...one, ...two] };
}
module.exports = { select, singles, T0 };
