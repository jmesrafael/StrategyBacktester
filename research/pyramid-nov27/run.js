'use strict';
const L = require('../hunt-4h-nov26/lib.js'), I = L.I;
const { COST, run: baseRun } = require('../strat-hunt-nov6/engine.js');
const { logTrial } = require('../harness-nov27/trials.js');
const { monthlyCorrelation, tradeOverlap } = require('../harness-nov27/checks.js');
const { audit } = require('../hunt-4h-nov26/audit.js');
const fs = require('fs');
const COINS = ['SOL', 'NEAR', 'ADA', 'GALA'], IV = 14400, HALF = 0.5;

function entries(c, withStop) {
  const mid = c.m('bm20', () => I.sma(c.C, 20)), sd = c.m('bs20', () => I.stdev(c.C, 20)), tr = c.m('sma200', () => I.sma(c.C, 200)), n = c.n;
  const Lf = new Uint8Array(n), Sf = new Uint8Array(n), sL = new Float64Array(n), sS = new Float64Array(n);
  for (let i = 205; i < n; i++) {
    const m = mid[i], s = sd[i], a = c.atr14[i], cl = c.C[i];
    if (!(m === m) || !(a > 0) || Math.abs(cl - m) < 0.3 * a) continue;
    if (cl > m + 2 * s && cl > tr[i]) { Lf[i] = 1; sL[i] = m; } else if (cl < m - 2 * s && cl < tr[i]) { Sf[i] = 1; sS[i] = m; }
  }
  return withStop ? { L: Lf, S: Sf, stopL: sL, stopS: sS, warmup: 205 } : { L: Lf, S: Sf, warmup: 205 };
}
const STRATS = {
  BB: { build: (c) => entries(c, true), ex: { kInit: 0, kTrail: 0, maxBars: 48, sigExit: false } },
  T: { build: (c) => entries(c, false), ex: { kInit: 2, kTrail: 14, maxBars: 0, sigExit: false } },
};
// pyr: null | {mode:'lvl', k} | {mode:'band'}
function runP(B, ATR, strat, ex, funding, iv, cost, pyr) {
  const n = B.length, trades = [], { L: Lf, S: Sf, stopL, stopS } = strat, warm = Math.max(strat.warmup || 0, 205);
  const T = funding ? funding.map((r) => r[0]) : [], Cs = new Float64Array(funding ? funding.length + 1 : 1);
  if (funding) for (let i = 0; i < funding.length; i++) Cs[i + 1] = Cs[i] + funding[i][1];
  const idx = (t) => { let lo = 0, hi = T.length; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m + 1; else hi = m; } return lo; };
  const fsum = (t0, t1) => (funding ? Cs[idx(t1)] - Cs[idx(t0)] : 0);
  let pos = null, pend = null, pendClose = false, pendAdd = false;
  function exit(px, i, why) {
    const t1 = B[i].time + iv / 2, fr = fsum(B[pos.i0].time, t1);
    const R0 = (pos.dir * (px - pos.entry) / pos.entry - 2 * cost.fee - pos.dir * fr) / pos.dist;
    let R = R0;
    if (pos.add) {
      const a = pos.add, fa = fsum(B[a.i].time, t1);
      R += HALF * (pos.dir * (px - a.px) / a.px - 2 * cost.fee - pos.dir * fa) / pos.dist;
    }
    trades.push({ dir: pos.dir, i0: pos.i0, t: B[pos.i0].time, tExit: B[i].time + iv, R, R0, added: !!pos.add, why, bars: i - pos.i0 + 1 });
    pos = null;
  }
  const be = (d) => { if (d === 1 ? pos.entry > pos.stop : pos.entry < pos.stop) pos.stop = pos.entry; };
  for (let i = 1; i < n; i++) {
    const b = B[i];
    if (pend) {
      const d = pend.dir, fill = b.open * (1 + d * cost.slip);
      let stop = null, dist = 0;
      if (pend.stopPx != null) { stop = pend.stopPx; dist = Math.abs(fill - stop) / fill; if (!(dist > 0 && (d === 1 ? stop < fill : stop > fill))) stop = null; }
      else { dist = ex.kInit * pend.atr / fill; stop = fill - d * ex.kInit * pend.atr; }
      if (stop != null && dist > 0) pos = { dir: d, i0: i, entry: fill, stop, dist, ext: b.open, add: null };
      pend = null;
    }
    if (pendClose && pos) { exit(b.open * (1 - pos.dir * cost.slip), i, 'sig'); pendAdd = false; }
    pendClose = false;
    if (pendAdd && pos && !pos.add) {
      const d = pos.dir;
      pos.add = { px: b.open * (1 + d * cost.slip), i };
      if (d * (b.open - pos.entry) > 0) be(d);
    }
    pendAdd = false;
    if (pos) {
      const d = pos.dir;
      if (d === 1 ? b.low <= pos.stop : b.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, b.open) : Math.max(pos.stop, b.open)) * (1 - d * cost.slip), i, 'stop');
      else {
        if (pyr && pyr.mode === 'lvl' && !pos.add) {
          const lvl = pos.entry * (1 + d * pyr.k * pos.dist);
          if (d === 1 ? b.high >= lvl : b.low <= lvl) {
            const f = d === 1 ? Math.max(lvl, b.open) : Math.min(lvl, b.open);
            pos.add = { px: f * (1 + d * cost.slip), i };
            be(d); // active from the next candle: the stop check of this candle is already done
          }
        }
        if (ex.kTrail > 0) {
          pos.ext = d === 1 ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low);
          const ns = pos.ext - d * ex.kTrail * ATR[i];
          if (d === 1 ? ns > pos.stop : ns < pos.stop) pos.stop = ns;
        }
      }
    }
    if (pos) {
      if (ex.maxBars > 0 && i - pos.i0 >= ex.maxBars) pendClose = true;
      else if (pyr && pyr.mode === 'band' && !pos.add && i > pos.i0 && i + 1 < n && (pos.dir === 1 ? Lf[i] && !Lf[i - 1] : Sf[i] && !Sf[i - 1])) pendAdd = true;
      continue;
    }
    if (i < warm || !(ATR[i] > 0) || i + 1 >= n) continue;
    if (Lf[i]) pend = { dir: 1, atr: ATR[i], stopPx: stopL ? stopL[i] : null };
    else if (Sf[i]) pend = { dir: -1, atr: ATR[i], stopPx: stopS ? stopS[i] : null };
    if (pend && pend.stopPx != null && !(pend.stopPx > 0)) pend = null;
  }
  return trades;
}
function evalCfg(sk, pyr, mul = 1) {
  const S = STRATS[sk], cost = { fee: COST.fee * mul, slip: COST.slip * mul }, all = [];
  for (const s of COINS) { const c = L.coin(s); for (const t of runP(c.B, c.atr14, S.build(c), S.ex, c.funding, IV, cost, pyr)) { t.coin = s; all.push(t); } }
  return all.sort((a, b) => a.tExit - b.tExit);
}
const yr = (t) => new Date(t.tExit * 1000).getUTCFullYear();
function sum(T) {
  let eq = 0, pk = 0, dd = 0; const years = {}; for (const y of L.YEARS) years[y] = 0;
  for (const t of T) { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); years[yr(t)] += t.R; }
  return { n: T.length, R: eq, dd, rdd: dd > 0 ? eq / dd : 0, years, pos: L.YEARS.filter((y) => years[y] > 0).length };
}
function ex10(T) { const top = new Set([...T].sort((a, b) => b.R - a.R).slice(0, 10)); return sum(T.filter((t) => !top.has(t))); }
function split(T) { return { full: sum(T), IS: sum(T.filter((t) => yr(t) <= 2023)), OOS: sum(T.filter((t) => yr(t) >= 2024)), ex10: ex10(T) }; }

// sanity: pyr=null must equal the repo engine
for (const sk of ['BB', 'T']) {
  let a = 0;
  for (const s of COINS) { const c = L.coin(s), S = STRATS[sk]; a += baseRun(c.B, c.atr14, S.build(c), S.ex, c.funding, IV, COST).trades.reduce((x, t) => x + t.R, 0); }
  const b = evalCfg(sk, null).reduce((x, t) => x + t.R, 0);
  console.log(`sanity ${sk}: engine ${a.toFixed(4)} mine ${b.toFixed(4)}`); if (Math.abs(a - b) > 1e-6) throw new Error('baseline mismatch');
}
const VARS = [{ id: 'k1.5', mode: 'lvl', k: 1.5 }, { id: 'k2', mode: 'lvl', k: 2 }, { id: 'k3', mode: 'lvl', k: 3 }, { id: 'band', mode: 'band' }];
const f = (v, d = 1) => v.toFixed(d), out = [], res = {};
const yrow = (s) => L.YEARS.map((y) => f(s.years[y], 0).padStart(5)).join('');
for (const sk of ['BB', 'T']) {
  const base = evalCfg(sk, null), base2 = evalCfg(sk, null, 2), B = split(base), B2 = split(base2);
  res[sk] = { base: B, rows: [] };
  out.push(`\n## ${sk === 'BB' ? 'BB-CORE 4h' : 'T-CORE 4h'} (SOL NEAR ADA GALA)\n`);
  out.push('| variant | adds | R | DD | R/DD | IS R/DD | OOS R/DD | OOS R | OOS DD | 2x R/DD | 2x OOS R/DD | ex10 R | ex10 R/DD | yrs+ | yrs beating base |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const line = (id, T, T2, adds) => {
    const s = split(T), s2 = split(T2), beat = L.YEARS.filter((y) => s.full.years[y] > B.full.years[y]).length;
    out.push(`| ${id} | ${adds} | ${f(s.full.R, 0)} | ${f(s.full.dd)} | ${f(s.full.rdd, 2)} | ${f(s.IS.rdd, 2)} | ${f(s.OOS.rdd, 2)} | ${f(s.OOS.R, 0)} | ${f(s.OOS.dd)} | ${f(s2.full.rdd, 2)} | ${f(s2.OOS.rdd, 2)} | ${f(s.ex10.R, 0)} | ${f(s.ex10.rdd, 2)} | ${s.full.pos}/7 | ${beat}/7 |`);
    return { id, s, s2, beat };
  };
  line('baseline', base, base2, 0);
  for (const v of VARS) {
    const T = evalCfg(sk, v), T2 = evalCfg(sk, v, 2), r = line(v.id, T, T2, T.filter((t) => t.added).length);
    r.T = T; res[sk].rows.push(r);
    logTrial({ strat: sk, ...v, coins: COINS }, { R: r.s.full.R, dd: r.s.full.dd, rdd: r.s.full.rdd, isRdd: r.s.IS.rdd, oosRdd: r.s.OOS.rdd, baseOosRdd: B.OOS.rdd }, 'pyramid-nov27');
  }
  const pick = res[sk].rows.reduce((a, b) => (b.s.IS.rdd > a.s.IS.rdd ? b : a));
  const chk = [
    ['OOS R/DD > baseline', pick.s.OOS.rdd > B.OOS.rdd, `${f(pick.s.OOS.rdd, 2)} vs ${f(B.OOS.rdd, 2)}`],
    ['2x full R/DD > base 2x', pick.s2.full.rdd > B2.full.rdd, `${f(pick.s2.full.rdd, 2)} vs ${f(B2.full.rdd, 2)}`],
    ['2x OOS R/DD > base 2x', pick.s2.OOS.rdd > B2.OOS.rdd, `${f(pick.s2.OOS.rdd, 2)} vs ${f(B2.OOS.rdd, 2)}`],
    ['ex10 R > base ex10', pick.s.ex10.R > B.ex10.R, `${f(pick.s.ex10.R, 0)} vs ${f(B.ex10.R, 0)}`],
    ['ex10 R/DD not worse', pick.s.ex10.rdd >= B.ex10.rdd, `${f(pick.s.ex10.rdd, 2)} vs ${f(B.ex10.rdd, 2)}`],
    ['yrs+ >= 4', pick.s.full.pos >= 4, `${pick.s.full.pos}/7`],
    ['beats base in >=4 yrs', pick.beat >= 4, `${pick.beat}/7`],
  ];
  res[sk].pick = pick.id; res[sk].pass = chk.every((c) => c[1]);
  out.push(`\nIS pick: **${pick.id}** (IS R/DD ${f(pick.s.IS.rdd, 2)} vs base IS ${f(B.IS.rdd, 2)}). Pass checks:\n`, '| check | pass | values |', '|---|---|---|', ...chk.map((c) => `| ${c[0]} | ${c[1] ? 'yes' : 'NO'} | ${c[2]} |`), `\n=> ${sk} ${res[sk].pass ? 'PASSES' : 'FAILS'}`);
  out.push(`\nPer-year R (2020..2026): baseline ${yrow(B.full)} | ${pick.id} ${yrow(pick.s.full)}`);
  const ad = pick.T.filter((t) => t.added);
  out.push(`Add-on trades ${ad.length}/${pick.T.length}; on those trades baseline R ${f(ad.reduce((x, t) => x + t.R0, 0), 0)} -> with add ${f(ad.reduce((x, t) => x + t.R, 0), 0)}; monthly corr vs baseline ${f(monthlyCorrelation(pick.T, base), 3)}, overlap ${f(tradeOverlap(pick.T, base), 2)}`);
  out.push(`IS->OOS R/DD gain vs baseline per variant (IS / OOS): ` + res[sk].rows.map((r) => `${r.id} ${f(r.s.IS.rdd - B.IS.rdd, 2)}/${f(r.s.OOS.rdd - B.OOS.rdd, 2)}`).join(', '));
}
const a = audit([{ id: 'BBsig', build: (c) => entries(c, true) }, { id: 'Tsig', build: (c) => entries(c, false) }], { coins: ['SOL', 'ADA'], cuts: 8 });
out.push(`\nTruncation audit of entry signals: ${a.ok ? 'OK' : 'LOOK-AHEAD'} (${a.perStrategy.map((p) => p.checks + ' checks/' + p.mismatches + ' mismatches').join('; ')})`);
fs.writeFileSync(__dirname + '/results.raw.md', out.join('\n'));
console.log(out.join('\n'));
