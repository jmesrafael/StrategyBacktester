// "We are here" test (Nov 17 2026). Today's situation: open trades reached a good profit, then a bounce took part back.
// Question: from exactly that point in history, was it better to CLOSE NOW or to HOLD by the bot's rules?
// For every past trade: find the first candle close where the trade had been at least +PEAK R at its best and is now
// at least GIVE R below that best (still open). Compare R if closed at that close vs the R the rules finally gave.
// Same engine, costs and coins as run.js. Run: node research/sell-too-soon/giveback.js
'use strict';
const path = require('path'), fs = require('fs');
const INTEL = path.join(__dirname, '..', '..', 'intel');
const E = require(path.join(INTEL, 'engines/backtest/engine'));
const S = require(path.join(INTEL, 'engines/backtest/strategies'));
const M = require(path.join(INTEL, 'lib/market'));
const cfg = require(path.join(INTEL, 'lib/config'));
const COST = 2 * (0.0005 + 0.0002); // fee + slippage, both sides, as a fraction of price

function study(botKey, PEAK, GIVE) {
  const def = cfg.bots[botKey], rows = [];
  for (const coin of def.coins) {
    if (!M.has(coin, '4h')) continue;
    const B = M.candles(coin, '4h'), F = M.has(coin, 'funding') ? M.bars(coin, 'funding') : null;
    for (const t of E.run(B, S.bot(def.strategy, 'v3'), E.standardCost({ funding: F })).trades) {
      let best = -Infinity;
      for (let i = t.i0; i < t.i1; i++) {           // strictly before the exit candle: the trade is still open
        const ext = t.dir === 1 ? B[i].high : B[i].low;
        best = Math.max(best, t.dir * (ext - t.entry) / t.entry / t.dist);
        const nowR = t.dir * (B[i].close - t.entry) / t.entry / t.dist;
        if (best >= PEAK && best - nowR >= GIVE) {
          rows.push({ coin, tExit: t.tExit, closeNow: nowR - COST / t.dist, hold: t.R, best, mfe: t.mfeR });
          break;
        }
      }
    }
  }
  return rows.sort((a, b) => a.tExit - b.tExit);
}
const f = (x, d = 2) => (x >= 0 ? '+' : '') + x.toFixed(d);
const out = ['# From "gave back profit on a bounce": close now or hold?', '',
  'Each row: all past trades that had reached at least the peak shown and then dropped back by at least the give-back shown, while still open (the first time it happened in each trade).', ''];
for (const bot of ['tcore', 'bbcore', 'icore']) {
  out.push(`## ${cfg.bots[bot].label}`, '', '| Reached at least | Then gave back | Cases | Avg R if closed there | Avg R if held by the rules | Holding better by | Hold won in % of cases | Held and ended below 0R | Held and ended ≥ +5R | 1st half diff | 2nd half diff |', '|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [P, G] of [[2, 1], [3, 1], [3, 1.5], [4, 1.5], [1.5, 1.4]]) {
    const r = study(bot, P, G); if (!r.length) continue;
    const n = r.length, avg = (k) => r.reduce((s, x) => s + x[k], 0) / n, h = Math.floor(n / 2);
    const diff = (a) => a.reduce((s, x) => s + x.hold - x.closeNow, 0) / (a.length || 1);
    out.push(`| +${P}R | ${G}R | ${n} | ${f(avg('closeNow'))} | ${f(avg('hold'))} | ${f(avg('hold') - avg('closeNow'))} R per trade | ${Math.round(r.filter((x) => x.hold > x.closeNow).length / n * 100)}% | ${Math.round(r.filter((x) => x.hold < 0).length / n * 100)}% | ${Math.round(r.filter((x) => x.hold >= 5).length / n * 100)}% | ${f(diff(r.slice(0, h)))} | ${f(diff(r.slice(h)))} |`);
  }
  out.push('');
}
fs.writeFileSync(path.join(__dirname, 'giveback.md'), out.join('\n') + '\n');
console.log(out.join('\n'));
