// regime-history.js - what did the 1h BB-Core earn in each kind of market? Runs the strategy's own backtest over MEXC's 1h candles (since 2020) and tags every trade with the regime
// its coin was in at the signal candle, using the very same classifier the recorder runs live (regime.js). The dashboard shows the result beside the market's current regime.
//
//   node regime-history.js <folder with SOL.json ZEC.json NEAR.json ADA.json GALA.json> [out.json]
//   candles per file: [[time, open, high, low, close, volume], ...] (research/indicator-top10/mexc1h)
//
// Costs are the backtest's fixed model (fees + slippage, no funding: MEXC's funding history for 2020-2026 is not in these files). It is a comparison between regimes, not a forecast of P&L.
'use strict';
const fs = require('fs'), path = require('path');
const { coinRegime, marketRegime, MIN_CANDLES, STATES } = require('./regime.js');
const { backtest } = require('../bb-core-1h/lucidio-core.js');

const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA'];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null), r = (v, d = 3) => (v == null ? null : +v.toFixed(d));
const stat = (rs) => ({ n: rs.length, avg_r: r(mean(rs)), win_rate: rs.length ? r(rs.filter((x) => x > 0).length / rs.length) : null, total_r: r(rs.reduce((a, b) => a + b, 0), 1) });

function build(dir) {
  const rows = {};
  for (const c of COINS) rows[c] = JSON.parse(fs.readFileSync(path.join(dir, `${c}.json`), 'utf8'));
  const idx = {}; for (const c of COINS) idx[c] = new Map(rows[c].map((x, i) => [x[0], i]));
  const tagged = [], share = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const c of COINS) {
    const B = rows[c].map((x) => ({ time: x[0], open: x[1], high: x[2], low: x[3], close: x[4] }));
    const res = backtest(B, {}, null);
    for (const t of res.trades) {
      const sigIdx = t.i0 - 1;                                              // the signal candle: the entry is on the next open
      if (sigIdx + 1 < MIN_CANDLES) continue;
      const sig = coinRegime(rows[c].slice(0, sigIdx + 1)); if (!sig) continue;
      // the market around that moment: the other coins' candles up to the same time
      const byCoin = {}; for (const o of COINS) { const j = idx[o].get(rows[c][sigIdx][0]); if (j != null) byCoin[o] = rows[o].slice(0, j + 1); }
      const m = marketRegime(byCoin).market;
      tagged.push({ coin: c, t: t.t, dir: t.dir, R: t.R, why: t.why, state: sig.state, market: m ? m.market_state : null, bb_pos: sig.bb_pos });
    }
    // how much of the time each state lasted: sample once a day
    for (let i = MIN_CANDLES; i < rows[c].length; i += 24) { const g = coinRegime(rows[c].slice(0, i)); if (g) share[g.state]++; }
  }
  const total = Object.values(share).reduce((a, b) => a + b, 0);
  const by = (key, values) => Object.fromEntries(values.map((v) => [v, stat(tagged.filter((x) => x[key] === v).map((x) => x.R))]));
  const states = by('state', STATES);
  for (const s of STATES) states[s].time_share = total ? r(share[s] / total) : null;
  return { generated: new Date().toISOString().slice(0, 10), source: '1h BB-Core backtest on MEXC candles, five coins, since 2020; fixed fees + slippage, no funding', min_trades: 30,
    overall: stat(tagged.map((x) => x.R)), states, market_states: by('market', ['trending_up', 'trending_down', 'choppy', 'mixed']) };
}

if (require.main === module) {
  const dir = process.argv[2], out = process.argv[3];
  if (!dir) { console.error('usage: node regime-history.js <folder with the five coin files> [out.json]'); process.exit(2); }
  const t0 = Date.now(), res = build(dir);
  console.log(`${res.overall.n} trades in ${Math.round((Date.now() - t0) / 1000)} s · overall avg ${res.overall.avg_r}R, win ${res.overall.win_rate}`);
  for (const [k, v] of Object.entries(res.states)) console.log(`  ${k.padEnd(14)} ${String(v.n).padStart(5)} trades · avg ${String(v.avg_r).padStart(7)}R · win ${v.win_rate} · total ${String(v.total_r).padStart(7)}R · ${Math.round((v.time_share || 0) * 100)}% of the time`);
  for (const [k, v] of Object.entries(res.market_states)) console.log(`  market ${k.padEnd(14)} ${String(v.n).padStart(5)} trades · avg ${String(v.avg_r).padStart(7)}R · win ${v.win_rate}`);
  if (out) { fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log('written ' + out); }
}
module.exports = { build };
