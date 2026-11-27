// floor-test.js - size of the openR() floor in improve-nov27/engine.js: a copy of the engine (written to the scratchpad)
// with the floor Math.max(v, x.R) removed, i.e. marks at the plain 1h close for the whole exit candle (pessimistic bound).
'use strict';
const fs = require('fs'), path = require('path');
const TMP = process.env.LA_TMP || path.join(__dirname, '.la-tmp'); fs.mkdirSync(TMP, { recursive: true });
const src = fs.readFileSync(path.join(__dirname, '../engine.js'), 'utf8');
const fix = (s) => s.replace(/require\('\.\.\/replace-nov25\/sim'\)/, `require(${JSON.stringify(path.join(__dirname, '../../replace-nov25/sim'))})`)
  .replace(/require\('\.\.\/\.\.\/candles\/candles\.js'\)/, `require(${JSON.stringify(path.join(__dirname, '../../../candles/candles.js'))})`)
  .replace(/require\('\.\.\/hunt-4h-nov26\/lib\.js'\)/, `require(${JSON.stringify(path.join(__dirname, '../../hunt-4h-nov26/lib.js'))})`)
  .replace(/require\('\.\.\/hunt-4h-nov26\/fam\.js'\)/, `require(${JSON.stringify(path.join(__dirname, '../../hunt-4h-nov26/fam.js'))})`)
  .replace(/require\('\.\.\/hunt-1h-nov26\/lib\.js'\)/, `require(${JSON.stringify(path.join(__dirname, '../../hunt-1h-nov26/lib.js'))})`)
  .replace(/require\('\.\.\/hunt-1h-nov26\/fam-vol\.js'\)/, `require(${JSON.stringify(path.join(__dirname, '../../hunt-1h-nov26/fam-vol.js'))})`)
  .replace(/require\('\.\.\/zec-replacement-2\/detail\.json'\)/, `require(${JSON.stringify(path.join(__dirname, '../../zec-replacement-2/detail.json'))})`);
const noFloor = fix(src).replace("return x.why === 'stop' && T0 + (k + 1) * H > x.tEff - x.iv ? Math.max(v, x.R) : v;", 'return v;');
if (noFloor === fix(src)) throw new Error('floor line not found');
fs.writeFileSync(path.join(TMP, 'engine-nofloor.js'), noFloor);
const A = require('../engine'), B = require(path.join(TMP, 'engine-nofloor.js'));
const p = (v) => (100 * v).toFixed(1);
const rule = (x, id, st) => { const n = st.W.find((w) => w.id === id).open.reduce((m, q) => m + (q.x.dir === x.dir ? 1 : 0), 0); return Math.max(0.25, 1 - (0.75 * Math.max(0, n - 2)) / 3); };
for (const [name, E] of [['with floor (as published)', A], ['without floor', B]]) {
  const bots = ['bb', 'ic', 'tc'].map((id) => ({ id, weight: E.BASE[id], trades: E.trades(id) }));
  const L = (o) => E.stats(E.account(bots, { mexc: true, flat: false, start: 1000 / 60, ...o }));
  const J = (o, from, to) => E.stats(E.account(bots, { ...o, from, to }));
  const a = L({}), b = L({ k: 1.11, mult: rule }), c = J({}, E.T0, E.CUT), d = J({ k: 1.11, mult: rule }, E.T0, E.CUT), e = J({}, E.CUT, E.END), f = J({ k: 1.11, mult: rule }, E.CUT, E.END);
  console.log(name.padEnd(26), `live TRI ${p(a.dd)} rule ${p(b.dd)} | flat 20-23 TRI ${p(c.dd)} rule ${p(d.dd)} | flat 24-26 TRI ${p(e.dd)} rule ${p(f.dd)}  (PHP ${Math.round(a.end * 60).toLocaleString()} / ${Math.round(b.end * 60).toLocaleString()})`);
}
