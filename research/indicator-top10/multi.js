// multi.js — the 10 tweaked indicators + bb-core + I-Core on 7 coins (SOL ZEC NEAR ADA GALA = the bots' five, plus BTC ETH), 4h, to 2026-11-05.
// Each indicator's setting was chosen on the ORIGINAL 4 coins only (results-R2.json, plateau rule) — never re-tuned here, so ZEC / NEAR / GALA are out-of-sample for it.
// Trade loop = I-Core's, stop from the signal close, safety exit at the next open (exactly what strategies/ma-trend-strategy.js does in the app replay).
process.env.COINS = 'SOL,ZEC,NEAR,ADA,GALA,BTC,ETH';
const fs = require('fs'); const { cfgRun, COINS } = require('./rstrat.js'); const { account } = require('./baseline');
const BB = require('../../../bb-core/lucidio-core.js'), IC = require('../../js/icore-core.js');
const S2 = require('./results-R2.json'), med = a => { a = [...a].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const YRS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const yOf = t => new Date(t.tExit * 1000).getUTCFullYear();
function summarize(trades) {
  const byYear = {}, byCoin = {}, grid = {};
  for (const y of YRS) byYear[y] = { n: 0, R: 0 };
  for (const c of COINS) { byCoin[c] = { n: 0, R: 0, w: 0 }; grid[c] = {}; for (const y of YRS) grid[c][y] = 0; }
  for (const t of trades) { const y = yOf(t); byYear[y].n++; byYear[y].R += t.R; const b = byCoin[t.coin]; b.n++; b.R += t.R; if (t.R > 0) b.w++; grid[t.coin][y] += t.R; }
  const peso = YRS.map(y => { const tt = trades.filter(t => yOf(t) === y).sort((a, b) => a.tExit - b.tExit); let e = 10000, pk = e, dd = 0; for (const t of tt) { e *= 1 + .025 * t.R; pk = Math.max(pk, e); dd = Math.min(dd, e / pk - 1); } return { y, end: e, dd }; });
  const a = account(trades);
  return { byYear, byCoin, grid, peso, total: { n: a.n, expR: a.expR, totR: a.totR, pf: a.pf, win: a.win, mdd: a.mdd } };
}
const botTrades = core => { const all = []; for (const c of COINS) { const B = JSON.parse(fs.readFileSync(`data4h/${c}.json`)).map(r => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })); all.push(...core.backtest(B).trades.map(t => ({ ...t, coin: c }))); } return all; };
// representative setting per indicator: family = SMA200 filter, long-only, 2 ATR stop; shape chosen by weaker-of(train,test) median over trail 10/14/20 on the 4 original coins
const names = [...new Set(S2.map(c => c.name))], out = { coins: COINS, years: YRS, ind: {}, bots: {} };
for (const n of names) {
  const fam = S2.filter(c => c.name === n && c.filt && c.lo && c.kI === 2 && c.kT >= 10), grp = {};
  for (const c of fam) (grp[c.mode + c.p.join('/')] = grp[c.mode + c.p.join('/')] || []).push(c);
  const best = Object.values(grp).filter(l => l.length === 3).map(l => ({ l, s: Math.min(med(l.map(c => c.train.totR)), med(l.map(c => c.test.totR))) })).sort((a, b) => b.s - a.s)[0].l.find(c => c.kT === 14);
  const r = cfgRun(n, best.mode, best.p, true, true, 2, 14, 'close', 'nextOpen');
  out.ind[n] = { cfg: { mode: best.mode, p: best.p, kI: 2, kT: 14, lo: true, filt: true }, ...summarize(r.trades) };
  console.log(n.padEnd(5), best.mode, best.p.join('/'), 'trades', r.trades.length, 'totR', out.ind[n].total.totR.toFixed(0));
}
out.bots['bb-core'] = summarize(botTrades(BB)); out.bots['I-Core'] = summarize(botTrades(IC));
fs.writeFileSync('multi.json', JSON.stringify(out));
console.log('bb-core', out.bots['bb-core'].total.totR.toFixed(0), 'I-Core', out.bots['I-Core'].total.totR.toFixed(0));
