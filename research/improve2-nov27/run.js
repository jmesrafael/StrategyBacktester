// run.js - second search on the validator's causal engine (PLAN.md).  node --max-old-space-size=8192 run.js
'use strict';
const fs = require('fs');
const X = require('../improve-nov27/opus-validate/causal');
const p = (v) => (100 * v).toFixed(1), ts = (y, m = 0) => Date.UTC(y, m, 1) / 1000;

// ICHI-X4 as an extra bot: tenkan 9 / kijun 26 cross with the close outside the cloud, 2 ATR stop, out after 12 candles
X.RULES.ix = { atr: 'B', warmup: 88, ix: true, kInit: 2, kTrail: 0, lockAtR: 0, staleBars: 0, maxBars: 12, cool: 0 };
const signal = X.Slot.prototype.signal;
X.Slot.prototype.signal = function (i) {
  if (!this.S.ix) return signal.call(this, i);
  if (i < 88) return null;
  const tk = (j) => this.hl(j, 9), kj = (j) => this.hl(j, 26), c = this.Cc[i], k = this.cloud(i);
  const up = tk(i) > kj(i) && !(tk(i - 1) > kj(i - 1)), dn = tk(i) < kj(i) && !(tk(i - 1) < kj(i - 1));
  return up && c > k.top ? { dir: 1, w: 1 } : dn && c < k.bot ? { dir: -1, w: 1 } : null;
};
const COINS = { ...X.COINS, ix: ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'ARB'] };

const v = (fam, label, weights, K = 1) => ({ fam, label: `${label}, risk x${K.toFixed(1)}`, weights, K });
const CAND = [];
for (const w of [0.1, 0.15, 0.2, 0.25]) for (const K of [1, 1.1, 1.2]) CAND.push(v('K', `ICHI-X4 ${w * 100}%`, { bb: 0.5 * (1 - w), ic: 0.25 * (1 - w), tc: 0.25 * (1 - w), ix: w }, K));
for (const [b, i, t] of [[60, 25, 15], [65, 20, 15], [70, 15, 15], [60, 20, 20]]) for (const K of [1, 1.1]) CAND.push(v('M', `BB/I/T ${b}/${i}/${t}`, { bb: b / 100, ic: i / 100, tc: t / 100 }, K));
for (const [b, i, t, x] of [[55, 20, 10, 15], [55, 20, 15, 10], [60, 15, 10, 15]]) for (const K of [1, 1.1]) CAND.push(v('N', `BB/I/T/ICHI ${b}/${i}/${t}/${x}`, { bb: b / 100, ic: i / 100, tc: t / 100, ix: x / 100 }, K));
const TRI = v('tri', 'TRI-CORE today', { bb: 0.5, ic: 0.25, tc: 0.25 });

const FLAT = { mode: 'flat', start: 1000 }, LIVE = { mode: 'live', start: 600, cap: 500 };
const go = (c, acc, from = X.T0, to = X.END, extra = {}) => X.stats(X.run({ ...acc, weights: c.weights, K: c.K, coins: COINS, from, to, ...extra }));
const both = (a, b) => a.cagr > b.cagr && a.dd < b.dd;
const r1 = (c) => ({ is: go(c, FLAT, X.T0, X.CUT), oos: go(c, FLAT, X.CUT, X.END) });
const wins = []; for (let y = 2020; y <= 2025; y++) for (let m = 0; m < 12; m++) if (ts(y + 1, m) <= X.END) wins.push([ts(y, m), ts(y + 1, m)]);

const base = { ...r1(TRI), live: go(TRI, LIVE), fresh: go(TRI, LIVE, X.CUT), x2: go(TRI, LIVE, X.T0, X.END, { cost: 2 }), win: wins.map(([a, b]) => go(TRI, LIVE, a, b)) };
console.log(`TRI flat 20-23 ${p(base.is.cagr)}/${p(base.is.dd)} 24-26 ${p(base.oos.cagr)}/${p(base.oos.dd)} | live US$${Math.round(base.live.end)} fall ${p(base.live.dd)} | fresh 2024 ${p(base.fresh.cagr)}/${p(base.fresh.dd)}`);

// parity of the ICHI-X4 port with the hunt study (R per trade is account independent)
const ixr = X.run({ ...FLAT, weights: { ix: 1 }, coins: COINS });
console.log(`ICHI-X4 on live coins in this engine: ${ixr.trades.length} trades, total R ${ixr.trades.reduce((s, t) => s + t.R, 0).toFixed(0)}`);

const rows = CAND.map((c) => { const a = r1(c); return { c, ...a, r1: both(a.is, base.is) && both(a.oos, base.oos) }; });
for (const r of rows) console.log(`${r.c.fam} ${r.c.label.padEnd(38)} 20-23 ${p(r.is.cagr)}/${p(r.is.dd)}  24-26 ${p(r.oos.cagr)}/${p(r.oos.dd)} ${r.r1 ? 'rule1' : ''}`);
const famShare = (f) => { const s = rows.filter((r) => r.c.fam === f); return s.filter((r) => r.r1).length / s.length; };
console.log('family share passing rule 1:', ['K', 'M', 'N'].map((f) => `${f} ${p(famShare(f))}%`).join(' '));

console.log('\nfull checks (every setting, so near misses are visible)');
for (const r of rows) {
  r.live = go(r.c, LIVE); r.fresh = go(r.c, LIVE, X.CUT); r.r2 = r.live.end > base.live.end && r.live.dd < base.live.dd; r.r3 = both(r.fresh, base.fresh);
  if (!(r.r1 || (r.r2 && r.r3))) continue;
  const w = wins.map(([a, b]) => go(r.c, LIVE, a, b));
  r.wRet = w.filter((x, i) => x.ret > base.win[i].ret).length / w.length; r.wDD = w.filter((x, i) => x.dd < base.win[i].dd).length / w.length; r.r4 = r.wRet > 0.5 && r.wDD > 0.5;
  r.x2 = go(r.c, LIVE, X.T0, X.END, { cost: 2 }); r.r5 = r.x2.end > base.x2.end && r.x2.dd < base.x2.dd;
  r.r6 = famShare(r.c.fam) >= 0.5;
  r.pass = r.r1 && r.r2 && r.r3 && r.r4 && r.r5 && r.r6;
  console.log(`${r.c.fam} ${r.c.label.padEnd(38)} live US$${Math.round(r.live.end)} ${p(r.live.dd)} | fresh24 ${p(r.fresh.cagr)}/${p(r.fresh.dd)} | 12m ${p(r.wRet)}/${p(r.wDD)} | x2 US$${Math.round(r.x2.end)} ${p(r.x2.dd)} (TRI ${Math.round(base.x2.end)} ${p(base.x2.dd)}) | rules ${[r.r1, r.r2, r.r3, r.r4, r.r5, r.r6].map((q) => (q ? 'y' : '.')).join('')}${r.pass ? '  PASS' : ''}`);
}

// walk-forward: each Jan 1 pick the candidate (or no change) with the best growth per fall on all earlier data, flat account
console.log('\nwalk-forward (flat account, choice uses earlier years only)');
const score = (s) => Math.log(1 + s.cagr) / s.dd, all = [TRI, ...CAND], picks = [];
for (let y = 2022; y <= 2026; y++) {
  const past = all.map((c) => ({ c, s: go(c, FLAT, X.T0, ts(y)) })), best = past.reduce((a, b) => (score(b.s) > score(a.s) ? b : a));
  const next = go(best.c, FLAT, ts(y), Math.min(ts(y + 1), X.END)), tri = go(TRI, FLAT, ts(y), Math.min(ts(y + 1), X.END));
  picks.push({ y, pick: best.c.label, next, tri });
  console.log(`  ${y} picked ${best.c.label.padEnd(38)} year ${p(next.ret)}/${p(next.dd)}  TRI ${p(tri.ret)}/${p(tri.dd)}`);
}
fs.writeFileSync(__dirname + '/results.json', JSON.stringify({ base: { ...base, win: undefined }, rows, picks }));
console.log('written');
