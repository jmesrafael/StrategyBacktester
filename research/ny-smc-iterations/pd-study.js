// pd-study.js — how frozen v7's trades relate to the previous day's high/low (PDH/PDL), SOL + ETH, Binance 15m, all years.
// Analysis only (no rule changes). Labels per trade, mirrored for shorts ("support side" = PDL/PDH below price for a long):
//   sweep   — the CHoCH leg's extreme went beyond a PD level and the CHoCH candle closed back on the trade side of it
//   bounce  — the leg's extreme stopped within tol of a PD level without crossing it
//   retest  — the impulse crossed a PD level and the FVG entry sits within tol of it (break and retest)
//   block1  — a PD level lies between entry and +1R (in the way before breakeven)
//   block3  — a PD level lies between +1R and the 3R target
//   none    — no PD interaction at all (mid-range)
// usage: node pd-study.js [tolATR=0.25] → results/pd-study.md, exports label()
const fs = require('fs'), E = require('./ie.js'), T = require('./trades-windows.js');
const C = T.C, D0 = (s) => Date.parse(s + 'T00:00:00Z') / 1000;
const TOL = +(process.argv[2] || 0.25);
const PDNY = require('./pdny.js'), PDMODE = process.env.PD || 'nyday'; // previous NY day by default (see pdny.js)
const SPLIT = D0('2023-10-18'), START = { SOL: D0('2020-10-18'), ETH: D0('2019-12-15') }, END = D0('2026-10-18');

function label(D, s, tolATR = TOL) {
  const { B, atr } = D, long = s.long, dir = long ? 1 : -1;
  const day = PDNY.levels(D, PDMODE)(s.chochIdx);
  if (!day) return null;
  const lv = [['PDH', day.pdh], ['PDL', day.pdl]], tol = tolATR * atr[s.fvgIdx];
  const legX = long ? s.stop / (1 - C.slBufferPct) : s.stop / (1 + C.slBufferPct);
  let imp = long ? -Infinity : Infinity;
  for (let j = s.legXi; j <= s.fvgIdx; j++) imp = long ? Math.max(imp, B[j].high) : Math.min(imp, B[j].low);
  const chClose = B[s.chochIdx].close, f = { sweep: null, bounce: null, retest: null, block1: null, block3: null };
  for (const [n, p] of lv) {
    // leg extreme vs level (level must be on the support side of the CHoCH close)
    if (dir * (chClose - p) > 0) {
      if (dir * (p - legX) > 0) f.sweep = f.sweep || n;                 // went through and came back
      else if (dir * (legX - p) <= tol) f.bounce = f.bounce || n;       // held just at it
    }
    if (dir * (imp - p) > 0 && dir * (p - legX) < 0 + 1e-12 * p && Math.abs(s.entry - p) <= tol) f.retest = f.retest || n;
    if (dir * (imp - p) > 0 && Math.abs(s.entry - p) <= tol && !f.retest) f.retest = n;
    const r = dir * (p - s.entry) / s.risk;
    if (r > 0 && r <= 1) f.block1 = f.block1 || n;
    else if (r > 1 && r < C.tpR) f.block3 = f.block3 || n;
  }
  f.none = !f.sweep && !f.bounce && !f.retest && !f.block1 && !f.block3;
  f.inRange = s.entry < day.pdh && s.entry > day.pdl;
  return f;
}
module.exports = { label };

if (require.main === module) {
  const rows = [];
  for (const sym of ['SOL', 'ETH']) {
    const D = E.analyze(sym + '-binance', JSON.parse(fs.readFileSync(`data/binance-${sym.toLowerCase()}15.json`, 'utf8')), C.swingLen);
    for (const t of E.execute(D, C, E.setupsFor(D, C))) { if (t.t < START[sym] || t.t >= END) continue; const f = label(D, t.s); if (f) rows.push({ sym, R: t.R, long: t.long, post: t.t >= SPLIT, f }); }
  }
  const g = (name, pred) => {
    const cell = (a) => { if (!a.length) return '— | — | —'; const R = a.reduce((x, t) => x + t.R, 0); return `${a.length} | ${(R / a.length >= 0 ? '+' : '−') + Math.abs(R / a.length).toFixed(2)} | ${(a.filter((t) => t.R > 1.5).length / a.length * 100).toFixed(0)}%`; };
    const a = rows.filter(pred);
    return `| ${name} | ${cell(a.filter((t) => !t.post))} | ${cell(a.filter((t) => t.post))} | ${cell(a)} |`;
  };
  const L = [`# v7 trades vs PDH/PDL (${PDMODE}) — SOL + ETH, Binance 15m, $1 risk (tolerance ${TOL} × ATR)`, '',
    'Each cell: trades | average R per trade | 3R hit rate. Breakeven needs about 15–17% 3R hits. Labels can overlap.', '',
    '| Label | 2019–23 n | avg | 3R | 2023–26 n | avg | 3R | All n | avg | 3R |', '|---|---|---|---|---|---|---|---|---|---|',
    g('All v7 trades', () => true),
    g('Sweep of PDL/PDH, then CHoCH back', (t) => t.f.sweep),
    g('  · swept PDL (long) / PDH (short)', (t) => (t.long && t.f.sweep === 'PDL') || (!t.long && t.f.sweep === 'PDH')),
    g('  · reclaimed PDH (long) / PDL (short)', (t) => (t.long && t.f.sweep === 'PDH') || (!t.long && t.f.sweep === 'PDL')),
    g('Bounce off PD level (no sweep)', (t) => t.f.bounce),
    g('Break and retest of PD level', (t) => t.f.retest),
    g('PD level in the way before +1R', (t) => t.f.block1),
    g('PD level between +1R and 3R', (t) => t.f.block3),
    g('No PD level involved', (t) => t.f.none),
    g('Entry inside previous-day range', (t) => t.f.inRange),
    g('Entry outside previous-day range', (t) => !t.f.inRange),
    g('Any reaction (sweep / bounce / retest)', (t) => t.f.sweep || t.f.bounce || t.f.retest),
    g('Reaction and nothing in the way before +1R', (t) => (t.f.sweep || t.f.bounce || t.f.retest) && !t.f.block1),
    g('Nothing in the way before +1R', (t) => !t.f.block1),
  ];
  fs.writeFileSync(`results/pd-study-${PDMODE}.md`, L.join('\n') + '\n');
  console.log(L.join('\n'));
}
