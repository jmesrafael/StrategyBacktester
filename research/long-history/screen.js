// screen.js: every long-history coin (perp listed before 2022, plus the current bot coins) on the three live bot rules, year by year.
// Data: ../../candles (Binance USDT-M perps, 4h + funding), nothing downloaded. Bots = live rules via ../strat-hunt-nov6 (BBX / P7 / P14),
// real fees 0.05% x2, slippage 0.02%, real funding. TRI mix = 0.5 BB-CORE + 0.25 I-CORE + 0.25 T-CORE (R at each bot's own risk).
// Output: screen.json, screen.txt. Usage: node screen.js
'use strict';
const fs = require('fs'), path = require('path');
const H = path.join(__dirname, '../strat-hunt-nov6'), C = require('../../candles/candles.js');
const { run, COST } = require(path.join(H, 'engine.js')), { S, makeCtx, exitOf } = require(path.join(H, 'strategies.js'));
const BOTS = { 'BB-CORE': 'BBX', 'I-CORE': 'P7', 'T-CORE': 'P14' }, WT = { 'BB-CORE': .5, 'I-CORE': .25, 'T-CORE': .25 };
const CUR = ['SOL', 'NEAR', 'ADA', 'GALA', 'ETH'];
const cfg = require('../../candles/coins.json');
const ex = JSON.parse(fs.readFileSync(path.join(process.env.TK_DIR || __dirname, 'ticker.json'), 'utf8'));  // Binance 24h volume snapshot (Nov 12)
const vol = Object.fromEntries(ex.map(t => [t.symbol, +t.quoteVolume / 1e6]));
const END = Date.UTC(2026, 10, 12) / 1000, YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];
const by = id => S.find(s => s.id === id);
const yr = t => new Date(t * 1e3).getUTCFullYear();
function stats(tr, scale = 1) {
  const s = [...tr].sort((a, b) => a.x - b.x); let e = 0, pk = 0, dd = 0;
  for (const t of s) { e += t.R * scale; pk = Math.max(pk, e); dd = Math.max(dd, pk - e); }
  const years = Object.fromEntries(YEARS.map(y => [y, s.filter(t => yr(t.x) === y).reduce((a, t) => a + t.R * scale, 0)]));
  const top10 = [...s].map(t => t.R * scale).sort((a, b) => b - a).slice(0, 10).reduce((a, v) => a + v, 0);
  return { n: s.length, R: e, dd, years, top10, exTop10: e - top10, win: s.length ? s.filter(t => t.R > 0).length / s.length : 0 };
}
const names = [...cfg.bots, ...cfg.extra, ...(cfg.history || []), 'BTC'].filter((c, i, a) => a.indexOf(c) === i).filter(c => C.coins().includes(c));
const rows = [];
for (const c of names) {
  const raw = C.load(c, '4h'), F = C.funding(c);
  const B = raw.map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
  if (B.length < 600) continue;
  const x = makeCtx(B, '4h'), bbc = by('bb-core').build(x), built = { BBX: bbc, P7: by('i-core').build(x), P14: { ...bbc, stopL: null, stopS: null } };
  const first = B[0].time, firstTrade = first + 205 * 14400, r = { coin: c, listed: new Date(first * 1e3).toISOString().slice(0, 10), vol: vol[c + 'USDT'] ?? vol['1000' + c + 'USDT'] ?? 0, bots: {} };
  const tri = [], tri2 = [];
  for (const [bot, p] of Object.entries(BOTS)) {
    for (const [k, cost] of [['n', COST], ['x2', { fee: COST.fee * 2, slip: COST.slip * 2 }]]) {
      const tr = run(B, x.atr14, built[p], exitOf(p, x), F.length ? F : null, 14400, cost).trades.filter(t => t.tExit <= END).map(t => ({ x: t.tExit, R: t.R }));
      if (k === 'n') { r.bots[bot] = stats(tr); tr.forEach(t => tri.push({ x: t.x, R: t.R * WT[bot] })); } else tr.forEach(t => tri2.push({ x: t.x, R: t.R * WT[bot] }));
    }
  }
  r.tri = stats(tri); r.tri2 = stats(tri2); r.firstTrade = new Date(firstTrade * 1e3).toISOString().slice(0, 10);
  // calendar years the coin could trade: 2020 counts only if tradable from before Jul 1 2020 (half a year of signals)
  r.fullYears = YEARS.filter(y => y > 2020 ? first + 205 * 14400 < Date.UTC(y, 0, 1) / 1000 + 86400 * 30 : firstTrade < Date.UTC(2020, 6, 1) / 1000);
  rows.push(r);
}
fs.writeFileSync(path.join(__dirname, 'screen.json'), JSON.stringify(rows));
const f = (v, d = 1) => (v >= 0 ? '+' : '') + v.toFixed(d);
const out = [];
const tab = (title, list) => {
  out.push(`\n=== ${title} ===`);
  out.push('coin    listed      $M/d | ' + YEARS.join('    ') + '  | total   DD  R/DD | yrs+ | 2x cost  exTop10');
  for (const r of list) {
    const t = r.tri, ys = YEARS.map(y => r.fullYears.includes(y) || y === 2026 && r.fullYears.includes(2025) ? f(t.years[y]).padStart(6) : '     -').join(' ');
    const pos = r.fullYears.filter(y => t.years[y] > 0).length;
    out.push(`${(r.coin + (CUR.includes(r.coin) ? '*' : '')).padEnd(8)}${r.listed} ${r.vol.toFixed(0).padStart(6)} | ${ys} | ${f(t.R).padStart(6)} ${t.dd.toFixed(0).padStart(4)} ${(t.R / Math.max(t.dd, 1)).toFixed(1).padStart(5)} | ${pos}/${r.fullYears.length} | ${f(r.tri2.R).padStart(6)} ${f(t.exTop10).padStart(7)}`);
  }
};
const allPos = r => r.fullYears.length >= 5 && r.fullYears.every(y => r.tri.years[y] > 0);
rows.sort((a, b) => b.fullYears.length - a.fullYears.length || b.tri.R - a.tri.R);
const winners = rows.filter(allPos);
tab(`ALL years positive on the TRI mix (needs 5+ calendar years; * = a bot trades it): ${winners.length} of ${rows.length}`, winners);
tab('Everything else (sorted by years of history, then total R)', rows.filter(r => !allPos(r)));
fs.writeFileSync(path.join(__dirname, 'screen.txt'), out.join('\n'));
console.log(out.join('\n'));
