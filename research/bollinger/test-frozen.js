// test-frozen.js — the frozen BB-breakout settings (chosen on TRAIN data, entries < 2023-01-01) run on the HELD-OUT years
// (2023-01 -> now) and on 10 coins the strategy was never tuned on. usage: node test-frozen.js
const L = require('./lib.js'), F = require('./fam.js'), fs = require('fs');
const TUNED = ['BTC', 'ETH', 'SOL'], FRESH = ['BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'LTC', 'DOT', 'TRX', 'BCH'];
const SPLIT = L.ts(2023), INF = L.ts(2100);
// FROZEN — do not edit after looking at the test numbers
const B = { tf: 240, n: 20, k: 2, look: 100, pct: 1, recent: 10, stop: 'mid', tp: 3, trailATR: 0, trendN: 200, beR: 0, maxBars: 48 };
const A = { ...B, maxBars: 0 };
const out = [];
const P = (s = '') => { out.push(s); console.log(s); };
const row = (name, tr) => { const s = L.stats(tr); return `| ${name} | ${s.n} | ${L.f2(s.sum)} | ${L.f2(s.avg)} | ${s.t.toFixed(2)} | ${s.pf.toFixed(2)} | ${(s.win * 100).toFixed(0)}% | ${s.dd.toFixed(1)} |`; };
const HEAD = '| | Trades | Total R | Avg R | t-stat | PF | Win | Max DD (R) |\n|---|---|---|---|---|---|---|---|';
const trades = (sym, c) => F.sq(sym, c);

P('# BB breakout (4h) — frozen settings on held-out data\n');
P('Frozen: 4h, Bollinger(20, 2), close beyond a band in the direction of the 200 SMA, stop at the middle band, target 3R, exit after 48 bars. ' +
  'Costs 0.04% commission + 0.02% slippage per side. R = amount risked per trade. TRAIN = entries before 2023-01-01, TEST = 2023-01-01 on.\n');

for (const [label, cfg] of [['B (primary: 48-bar time exit)', B], ['A (no time exit)', A]]) {
  P(`## ${label}\n`);
  P('### The three coins it was tuned on\n');
  P(HEAD);
  let trAll = [], teAll = [];
  for (const s of TUNED) { const t = trades(s, cfg); trAll = trAll.concat(L.slice(t, 0, SPLIT)); teAll = teAll.concat(L.slice(t, SPLIT, INF));
    P(row(`${s} train`, L.slice(t, 0, SPLIT))); P(row(`${s} **TEST**`, L.slice(t, SPLIT, INF))); }
  P(row('All 3 train', trAll)); P(row('**All 3 TEST**', teAll));
  P('\n### Ten coins it was never tuned on (BNB XRP DOGE ADA AVAX LINK LTC DOT TRX BCH)\n');
  P(HEAD);
  let fTr = [], fTe = [], pos = 0;
  for (const s of FRESH) { const t = trades(s, cfg), tr = L.slice(t, 0, SPLIT), te = L.slice(t, SPLIT, INF); fTr = fTr.concat(tr); fTe = fTe.concat(te);
    if (L.sum(te.map((x) => x.R)) > 0) pos++; P(row(`${s} train`, tr)); P(row(`${s} **TEST**`, te)); }
  P(row('All 10 train', fTr)); P(row('**All 10 TEST**', fTe));
  P(`\nFresh coins profitable in the test years: ${pos} of ${FRESH.length}.\n`);
  if (cfg === B) globalThis.keep = { teAll, fTe, fTr, trAll };
}

P('## Diagnostics on the test years (reported only — settings were not changed because of them)\n');
P('Pooled: 3 tuned coins + 10 fresh coins, TEST years, primary B.\n');
P(HEAD);
const ALL = TUNED.concat(FRESH);
const pooled = (c, a = SPLIT, b = INF, cost) => {
  if (cost) { L.COST.comm = 0.0004 * cost; L.COST.slip = 0.0002 * cost; }
  let r = []; for (const s of ALL) r = r.concat(L.slice(trades(s, c), a, b));
  L.COST.comm = 0.0004; L.COST.slip = 0.0002; return r;
};
P(row('Primary B', pooled(B)));
P(row('No trend filter', pooled({ ...B, trendN: 0 })));
P(row('With squeeze requirement (pct 0.25)', pooled({ ...B, pct: 0.25 })));
P(row('Costs ×2', pooled(B, SPLIT, INF, 2)));
P(row('Costs ×3', pooled(B, SPLIT, INF, 3)));
const long = pooled(B).filter((t) => t.dir === 1), short = pooled(B).filter((t) => t.dir === -1);
P(row('Longs only', long)); P(row('Shorts only', short));
P('\n### Pooled R by year (13 coins, primary B)\n');
P('| Year | Trades | Total R | Avg R | Coins traded |\n|---|---|---|---|---|');
for (let y = 2019; y <= 2026; y++) {
  let r = []; let cn = 0;
  for (const s of ALL) { const t = L.slice(trades(s, B), L.ts(y), L.ts(y + 1)); if (t.length) cn++; r = r.concat(t); }
  if (r.length) P(`| ${y} | ${r.length} | ${L.f2(L.sum(r.map((t) => t.R)))} | ${L.f2(L.sum(r.map((t) => t.R)) / r.length)} | ${cn} |`);
}
fs.writeFileSync(__dirname + '/results-test-frozen.md', out.join('\n') + '\n');
