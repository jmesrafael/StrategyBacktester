// engines/backtest - builds the reference backtests of the three live bots (dataset "derived/reference-trades").
// Each bot runs on its own coins, on 4h Binance candles, in both rule sets (v3 and legacy) and under two cost models:
// "standard" (the one model all research uses, with real funding) and "native" (the bot's own model).
// Other engines read this dataset: the regime test, the validator (overlap with the bots) and the health monitor.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const E = require('./engine'), S = require('./strategies');

const SCHEMA = { bot: 'string', version: 'string', cost: 'string', coin: 'string', dir: 'int', sig_t: 'int', t: 'int', t_exit: 'int', r: 'number', why: 'string', bars: 'int', mfe_r: 'number' };
function build() {
  const rows = [], summary = [], skipped = [];
  for (const [bot, def] of Object.entries(cfg.bots)) for (const version of ['v3', 'legacy']) for (const costName of ['standard', 'native']) {
    const all = [];
    for (const coin of def.coins) {
      if (!M.has(coin, '4h')) { skipped.push(coin); continue; }
      const B = M.candles(coin, '4h'), F = M.has(coin, 'funding') ? M.bars(coin, 'funding') : null;
      const cost = costName === 'standard' ? E.standardCost({ funding: F }) : def.strategy === 'bbcore' ? E.bbNativeCost(undefined, F) : E.icNativeCost();
      for (const t of E.run(B, S.bot(def.strategy, version), cost).trades) all.push({ bot, version, cost: costName, coin, dir: t.dir, sig_t: t.sigT, t: t.t, t_exit: t.tExit, r: U.round(t.R, 6), why: t.why, bars: t.bars, mfe_r: U.round(t.mfeR, 4) });
    }
    all.sort((a, b) => a.t_exit - b.t_exit || a.t - b.t); rows.push(...all);
    const st = E.stats(all.map((t) => ({ R: t.r }))), top = [...all].sort((a, b) => b.r - a.r).slice(0, 10);
    summary.push({ bot, version, cost: costName, coins: def.coins.filter((c) => M.has(c, '4h')).join(' '), n: st.n, total_r: U.round(st.totalR, 1), avg_r: U.round(st.avgR, 3), win_rate: U.round(st.winRate, 3), max_dd_r: U.round(st.maxDD, 1), max_loss_streak: st.maxLossStreak,
      t_stat: U.round(st.tStat, 2), total_without_top10: U.round(st.totalR - U.sum(top.map((t) => t.r)), 1), from: all.length ? U.day(all[0].t) : null, to: all.length ? U.day(all[all.length - 1].t_exit) : null });
  }
  return { rows, summary, skipped: [...new Set(skipped)] };
}
function run() {
  const b = build();
  const m = spine.write('derived/reference-trades', { generator: 'engines/backtest', inputs: [spine.ref('market')],
    checks: [{ name: 'reference backtests built', ok: b.rows.length > 1000, detail: `${b.rows.length} trades` }, { name: 'all bot coins available', ok: b.skipped.length === 0, detail: b.skipped.length ? 'no clean 4h candles: ' + b.skipped.join(', ') : 'yes' }],
    notes: ['R is after costs. cost=standard: 0.05% fee and 0.02% slippage per side, real settled funding. cost=native: the bot\'s own model.', 'Coins are today\'s live coin lists (config.json), over each coin\'s whole Binance history.'],
    files: { 'trades.csv': { rows: b.rows, schema: SCHEMA }, 'summary.json': { json: b.summary } } });
  const L = ['# Reference backtests of the live bots (unified engine)', '', `Built ${new Date().toISOString().slice(0, 16)} UTC. 4h Binance candles, each bot on its live coins, whole history.`, '',
    U.mdTable(b.summary, [['Bot', (r) => r.bot], ['Rules', (r) => r.version], ['Costs', (r) => r.cost], ['Coins', (r) => r.coins], ['Trades', (r) => r.n], ['Total R', (r) => r.total_r], ['R per trade', (r) => U.signed(r.avg_r, 3)], ['Win rate', (r) => Math.round(r.win_rate * 100) + '%'],
      ['Worst drop R', (r) => r.max_dd_r], ['Longest losing run', (r) => r.max_loss_streak], ['Total without 10 best trades', (r) => r.total_without_top10], ['Period', (r) => `${r.from} to ${r.to}`]]), '',
    '## Cost models', '', '- standard: 0.05% taker fee and 0.02% slippage on each side, real settled funding. Used for all new research so results are comparable.',
    '- native: BB-CORE uses the same fees and slippage with real funding; I-CORE and T-CORE charge fee plus slippage twice and a flat 0.005% per candle for funding inside the R formula, not in the fill price. The gap between the two rows of a bot is the size of that difference.', '',
    'test/backtest-parity.test.js proves the engine reproduces each bot\'s own backtest trade for trade under its native costs.'];
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'backtest.md'), L.join('\n') + '\n');
  return m;
}
// reference trades of one bot: current rules, standard costs (what other engines normally want)
const reference = (bot, version = 'v3', cost = 'standard') => spine.load('derived/reference-trades', 'trades.csv').filter((t) => t.bot === bot && t.version === version && t.cost === cost);
module.exports = { build, run, reference, SCHEMA };
if (require.main === module) { const m = run(); console.log('reference-trades:', m.status, '-> reports/backtest.md'); }
