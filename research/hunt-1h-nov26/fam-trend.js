// fam-trend.js — trend/breakout family on 1h. All series causal (value at i uses bars <= i); entries decided on closed bar i, filled at open i+1 by the engine.
'use strict';
const L = require('./lib.js'), I = L.I, { N, ok } = I;
const fs = require('fs');
const IS_END = Date.parse('2024-01-01') / 1000;

// ---------- causal helpers (O(n)) ----------
function wma(x, n) { // linear-weighted MA, running sums
  const o = N(x.length); let f = 0; while (f < x.length && !ok(x[f])) f++;
  let s = 0, w = 0; const den = n * (n + 1) / 2;
  for (let i = f; i < x.length; i++) {
    const j = i - f;
    if (j < n) { s += x[i]; w += x[i] * (j + 1); if (j === n - 1) o[i] = w / den; }
    else { w = w - s + x[i] * n; s = s - x[i - n] + x[i]; o[i] = w / den; }
  }
  return o;
}
function hma(x, n) { const a = wma(x, Math.max(2, Math.round(n / 2))), b = wma(x, n); return wma(a.map((v, i) => 2 * v - b[i]), Math.max(2, Math.round(Math.sqrt(n)))); }
function supertrend(c, len, mult) {
  const { H, L: Lo, C, n } = c, a = I.atr(H, Lo, C, len), dir = new Int8Array(n); // 1 up, -1 down, 0 unknown
  let fu = NaN, fl = NaN, d = 0;
  for (let i = 0; i < n; i++) {
    if (!ok(a[i])) continue;
    const m = (H[i] + Lo[i]) / 2, bu = m + mult * a[i], bl = m - mult * a[i];
    if (!ok(fu)) { fu = bu; fl = bl; d = C[i] > m ? 1 : -1; dir[i] = d; continue; }
    const pfu = fu, pfl = fl;
    fu = (bu < pfu || C[i - 1] > pfu) ? bu : pfu;
    fl = (bl > pfl || C[i - 1] < pfl) ? bl : pfl;
    if (d === -1 && C[i] > pfu) d = 1; else if (d === 1 && C[i] < pfl) d = -1;
    dir[i] = d;
  }
  return dir;
}
const u8 = (n) => new Uint8Array(n);

// ---------- entries: return {sl,ss (entry events), xl,xs (exit-state flags), warm} ----------
const ENT = {
  st: (c, p) => c.m(`st${p.len}_${p.mult}`, () => {
    const d = supertrend(c, p.len, p.mult), sl = u8(c.n), ss = u8(c.n), xl = u8(c.n), xs = u8(c.n);
    for (let i = 1; i < c.n; i++) { if (!d[i] || !d[i - 1]) continue; if (d[i] === 1 && d[i - 1] === -1) sl[i] = 1; if (d[i] === -1 && d[i - 1] === 1) ss[i] = 1; xl[i] = d[i] === -1 ? 1 : 0; xs[i] = d[i] === 1 ? 1 : 0; }
    return { sl, ss, xl, xs, warm: p.len * 3 };
  }),
  kc: (c, p) => c.m(`kc${p.len}_${p.mult}`, () => {
    const e = c.m('ema' + p.len, () => I.ema(c.C, p.len)), sl = u8(c.n), ss = u8(c.n), xl = u8(c.n), xs = u8(c.n);
    for (let i = 1; i < c.n; i++) { if (!ok(e[i]) || !ok(c.atr14[i])) continue; const up = e[i] + p.mult * c.atr14[i], dn = e[i] - p.mult * c.atr14[i]; if (c.C[i] > up) sl[i] = 1; if (c.C[i] < dn) ss[i] = 1; xl[i] = c.C[i] < e[i] ? 1 : 0; xs[i] = c.C[i] > e[i] ? 1 : 0; }
    return { sl, ss, xl, xs, warm: p.len * 2 };
  }),
  dc: (c, p) => c.m(`dc${p.N}_${p.M}`, () => {
    const hN = c.m('hh' + p.N, () => I.highest(c.H, p.N)), lN = c.m('ll' + p.N, () => I.lowest(c.L, p.N)), lM = c.m('ll' + p.M, () => I.lowest(c.L, p.M)), hM = c.m('hh' + p.M, () => I.highest(c.H, p.M));
    const sl = u8(c.n), ss = u8(c.n), xl = u8(c.n), xs = u8(c.n);
    for (let i = 1; i < c.n; i++) { // channel of PRIOR bars (i-1) vs close of i
      if (ok(hN[i - 1]) && c.C[i] > hN[i - 1]) sl[i] = 1; if (ok(lN[i - 1]) && c.C[i] < lN[i - 1]) ss[i] = 1;
      if (ok(lM[i - 1]) && c.C[i] < lM[i - 1]) xl[i] = 1; if (ok(hM[i - 1]) && c.C[i] > hM[i - 1]) xs[i] = 1;
    }
    return { sl, ss, xl, xs, warm: p.N + 2 };
  }),
  ema: (c, p) => c.m(`ma${p.kind}${p.fast}_${p.slow}`, () => {
    const f = c.m(p.kind + p.fast, () => p.kind === 'hma' ? hma(c.C, p.fast) : I.ema(c.C, p.fast)), s = c.m(p.kind + p.slow, () => p.kind === 'hma' ? hma(c.C, p.slow) : I.ema(c.C, p.slow));
    const sl = u8(c.n), ss = u8(c.n), xl = u8(c.n), xs = u8(c.n);
    for (let i = 1; i < c.n; i++) { if (!ok(f[i]) || !ok(s[i]) || !ok(f[i - 1]) || !ok(s[i - 1])) continue; if (f[i] > s[i] && f[i - 1] <= s[i - 1]) sl[i] = 1; if (f[i] < s[i] && f[i - 1] >= s[i - 1]) ss[i] = 1; xl[i] = f[i] < s[i] ? 1 : 0; xs[i] = f[i] > s[i] ? 1 : 0; }
    return { sl, ss, xl, xs, warm: p.slow * 2 };
  }),
  macd: (c, p) => c.m(`macd${p.sc}_${p.mode}`, () => {
    const m = c.m('macd' + p.sc, () => I.macd(c.C, Math.round(12 * p.sc), Math.round(26 * p.sc), Math.round(9 * p.sc))), sl = u8(c.n), ss = u8(c.n), xl = u8(c.n), xs = u8(c.n);
    const a = m.line, b = p.mode === 'zero' ? null : m.sig;
    for (let i = 1; i < c.n; i++) {
      const x = a[i], y = b ? b[i] : 0, px = a[i - 1], py = b ? b[i - 1] : 0;
      if (!ok(x) || !ok(y) || !ok(px) || !ok(py)) continue;
      if (x > y && px <= py) sl[i] = 1; if (x < y && px >= py) ss[i] = 1; xl[i] = x < y ? 1 : 0; xs[i] = x > y ? 1 : 0;
    }
    return { sl, ss, xl, xs, warm: Math.round(26 * p.sc) * 3 };
  }),
};
// ---------- filters ----------
const trendMa = (c, n) => c.m('sma' + n, () => I.sma(c.C, n));
const adxA = (c) => c.m('adx14', () => I.adx(c.H, c.L, c.C, 14).adx);
const erA = (c) => c.m('er48', () => I.efficiency(c.C, 48));
function build(c, cfg) {
  const e = ENT[cfg.fam](c, cfg.p), n = c.n, Lf = u8(n), Sf = u8(n);
  const sm = cfg.trend ? trendMa(c, cfg.trend) : null, ad = cfg.qual === 'adx' ? adxA(c) : null, er = cfg.qual === 'er' ? erA(c) : null;
  const thr = cfg.qthr;
  for (let i = 1; i < n; i++) {
    if (!e.sl[i] && !e.ss[i]) continue;
    if (sm && !ok(sm[i])) continue;
    if (ad && !(ad[i] > thr)) continue;
    if (er && !(er[i] > thr)) continue;
    if (e.sl[i] && (!sm || c.C[i] > sm[i])) Lf[i] = 1;
    if (e.ss[i] && (!sm || c.C[i] < sm[i])) Sf[i] = 1;
  }
  return { L: Lf, S: Sf, xL: e.xl, xS: e.xs, warmup: Math.max(e.warm, cfg.trend || 0) + 5 };
}
function exitObj(x) { return x.type === 'sig' ? { kInit: x.kInit, kTrail: x.kTrail || 0, maxBars: 0, sigExit: true } : x.type === 'time' ? { kInit: x.kInit, kTrail: 0, maxBars: x.maxBars, sigExit: false } : { kInit: x.kInit, kTrail: x.kTrail, maxBars: 0, sigExit: false }; }
function evalCfg(cfg, costMul = 1, keep = true) {
  return L.evaluate((c) => build(c, cfg), exitObj(cfg.exit), L.MAIN, costMul, keep);
}
function isStats(r) {
  const t = r.trades.filter((x) => x.tExit < IS_END), s = L.stats(t), ys = [2020, 2021, 2022, 2023].map((y) => s.years[y] || 0);
  return { n: s.n, total: s.total, dd: s.dd, rdd: s.dd > 0 ? s.total / s.dd : 0, ys, all4: ys.every((v) => v > 0) };
}
const label = (cfg) => `${cfg.fam}${JSON.stringify(cfg.p)} tr=${cfg.trend} q=${cfg.qual}${cfg.qual === 'off' ? '' : cfg.qthr} x=${cfg.exit.type}(${cfg.exit.kInit},${cfg.exit.kTrail ?? cfg.exit.maxBars ?? 0})`;
const yline = (r) => L.YEARS.map((y) => `${String(y).slice(2)}:${r.years[y].toFixed(0)}`).join(' ');

// ---------- grid ----------
function entries() {
  const o = [];
  for (const len of [14, 40]) for (const mult of [2, 3, 4, 6]) o.push({ fam: 'st', p: { len, mult } });
  for (const len of [50, 100, 200]) for (const mult of [1.5, 2.5, 3.5]) o.push({ fam: 'kc', p: { len, mult } });
  for (const [Nn, Ms] of [[50, [12, 24]], [100, [12, 24, 50]], [200, [24, 50, 100]], [400, [50, 100]]]) for (const M of Ms) o.push({ fam: 'dc', p: { N: Nn, M } });
  for (const kind of ['ema', 'hma']) for (const [fast, slow] of [[12, 48], [24, 120], [50, 200], [100, 400]]) o.push({ fam: 'ema', p: { kind, fast, slow } });
  for (const sc of [1, 2, 4, 8]) for (const mode of ['zero', 'sig']) o.push({ fam: 'macd', p: { sc, mode } });
  return o;
}
const FILTERS = []; for (const trend of [0, 1200, 2400]) for (const [qual, qthr] of [['off', 0], ['adx', 20], ['er', 0.2]]) FILTERS.push({ trend, qual, qthr });
const EXITS = [{ type: 'atr', kInit: 3, kTrail: 10 }, { type: 'atr', kInit: 3, kTrail: 18 }, { type: 'atr', kInit: 4, kTrail: 14 }, { type: 'atr', kInit: 4, kTrail: 22 }, { type: 'atr', kInit: 6, kTrail: 28 },
  { type: 'sig', kInit: 4, kTrail: 0 }, { type: 'sig', kInit: 4, kTrail: 22 }, { type: 'time', kInit: 4, maxBars: 48 }, { type: 'time', kInit: 4, maxBars: 168 }];

// neighbour axes (one step up/down on each numeric parameter)
const AX = { len: [10, 14, 20, 30, 40, 60, 100, 200], N: [24, 50, 100, 200, 300, 400, 600], M: [6, 12, 24, 50, 100, 200], fast: [8, 12, 18, 24, 36, 50, 75, 100, 150], slow: [32, 48, 80, 120, 160, 200, 300, 400, 600], sc: [0.5, 1, 1.5, 2, 3, 4, 6, 8] };
const AXm = { st: [1.5, 2, 2.5, 3, 4, 5, 6, 8], kc: [1, 1.5, 2, 2.5, 3.5, 5, 7] };
const step = (arr, v, d) => { const k = arr.indexOf(v); if (k < 0) return null; const w = arr[k + d]; return w === undefined ? null : w; };
function neighbours(cfg) {
  const out = [];
  for (const key of Object.keys(cfg.p)) {
    if (typeof cfg.p[key] !== 'number') continue;
    let arr = key === 'mult' ? AXm[cfg.fam] : key === 'len' && cfg.fam === 'kc' ? [30, 50, 75, 100, 150, 200, 300] : AX[key];
    for (const d of [-1, 1]) {
      const v = step(arr, cfg.p[key], d); if (v == null) continue;
      const p = { ...cfg.p, [key]: v };
      if (cfg.fam === 'ema' && p.fast >= p.slow) continue; if (cfg.fam === 'dc' && p.M >= p.N) continue;
      out.push({ ...cfg, p, tag: `${key}${d > 0 ? '+' : '-'}` });
    }
  }
  for (const d of [-1, 1]) { const v = step([0, 800, 1200, 2400], cfg.trend, d); if (v != null) out.push({ ...cfg, trend: v, tag: `trend${d > 0 ? '+' : '-'}` }); }
  const xa = { kInit: [2, 3, 4, 5, 6], kTrail: [6, 10, 14, 18, 22, 28], maxBars: [24, 48, 96, 168, 336] };
  for (const key of ['kInit', 'kTrail', 'maxBars']) if (cfg.exit[key]) for (const d of [-1, 1]) { const v = step(xa[key], cfg.exit[key], d); if (v != null) out.push({ ...cfg, exit: { ...cfg.exit, [key]: v }, tag: `${key}${d > 0 ? '+' : '-'}` }); }
  return out;
}

module.exports = { build, evalCfg, isStats, label, neighbours, ENT };
if (require.main === module) {
  const all = []; for (const e of entries()) for (const f of FILTERS) for (const x of EXITS) all.push({ ...e, ...f, exit: x });
  const lim = +process.argv[2] || 0;
  console.log(`grid size ${all.length}`);
  const t0 = Date.now(); const rows = [];
  const todo = lim ? all.filter((_, i) => i % Math.floor(all.length / lim) === 0).slice(0, lim) : all;
  todo.forEach((cfg, k) => {
    const r = evalCfg(cfg), s = isStats(r); delete r.perCoin; rows.push({ cfg, r, s });
    if (k % 100 === 99) console.error(`${k + 1}/${todo.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  });
  const dt = (Date.now() - t0) / 1000; console.log(`scanned ${todo.length} in ${dt.toFixed(0)}s (${(dt / todo.length).toFixed(2)}s/cfg)`);
  if (lim) { console.log(`estimate full: ${(dt / todo.length * all.length / 60).toFixed(1)} min (includes warm-up of memo caches)`); process.exit(0); }
  const out = [];
  out.push(`FAM-TREND  grid=${all.length}  scanned=${rows.length}  time=${dt.toFixed(0)}s`);
  const cand = rows.filter((x) => x.s.all4 && x.s.n >= 300).sort((a, b) => b.s.rdd - a.s.rdd);
  const pos = rows.filter((x) => x.r.posYears === 7).length;
  out.push(`IS-qualified (4/4 IS years>0, n>=300): ${cand.length}; configs 7/7 at 1x over whole grid (not used for ranking): ${pos}`);
  out.push('\n=== IS TOP 30 (ranked by IS totalR / IS maxDD) ===');
  const top = cand.slice(0, 30), seven = [];
  top.forEach((x, k) => {
    const r2 = evalCfg(x.cfg, 2, false), ok1 = x.r.posYears === 7, ok2 = r2.posYears === 7;
    x.r2 = r2; if (ok1 && ok2) seven.push(x);
    out.push(`#${k + 1} ${label(x.cfg)}\n   IS: n=${x.s.n} R=${x.s.total.toFixed(0)} dd=${x.s.dd.toFixed(0)} r/dd=${x.s.rdd.toFixed(1)} yrs=${x.s.ys.map((v) => v.toFixed(0)).join('/')}\n   1x: ${L.fmt(x.r)}\n   2x: ${L.fmt(r2)}\n   7/7@1x=${ok1 ? 'YES' : 'no'} 7/7@2x=${ok2 ? 'YES' : 'no'}`);
  });
  out.push(`\nIS top30 that are 7/7 at 1x: ${top.filter((x) => x.r.posYears === 7).length}; at both 1x and 2x: ${seven.length}`);
  const pick = top.filter((x) => x.r.posYears === 7).slice(0, 3);
  out.push('\n=== NEIGHBOUR TABLES (best 3 that are 7/7 at 1x) ===');
  for (const x of pick) {
    out.push(`\nBASE ${label(x.cfg)}\n   ${L.fmt(x.r)}`);
    for (const nb of neighbours(x.cfg)) { const r = evalCfg(nb, 1, false); out.push(`  ${nb.tag.padEnd(9)} ${label(nb).slice(0, 80).padEnd(80)} ${r.posYears}/7 R=${r.total.toFixed(0)} r/dd=${r.rdd.toFixed(1)} | ${yline(r)}`); }
  }
  if (!pick.length) { out.push('\nNo IS-top30 7/7. Closest overall (most positive years, by worst year), whole grid:'); rows.sort((a, b) => b.r.posYears - a.r.posYears || b.r.worst - a.r.worst).slice(0, 8).forEach((x) => out.push(`${label(x.cfg)}\n   ${L.fmt(x.r)}`)); }
  fs.writeFileSync(__dirname + '/fam-trend-results.txt', out.join('\n') + '\n');
  console.log('done');
}
