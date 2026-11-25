// e-extra.js: account at BB 0.87x (same average risk as tweak 1.00x) for the ablation table
'use strict';
const K = require('./core');
for (const [n, o, k] of [['Current, BB x0.87', { mult: 0.87 }, 14], ['Current, BB x0.913', { mult: 0.913 }, 14]]) { const r = K.book(K.portfolio(o, k)); console.log(n, r.R.toFixed(1), r.dd.toFixed(1), r.mdd.toFixed(1)); }
