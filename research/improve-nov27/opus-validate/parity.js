// parity.js - my causal engine vs the research trade engine (replace-nov25/sim.js coinTrades, used by improve-nov27/engine.js),
// trade by trade, in two modes: "research conventions" (stops on 4h bars, stale exit at the decision close) and "strict"
// (stops hour by hour on 1h bars, every exit at the next open). Flat judging account, so no trade is ever skipped.
// Also: real live journal (intel/data/trades/trades.csv) vs my engine's signals.  node parity.js > parity.out
'use strict';
const fs = require('fs'), path = require('path');
const X = require('./causal');
const S = require('../../replace-nov25/sim');
const KIND = { bb: 'bbT', ic: 'ic', tc: 'tc' };
const t0 = Date.now();
const key = (t) => `${t.bot}|${t.coin}|${t.t}`;
function research() {
  const m = new Map();
  for (const bot of ['bb', 'ic', 'tc']) for (const c of X.COINS[bot]) for (const x of S.coinTrades(S.real(c), KIND[bot], { mult: bot === 'bb' ? 1.05 : 1 }))
    if (x.t >= X.T0 && x.t < X.END) m.set(`${bot}|${c}|${x.t}`, { bot, coin: c, ...x });
  return m;
}
const R = research();
const out = {};
for (const [name, opt] of [['research conventions', { hourStops: false, exitAtClose: true }], ['strict', {}]]) {
  const r = X.run({ mode: 'flat', start: 1000, ...opt });
  const mine = new Map(r.trades.map((t) => [key(t), t]));
  let same = 0, rDiff = 0, exitDiff = 0, onlyMine = [], onlyRes = [], maxDR = 0, sumDR = 0; const why = {};
  for (const [k, a] of mine) {
    const b = R.get(k);
    if (!b) { onlyMine.push(a); continue; }
    const dr = a.Rb - b.R; sumDR += dr;
    if (a.tExit !== (b.why === 'stop' ? b.tExit : b.tExit) && Math.abs(a.tExit - b.tExit) > 14400) exitDiff++;
    if (a.dir === b.dir && Math.abs(dr) < 1e-6) same++; else { rDiff++; maxDR = Math.max(maxDR, Math.abs(dr)); const w = `${a.why}/${b.why}`; why[w] = (why[w] || 0) + 1; }
  }
  for (const [k, b] of R) if (!mine.has(k)) onlyRes.push(b);
  // trades still open at the end are not in either closed list: count them
  out[name] = { mine: mine.size, research: R.size, matchedSameR: same, matchedDiffR: rDiff, maxAbsDiffR: maxDR, sumDiffR: sumDR, diffByWhy: why,
    onlyMine: onlyMine.map((t) => `${t.bot} ${t.coin} ${new Date(t.t * 1e3).toISOString().slice(0, 13)} ${t.why} R ${t.Rb.toFixed(2)}`),
    onlyResearch: onlyRes.map((t) => `${t.bot} ${t.coin} ${new Date(t.t * 1e3).toISOString().slice(0, 13)} ${t.why} R ${t.R.toFixed(2)} exit ${new Date(t.tExit * 1e3).toISOString().slice(0, 13)}`),
    openAtEnd: r.open.map((p) => `${p.bot} ${p.coin} ${new Date(p.t * 1e3).toISOString().slice(0, 13)}`) };
  console.log(name, JSON.stringify(out[name], null, 1));
}

// ---- real live journal: entries the bots actually made (Oct-Nov 2026) vs the signals of my engine
const lines = fs.readFileSync(path.join(__dirname, '../../../intel/data/trades/trades.csv'), 'utf8').trim().split('\n');
const hd = lines[0].split(','), rows = lines.slice(1).map((l) => { const v = l.split(','); return Object.fromEntries(hd.map((h, i) => [h, v[i]])); });
const live = rows.filter((x) => x.mode === 'live');
// my engine with the rules each bot ran at that time (v3 from the signal candle of Nov 14 2026; legacy before; BB v4 not installed per the install note)
const LEG = { bb: { bbMult: 2, maxBars: 48, cool: 0, v4: false }, ic: { kInit: 2, lockAtR: 0 }, tc: { bbLen: 20, staleBars: 0 } };
const V3 = { bb: { v4: false } };
const sigs = {};
for (const [tag, spec] of [['legacy', LEG], ['v3', V3], ['v4', {}]]) {
  const r = X.run({ mode: 'flat', start: 1000, spec, from: Date.UTC(2026, 8, 1) / 1000, bbMult: 1 });
  sigs[tag] = r;
}
const RV3 = Date.UTC(2026, 10, 14) / 1000;
const jr = { liveTrades: live.length, matched: 0, unmatched: [] };
for (const x of live) {
  const bot = x.bot === 'bbcore' ? 'bb' : x.bot === 'icore' ? 'ic' : 'tc', sig = +x.signal_candle_s, dir = +x.dir;
  const tag = sig < RV3 ? 'legacy' : 'v3';
  const hit = sigs[tag].trades.concat(sigs[tag].open).find((t) => t.bot === bot && t.coin === x.coin && t.sigT === sig && t.dir === dir);
  if (hit) jr.matched++; else jr.unmatched.push(`${bot} ${x.coin} ${dir > 0 ? 'L' : 'S'} sig ${new Date(sig * 1e3).toISOString().slice(0, 13)} (${tag}) R ${(+x.r).toFixed(2)} ${x.reason}`);
}
// engine signals in the live window that the bots did not trade
const liveKeys = new Set(live.map((x) => `${x.bot === 'bbcore' ? 'bb' : x.bot === 'icore' ? 'ic' : 'tc'}|${x.coin}|${x.signal_candle_s}`));
const firstLive = { bb: Math.min(...live.filter((x) => x.bot === 'bbcore').map((x) => +x.signal_candle_s)), ic: Math.min(...live.filter((x) => x.bot === 'icore').map((x) => +x.signal_candle_s)), tc: Math.min(...live.filter((x) => x.bot === 'tcore').map((x) => +x.signal_candle_s)) };
jr.engineOnly = [];
for (const tag of ['legacy', 'v3']) for (const t of sigs[tag].trades.concat(sigs[tag].open)) {
  if ((tag === 'legacy') !== (t.sigT < RV3) || t.sigT < firstLive[t.bot] || t.sigT >= Date.UTC(2026, 10, 24) / 1000) continue;
  if (!liveKeys.has(`${t.bot}|${t.coin}|${t.sigT}`)) jr.engineOnly.push(`${t.bot} ${t.coin} ${t.dir > 0 ? 'L' : 'S'} sig ${new Date(t.sigT * 1e3).toISOString().slice(0, 13)} (${tag})`);
}
console.log('live journal', JSON.stringify(jr, null, 1));
out.journal = jr;
fs.writeFileSync(path.join(__dirname, 'parity.json'), JSON.stringify(out, null, 1));
console.log('secs', ((Date.now() - t0) / 1000).toFixed(1));
