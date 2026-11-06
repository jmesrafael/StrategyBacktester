// trail-lab-test.js — the BB-Trail lab end to end: a real SOL trend trade from the history, run candle by candle through the bot (processCoin) with the
// REALISTIC paper executor against a fake MEXC (contract, order book, funding history; no network, no keys). Checks: entry and exit on the backtest's candles,
// the trailing stop moved, real-cost R close to the backtest R, the journal records the modelled costs and the research numbers (MFE / MAE / trail moves).
//   node test/trail-lab-test.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bbtrail-'));
process.env.ICORE_STATE_DIR = TMP; process.env.ICORE_NO_NOTIFY = '1';
delete process.env.DASHBOARD_URL; delete process.env.DASHBOARD_PUSH_SECRET;
const H = require('./helpers.js'), core = require('../icore-core.js'), bot = require('../icore.js'), mexc = require('../mexc.js'), journal = require('../journal.js');
let pass = 0, failN = 0;
const f2 = (v) => (v == null ? '—' : v.toFixed(2));
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };

(async () => {
  ok(bot.liveAllowed() === false, 'live is locked off in the lab');
  ok(bot.CFG.mode === 'paper' && bot.CFG.realisticPaper === true, 'bot-config.json: paper mode with realistic costs');
  ok(core.DEFAULTS.kTrail === 14 && core.DEFAULTS.kInit === 2 && core.DEFAULTS.bbLen === 20 && core.DEFAULTS.trendLen === 200, 'strategy settings: 2 ATR stop, 14 ATR trail, Bollinger 20, SMA 200');

  const all = H.load('SOL'), ref = core.backtest(all, { cost: core.FREE }).trades;
  // a long winning trend trade well inside the data (room for the 500-candle window)
  const t = ref.find((x) => x.R > 5 && x.i0 > 900 && x.i1 + 3 < all.length);
  ok(!!t, `found a long SOL trend trade in the history (${t && `${t.dir === 1 ? 'LONG' : 'SHORT'} ${new Date(t.t * 1000).toISOString().slice(0, 10)}, ${t.bars} candles, ${t.R.toFixed(1)}R`})`);

  // fake MEXC: 1 contract = 0.1 SOL, taker 0.02%, a tight book around the price, one positive funding settlement every 8 hours
  let px = 0;
  const book = () => ({ bids: [[px * 0.9998, 5000, 1], [px * 0.999, 50000, 1]], asks: [[px * 1.0002, 5000, 1], [px * 1.001, 50000, 1]] });
  const fund = []; for (let s = t.t - 86400; s < t.tExit + 86400; s += 28800) fund.push({ settleTime: s * 1000, fundingRate: 0.0001 });
  Object.assign(mexc.client, {
    contract: async (s) => ({ symbol: s, state: 0, apiAllowed: true, contractSize: 0.1, minVol: 1, volUnit: 1, maxVol: 1e7, priceUnit: 0.001, maxLeverage: 200, takerFeeRate: 0.0002, makerFeeRate: 0, maintenanceMarginRate: 0.005 }),
    depth: async () => book(), fundingHistory: async () => ({ resultList: fund.slice().reverse() }),
  });
  const exec = bot.getRealPaper(), st = { lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] }, acct = { balance: 1000, peakBalance: 1000 }, hooks = bot.makeHooks();
  let moves = 0, entered = null;
  const realNow = Date.now; let fakeMs = 0; Date.now = () => fakeMs || realNow();   // realpaper times the entry and the funding window with the clock
  try {
    for (let k = t.i0 - 2; k <= t.i1 + 1 && st.n === 0; k++) {
      const B = all.slice(k - 499, k + 1).concat([H.forming(all[k + 1])]);
      px = all[k + 1].open; fakeMs = (all[k + 1].time + 3) * 1000;
      const ev = await bot.processCoin('SOL', B, st, exec, { acct, now: all[k + 1].time + 3, nowPx: px, hooks, save: () => {} });
      moves += ev.filter((e) => e.startsWith('TRAIL')).length;
      if (!entered && st.pos) entered = { k, pos: { ...st.pos } };
    }
  } finally { Date.now = realNow; }
  const x = st.trades[0];
  ok(entered && all[entered.k + 1].time === t.t, `entry on the backtest's candle (${entered && new Date(all[entered.k + 1].time * 1000).toISOString().slice(0, 16)})`);
  ok(entered && entered.pos.vol > 0 && Number.isInteger(entered.pos.vol) && entered.pos.fees && entered.pos.fees.taker === 0.0002 && /book/.test(entered.pos.entrySlipSource), `realistic entry: ${entered && entered.pos.vol} whole contracts, MEXC taker fee, filled by walking the order book (${entered && entered.pos.entrySlipSource})`);
  ok(moves > 3, `the trailing stop moved ${moves} times during the trade`);
  ok(x && x.why === 'stop' && x.tExit === t.tExit, `exit on the backtest's candle by the trailing stop (${x && x.why})`);
  ok(x && Math.abs(x.R - t.R) < 0.06 * Math.abs(t.R) + 0.1, `R with real costs ${x && x.R.toFixed(2)} vs frictionless backtest ${t.R.toFixed(2)} (costs and funding take a little)`);

  const J = journal.readAll().events, en = J.find((e) => e.type === 'entry'), ex = J.find((e) => e.type === 'exit');
  ok(en && en.costs && en.costs.kind === 'modelled (paper)' && en.costs.fee_taker === 0.0002 && en.costs.entry_slip_bp > 0 && en.costs.contracts === entered.pos.vol, 'journal entry: modelled costs (fee, slippage from the book, contracts)');
  ok(en && en.indicators && en.indicators.bb_upper > en.indicators.bb_lower && en.indicators.dist_mid_atr >= 0.3 && en.trail_atr === 14, 'journal entry: the Bollinger numbers behind the decision, trail 14 ATR');
  ok(ex && ex.costs && ex.costs.kind === 'modelled (paper)' && ex.costs.funding_events > 0 && ex.costs.funding_source === 'MEXC settled history', `journal exit: real funding counted (${ex && ex.costs.funding_events} settlements, ${ex && ex.costs.funding_r.toFixed(4)}R)`);
  const e = ex && ex.excursion;
  ok(e && e.mfe_r > e.result_r && e.mae_r <= 0.05 && e.trail_moves === moves && e.bars === t.bars && e.gave_back_r > 0 && e.stop_at_exit_r > 0,
    `journal exit: research numbers (best ${e && e.mfe_r.toFixed(2)}R, worst ${e && e.mae_r.toFixed(2)}R, gave back ${e && e.gave_back_r.toFixed(2)}R to the trail, stop locked ${e && e.stop_at_exit_r.toFixed(2)}R, ${e && e.trail_moves} moves, ${e && e.bars} candles)`);
  // the lab report reads that journal: one closed trade with its research numbers and modelled costs
  const rep = JSON.parse(require('child_process').execFileSync(process.execPath, [path.join(__dirname, '..', 'lab-report.js'), '--json'], { env: { ...process.env, ICORE_STATE_DIR: TMP } }).toString());
  const rt = rep.trades[0];
  ok(rep.lab.trades === 1 && rt && Math.abs(rt.R - x.R) < 1e-9 && rt.mfe === e.mfe_r && rt.trail_moves === moves && rt.funding_r < 0 && rt.fees_r > 0 && rep.expected && rep.expected.trades > 500,
    `lab-report.js reads it: 1 trade ${rt && f2(rt.R)}R, best ${rt && f2(rt.mfe)}R, fees ${rt && rt.fees_r.toFixed(4)}R, funding ${rt && rt.funding_r.toFixed(4)}R, next to the backtest's ${rep.expected && rep.expected.trades} trades`);
  console.log(`\n${pass} passed, ${failN} failed`);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exitCode = failN ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
