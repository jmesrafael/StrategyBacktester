// year-2026.js — this year (2026, by exit date) per coin: bb-core vs EMA 20/100 vs merged (both side by side, 1R each)
'use strict';
const { runMerged } = require('./merged.js'); const { summarize, DEFAULTS } = require('./v2-core.js'); const { COINS, loadCoin } = require('./load.js');
const Y = +(process.argv[2] || 2026), f1 = (v) => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1);
const yr = (t) => t.filter((x) => new Date(x.tExit * 1000).getUTCFullYear() === Y);
const tot = { bb: [], ema: [], two: [] };
console.log(`| coin | bb-core R (trades, win%) | EMA 20/100 R (trades, win%) | Merged R (trades, win%) | best |`); console.log('|---|---|---|---|---|');
const cell = (t) => { const s = summarize(t); return [s.R, `${f1(s.R)} (${s.n}, ${s.n ? (s.win * 100).toFixed(0) : 0}%)`]; };
for (const c of COINS) { const D = loadCoin(c), r = {}; for (const m of ['bb', 'ema', 'two']) { r[m] = yr(runMerged(D.B, m, DEFAULTS.cost, D.funding).trades); tot[m].push(...r[m]); }
  const v = ['bb', 'ema', 'two'].map((m) => cell(r[m])); console.log(`| ${c} | ${v.map((x) => x[1]).join(' | ')} | ${['bb-core', 'EMA', 'Merged'][v.map((x) => x[0]).indexOf(Math.max(...v.map((x) => x[0])))]} |`); }
const v = ['bb', 'ema', 'two'].map((m) => cell(tot[m])); console.log(`| **All 5** | ${v.map((x) => '**' + x[1] + '**').join(' | ')} | |`);
