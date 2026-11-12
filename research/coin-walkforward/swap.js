// swap.js — built from wf.js (data part) + the checks at the bottom.
// wf.js — walk-forward coin pick: does a coin that improves a bot on Oct 2021-2023 still improve it on 2024-2026?
// Bots = the live rules (../strat-hunt-nov6: BBX = BB-CORE, P7 = I-CORE, P14 = T-CORE), real fees, slippage, funding, 4h.
// Base sets: BB-CORE / I-CORE = SOL NEAR ADA GALA; T-CORE = SOL NEAR ADA GALA ETH (the 6th-coin question was never tested).
// Coin added at the same risk per trade as the others. Metric = trade-by-trade return/max drawdown of the bot's whole coin set.
// Candidates: crypto with 4h data from before 2021 and MEXC futures volume >= $1M/day. IS = Oct 18 2021 - Dec 31 2023, OOS = 2024 - Nov 11 2026.
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), Z = path.join(__dirname, '../zec-replacement'), Z2 = path.join(__dirname, '../zec-replacement-2');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, KEEP = ['SOL', 'NEAR', 'ADA', 'GALA'];
const BASE = { 'BB-CORE': KEEP, 'I-CORE': KEEP, 'T-CORE': [...KEEP, 'ETH'] };
const A = Date.UTC(2021, 9, 18) / 1000, M = Date.UTC(2024, 0, 1) / 1000, E = Date.UTC(2026, 10, 11) / 1000;
const vol = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(Z2, 'ticker.json'), 'utf8')).data.map(t => [t.symbol, +t.amount24]));
const by = id => S.find(s => s.id === id);
function load(c) {
  const f10 = path.join(Z, 'data4h-10y', c + '.json'), f = fs.existsSync(f10) ? f10 : path.join(Z, 'data4h', c + '.json');
  const B = JSON.parse(fs.readFileSync(f, 'utf8')).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  const fp = path.join(Z, 'funding', c + '.json'), F = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : [];
  return { B, F: F.length ? F : null };
}
const names = [...new Set([...fs.readdirSync(path.join(Z, 'data4h')), ...fs.readdirSync(path.join(Z, 'data4h-10y'))].map(f => f.replace('.json', '')))].filter(n => n !== 'ZEC');
const T = {};
for (const c of names) {
  const { B, F } = load(c); if (B.length < 600 || (!KEEP.includes(c) && c !== 'ETH' && B[205].time > Date.UTC(2021, 3, 1) / 1000)) continue;   // needs full IS history
  if (!KEEP.includes(c) && c !== 'ETH' && !((vol[c + '_USDT'] || 0) >= 1e6)) continue;
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  T[c] = {};
  for (const [bot, p] of Object.entries(BOTS)) {
    T[c][bot] = run(B, x.atr14, built[p], exitOf(p, x), F, 14400, COST).trades.map(t => ({ x: t.tExit, R: t.R }));
    T[c][bot + 'x2'] = run(B, x.atr14, built[p], exitOf(p, x), F, 14400, { fee: COST.fee * 2, slip: COST.slip * 2 }).trades.map(t => ({ x: t.tExit, R: t.R }));
  }
}
const cut = (tr, a, b) => tr.filter(t => t.x > a && t.x <= b);
function curve(tr) { const s = [...tr].sort((p, q) => p.x - q.x); let e = 0, pk = 0, d = 0; for (const t of s) { e += t.R; pk = Math.max(pk, e); d = Math.max(d, pk - e); } return { tot: e, dd: d, rdd: d > 0 ? e / d : 0 }; }
const sum = tr => tr.reduce((a, t) => a + t.R, 0);
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length); idx.forEach(([, i], k) => r[i] = k); return r; };
const corr = (x, y) => { const n = x.length, mx = x.reduce((a, b) => a + b) / n, my = y.reduce((a, b) => a + b) / n; let s = 0, a = 0, b = 0; for (let i = 0; i < n; i++) { s += (x[i] - mx) * (y[i] - my); a += (x[i] - mx) ** 2; b += (y[i] - my) ** 2; } return s / Math.sqrt(a * b); };
// --- swap.js: ETH on T-CORE under the walk-forward test, and leave-one-out of each bot's current coins (IS vs OOS)
const show = (bot, set, label) => { const all = set.flatMap(c => T[c][bot]); const i = curve(cut(all, A, M)), o = curve(cut(all, M, E)); return label.padEnd(30) + 'IS ' + i.rdd.toFixed(2).padStart(5) + ' (' + i.tot.toFixed(0) + 'R/' + i.dd.toFixed(1) + 'R)   OOS ' + o.rdd.toFixed(2).padStart(5) + ' (' + o.tot.toFixed(0) + 'R/' + o.dd.toFixed(1) + 'R)'; };
console.log('T-CORE: was ETH a walk-forward pick?');
console.log(show('T-CORE', KEEP, '  SOL NEAR ADA GALA'));
console.log(show('T-CORE', [...KEEP, 'ETH'], '  + ETH'));
for (const bot of Object.keys(BOTS)) {
  console.log(''); console.log(bot + ': drop one current coin');
  const set = BASE[bot]; console.log(show(bot, set, '  all ' + set.length));
  for (const c of set) console.log(show(bot, set.filter(x => x !== c), '  without ' + c));
}
