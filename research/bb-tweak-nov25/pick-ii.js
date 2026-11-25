// pick-ii.js: the owner asked to keep Intraday Intensity in view. Using data BEFORE 2024 only, join every II setting
// with the locked champion and lock the best one (highest R / marked-to-market drawdown). Adds `iiCombo` to locked.json.
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./engine');
const { singles, T0 } = require('./select');
const file = path.join(__dirname, 'locked.json'), K = JSON.parse(fs.readFileSync(file, 'utf8')), CUT = K.cut;
const ev = (cfg) => { const res = L.replay(cfg, { endT: CUT }), k = 1 / L.meanW(res, T0, CUT); return { k, m: L.measure(res, T0, CUT, k) }; };
const line = (label, m) => console.log(`${label.padEnd(48)} R ${m.R.toFixed(0).padStart(4)}  DD ${m.dd.toFixed(1)}  DDmtm ${m.mdd.toFixed(1)}  R/DDmtm ${m.rdd.toFixed(1)}`);
console.log('data before 2024 only'); line('BB-CORE v3', ev({}).m); line('II(21)>0 filter (as in the book study)', ev({ ii: { len: 21, th: 0, lo: 0 } }).m); line(K.champion.label, ev(K.champion.cfg).m);
const all = singles().filter((s) => s.fam === 'ii').map((s) => { const cfg = { ...K.champion.cfg, ...s.cfg }; return { label: `${s.label} + ${K.champion.label}`, cfg, ...ev(cfg) }; }).sort((a, b) => b.m.rdd - a.m.rdd);
console.log('\nbest 6 Intraday Intensity combinations:'); all.slice(0, 6).forEach((r) => line(r.label, r.m));
const w = all[0]; K.iiCombo = { label: w.label, cfg: w.cfg, k: w.k, dev: w.m }; fs.writeFileSync(file, JSON.stringify(K, null, 1));
