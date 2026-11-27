// la-child.js - one run of the RESEARCH engines (replace-nov25/sim.js and improve-nov27/engine.js) on doctored candles.
// node la-child.js <cut unix sec | none> <truncate|corrupt> <seed> <out.json>
// The candle library is wrapped before the engines load, so they only ever see the doctored data.
'use strict';
const fs = require('fs'), path = require('path');
const [cutArg, mode, seedArg, outFile] = process.argv.slice(2);
const cut = cutArg === 'none' ? null : +cutArg;
const C = require(path.join(__dirname, '../../../candles/candles.js'));
const X = require('./causal');
const origLoad = C.load.bind(C), origFund = C.funding.bind(C);
const r = X.rng(+seedArg || 3);
const TF = { '1h': 3600, '4h': 14400 };
const memo = new Map();
C.load = (coin, tf, o) => {
  const k = coin + tf;
  if (!memo.has(k)) {
    const rows = origLoad(coin, tf);
    if (cut == null) memo.set(k, rows);
    else {
      const keep = rows.filter((x) => x[0] + TF[tf] <= cut);
      if (mode !== 'corrupt') memo.set(k, keep);
      else { let p = keep.length ? keep[keep.length - 1][4] : 1; memo.set(k, keep.concat(rows.filter((x) => x[0] + TF[tf] > cut).map((x) => { p = Math.max(1e-6, p * Math.exp((r() - 0.5) * 0.4)); const op = p * (1 + (r() - 0.5) * 0.1); return [x[0], op, Math.max(op, p) * (1 + r() * 0.2), Math.min(op, p) * (1 - r() * 0.2), p, r() * 1e7]; }))); }
    }
  }
  return memo.get(k);
};
C.funding = (coin) => { const f = origFund(coin); return cut == null ? f : mode === 'corrupt' ? f.map((x) => (x[0] <= cut ? x : [x[0], (r() - 0.5) * 0.02])) : f.filter((x) => x[0] <= cut); };

const S = require('../../replace-nov25/sim');
const E = require('../engine');
const out = { signals: {}, trades: {}, simCurve: null, impCurve: {} };
const KIND = { bb: 'bbT', ic: 'ic', tc: 'tc' };
for (const bot of ['bb', 'ic', 'tc']) for (const c of X.COINS[bot]) {
  const x = S.real(c), g = S.signals(x, KIND[bot]);
  const T = Array.from(x.T), sig = [];
  for (let i = 0; i < x.n; i++) if (g.dir[i]) sig.push([T[i] + 14400, g.dir[i], g.dist[i], g.size[i]]);
  out.signals[bot + c] = sig;
  out.trades[bot + c] = S.coinTrades(x, KIND[bot], { mult: bot === 'bb' ? 1.05 : 1 }).map((t) => [t.t, t.tExit, t.dir, t.R, t.why, t.entry]);
}
// replace-nov25 shared account (event driven)
const bots = [{ name: 'bb', kind: 'bbT', weight: 0.5, coins: X.COINS.bb, mult: 1.05 }, { name: 'ic', kind: 'ic', weight: 0.25, coins: X.COINS.ic }, { name: 'tc', kind: 'tc', weight: 0.25, coins: X.COINS.tc }];
out.simCurve = S.account(bots, { start: 1000 / 60, from: X.T0, sets: S.real, specs: null }).curve;
// improve-nov27 account (precomputed trades), TRI and the rule at x1.11, live account
const rule = (x, id, st) => { const n = st.W.find((w) => w.id === id).open.reduce((m, p) => m + (p.x.dir === x.dir ? 1 : 0), 0); return Math.max(0.25, 1 - (0.75 * Math.max(0, n - 2)) / 3); };
const tb = ['bb', 'ic', 'tc'].map((id) => ({ id, weight: E.BASE[id], trades: E.trades(id) }));
for (const [n, o] of [['tri', {}], ['rule', { k: 1.11, mult: rule }]]) {
  const a = E.account(tb, { mexc: true, flat: false, start: 1000 / 60, ...o });
  out.impCurve[n] = Array.from(a.curve);
}
fs.writeFileSync(outFile, JSON.stringify(out));
