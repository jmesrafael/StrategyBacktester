// test/full-loop-parity.js - the strongest 1:1 check: the bot's live loop (one wake-up per 4h close, 500-candle view, paper fills at the candle open, journal hooks)
// stepped through the WHOLE stored history of every coin, then compare-live-vs-backtest.js against the backtest on the same candles. Every coin must be a MATCH.
//   node test/full-loop-parity.js [SOL,ZEC,...]      No network, no money (takes a minute or two: ~66,000 wake-ups).
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./helpers.js');
const STATE = H.tmp('fullloop');
process.env.ICORE_STATE_DIR = STATE; process.env.ICORE_NO_NOTIFY = '1'; process.env.ICORE_ENV_FILE = path.join(STATE, 'none.env');
for (const k of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'DASHBOARD_URL', 'DASHBOARD_PUSH_SECRET']) delete process.env[k];
const coins = (process.argv[2] || 'SOL,ZEC,NEAR,ADA,GALA').split(',');

(async () => {
  let bad = 0, totL = 0, totB = 0, totN = 0;
  for (const coin of coins) {
    process.env.ICORE_JOURNAL_DIR = path.join(STATE, coin);
    for (const k of Object.keys(require.cache)) if (/icore|journal|compare|dashboard-push|telegram/.test(k) && !/helpers/.test(k)) delete require.cache[k];
    const bot = require('../icore.js'), journal = require('../journal.js'), cmp = require('../compare-live-vs-backtest.js');
    require('../icore-core.js').RULES_V3_FROM = 0;   // rules v3 (Nov 13, 2026) for every candle: the path the bot runs from now on (set after the cache clear above)
    const all = H.load(coin), W = cmp.WARM + 1, END = all.length - 1;
    const st = { lastTime: null, pos: null, realizedR: 0, n: 0, trades: [] }, acct = { balance: 100, totalR: 0, peakR: -1e9 }, hooks = bot.makeHooks();
    hooks.session({ coins: [coin], note: 'full-history loop' });
    for (let idx = W + 1; idx <= END; idx++) { const v = H.viewAt(all, idx); await bot.processCoin(coin, v.B, st, bot.paper, { acct, now: v.now, nowPx: v.nowPx, hooks, save: () => {} }); }
    const open = new Map(); if (st.pos) open.set(journal.tradeId(`${coin}_USDT`, st.pos.dir, st.pos.sigTime), { stop: st.pos.stop, stop0: st.pos.stop0, entry: st.pos.entry, lastTime: st.lastTime });
    const r = cmp.buildReport({ events: journal.readAll().events, candles: { [`${coin}_USDT`]: all.slice(0, END) }, open, mode: 'paper', fromSec: all[W].time, now: all[END].time + 600 });
    if (!r.match) bad++;
    totL += r.totals.live_R_all; totB += r.totals.backtest_R_all; totN += r.counts.backtest_trades;
    console.log(`${coin}: ${r.match ? 'MATCH' : 'NOT A MATCH'} · ${r.counts.matched}/${r.counts.backtest_trades} trades matched · live ${r.totals.live_R_all.toFixed(2)}R vs backtest ${r.totals.backtest_R_all.toFixed(2)}R · ${r.counts.live_only} live-only, ${r.counts.backtest_only} backtest-only, ${r.counts.differs} differ · open stop: ${r.open_stops.map((s) => s.status).join(', ') || 'flat'}`);
    for (const i of r.investigation.slice(0, 5)) console.log(`   ${i.kind} ${i.side} ${i.signal_candle}: ${i.why}`);
  }
  console.log(`\nALL: ${totN} trades · live ${totL.toFixed(2)}R vs backtest ${totB.toFixed(2)}R · ${bad ? bad + ' coin(s) NOT A MATCH' : 'every coin MATCH'}`);
  process.exitCode = bad ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
