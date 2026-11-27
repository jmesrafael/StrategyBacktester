// journal2.js - live journal vs my engine with +-1 candle tolerance and status. node journal2.js
'use strict';
const fs = require('fs'), path = require('path'), X = require('./causal');
const lines = fs.readFileSync(path.join(__dirname, '../../../intel/data/trades/trades.csv'), 'utf8').trim().split('\n');
const hd = lines[0].split(','), rows = lines.slice(1).map((l) => { const v = l.split(','); return Object.fromEntries(hd.map((h, i) => [h, v[i]])); });
const live = rows.filter((x) => x.mode === 'live');
const LEG = { bb: { bbMult: 2, maxBars: 48, cool: 0, v4: false }, ic: { kInit: 2, lockAtR: 0 }, tc: { bbLen: 20, staleBars: 0 } };
const RV3 = Date.UTC(2026, 10, 14) / 1000, iso = (t) => new Date(t * 1e3).toISOString().slice(5, 13);
const runs = { legacy: X.run({ mode: 'flat', start: 1000, spec: LEG, from: Date.UTC(2026, 8, 1) / 1000, bbMult: 1 }), v3: X.run({ mode: 'flat', start: 1000, spec: { bb: { v4: false } }, from: Date.UTC(2026, 8, 1) / 1000, bbMult: 1 }) };
// raw signals without position blocking: re-run each slot's signal on every candle
const all = (tag) => runs[tag].trades.concat(runs[tag].open);
let exact = 0, near = 0, none = 0; const rowsOut = [];
for (const x of live) {
  const bot = x.bot === 'bbcore' ? 'bb' : x.bot === 'icore' ? 'ic' : 'tc', sig = +x.signal_candle_s, dir = +x.dir, tag = sig < RV3 ? 'legacy' : 'v3';
  const c = all(tag).filter((t) => t.bot === bot && t.coin === x.coin && t.dir === dir);
  const e = c.find((t) => t.sigT === sig), n = c.find((t) => Math.abs(t.sigT - sig) <= 14400);
  const st = e ? 'exact' : n ? `off by ${(n.sigT - sig) / 3600}h` : 'no engine trade';
  if (e) exact++; else if (n) near++; else none++;
  rowsOut.push(`${bot} ${x.coin} ${dir > 0 ? 'L' : 'S'} sig ${iso(sig)} ${tag} ${x.status} live R ${x.r ? (+x.r).toFixed(2) : '-'} | ${st}${e || n ? ' engine R ' + ((e || n).Rb != null ? (e || n).Rb.toFixed(2) : 'open') : ''}`);
}
console.log(rowsOut.join('\n'));
console.log({ live: live.length, exact, near, none });
// raw signal on the live signal candle (ignores whether the engine was already in a trade on that coin)
const LEGs = LEG;
let rawYes = 0, rawNo = [];
for (const x of live) {
  const bot = x.bot === 'bbcore' ? 'bb' : x.bot === 'icore' ? 'ic' : 'tc', sig = +x.signal_candle_s, dir = +x.dir, tag = sig < RV3 ? 'legacy' : 'v3';
  const s = new X.Slot(bot, x.coin, tag === 'legacy' ? LEGs[bot] : bot === 'bb' ? { v4: false } : {});
  for (const r of X.raw(x.coin).h4) { if (r[0] > sig) break; s.push({ t: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] }); }
  const g = s.signal(s.n - 1);
  if (g && g.dir === dir) rawYes++; else rawNo.push(`${bot} ${x.coin} ${dir > 0 ? 'L' : 'S'} ${iso(sig)} ${tag} -> ${g ? 'opposite' : 'no signal on Binance candles'}`);
}
console.log('raw signal present on Binance candles for', rawYes, 'of', live.length); console.log(rawNo.join('\n'));
