// "Sell too soon?" study (Nov 17 2026). Question from the owner after the Nov 14-17 bounce gave back open profit:
// would taking profit earlier (tighter trail, profit lock, or closing half at +X R) have beaten the bots' own exit rules?
// Offline only. Uses the intel unified engine (parity-tested against each bot's own backtest), standard costs with real
// funding, 4h Binance candles from the local candle library, each bot on its live coins, current (v3) rules.
// Run: node research/sell-too-soon/run.js   (from StrategyBacktester)
'use strict';
const path = require('path'), fs = require('fs');
const INTEL = path.join(__dirname, '..', '..', 'intel');
const E = require(path.join(INTEL, 'engines/backtest/engine'));
const S = require(path.join(INTEL, 'engines/backtest/strategies'));
const M = require(path.join(INTEL, 'lib/market'));
const cfg = require(path.join(INTEL, 'lib/config'));

// half-off at +X R: a resting take-profit for 50% of the size. Triggered if the trade's best excursion reached X.
// The other half follows the bot's normal exit. Extra fee for the extra order: 0.05% on half the size, in R.
function scaleOut(trades, X) {
  return trades.map((t) => {
    if (!(t.mfeR >= X)) return t;
    const extraFeeR = 0.5 * 0.0005 / t.dist;
    return { ...t, R: 0.5 * X + 0.5 * t.R - extraFeeR };
  });
}

function runBot(botKey, extra, post) {
  const def = cfg.bots[botKey], all = [];
  for (const coin of def.coins) {
    if (!M.has(coin, '4h')) continue;
    const B = M.candles(coin, '4h'), F = M.has(coin, 'funding') ? M.bars(coin, 'funding') : null;
    const strat = S.bot(def.strategy, 'v3', extra);
    // BB-CORE's factory hard-codes kTrail 0 and has no lock fields: apply exit overrides to the strategy object directly
    for (const k of ['kTrail', 'lockAtR', 'lockToR']) if (extra[k] != null) strat[k] = extra[k];
    let tr = E.run(B, strat, E.standardCost({ funding: F })).trades.map((t) => ({ ...t, coin }));
    if (post) tr = post(tr);
    all.push(...tr);
  }
  return all.sort((a, b) => a.tExit - b.tExit);
}

function summarize(name, trades, splitT) {
  const st = E.stats(trades), top = [...trades].sort((a, b) => b.R - a.R).slice(0, 10).reduce((s, t) => s + t.R, 0);
  const h1 = trades.filter((t) => t.tExit < splitT).reduce((s, t) => s + t.R, 0), h2 = trades.filter((t) => t.tExit >= splitT).reduce((s, t) => s + t.R, 0);
  const big = trades.filter((t) => t.R >= 5).length;
  return { name, n: st.n, total: st.totalR, avg: st.avgR, win: st.winRate, dd: st.maxDD, ratio: st.totalR / (st.maxDD || 1), noTop10: st.totalR - top, h1, h2, big };
}

const variants = {
  tcore: [
    ['Current rules (trail 14 ATR, no lock)', {}],
    ['Trail 13 ATR', { kTrail: 13 }], ['Trail 12 ATR', { kTrail: 12 }], ['Trail 11 ATR', { kTrail: 11 }],
    ['Trail 10 ATR', { kTrail: 10 }], ['Trail 9 ATR', { kTrail: 9 }], ['Trail 8 ATR', { kTrail: 8 }], ['Trail 6 ATR', { kTrail: 6 }], ['Trail 4 ATR', { kTrail: 4 }],
    ['Break-even at +2R', { lockAtR: 2, lockToR: 0 }], ['Lock +1R at +3R', { lockAtR: 3, lockToR: 1 }], ['Lock +1R at +4R', { lockAtR: 4, lockToR: 1 }],
    ['Lock +2R at +4R', { lockAtR: 4, lockToR: 2 }], ['Lock +3R at +5R', { lockAtR: 5, lockToR: 3 }],
    ['Trail 8 ATR + lock +1R at +3R', { kTrail: 8, lockAtR: 3, lockToR: 1 }],
    ['Close half at +2R', {}, (t) => scaleOut(t, 2)], ['Close half at +3R', {}, (t) => scaleOut(t, 3)], ['Close half at +5R', {}, (t) => scaleOut(t, 5)],
  ],
  bbcore: [
    ['Current rules (middle-band stop, 42-candle time exit)', {}],
    ['Break-even at +2R', { lockAtR: 2, lockToR: 0 }], ['Lock +1R at +3R', { lockAtR: 3, lockToR: 1 }], ['Lock +2R at +4R', { lockAtR: 4, lockToR: 2 }],
    ['Add 8 ATR trail', { kTrail: 8 }], ['Add 5 ATR trail', { kTrail: 5 }], ['Add 3 ATR trail', { kTrail: 3 }],
    ['Close half at +2R', {}, (t) => scaleOut(t, 2)], ['Close half at +3R', {}, (t) => scaleOut(t, 3)], ['Close half at +5R', {}, (t) => scaleOut(t, 5)],
  ],
  icore: [
    ['Current rules (trail 7 ATR, lock +1R at +4R)', {}],
    ['Trail 5 ATR', { kTrail: 5 }], ['Lock +1R at +3R', { lockAtR: 3, lockToR: 1 }], ['Lock +2R at +4R', { lockAtR: 4, lockToR: 2 }],
    ['Close half at +3R', {}, (t) => scaleOut(t, 3)],
  ],
};

const f = (x, d = 1) => (x >= 0 ? '+' : '') + x.toFixed(d);
const out = [];
for (const [bot, list] of Object.entries(variants)) {
  const base = runBot(bot, {});
  const splitT = base[Math.floor(base.length / 2)].tExit; // half the trades each side
  const rows = list.map(([name, extra, post]) => summarize(name, runBot(bot, extra, post), splitT));
  const b = rows[0];
  out.push(`## ${cfg.bots[bot].label} (${cfg.bots[bot].coins.join(' ')})`, '',
    `${b.n} trades, ${new Date(base[0].t * 1000).toISOString().slice(0, 10)} to ${new Date(base[base.length - 1].tExit * 1000).toISOString().slice(0, 10)}. Halves split at ${new Date(splitT * 1000).toISOString().slice(0, 10)}.`, '',
    '| Rule | Trades | Total R | vs current | R/trade | Win % | Worst drop R | Total ÷ drop | Without best 10 | 1st half R | 2nd half R | Trades ≥ +5R | Beats current in both halves? |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const both = r === b ? '—' : (r.h1 > b.h1 && r.h2 > b.h2 ? '**yes**' : 'no');
    out.push(`| ${r.name} | ${r.n} | ${f(r.total)} | ${r === b ? '—' : f(r.total - b.total)} | ${f(r.avg, 3)} | ${Math.round(r.win * 100)}% | ${r.dd.toFixed(1)} | ${r.ratio.toFixed(1)} | ${f(r.noTop10)} | ${f(r.h1)} | ${f(r.h2)} | ${r.big} | ${both} |`);
  }
  out.push('');
}
// robustness: T-CORE trail 10 vs current 14, by year and by coin
{
  const a = runBot('tcore', {}), b = runBot('tcore', { kTrail: 10 });
  const by = (tr, key) => tr.reduce((m, t) => { const k = key(t); m[k] = (m[k] || 0) + t.R; return m; }, {});
  const yr = (t) => new Date(t.tExit * 1000).getUTCFullYear();
  const ya = by(a, yr), yb = by(b, yr), ca = by(a, (t) => t.coin), cb = by(b, (t) => t.coin);
  out.push('## T-CORE robustness: trail 10 ATR vs current 14 ATR', '', '| Year | Current R | Trail 10 R | Difference |', '|---|---|---|---|');
  for (const y of Object.keys(ya).sort()) out.push(`| ${y} | ${f(ya[y])} | ${f(yb[y] || 0)} | ${f((yb[y] || 0) - ya[y])} |`);
  out.push('', '| Coin | Current R | Trail 10 R | Difference |', '|---|---|---|---|');
  for (const c of Object.keys(ca)) out.push(`| ${c} | ${f(ca[c])} | ${f(cb[c] || 0)} | ${f((cb[c] || 0) - ca[c])} |`);
  out.push('');
}
const md = out.join('\n');
fs.writeFileSync(path.join(__dirname, 'results.md'), md + '\n');
console.log(md);
