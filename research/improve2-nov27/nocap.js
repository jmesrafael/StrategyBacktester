// nocap.js - owner request (Nov 27): the second search again WITHOUT the US$500 per-trade risk cap (live account, MEXC minimums).  node nocap.js
'use strict';
const fs = require('fs');
const X = require('../improve-nov27/opus-validate/causal');
const p = (v) => (100 * v).toFixed(1), ts = (y) => Date.UTC(y, 0, 1) / 1000;
// the candidate list and the ICHI-X4 rule exactly as run.js builds them
const src = fs.readFileSync(__dirname + '/run.js', 'utf8');
const part = src.slice(src.indexOf('X.RULES.ix'), src.indexOf('const FLAT ='));
const { CAND, TRI, COINS } = new Function('X', part + '; return { CAND, TRI, COINS };')(X);
const go = (c, from = X.T0) => X.stats(X.run({ mode: 'live', start: 600, weights: c.weights, K: c.K, coins: COINS, from, to: X.END }));
const base = { all: go(TRI), fresh: go(TRI, ts(2024)) };
console.log(`no cap, US$600 start | TRI-CORE: US$${Math.round(base.all.end).toLocaleString('en-US')} fall ${p(base.all.dd)} | fresh 2024 ${p(base.fresh.cagr)}/${p(base.fresh.dd)}`);
const rows = CAND.map((c) => { const all = go(c), fresh = go(c, ts(2024)); return { label: c.label, fam: c.fam, all, fresh, full: all.end > base.all.end && all.dd < base.all.dd, f24: fresh.cagr > base.fresh.cagr && fresh.dd < base.fresh.dd }; });
for (const r of rows) console.log(`${r.fam} ${r.label.padEnd(38)} US$${Math.round(r.all.end).toLocaleString('en-US').padStart(12)} fall ${p(r.all.dd)} ${r.full ? 'both' : '    '} | fresh 2024 ${p(r.fresh.cagr)}/${p(r.fresh.dd)} ${r.f24 ? 'both' : ''}`);
console.log(`better on both: full period ${rows.filter((r) => r.full).length} of ${rows.length}, fresh 2024 ${rows.filter((r) => r.f24).length}, both tests ${rows.filter((r) => r.full && r.f24).length}`);
fs.writeFileSync(__dirname + '/nocap.json', JSON.stringify({ base, rows }));
