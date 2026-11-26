// fam-vol.js - Bollinger / volatility breakout family on 1h. All indicators causal (bars <= i), memoized per coin.
'use strict';
const L = require('./lib.js'), I = L.I, fs = require('fs');
const ok = I.ok;
const CUT = Date.parse('2024-01-01') / 1000;
const MAINC = L.MAIN;

const band = (c, len) => c.m('band' + len, () => ({ mid: I.sma(c.C, len), sd: I.stdev(c.C, len) }));
const smaC = (c, n) => c.m('sma' + n, () => I.sma(c.C, n));
const adxC = (c) => c.m('adx56', () => I.adx(c.H, c.L, c.C, 56).adx);
const volAvg = (c) => c.m('vavg480', () => I.sma(c.V, 480));
// causal squeeze: relative band width within 25% of its trailing 480-bar low, seen in the last 6 bars
const sqz = (c, len) => c.m('sqz' + len, () => {
  const b = band(c, len), w = Float64Array.from(b.mid, (m, i) => ok(m) ? b.sd[i] / m : NaN);
  const lo = I.lowest(w, 480), flag = new Uint8Array(c.n);
  for (let i = 0; i < c.n; i++) if (ok(lo[i]) && w[i] <= lo[i] * 1.25) flag[i] = 1;
  const rec = new Uint8Array(c.n); let last = -999;
  for (let i = 0; i < c.n; i++) { if (flag[i]) last = i; rec[i] = i - last <= 6 ? 1 : 0; }
  return rec;
});
// p = {len, mult, trend, minStop, filt}
function build(c, p) {
  const b = band(c, p.len), tr = p.trend ? smaC(c, p.trend) : null, n = c.n;
  const Lf = new Uint8Array(n), Sf = new Uint8Array(n), stopL = new Float64Array(n), stopS = new Float64Array(n);
  const adx = p.filt === 'adx25' || p.filt === 'adx30' ? adxC(c) : null, adxMax = p.filt === 'adx25' ? 25 : 30;
  const sq = p.filt === 'sqz' ? sqz(c, p.len) : null, va = p.filt === 'vol' ? volAvg(c) : null;
  const slow = p.filt === 'slope' ? smaC(c, 800) : null;
  const warm = Math.max(p.len, p.trend || 0, p.filt === 'sqz' ? 480 + p.len : 0, p.filt === 'vol' ? 480 : 0, p.filt === 'slope' ? 800 + 96 : 0, p.filt && p.filt.startsWith('adx') ? 120 : 0) + 2;
  for (let i = warm; i < n; i++) {
    const m = b.mid[i], s = b.sd[i], a = c.atr14[i];
    if (!ok(m) || !ok(a)) continue;
    const up = m + p.mult * s, lo = m - p.mult * s, cl = c.C[i];
    let d = 0;
    if (cl > up && (!tr || cl > tr[i])) d = 1; else if (cl < lo && (!tr || cl < tr[i])) d = -1;
    if (!d) continue;
    if (Math.abs(cl - m) < p.minStop * a) continue;
    if (adx && !(adx[i] <= adxMax)) continue;
    if (sq && !sq[i]) continue;
    if (va && !(c.V[i] > 1.5 * va[i])) continue;
    if (slow && !(d === 1 ? slow[i] > slow[i - 96] : slow[i] < slow[i - 96])) continue;
    if (d === 1) { Lf[i] = 1; stopL[i] = m; } else { Sf[i] = 1; stopS[i] = m; }
  }
  return { L: Lf, S: Sf, stopL, stopS, warmup: warm };
}
const key = (p) => [p.len, p.mult, p.trend, p.minStop, p.filt].join('|');
function entries(c, p) { return c.m('ent' + key(p), () => build(c, p)); }
// exits: 'M' mid stop + time ; 'T' mid stop + ATR trail ; 'A' ATR stop + trail
const mkEx = (e) => e.kind === 'M' ? { kInit: 0, kTrail: 0, maxBars: e.bars, sigExit: false }
  : e.kind === 'T' ? { kInit: 0, kTrail: e.k, maxBars: 0, sigExit: false } : { kInit: e.ki, kTrail: e.k, maxBars: 0, sigExit: false };
const strat = (p, e) => (c) => { const s = entries(c, p); return e.kind === 'A' ? { ...s, stopL: null, stopS: null } : s; };
const exName = (e) => e.kind === 'M' ? `M-time${e.bars}` : e.kind === 'T' ? `M-trail${e.k}` : `ATR${e.ki}-trail${e.k}`;
const pName = (p) => `len${p.len} x${p.mult} tr${p.trend || 'off'} ms${p.minStop} ${p.filt || 'nofilt'}`;

function isStats(trades) {
  const tr = trades.filter((t) => t.tExit < CUT).sort((a, b) => a.tExit - b.tExit);
  let eq = 0, pk = 0, dd = 0; const yrs = {};
  for (const t of tr) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); const y = L.yearOf(t.tExit); yrs[y] = (yrs[y] || 0) + t.R; }
  const ok4 = [2020, 2021, 2022, 2023].every((y) => (yrs[y] || 0) > 0);
  return { n: tr.length, R: eq, dd, rdd: dd > 0 ? eq / dd : 0, ok4, yrs };
}

function grid() {
  const P = [], E = [];
  for (const len of [40, 80, 120]) for (const mult of [1.8, 2.2, 2.6]) for (const trend of [0, 400, 800, 1600, 2400])
    for (const filt of [null, 'adx25', 'adx30', 'sqz', 'vol', 'slope']) P.push({ len, mult, trend, minStop: 0.3, filt });
  for (const len of [40, 80, 120]) for (const mult of [1.8, 2.2, 2.6]) for (const trend of [0, 400, 800, 1600, 2400]) P.push({ len, mult, trend, minStop: 0.8, filt: null });
  for (const bars of [96, 192, 384]) E.push({ kind: 'M', bars });
  for (const k of [12, 20]) E.push({ kind: 'T', k });
  E.push({ kind: 'A', ki: 3, k: 12 }, { kind: 'A', ki: 4, k: 20 });
  return { P, E };
}

if (require.main === module) {
  const { P, E } = grid();
  const out = [];
  const log = (s) => { out.push(s); console.log(s); };
  const t0 = Date.now(), res = [];
  const only = process.argv[2] ? +process.argv[2] : Infinity; let cnt = 0;
  outer: for (const p of P) for (const e of E) {
    if (cnt++ >= only) break outer;
    const r = L.evaluate(strat(p, e), mkEx(e), MAINC, 1, true);
    const s = isStats(r.trades); r.trades = null;
    res.push({ p, e, s, r });
    if (cnt % 100 === 0) console.error(cnt, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  log(`configs evaluated: ${res.length}, time ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  const elig = res.filter((x) => x.s.ok4 && x.s.n >= 300).sort((a, b) => b.s.rdd - a.s.rdd);
  log(`IS-eligible (4/4 IS years>0, n>=300): ${elig.length}`);
  const top = elig.slice(0, 30), rows = [];
  for (const x of top) {
    const r2 = L.evaluate(strat(x.p, x.e), mkEx(x.e), MAINC, 2);
    x.r2 = r2; x.full = x.r.posYears === 7; x.full2 = r2.posYears === 7;
    log(`\n#${rows.push(x)} ${pName(x.p)} | ${exName(x.e)}  IS: n=${x.s.n} R=${x.s.R.toFixed(0)} dd=${x.s.dd.toFixed(0)} R/DD=${x.s.rdd.toFixed(2)}${x.full ? '  [7/7 @1x]' : ''}${x.full2 ? ' [7/7 @2x]' : ''}`);
    log('  1x: ' + L.fmt(x.r)); log('  2x: ' + L.fmt(r2));
  }
  const good = rows.filter((x) => x.full);
  log(`\n=== 7/7 at 1x among IS top 30: ${good.length}; also 2x: ${good.filter((x) => x.full2).length}`);
  const pick = (good.length ? good : rows).slice(0, 3);
  if (!good.length) log('NO 7/7 config; neighbour tables for closest (top-3 IS rank)');
  const steps = { len: [40, 60, 80, 100, 120], mult: [1.8, 2.0, 2.2, 2.4, 2.6], trend: [0, 400, 800, 1600, 2400] };
  const nb = (arr, v) => { const i = arr.indexOf(v); return [arr[i - 1], arr[i + 1]].filter((z) => z !== undefined); };
  for (const x of pick) {
    log(`\n--- neighbours of ${pName(x.p)} | ${exName(x.e)}`);
    const variants = [];
    for (const k of ['len', 'mult', 'trend']) for (const v of nb(steps[k], x.p[k])) variants.push([`${k}=${v}`, { ...x.p, [k]: v }, x.e]);
    if (x.e.kind === 'M') for (const v of nb([96, 192, 384], x.e.bars)) variants.push([`bars=${v}`, x.p, { ...x.e, bars: v }]);
    if (x.e.kind === 'T') for (const v of nb([8, 12, 16, 20, 28], x.e.k)) variants.push([`trail=${v}`, x.p, { ...x.e, k: v }]);
    if (x.e.kind === 'A') for (const v of nb([8, 12, 16, 20, 28], x.e.k)) variants.push([`trail=${v}`, x.p, { ...x.e, k: v }]);
    for (const [nm, p, e] of variants) { const r = L.evaluate(strat(p, e), mkEx(e), MAINC, 1); log(`  ${nm.padEnd(12)} ${L.fmt(r)}`); }
  }
  const all7 = res.filter((x) => x.r.posYears === 7).sort((a, b) => b.s.rdd - a.s.rdd).slice(0, 10);
  log(`\nAll-config 7/7 at 1x (any IS result): ${res.filter((x) => x.r.posYears === 7).length}; top by IS R/DD:`);
  for (const x of all7) log(`  ${pName(x.p)} | ${exName(x.e)} IS-ok4=${x.s.ok4} n_IS=${x.s.n} R/DD=${x.s.rdd.toFixed(2)} :: ${L.fmt(x.r)}`);
  fs.writeFileSync('fam-vol-results.txt', out.join('\n') + '\n');
}
module.exports = { build, strat, mkEx };
