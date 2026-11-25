// pick.js: run the selection with data BEFORE 2024 only and LOCK the winners in locked.json.
// holdout.js reads that file; it is written before any 2024+ result of a tweak exists in this study.
'use strict';
const fs = require('fs'), path = require('path');
const { select } = require('./select');
const CUT = Date.UTC(2024, 0, 1) / 1000;
const s = select(CUT, { log: console.log });
const f = (v) => (v >= 0 ? '+' : '') + v.toFixed(0);
const line = (r) => `${r.label.padEnd(75)} R ${f(r.all.R)}  DD ${r.all.dd.toFixed(1)}  DDmtm ${r.all.mdd.toFixed(1)}  halves ${r.h1 ? (r.worstHalf).toFixed(2) : '-'}  baskets ${r.share != null ? (r.share * 100).toFixed(0) + '%' : '-'}  score ${r.score ? r.score.toFixed(3) : '-'}`;
console.log(`\nBASE (2020-23): R ${f(s.base.all.R)} DD ${s.base.all.dd.toFixed(1)} DDmtm ${s.base.all.mdd.toFixed(1)}`);
console.log(`\nTop 15 of ${s.ranked.length} that pass everything (${s.tested} tested)`); s.ranked.slice(0, 15).forEach((r) => console.log(line(r)));
const has = (r, f2) => r.fam.split('+').includes(f2);
const champion = s.ranked[0] || null, iiBest = s.ranked.find((r) => has(r, 'ii')) || null, single = s.ranked.find((r) => !r.fam.includes('+')) || null;
console.log('\nBest with Intraday Intensity:'); console.log(iiBest ? line(iiBest) : 'none qualifies');
console.log('\nAll Intraday Intensity singles that pass the live checks:'); s.all.filter((r) => r.fam === 'ii' && r.liveOk).forEach((r) => console.log(line(r)));
const slim = (r) => r && { label: r.label, fam: r.fam, cfg: r.cfg, k: r.k, share: r.share, worstHalf: r.worstHalf, score: r.score, dev: r.all };
fs.writeFileSync(path.join(__dirname, 'locked.json'), JSON.stringify({ lockedAt: new Date().toISOString(), cut: CUT, tested: s.tested, passed: s.ranked.length, base: s.base.all, champion: slim(champion), iiBest: slim(iiBest), single: slim(single), top: s.ranked.slice(0, 15).map(slim) }, null, 1));
