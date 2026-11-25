// run.js: every test of PLAN.md.  node --max-old-space-size=8192 run.js  -> RESULTS.md + results.json
'use strict';
const fs = require('fs'), path = require('path');
const S = require('./sim');
const E = require('../../intel/engines/backtest/engine');
const { bot } = require('../../intel/engines/backtest/strategies');
const C = require('../../candles/candles.js');
const L = require('../bb-tweak-nov25/engine'), K = require('../bb-tweak-nov25/locked.json');
const CFG = require('../../intel/config.json').bots;
const DETAIL = require('../zec-replacement-2/detail.json');
const { IV, END } = S, ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000, T0 = ts(2020), CUT = ts(2024), YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026], PHP = 58, START = 1000 / PHP;
const md = [], out = {}, log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v, d = 0) => (100 * v).toFixed(d) + '%';
const peso = (usd) => { const v = usd * PHP; return v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v).toLocaleString('en-US'); };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const share = (a, fn) => a.filter(fn).length / a.length;
const table = (head, rows) => { md.push('| ' + head.join(' | ') + ' |', '|' + '---|'.repeat(head.length), ...rows.map((r) => '| ' + r.join(' | ') + ' |'), ''); };

// ---------- bots and account versions ----------
const BC = CFG.bbcore.coins, IC = CFG.icore.coins, TC = CFG.tcore.coins;
const BOTS = {
  bb: { label: 'BB-CORE live', name: 'bb', kind: 'bb', coins: BC, mult: 1 },
  bb100: { label: 'BB tweak 1.00x', name: 'bb', kind: 'bbT', coins: BC, mult: 1 },
  bb105: { label: 'BB tweak 1.05x', name: 'bb', kind: 'bbT', coins: BC, mult: 1.05 },
  ic: { label: 'I-CORE live', name: 'ic', kind: 'ic', coins: IC, mult: 1 },
  t14: { label: 'T-CORE live (trail 14)', name: 'tc', kind: 'tc', coins: TC, mult: 1 },
  t12: { label: 'T-CORE trail 12', name: 'tc', kind: 'tc', coins: TC, mult: 1, spec: { kTrail: 12 } },
};
const VERS = [['ORIG', 'ORIG (3 live bots)', ['bb', 'ic', 't14'], 1], ['NEW', 'NEW (BB 1.05x + I + T12)', ['bb105', 'ic', 't12'], 1], ['NEW-BB', 'NEW-BB (BB 1.05x only)', ['bb105', 'ic', 't14'], 1],
  ['NEW-T', 'NEW-T (T12 only)', ['bb', 'ic', 't12'], 1], ['SAFE', 'SAFE (BB 1.00x only)', ['bb100', 'ic', 't14'], 1], ['ORIG-LOW', 'ORIG-LOW (live, risk x0.85)', ['bb', 'ic', 't14'], 0.85]];
const WEIGHT = [0.5, 0.25, 0.25];
const accBots = (v) => v[2].map((id, k) => ({ ...BOTS[id], weight: WEIGHT[k], mult: BOTS[id].mult * v[3] }));
const botTrades = (id, sets, extra = {}) => { const b = BOTS[id]; return b.coins.flatMap((c) => S.coinTrades(sets(c), b.kind, { spec: b.spec, mult: b.mult * (extra.mult || 1), name: b.name, rnd: extra.rnd, cost: extra.cost, sig: extra.sig?.(sets(c), b) })); };

// R equity on a 4h grid, open trades valued at each close
function rcurve(trades, sets, g0, len) {
  const d = new Float64Array(len);
  for (const t of trades) { const x = sets(t.c), w = t.w; let prev = 0;
    for (let i = t.i0; i < x.n && x.T[i] + IV < t.tExit; i++) { const v = (w * (t.dir * (x.C[i] - t.entry) / t.entry - 0.001 - t.dir * (x.FS[i + 1] - x.FS[t.i0]))) / t.dist, k = (x.T[i] + IV - g0) / IV; if (k >= 0 && k < len) d[k] += v - prev; prev = v; }
    const k = (t.tExit - g0) / IV; if (k >= 0 && k < len) d[k] += w * t.R - prev; }
  for (let i = 1; i < len; i++) d[i] += d[i - 1]; return d;
}
function stats(trades, sets, a, b) {
  const g0 = a, len = Math.floor((b - a) / IV) + 1, all = [...trades].sort((p, r) => p.tExit - r.tExit || p.t - r.t), t = all.filter((x) => x.tExit > a && x.tExit <= b);
  const eq = rcurve(all.filter((x) => x.tExit > a && x.t < b), sets, g0, len);
  let R = 0, pk = 0, dd = 0, ls = 0, cur = 0, win = 0, gw = 0, gl = 0, lg = 0, sh = 0; const rs = [], mon = {};
  for (const x of t) { const r = x.w * x.R; rs.push(r); R += r; pk = Math.max(pk, R); dd = Math.max(dd, pk - R); if (r > 0) { win++; gw += r; cur = 0; } else { gl -= r; ls = Math.max(ls, ++cur); } if (x.dir === 1) lg += r; else sh += r; const k = new Date((x.tExit - 1) * 1000).toISOString().slice(0, 7); mon[k] = (mon[k] || 0) + r; }
  let mp = 0, mdd = 0, pkAt = 0, under = 0; for (let i = 0; i < len; i++) { if (eq[i] >= mp) { mp = eq[i]; pkAt = i; } mdd = Math.max(mdd, mp - eq[i]); under = Math.max(under, i - pkAt); }
  rs.sort((p, r) => r - p); const mv = Object.values(mon);
  return { n: t.length, R, dd, mdd, ls, win: t.length ? win / t.length : 0, avg: t.length ? R / t.length : 0, pf: gl ? gw / gl : 0, ex10: R - rs.slice(0, 10).reduce((s, v) => s + v, 0), under: under / 6, redM: mv.filter((v) => v < 0).length, months: mv.length, worstM: mv.length ? Math.min(...mv) : 0, longs: lg, shorts: sh };
}
// random frictions, identical for every version
const hash = (seed, s, t) => { let h = (seed * 2654435761) >>> 0; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); h = Math.imul(h ^ Math.floor(t / IV), 2246822519); h ^= h >>> 13; h = Math.imul(h, 3266489917); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const frictions = (seed, miss = 0.15, slip = 0.0015, fee = 1) => ({ skip: (b, c, t) => hash(seed, 'm' + b + c, t) < miss, extra: (b, c, t) => hash(seed, 's' + b + c, t) * slip, feeMult: 1 + hash(seed, 'fee', 0) * fee });

// ---------- 0. engine check ----------
let cmpN = 0, cmpBad = 0;
for (const id of Object.keys(BOTS)) for (const c of BOTS[id].coins) {
  const b = BOTS[id], x = S.real(c), a = S.coinTrades(x, b.kind, { spec: b.spec });
  const rows = C.load(c, '4h').filter((r) => r[0] + IV <= END).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const ref = b.kind === 'bbT' ? L.replay(K.iiCombo.cfg, { coins: [c], endT: END }).trades : E.run(rows, bot(b.kind === 'bb' ? 'bbcore' : b.kind === 'ic' ? 'icore' : 'tcore', 'v3', b.spec || {}), E.standardCost({ funding: C.funding(c).filter((r) => r[0] <= END) })).trades;
  cmpBad += Math.abs(a.length - ref.length); for (let i = 0; i < Math.min(a.length, ref.length); i++) { cmpN++; if (a[i].t !== ref[i].t || a[i].tExit !== ref[i].tExit || a[i].dir !== ref[i].dir || Math.abs(a[i].R - ref[i].R) > 1e-7) cmpBad++; }
}
log('engine check', cmpN, cmpBad); if (cmpBad) process.exit(1);
md.push('# Results: replace the live bots? (candles to 2026-11-24)', '', `Study engine against the project engine: ${cmpN} trades, ${cmpBad} different.`, '');

// ---------- 1. history ----------
const HT = Object.fromEntries(Object.keys(BOTS).map((id) => [id, botTrades(id, S.real)]));
const verTrades = (v, src = HT) => v[2].flatMap((id, k) => src[id].map((t) => ({ ...t, w: t.w * WEIGHT[k] * v[3] })));
const HIST = {};
const histRows = [...Object.keys(BOTS).map((id) => [BOTS[id].label, HT[id], id]), ...VERS.map((v) => ['Account ' + v[0], verTrades(v), v[0]])];
for (const [, tr, id] of histRows) HIST[id] = { all: stats(tr, S.real, T0, END), oos: stats(tr, S.real, CUT, END), two: stats(id in BOTS ? botTrades(id, S.real, { cost: 2 }) : verTrades(VERS.find((v) => v[0] === id), Object.fromEntries(Object.keys(BOTS).map((b) => [b, botTrades(b, S.real, { cost: 2 })]))), S.real, T0, END), y: YEARS.map((y) => stats(tr, S.real, ts(y), Math.min(ts(y + 1), END))) };
md.push('## 1. History, complete stats (2020 to Nov 24 2026, R)', '', 'Bots first, then the account (weighted 50 / 25 / 25; compare accounts only with accounts).', '');
table(['Version', 'Trades', 'Total R', 'Drop closed', 'Drop open', 'R / drop open', 'Longest under water (days)', 'Longest losing run', 'Losing months', 'Worst month', 'Win', 'Avg R', 'Profit factor', 'Without best 10', 'Longs / shorts'],
  histRows.map(([n, , id]) => { const m = HIST[id].all; return [n, m.n, f(m.R), m.dd.toFixed(1), m.mdd.toFixed(1), (m.R / m.mdd).toFixed(1), Math.round(m.under), m.ls, `${m.redM}/${m.months}`, f(m.worstM, 1), pc(m.win), f(m.avg, 2), m.pf.toFixed(2), f(m.ex10), `${f(m.longs)} / ${f(m.shorts)}`]; }));
table(['Version', '2024-26 R', '2024-26 drop closed', '2024-26 drop open', 'Double costs R', 'Double costs drop open', 'Green years'], histRows.map(([n, , id]) => { const h = HIST[id]; return [n, f(h.oos.R), h.oos.dd.toFixed(1), h.oos.mdd.toFixed(1), f(h.two.R), h.two.mdd.toFixed(1), `${h.y.filter((m) => m.R > 0).length}/7`]; }));
for (const [title, fn] of [['Total R per year', (m) => f(m.R)], ['Drop open per year (R)', (m) => m.mdd.toFixed(0)], ['Drop closed per year (R)', (m) => m.dd.toFixed(0)]]) { md.push(`### ${title}`, ''); table(['Version', ...YEARS], histRows.map(([n, , id]) => [n, ...HIST[id].y.map(fn)])); }
log('history done');

// ---------- 2. PHP 1,000 account ----------
const SPECS = {};
for (const c of new Set([...BC, ...IC, ...TC])) { const d = DETAIL.data ? DETAIL.data.find((s) => s.symbol === c + '_USDT') : (Array.isArray(DETAIL) ? DETAIL : Object.values(DETAIL)).find((s) => s.symbol === c + '_USDT'); const x = S.real(c); SPECS[c] = { unit: d.contractSize * x.C[x.n - 1], minVol: d.minVol || 1, mmr: d.maintenanceMarginRate }; }
md.push('## 2. PHP 1,000 account', '', `Minimum position per coin today (USD): ${Object.entries(SPECS).map(([c, s]) => `${c} ${(s.unit * s.minVol).toFixed(2)}`).join(', ')}. PHP ${PHP} per USD.`, '');
const acc = (v, o = {}) => { const r = S.account(accBots(v), { start: o.start ?? START, from: o.from ?? T0, to: o.to ?? END, sets: o.sets || S.real, specs: o.ideal ? null : SPECS, rnd: o.rnd, fee20: o.fee20 }); return { ...S.curveStats(r.curve, o.start ?? START), curve: r.curve, taken: r.taken, skipped: r.skipped }; };
const PF = {};
for (const v of VERS) PF[v[0]] = { real: acc(v), fee: acc(v, { fee20: true }), ideal: acc(v, { ideal: true }) };
md.push('### Start Jan 2020 with PHP 1,000, run to Nov 24 2026', '', 'Money this large after 7 years is not realistic (order size, slippage, withdrawals); compare the versions and the falls, not the final amount.', '');
table(['Version', 'End (PHP)', 'Deepest fall', 'Lowest value (PHP)', 'Longest under water (days)', 'Orders filled / failed attempts', 'End after 20% fee', 'End if no order minimums', 'Deepest fall if no minimums'],
  VERS.map((v) => { const p = PF[v[0]]; return [v[1], peso(p.real.end), pc(p.real.dd, 1), peso(p.real.low), Math.round(p.real.underDays), `${p.real.taken} / ${p.real.skipped}`, peso(p.fee.end), peso(p.ideal.end), pc(p.ideal.dd, 1)]; }));
const yearEnd = (curve, y) => { let v = START; for (const [t, e] of curve) { if (t <= ts(y + 1)) v = e; else break; } return v; };
md.push('### Return and deepest fall inside each year (same run)', '');
table(['Version', ...YEARS], VERS.map((v) => [v[1], ...YEARS.map((y) => { const c = PF[v[0]].real.curve, a = y === 2020 ? START : yearEnd(c, y - 1), seg = c.filter(([t]) => t > ts(y) && t <= ts(y + 1)); let pk = a, dd = 0; for (const [, e] of seg) { pk = Math.max(pk, e); dd = Math.max(dd, 1 - e / pk); } return `${f((yearEnd(c, y) / a - 1) * 100)}% / ${pc(dd)}`; })]));
log('account full done');
// start sizes
md.push('### Does the starting amount matter? (start Nov 2024, 24 months)', '');
const sizeRows = [];
for (const php of [1000, 5000, 10000, 50000]) for (const v of VERS.slice(0, 2)) { const r = acc(v, { start: php / PHP, from: ts(2024, 10) }); sizeRows.push([php.toLocaleString('en-US'), v[0], peso(r.end), pc(r.end * PHP / php - 1), pc(r.dd, 1), pc(r.skipped / (r.taken + r.skipped))]); }
table(['Start (PHP)', 'Version', 'End (PHP)', 'Return', 'Deepest fall', 'Failed order attempts (too small or no margin; repeats counted)'], sizeRows);

// ---------- 3a. every start month ----------
md.push('## 3. Randomness on the PHP 1,000 account', '', '### Every start month from Jan 2020', '');
const months = []; for (let y = 2020; y <= 2026; y++) for (let m = 0; m < 12; m++) if (ts(y, m) < END) months.push([y, m]);
const WINS = {};
for (const h of [6, 12, 24]) {
  const starts = months.filter(([y, m]) => ts(y, m + h) <= END), res = Object.fromEntries(VERS.map((v) => [v[0], starts.map(([y, m]) => acc(v, { from: ts(y, m), to: ts(y, m + h) }))]));
  WINS[h] = res;
  md.push(`#### ${h} months (${starts.length} start dates)`, '');
  table(['Version', 'Median end (PHP)', 'Bad case end (1 in 20)', 'Ended with a profit', 'Median deepest fall', 'Bad case fall (1 in 20)', 'Worst fall', 'Smaller fall than ORIG', 'More money than ORIG'],
    VERS.map((v) => { const r = res[v[0]], o = res.ORIG, ends = r.map((x) => x.end), dds = r.map((x) => x.dd); return [v[1], peso(q(ends, 0.5)), peso(q(ends, 0.05)), pc(share(ends, (e) => e > START)), pc(q(dds, 0.5), 1), pc(q(dds, 0.95), 1), pc(Math.max(...dds), 1), v[0] === 'ORIG' ? '-' : pc(share(r.map((x, i) => x.dd < o[i].dd - 1e-12), Boolean)), v[0] === 'ORIG' ? '-' : pc(share(r.map((x, i) => x.end > o[i].end + 1e-12), Boolean))]; }));
  log('windows', h);
}
// ---------- 3b. random frictions ----------
const MC = 300;
for (const [title, win] of [['12 months from a random start date', (s) => { const st = months.filter(([y, m]) => ts(y, m + 12) <= END), [y, m] = st[Math.floor(hash(s, 'start', 0) * st.length)]; return { from: ts(y, m), to: ts(y, m + 12) }; }], ['Full run 2020-2026', () => ({})]]) {
  const res = Object.fromEntries(VERS.map((v) => [v[0], Array.from({ length: MC }, (_, s) => acc(v, { ...win(s + 1), rnd: frictions(s + 1) }))]));
  md.push(`### ${MC} runs with missed signals (15%), random extra slippage and fees: ${title}`, '');
  table(['Version', 'Median end (PHP)', 'Bad case end (1 in 20)', 'Ended with a profit', 'Median deepest fall', 'Bad case fall (1 in 20)', 'Chance of a fall over 50%', 'Smaller fall than ORIG', 'More money than ORIG'],
    VERS.map((v) => { const r = res[v[0]], o = res.ORIG, ends = r.map((x) => x.end), dds = r.map((x) => x.dd); return [v[1], peso(q(ends, 0.5)), peso(q(ends, 0.05)), pc(share(ends, (e) => e > START)), pc(q(dds, 0.5), 1), pc(q(dds, 0.95), 1), pc(share(dds, (d) => d > 0.5)), v[0] === 'ORIG' ? '-' : pc(share(r.map((x, i) => x.dd < o[i].dd - 1e-12), Boolean)), v[0] === 'ORIG' ? '-' : pc(share(r.map((x, i) => x.end > o[i].end + 1e-12), Boolean))]; }));
  log('mc', title);
}
// per bot, in R, randomized history (pass mark c)
const RN = 200, RB = {};
for (const id of Object.keys(BOTS)) RB[id] = Array.from({ length: RN }, (_, s) => stats(botTrades(id, S.real, { rnd: frictions(s + 1) }), S.real, T0, END));
md.push(`### Each bot, ${RN} randomized 7-year histories (R)`, '');
const PAIR = [['bb105', 'bb'], ['bb100', 'bb'], ['t12', 't14']];
table(['Change', 'Open drop smaller', 'Closed drop smaller', 'More R', 'Median open drop: new / live', 'Median R: new / live', 'Runs with positive total: new / live'], PAIR.map(([n, o]) => [BOTS[n].label, pc(share(RB[n].map((m, i) => m.mdd < RB[o][i].mdd), Boolean)), pc(share(RB[n].map((m, i) => m.dd < RB[o][i].dd), Boolean)), pc(share(RB[n].map((m, i) => m.R > RB[o][i].R), Boolean)), `${q(RB[n].map((m) => m.mdd), 0.5).toFixed(1)} / ${q(RB[o].map((m) => m.mdd), 0.5).toFixed(1)}`, `${f(q(RB[n].map((m) => m.R), 0.5))} / ${f(q(RB[o].map((m) => m.R), 0.5))}`, `${pc(share(RB[n], (m) => m.R > 0))} / ${pc(share(RB[o], (m) => m.R > 0))}`]));
log('bot mc');

// ---------- 4. coin toss ----------
const NT = 200;
const flip = (seed) => (x, b) => { const s = S.signals(x, b.kind), dir = Int8Array.from(s.dir, (d, i) => (d ? (hash(seed, 'f' + b.kind + x.coin, x.T[i]) < 0.5 ? 1 : -1) : 0)); return { dir, dist: s.dist, size: s.size }; };
const randomEntry = (seed) => (x, b) => {
  const k = 'rate' + b.kind, s = S.signals(x, b.kind), rate = x.cache[k] ?? (x.cache[k] = s.dir.reduce((a, d) => a + (d ? 1 : 0), 0) / Math.max(1, x.n - 199)), isBB = b.kind === 'bb' || b.kind === 'bbT';
  const mid = isBB ? (x.cache.mid20 || (x.cache.mid20 = (() => { const m = new Float64Array(x.n).fill(NaN); for (let i = 19; i < x.n; i++) { let z = 0; for (let j = i - 19; j <= i; j++) z += x.C[j]; m[i] = z / 20; } return m; })())) : null;
  const A = isBB ? S.atrOf(x, 'A') : null, adx = b.kind === 'bbT' ? S.signals(x, 'bbT') : null, dir = new Int8Array(x.n), dist = new Float64Array(x.n), size = new Float64Array(x.n).fill(1);
  if (b.kind === 'bbT' && !x.cache.adx) x.cache.adx = S.adxArr(x);
  for (let i = 199; i < x.n; i++) { if (hash(seed, 'e' + b.kind + x.coin, x.T[i]) >= rate) continue; const d = hash(seed, 'd' + b.kind + x.coin, x.T[i]) < 0.5 ? 1 : -1;
    if (isBB) { const z = Math.abs(x.C[i] - mid[i]); if (!(z >= 0.3 * A[i])) continue; dist[i] = z; if (b.kind === 'bbT' && x.cache.adx[i] > 27) size[i] = 0.5; } dir[i] = d; }
  return { dir, dist, size };
};
md.push('## 4. Coin toss', '', `${NT} runs each, same exits and costs. "Flip": the bot's own entry times, direction by coin flip. "Random": entry times and direction both random, same number of signals.`, '');
const tossRows = [], tossYears = [];
for (const id of ['bb', 'bb105', 'ic', 't14', 't12']) for (const [nm, mk] of [['Flip', flip], ['Random', randomEntry]]) {
  const runs = Array.from({ length: NT }, (_, s) => { const tr = botTrades(id, S.real, { sig: mk(s + 1) }); const y = YEARS.map(() => 0); let R = 0, e = 0, p = 0, dd = 0; for (const t of tr.sort((a, b) => a.tExit - b.tExit)) { if (t.tExit <= T0) continue; const r = t.w * t.R; R += r; e += r; p = Math.max(p, e); dd = Math.max(dd, p - e); y[new Date((t.tExit - 1) * 1000).getUTCFullYear() - 2020] += r; } return { R, dd, y }; });
  const Rs = runs.map((r) => r.R), real = HIST[id].all;
  tossRows.push([BOTS[id].label, nm, f(real.R), f(q(Rs, 0.5)), f(q(Rs, 0.05)), f(q(Rs, 0.95)), pc(share(Rs, (v) => v > 0)), pc(share(runs, (r) => r.y.every((v) => v > 0))), pc(share(Rs, (v) => v < real.R), 1), `${real.dd.toFixed(0)} / ${q(runs.map((r) => r.dd), 0.5).toFixed(0)}`]);
  tossYears.push([BOTS[id].label, nm, ...YEARS.map((_, k) => pc(share(runs, (r) => r.y[k] > 0)))]);
  log('toss', id, nm);
}
table(['Bot', 'Coin toss', 'Real strategy R', 'Toss median R', 'Toss 5th', 'Toss 95th', 'Toss runs with profit', 'Toss runs green all 7 years', 'Toss runs the real one beats', 'Closed drop: real / toss median'], tossRows);
md.push('### Share of coin-toss runs that made money, per year', '');
table(['Bot', 'Coin toss', ...YEARS], tossYears);

// ---------- 5. synthetic markets ----------
const SYN_COINS = [...new Set([...BC, ...IC, ...TC])], SRC0 = ts(2021, 9), NB = 6570, WARM = 300, LEN = NB + WARM, G0 = 1_700_006_400 - (1_700_006_400 % IV);
const idxAt = (x, t) => { let lo = 0, hi = x.n; while (lo < hi) { const m = (lo + hi) >> 1; if (x.T[m] < t) lo = m + 1; else hi = m; } return lo; };
const btc = S.real('BTC');
const startsFor = (L2, filter) => { const out = []; for (let t = Math.max(SRC0, btc.T[1]); t + L2 * IV <= END; t += IV) { if (filter) { const i = idxAt(btc, t); if (i + L2 - 1 >= btc.n) continue; const r = btc.C[i + L2 - 1] / btc.C[i - 1] - 1; if (!filter(r)) continue; } out.push(t); } return out; };
const MARKETS = [['normal30', 'Normal (30-day blocks)', { L: 180 }], ['normal90', 'Normal (90-day blocks)', { L: 540 }], ['bull', 'Rising only', { L: 180, filter: (r) => r > 0.08 }], ['bear', 'Falling only', { L: 180, filter: (r) => r < -0.08 }],
  ['side', 'Sideways only', { L: 180, filter: (r) => Math.abs(r) <= 0.08 }], ['flat', 'No long-term drift', { L: 180, flat: true }], ['mirror', 'Mirrored (up becomes down)', { L: 180, mirror: true }], ['shuffle', 'Single candles shuffled (no trends)', { L: 1 }]];
const drift = {}; for (const c of SYN_COINS) { const x = S.real(c), a = Math.max(1, idxAt(x, SRC0)); drift[c] = Math.log(x.C[x.n - 1] / x.C[a - 1]) / (x.n - a); }
const ownStarts = {}; const own = (c, L2) => (ownStarts[c + L2] ||= (() => { const x = S.real(c), o = []; for (let i = Math.max(1, idxAt(x, SRC0)); i + L2 <= x.n; i++) o.push(i); return o; })());
function synth(mk, seed) {
  const { L: L2, filter, flat, mirror } = mk, starts = mk.starts || (mk.starts = startsFor(L2, filter)); let s = (seed * 2654435761 + 7) >>> 0; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const blocks = Array.from({ length: Math.ceil(LEN / L2) }, () => ({ t: starts[Math.floor(rnd() * starts.length)], u: rnd() })), sets = {};
  for (const c of SYN_COINS) {
    const x = S.real(c), rows = new Array(LEN), fund = new Float64Array(LEN); let prev = 100, k = 0;
    for (let b = 0; b < blocks.length && k < LEN; b++) {
      let i = idxAt(x, blocks[b].t);
      if (!(i >= 1 && i + L2 <= x.n && x.T[i] === blocks[b].t && x.T[i + L2 - 1] - x.T[i] === (L2 - 1) * IV)) { const o = own(c, L2); i = o[Math.floor(((blocks[b].u * 9973 + c.charCodeAt(0) * 0.137) % 1) * o.length)]; }
      for (let j = 0; j < L2 && k < LEN; j++, k++) { const p = x.C[i + j - 1]; let o = x.O[i + j] / p, h = x.H[i + j] / p, l = x.L[i + j] / p, cl = x.C[i + j] / p, fd = x.F[i + j];
        if (flat) { const a = Math.exp(-drift[c]); o *= a; h *= a; l *= a; cl *= a; }
        if (mirror) { const hh = 1 / l, ll = 1 / h; o = 1 / o; cl = 1 / cl; h = hh; l = ll; fd = -fd; }
        rows[k] = [G0 + k * IV, prev * o, prev * h, prev * l, prev * cl, x.V[i + j]]; fund[k] = fd; prev *= cl; }
    }
    sets[c] = S.pack(c, rows, fund);
  }
  return (c) => sets[c];
}
const NP = 100, SY = {};
const a0 = G0 + WARM * IV, b0 = G0 + LEN * IV;
for (const [key, , mk] of MARKETS) {
  const res = { bot: Object.fromEntries(Object.keys(BOTS).map((id) => [id, []])), ver: Object.fromEntries(VERS.map((v) => [v[0], []])), php: Object.fromEntries(VERS.map((v) => [v[0], []])) };
  for (let p = 1; p <= NP; p++) {
    const sets = synth(mk, p * 31 + key.length), tr = Object.fromEntries(Object.keys(BOTS).map((id) => [id, botTrades(id, sets)]));
    for (const id of Object.keys(BOTS)) res.bot[id].push(stats(tr[id], sets, a0, b0));
    for (const v of VERS) { res.ver[v[0]].push(stats(verTrades(v, tr), sets, a0, b0)); res.php[v[0]].push(acc(v, { sets, from: a0, to: a0 + 2190 * IV })); }
  }
  SY[key] = res; log('synthetic', key);
}
md.push('## 5. Synthetic markets', '', `${NP} markets of each kind, 3 years each, built from real candles from Oct 2021 on. R over 3 years.`, '');
md.push('### Do the bots make money whatever the market does?', '');
table(['Market', ...Object.keys(BOTS).map((id) => BOTS[id].label)], MARKETS.map(([key, name]) => [name, ...Object.keys(BOTS).map((id) => { const r = SY[key].bot[id]; return `${pc(share(r, (m) => m.R > 0))} (${f(q(r.map((m) => m.R), 0.5))}R)`; })]));
md.push('Each cell: share of markets with a profit (median R).', '', '### Changed bot against the live bot', '');
const pairRows = [];
for (const [n, o] of PAIR) for (const [key, name] of MARKETS) { const x = SY[key].bot[n], y = SY[key].bot[o]; pairRows.push([BOTS[n].label, name, pc(share(x.map((m, i) => m.mdd < y[i].mdd), Boolean)), pc(share(x.map((m, i) => m.dd < y[i].dd), Boolean)), pc(share(x.map((m, i) => m.R > y[i].R), Boolean)), `${q(x.map((m) => m.mdd), 0.5).toFixed(1)} / ${q(y.map((m) => m.mdd), 0.5).toFixed(1)}`, `${f(q(x.map((m) => m.R), 0.5))} / ${f(q(y.map((m) => m.R), 0.5))}`]); }
table(['Change', 'Market', 'Open drop smaller', 'Closed drop smaller', 'More R', 'Median open drop: new / live', 'Median R: new / live'], pairRows);
md.push('### PHP 1,000 for one year in each synthetic market', '');
const phpRows = [];
for (const [key, name] of MARKETS) for (const v of VERS) { const r = SY[key].php[v[0]], o = SY[key].php.ORIG, ends = r.map((x) => x.end), dds = r.map((x) => x.dd); phpRows.push([name, v[0], pc(share(ends, (e) => e > START)), peso(q(ends, 0.5)), peso(q(ends, 0.05)), pc(q(dds, 0.5), 1), pc(q(dds, 0.95), 1), v[0] === 'ORIG' ? '-' : pc(share(r.map((x, i) => x.dd < o[i].dd - 1e-12), Boolean)), v[0] === 'ORIG' ? '-' : pc(share(r.map((x, i) => x.end > o[i].end + 1e-12), Boolean))]); }
table(['Market', 'Version', 'Years with profit', 'Median end (PHP)', 'Bad case end (1 in 20)', 'Median fall', 'Bad case fall', 'Smaller fall than ORIG', 'More money than ORIG'], phpRows);

// ---------- 6. pass mark ----------
md.push('## 6. Pass mark (PLAN.md)', '');
const passRows = [];
for (const [n, o] of PAIR) {
  const a = HIST[n].all.mdd < HIST[o].all.mdd, bShare = share(SY.normal30.bot[n].map((m, i) => m.mdd < SY.normal30.bot[o][i].mdd), Boolean), cShare = share(RB[n].map((m, i) => m.mdd < RB[o][i].mdd), Boolean);
  const hr = HIST[n].all.R / HIST[o].all.R, mn = q(SY.normal30.bot[n].map((m) => m.R), 0.5), mo = q(SY.normal30.bot[o].map((m) => m.R), 0.5), dOk = hr >= 0.95 && mn >= mo - 0.05 * Math.abs(mo);
  passRows.push([BOTS[n].label, `${a ? 'pass' : 'FAIL'} (${HIST[n].all.mdd.toFixed(1)} vs ${HIST[o].all.mdd.toFixed(1)})`, `${bShare >= 0.7 ? 'pass' : 'FAIL'} (${pc(bShare)})`, `${cShare >= 0.7 ? 'pass' : 'FAIL'} (${pc(cShare)})`, `${dOk ? 'pass' : 'FAIL'} (history ${pc(hr)}, synthetic ${f(mn)} vs ${f(mo)})`, a && bShare >= 0.7 && cShare >= 0.7 && dOk ? '**REPLACE (paper first)**' : '**do not replace**']);
}
table(['Change', '(a) history open drop', '(b) synthetic', '(c) randomized history', '(d) profit kept', 'Verdict'], passRows);

// ---------- 7. risk level (added AFTER seeing sections 1-6: the owner's priority is the smallest fall) ----------
md.push('', '## 7. Risk level (added after the results above)', '', 'The same two accounts with every trade\'s risk multiplied. "Failed attempts" = share of order attempts below the exchange minimum or without margin. A signal that repeats on later candles counts again, so this is NOT the share of trades lost (see REPORT.md).', '');
const sets30 = Array.from({ length: NP }, (_, p) => synth(MARKETS[0][2], (p + 1) * 31 + 'normal30'.length));
const st12 = months.filter(([y, m]) => ts(y, m + 12) <= END);
const levels = []; for (const [id, name] of [['ORIG', 'ORIG'], ['SAFE', 'BB tweak 1.00x (SAFE)']]) for (const k of [1, 0.7, 0.5]) { const v = VERS.find((x) => x[0] === id); levels.push([`${name}, risk x${k}`, [v[0], v[1], v[2], k]]); }
for (const php of [1000, 10000]) for (const [title, runs] of [['12 months from a random start, 300 runs with random frictions', (v) => Array.from({ length: MC }, (_, s) => { const [y, m] = st12[Math.floor(hash(s + 1, 'start', 0) * st12.length)]; return acc(v, { start: php / PHP, from: ts(y, m), to: ts(y, m + 12), rnd: frictions(s + 1) }); })], ['1 year in 100 synthetic markets (30-day blocks)', (v) => sets30.map((sets) => acc(v, { start: php / PHP, sets, from: a0, to: a0 + 2190 * IV }))]]) {
  md.push(`### Start PHP ${php.toLocaleString('en-US')}: ${title}`, '');
  table(['Account', 'Median end (PHP)', 'Bad case end (1 in 20)', 'Ended with a profit', 'Median deepest fall', 'Bad case fall (1 in 20)', 'Chance of a fall over 50%', 'Failed attempts'],
    levels.map(([n, v]) => { const r = runs(v), ends = r.map((x) => x.end * 1), dds = r.map((x) => x.dd), sk = r.reduce((a, x) => a + x.skipped, 0), tk = r.reduce((a, x) => a + x.taken, 0); return [n, peso(q(ends, 0.5)), peso(q(ends, 0.05)), pc(share(ends, (e) => e > php / PHP)), pc(q(dds, 0.5), 1), pc(q(dds, 0.95), 1), pc(share(dds, (d) => d > 0.5)), pc(sk / (sk + tk))]; }));
  log('risk levels', php, title);
}
fs.writeFileSync(path.join(__dirname, 'RESULTS.md'), md.join('\n') + '\n'); log('written');
