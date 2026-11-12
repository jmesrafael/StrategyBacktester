// opt2.js — Option 1 (BB+ARB, T+SUI+ARB) vs Option 2 (T+SUI only) on the TRI account, Jun 10 2023 -> Nov 11 2026, candle library data.
'use strict';
const path = require('path'), H = path.join(__dirname, '../strat-hunt-nov6'), C = require('../../candles/candles.js');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, WT = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
const BASE = { 'BB-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'I-CORE': ['SOL', 'NEAR', 'ADA', 'GALA'], 'T-CORE': ['SOL', 'NEAR', 'ADA', 'GALA', 'ETH'] };
const W0 = Date.UTC(2023, 5, 10) / 1000, END = Date.UTC(2026, 10, 12) / 1000, Y26 = Date.UTC(2026, 0, 1) / 1000, by = (id) => S.find((s) => s.id === id), T = {};
for (const c of ['SOL', 'NEAR', 'ADA', 'GALA', 'ETH', 'SUI', 'ARB']) {
  const B = C.load(c, '4h').map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] })), x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  T[c] = {}; for (const [b, p] of Object.entries(BOTS)) T[c][b] = run(B, x.atr14, built[p], exitOf(p, x), C.funding(c), 14400, COST).trades.filter((t) => t.tExit > W0 && t.tExit <= END).map((t) => ({ x: t.tExit, R: t.R }));
}
const st = (tr, a = W0) => { const s = tr.filter((t) => t.x > a).sort((p, q) => p.x - q.x); let e = 0, pk = 0, dd = 0; for (const t of s) { e += t.R; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); } return `${e.toFixed(1)}R, worst drop ${dd.toFixed(1)}R, R/DD ${(e / dd).toFixed(2)}`; };
const acct = (add) => Object.keys(BOTS).flatMap((b) => [...BASE[b], ...(add[b] || [])].flatMap((c) => T[c][b].map((t) => ({ x: t.x, R: t.R * WT[b] }))));
const bot = (b, add) => [...BASE[b], ...add].flatMap((c) => T[c][b]);
for (const [n, a] of [['Current', {}], ['Option 1: BB+ARB, T+SUI+ARB', { 'BB-CORE': ['ARB'], 'T-CORE': ['SUI', 'ARB'] }], ['Option 2: T+SUI only', { 'T-CORE': ['SUI'] }]]) console.log('ACCOUNT', n.padEnd(30), '| Jun23-Nov26:', st(acct(a)), '| 2026:', st(acct(a), Y26));
for (const [n, b, a] of [['T-CORE current', 'T-CORE', []], ['T-CORE + SUI', 'T-CORE', ['SUI']], ['T-CORE + SUI + ARB', 'T-CORE', ['SUI', 'ARB']], ['BB-CORE current', 'BB-CORE', []], ['BB-CORE + ARB', 'BB-CORE', ['ARB']], ['BB-CORE + SUI', 'BB-CORE', ['SUI']]]) console.log('BOT', n.padEnd(22), '| Jun23-Nov26:', st(bot(b, a)), '| 2026:', st(bot(b, a), Y26));
