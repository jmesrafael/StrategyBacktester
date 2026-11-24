// sim.js — Nov 24 2026: SAME entries, SAME stops as the live bots; only WHEN a trade is closed changes (early / late, by situation).
// Engine = ../tweak-lab-nov13/lab.js runX, copied and extended with situational exits. Live coins, 4h, Jan 2020 -> Nov 12 2026, standard costs + real funding.
// Every new exit decision uses only candles up to the one that just closed; the exit fills at the NEXT open (same as the bots' time exit).
//   node sim.js  -> results.md + sim.json
'use strict';
const fs = require('fs'), path = require('path');
const Lb = require('../tweak-lab-nov13/lab.js'), { load, loadCut, bbSig, ichiSig, btcReg, measure, LINEUP, BASE, START, END, FEE, SLIP, IV } = Lb;
const ok = (v) => v === v && v != null;

function runY(x, sig, o) {
  const { B, n, atr: ATR } = x, { L, S } = sig, mid = sig.mid, trades = [], reg = o.btcFlip ? btcReg(x) : null;
  let pos = null, pend = null, pendClose = false;
  function exit(px, i, why) {
    const fr = x.fr ? x.fr(B[pos.i0].time, B[i].time + IV / 2) : 0;
    const R = (pos.dir * (px - pos.entry) / pos.entry - 2 * FEE - pos.dir * fr) / pos.dist;
    trades.push({ c: x.c, d: pos.dir, t0: B[pos.i0].time, t1: B[i].time + IV, R, why, bars: i - pos.i0 + 1, i0: pos.i0, i1: i, entry: pos.entry, dist: pos.dist });
    pos = null;
  }
  for (let i = 1; i < n; i++) {
    const b = B[i];
    if (pend && pend.wait > 0) pend.wait--;
    else if (pend) {
      const d = pend.dir, fill = b.open * (1 + d * SLIP); let stop, dist;
      if (pend.late) { pend.atr = ATR[i - 1]; if (pend.stopPx != null) pend.stopPx = mid[i - 1]; } // a late entry re-reads the bands and ATR as of the candle just closed
      if (pend.stopPx != null) { stop = pend.stopPx; dist = Math.abs(fill - stop) / fill; if (!(dist > 0 && (d === 1 ? stop < fill : stop > fill))) stop = null; }
      else { dist = o.kInit * pend.atr / fill; stop = fill - d * o.kInit * pend.atr; }
      if (stop != null && dist > 0 && !(pend.late && dist * fill < 0.3 * pend.atr)) pos = { dir: d, i0: i, entry: fill, stop, dist, ext: b.open, limit: o.maxBars + (o.maxBars > 0 && o.lateP && o.rng() < o.lateP ? 1 + Math.floor(o.rng() * (o.lateMax || 24)) : 0), extended: false, reg0: reg ? reg[i - 1] : 0 };
      pend = null;
    }
    if (pendClose && pos) exit(b.open * (1 - pos.dir * SLIP), i, 'rule');
    pendClose = false;
    if (pos) {
      const d = pos.dir;
      if (d === 1 ? b.low <= pos.stop : b.high >= pos.stop) exit((d === 1 ? Math.min(pos.stop, b.open) : Math.max(pos.stop, b.open)) * (1 - d * SLIP), i, 'stop');
      else {
        if (o.kTrail > 0) { pos.ext = d === 1 ? Math.max(pos.ext, b.high) : Math.min(pos.ext, b.low); const ns = pos.ext - d * o.kTrail * ATR[i]; if (d === 1 ? ns > pos.stop : ns < pos.stop) pos.stop = ns; }
        if (o.beR && hitR(pos, b, o.beR)) { const ns = pos.entry * (1 + d * (o.beLock || 0) * pos.dist); if (d === 1 ? ns > pos.stop : ns < pos.stop) pos.stop = ns; }
      }
    }
    if (pos) {
      const d = pos.dir, bars = i - pos.i0, r = d * (b.close - pos.entry) / pos.entry / pos.dist, dt = new Date(b.time * 1000);
      let close = false;
      // --- the bot's own time exit (BB-CORE) with an optional extension when in profit
      if (pos.limit > 0 && bars >= pos.limit) {
        if (o.extR != null && !pos.extended && r >= o.extR) { pos.limit += o.extBars; pos.extended = true; } else close = true;
      }
      // --- situational exits
      if (!close && o.weekend && dt.getUTCDay() === 5 && dt.getUTCHours() === 16 && bars >= 1) close = o.weekend === 'all' || (o.weekend === 'win' ? r > 0 : r <= 0);
      if (!close && o.loserBars && bars >= o.loserBars && r < o.loserR) close = true;                       // cut a loser early
      if (!close && o.btcFlip && reg[i] === -d && pos.reg0 !== -d) close = o.btcFlip === 'all' || (o.btcFlip === 'win' ? r > 0 : r <= 0);
      if (!close && o.midCross && bars >= 4 && ok(mid[i]) && (d === 1 ? b.close < mid[i] : b.close > mid[i]) && r < o.midCross) close = true; // fell back through the middle band while not yet well in profit
      if (!close && o.shock && d * (b.close - b.open) < -o.shock * ATR[i]) close = o.shockOnly === 'win' ? r > 0 : true;  // one big candle against us
      if (!close && o.winBars && bars >= o.winBars && r > 0 && r < o.winR) close = true;                      // in small profit after N candles: bank it
      if (!close && o.stallBars && bars >= o.stallBars) { const a = d * (b.close - B[i - o.stallBars].close); if (a < 0 && r > 0) close = true; } // winning but last N candles went against us
      if (close) pendClose = true;
      continue;
    }
    if (i < 205 || !(ATR[i] > 0) || i + 1 >= n || pend) continue;
    const d = L[i] ? 1 : S[i] ? -1 : 0; if (!d) continue;
    let wait = 0; // random opening: a chosen signal is skipped (1/3) or entered 1-12 candles late (2/3); the draw never looks at what price does next
    if (o.entP && o.rng() < o.entP) { if (o.rng() < 1 / 3) continue; wait = 1 + Math.floor(o.rng() * 12); }
    pend = { dir: d, atr: ATR[i], stopPx: o.stop === 'mid' ? mid[i] : null, wait, late: wait > 0 };
    if (pend.stopPx != null && !(pend.stopPx > 0)) pend = null;
  }
  return trades.filter((t) => t.t1 > START && t.t1 <= END);
}
function hitR(pos, b, r) { const lvl = pos.entry * (1 + pos.dir * r * pos.dist); return pos.dir === 1 ? b.high >= lvl : b.low <= lvl; }

const mk = (bot, c, ch, cut = 0) => { const o = { ...BASE[bot], ...ch }, x = cut ? loadCut(c, cut) : load(c); return runY(x, o.sig === 'bb' ? bbSig(x, o.bb) : ichiSig(x), o); };
const by = (bot, ch) => Object.fromEntries(LINEUP[bot].map((c) => [c, mk(bot, c, ch)]));

// random early closes: a chosen trade is closed at the close of a random candle 1-48 after entry (drawn blind: independent of how the trade ends)
function jitter(bot, trades, p, rng) {
  return trades.map((t) => {
    if (rng() >= p) return t;
    const k = t.i0 + 1 + Math.floor(rng() * 48); if (k >= t.i1) return t; // stop (or the bot's own exit) came first: nothing changes. The draw never looks at how the trade ends.
    const x = load(t.c), px = x.B[k].close * (1 - t.d * SLIP), fr = x.fr ? x.fr(x.B[t.i0].time, x.B[k].time + IV / 2) : 0;
    return { ...t, R: (t.d * (px - t.entry) / t.entry - 2 * FEE - t.d * fr) / t.dist, t1: x.B[k].time + IV, i1: k, bars: k - t.i0 + 1 };
  });
}
if (require.main !== module) { module.exports = { runY, mk, jitter, VAR: null }; return; }
let seed = 24112026; const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

const VAR = {
  'BB-CORE': [
    ['E  close every trade before the weekend (Fri 20:00 UTC)', { weekend: 'all' }], ['E  close before weekend only if in profit', { weekend: 'win' }], ['E  close before weekend only if losing', { weekend: 'lose' }],
    ['E  cut a loser: after 12 candles if under -0.3R', { loserBars: 12, loserR: -0.3 }], ['E  cut a loser: after 24 candles if under -0.5R', { loserBars: 24, loserR: -0.5 }], ['E  cut a loser: after 24 candles if under 0R', { loserBars: 24, loserR: 0 }],
    ['E  BTC trend flips against the trade -> close', { btcFlip: 'all' }], ['E  BTC flips against and trade in profit -> close', { btcFlip: 'win' }],
    ['E  one candle > 2.5 ATR against us -> close', { shock: 2.5 }], ['E  one candle > 2 ATR against us, only if in profit', { shock: 2, shockOnly: 'win' }],
    ['E  in small profit (<1R) after 24 candles -> bank it', { winBars: 24, winR: 1 }], ['E  winning but last 6 candles went against us -> close', { stallBars: 6 }],
    ['L  time exit: if >= +0.5R, hold 12 more candles', { extR: 0.5, extBars: 12 }], ['L  time exit: if >= +1R, hold 24 more candles', { extR: 1, extBars: 24 }], ['L  time exit: if >= +2R, hold 48 more candles', { extR: 2, extBars: 48 }], ['L  time exit: if > 0R, hold 12 more', { extR: 0.0001, extBars: 12 }],
  ],
  'I-CORE': [
    ['E  close every trade before the weekend', { weekend: 'all' }], ['E  close before weekend only if in profit', { weekend: 'win' }], ['E  close before weekend only if losing', { weekend: 'lose' }],
    ['E  cut a loser: after 12 candles if under -0.3R', { loserBars: 12, loserR: -0.3 }], ['E  cut a loser: after 24 candles if under -0.5R', { loserBars: 24, loserR: -0.5 }], ['E  cut a loser: after 24 candles if under 0R', { loserBars: 24, loserR: 0 }],
    ['E  BTC trend flips against the trade -> close', { btcFlip: 'all' }], ['E  BTC flips against and trade in profit -> close', { btcFlip: 'win' }],
    ['E  one candle > 2.5 ATR against us -> close', { shock: 2.5 }], ['E  one candle > 2 ATR against us, only if in profit', { shock: 2, shockOnly: 'win' }],
    ['E  in small profit (<1R) after 24 candles -> bank it', { winBars: 24, winR: 1 }], ['E  winning but last 6 candles went against us -> close', { stallBars: 6 }],
    ['L  hard cap: time exit at 96 candles (16d)', { maxBars: 96 }], ['L  hard cap: time exit at 192 candles (32d)', { maxBars: 192 }],
  ],
  'T-CORE': [], // same list, filled below
};
VAR['T-CORE'] = VAR['I-CORE'];

const f = (v, d = 0) => (v >= 0 ? '+' : '') + v.toFixed(d), pc = (v) => (v * 100).toFixed(0) + '%';
let md = `# Situational early / late closes (Nov 24 2026)\n\nSame entries and stops as the live bots (live coins, 4h, Jan 2020 -> Nov 12 2026, standard costs + real funding). Only WHEN a trade is closed changes. E = early close, L = late (hold longer). Fills at the next open after the candle that triggered the rule.\n"Better" = more profit AND not a deeper drop. Halves: 2020-22 | 2023-26.\n\n`;
const out = {};
console.log('base check (must match +663 / +697 / +1081 on lab.js rules):');
for (const bot of Object.keys(LINEUP)) {
  const base = measure(Object.values(by(bot, {})).flat());
  console.log(bot, f(base.R, 1), 'DD', base.dd.toFixed(1), 'trades', base.n);
  md += `## ${bot}\n\n| Rule | Trades | Total R | vs today | Drop (R) | Win % | Losing months | 2020-22 | 2023-26 | Without best 10 | Years up | Verdict |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  const row = (name, M, verdict) => `| ${name} | ${M.n} | ${f(M.R)} | ${f(M.R - base.R)} | ${M.dd.toFixed(0)} | ${pc(M.wr)} | ${pc(M.loseM)} | ${f(M.is)} | ${f(M.oos)} | ${f(M.ex10)} | ${M.yrsUp}/7 | ${verdict} |\n`;
  md += row('**TODAY (live rules)**', base, '—'); out[bot] = { base, rows: [] };
  for (const [name, ch] of VAR[bot]) {
    const M = measure(Object.values(by(bot, ch)).flat());
    const better = M.R > base.R * 1.02 && M.dd <= base.dd * 1.05 && M.is >= base.is * 0.98 && M.oos >= base.oos * 0.98;
    const safer = !better && M.dd <= base.dd * 0.85 && M.R >= base.R * 0.9;
    const v = better ? '**BETTER both halves**' : safer ? 'safer, less profit' : M.R < base.R ? 'worse' : 'mixed';
    md += row(name, M, v); out[bot].rows.push({ name, ch, ...M, v });
    console.log(bot.padEnd(7), name.padEnd(58), f(M.R).padStart(6), `(${f(M.R - base.R).padStart(5)})`, 'DD', M.dd.toFixed(0).padStart(3), 'h1', f(M.is).padStart(5), 'h2', f(M.oos).padStart(5), v);
  }
  // years of today vs best-by-profit rule of each type
  md += `\nYears today: ${Object.entries(base.yrs).map(([y, v]) => y + ' ' + f(v)).join(', ')}\n\n`;
}

// ---- noise test: some trades closed early at a random candle (what an impatient human does), 25 draws each
md += `## "What if some trades are closed early at a random time?" (random-early-close noise test, 25 draws each)\n\nA chosen share of trades is closed at the close of a random candle 1-48 after entry (drawn without looking at how the trade ends; if the stop is hit first the trade is unchanged); the rest run as normal.\n\n| Bot | Share closed early | Mean total R | Worst draw | Best draw | vs today (mean) | Mean drop | Years that stay positive (of 7) |\n|---|---|---|---|---|---|---|---|\n`;
console.log('\nNOISE TEST');
for (const bot of Object.keys(LINEUP)) {
  const tr = Object.values(by(bot, {})).flat(), base = measure(tr);
  for (const p of [0.1, 0.25, 0.5, 1]) {
    const res = []; for (let k = 0; k < 25; k++) res.push(measure(jitter(bot, tr, p, rng)));
    const mean = res.reduce((s, m) => s + m.R, 0) / 25, lo = Math.min(...res.map((m) => m.R)), hi = Math.max(...res.map((m) => m.R)), dd = res.reduce((s, m) => s + m.dd, 0) / 25, yu = res.reduce((s, m) => s + m.yrsUp, 0) / 25;
    md += `| ${bot} | ${pc(p)} | ${f(mean)} | ${f(lo)} | ${f(hi)} | ${f(mean - base.R)} (${pc((mean - base.R) / base.R)}) | ${dd.toFixed(0)} (today ${base.dd.toFixed(0)}) | ${yu.toFixed(1)} |\n`;
    console.log(bot.padEnd(7), pc(p).padStart(4), 'mean', f(mean).padStart(6), 'worst', f(lo).padStart(6), 'best', f(hi).padStart(6), 'dd', dd.toFixed(0), 'yrsUp', yu.toFixed(1));
  }
}

// ---- replay check: rerun with only candles up to a cut; every trade closed before the cut must be identical (no future sight, no repaint)
md += `\n## Replay check (no future sight)\n\nEach rule rerun with only the candles up to 6 random cut-offs per coin; trades closed before the cut compared with the full run.\n\n`;
let bad = 0, chk = 0;
for (const bot of Object.keys(LINEUP)) for (const [name, ch] of VAR[bot]) for (const c of LINEUP[bot]) {
  const full = mk(bot, c, ch), n = load(c).n;
  for (let k = 0; k < 6; k++) {
    const cut = Math.floor(700 + rng() * (n - 800)), tCut = load(c).B[cut - 1].time, a = mk(bot, c, ch, cut).filter((t) => t.t1 <= tCut), b = full.filter((t) => t.t1 <= tCut);
    chk += Math.max(a.length, b.length); if (a.length !== b.length) bad += Math.abs(a.length - b.length);
    for (let j = 0; j < Math.min(a.length, b.length); j++) if (a[j].t0 !== b[j].t0 || a[j].t1 !== b[j].t1 || Math.abs(a[j].R - b[j].R) > 1e-9) bad++;
  }
}
md += `${chk.toLocaleString()} trades compared across all rules -> ${bad} different: **${bad === 0 ? 'PASS' : 'FAIL'}**\n`;
console.log('\nREPLAY:', chk, 'trades compared,', bad, 'different');
fs.writeFileSync(path.join(__dirname, 'results.md'), md); fs.writeFileSync(path.join(__dirname, 'sim.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toFixed(3) : v)));
