// validate.js — full check of the candidate "BB-1H-WIDE": Bollinger(80, 2.6) close-through, with SMA(800) trend,
// stop = middle band (skip if < 0.3 ATR away), exit after 192 bars. Compared with BB-CORE 1h (same, 2.0 sigma).
'use strict';
const L = require('./lib.js'), { build, strat, mkEx } = require('./fam-vol.js'), { audit } = require('./audit.js');
const CAND = { len: 80, mult: 2.6, trend: 800, minStop: 0.3, filt: null }, REF = { ...CAND, mult: 2.0 }, E = { kind: 'M', bars: 192 };
const log = (...a) => console.log(...a);
const yrs = (tr) => { const y = {}; for (const t of tr) { const k = L.yearOf(t.tExit); y[k] = (y[k] || 0) + t.R; } return L.YEARS.map((k) => (y[k] || 0).toFixed(0).padStart(5)).join(''); };
const dd = (tr) => { let e = 0, p = 0, d = 0; for (const t of [...tr].sort((a, b) => a.tExit - b.tExit)) { e += t.R; p = Math.max(p, e); d = Math.max(d, p - e); } return d; };

log('== 1. look-ahead audit (truncation, 12 random cuts on 4 coins)');
const a = audit([{ id: 'bb-1h-wide', build: (c) => build(c, CAND) }, { id: 'bb-core-1h', build: (c) => build(c, REF) }], { coins: ['SOL', 'BTC', 'ADA', 'LTC'], cuts: 12 });
log('audit ok =', a.ok);

for (const [name, p] of [['BB-1H-WIDE (2.6)', CAND], ['BB-CORE 1h (2.0)', REF]]) {
  log(`\n== ${name}            years: ` + L.YEARS.join('  '));
  for (const [bk, coins] of [['MAIN', L.MAIN], ['HOLD', L.HOLD], ['ALL24', [...L.MAIN, ...L.HOLD]]]) for (const cm of [1, 2, 3]) {
    const r = L.evaluate(strat(p, E), mkEx(E), coins, cm, true);
    log(`${bk.padEnd(5)} ${cm}x  ${yrs(r.trades)} | R=${r.total.toFixed(0)} dd=${r.dd.toFixed(0)} r/dd=${r.rdd.toFixed(1)} exp=${r.exp.toFixed(3)} ${r.posYears}/7 ex10=${r.ex10.toFixed(0)} coins+=${r.coinsPos}/${coins.length}`);
  }
  const r = L.evaluate(strat(p, E), mkEx(E), [...L.MAIN, ...L.HOLD], 1, true), T = r.trades;
  const lo = T.filter((t) => t.dir === 1), sh = T.filter((t) => t.dir === -1);
  log(`longs  ${yrs(lo)} | R=${lo.reduce((s, t) => s + t.R, 0).toFixed(0)} n=${lo.length}`);
  log(`shorts ${yrs(sh)} | R=${sh.reduce((s, t) => s + t.R, 0).toFixed(0)} n=${sh.length}`);
  const is = T.filter((t) => t.tExit < 1704067200), oos = T.filter((t) => t.tExit >= 1704067200);
  log(`IS 2020-23 R=${is.reduce((s, t) => s + t.R, 0).toFixed(0)} exp=${(is.reduce((s, t) => s + t.R, 0) / is.length).toFixed(3)} dd=${dd(is).toFixed(0)} | OOS 2024-26 R=${oos.reduce((s, t) => s + t.R, 0).toFixed(0)} exp=${(oos.reduce((s, t) => s + t.R, 0) / oos.length).toFixed(3)} dd=${dd(oos).toFixed(0)}`);
  const top = [...T].sort((x, y) => y.R - x.R), tot = r.total, k10 = Math.ceil(T.length / 10);
  log(`top 10% of trades = ${(100 * top.slice(0, k10).reduce((s, t) => s + t.R, 0) / tot).toFixed(0)}% of profit; biggest trade ${top[0].R.toFixed(1)}R; win ${(100 * r.win).toFixed(0)}%; avg hold ${(T.reduce((s, t) => s + t.bars, 0) / T.length).toFixed(0)} bars`);
  // per-coin per-year (24 coins)
  const pcy = {}; for (const t of T) { const y = L.yearOf(t.tExit); (pcy[t.coin] = pcy[t.coin] || {})[y] = (pcy[t.coin][y] || 0) + t.R; }
  let cells = 0, pos = 0; for (const cn in pcy) for (const y of L.YEARS) if (pcy[cn][y] != null) { cells++; if (pcy[cn][y] > 0) pos++; }
  log(`coin-years positive: ${pos}/${cells}`);
  // monthly
  const mo = {}; for (const t of T) { const d = new Date(t.tExit * 1000), k = d.getUTCFullYear() * 100 + d.getUTCMonth(); mo[k] = (mo[k] || 0) + t.R; }
  const mv = Object.values(mo); log(`months positive: ${mv.filter((v) => v > 0).length}/${mv.length}, worst month ${Math.min(...mv).toFixed(0)}R`);
  if (name.startsWith('BB-1H')) global.CT = T; else global.RT = T;
}
// overlap with BB-CORE 1h: same coin, entry within 24 bars
const key = (t) => t.coin + '|' + t.dir;
const refIdx = {}; for (const t of global.RT) (refIdx[key(t)] = refIdx[key(t)] || []).push(t.t);
const ov = global.CT.filter((t) => (refIdx[key(t)] || []).some((x) => Math.abs(x - t.t) <= 24 * 3600)).length;
log(`\noverlap: ${ov}/${global.CT.length} (${(100 * ov / global.CT.length).toFixed(0)}%) of BB-1H-WIDE trades have a BB-CORE 1h trade on the same coin+side within 24h`);
const mon = (T) => { const m = {}; for (const t of T) { const d = new Date(t.tExit * 1000), k = d.getUTCFullYear() * 100 + d.getUTCMonth(); m[k] = (m[k] || 0) + t.R; } return m; };
const m1 = mon(global.CT), m2 = mon(global.RT), ks = Object.keys(m1).filter((k) => k in m2), x = ks.map((k) => m1[k]), y = ks.map((k) => m2[k]);
const mean = (v) => v.reduce((s, z) => s + z, 0) / v.length, mx = mean(x), my = mean(y);
const corr = x.reduce((s, z, i) => s + (z - mx) * (y[i] - my), 0) / Math.sqrt(x.reduce((s, z) => s + (z - mx) ** 2, 0) * y.reduce((s, z) => s + (z - my) ** 2, 0));
log(`monthly correlation with BB-CORE 1h: ${corr.toFixed(2)}`);
