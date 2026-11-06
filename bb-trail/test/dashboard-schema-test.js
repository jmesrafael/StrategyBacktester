// dashboard-schema-test.js — the events this lab bot pushes pass the dashboard's OWN validation (ledger/lib/schema.js, next to this folder on the PC) with every
// research field kept: the bot tag, the trend-capture numbers of a closed trade, and the open trades' trailing stops on the heartbeat. Skipped when the ledger is not there.
'use strict';
const fs = require('fs'), path = require('path');
// the ledger repo is a sibling of the StrategyBacktester repo (D:\testing\Strat\ledger); the old location of this folder was next to it
const SCHEMA = [path.join(__dirname, '..', '..', '..', 'ledger', 'lib', 'schema.js'), path.join(__dirname, '..', '..', 'ledger', 'lib', 'schema.js')].find((p) => fs.existsSync(p)) || path.join(__dirname, '..', '..', '..', 'ledger', 'lib', 'schema.js');
if (!fs.existsSync(SCHEMA)) { console.log('dashboard-schema-test: ledger/lib/schema.js not found, skipped'); process.exit(0); }
const { validateBody } = require(SCHEMA), push = require('../dashboard-push.js');
let pass = 0, failN = 0;
const ok = (c, w) => { if (c) pass++; else failN++; console.log(`${c ? 'PASS' : 'FAIL'}  ${w}`); };
const now = 1.79e12;
const exitRec = { type: 'exit', event_id: '11111111-2222-3333-4444-555555555555', ts_ms: now, trade_id: 'SOL_USDT|LONG|1789000000000', symbol: 'SOL_USDT', side: 'LONG', mode: 'paper',
  match_key: { symbol: 'SOL_USDT', side: 'LONG', signal_candle_open_ms: 1789000000000 }, exit_price: 160, exit_reason: 'stop', exit_candle_open_ms: 1789100000000, r_result: 7.82, usd_pnl: 19.5, balance_after: 119.5, hold_sec: 4608000,
  entry_summary: { fill_price: 120, sl: 150, sl_initial: 115 }, costs: { kind: 'modelled (paper)', fees_pct: 0.04, fees_r: 0.005, slippage_pct: 0.031, funding_r: -0.1989 },
  excursion: { mfe_r: 33.14, mae_r: -0.51, gave_back_r: 25.32, stop_at_exit_r: 8.02, trail_moves: 18, bars: 320, one_r_price: 5 } };
const evs = push.fromJournal ? push.fromJournal(exitRec) : null;
const ex = (evs || []).find((e) => e.type === 'exit');
ok(!!ex && ex.bot === 'bbtr' && ex.event_id.startsWith('bbtr|'), 'a journal exit becomes a dashboard exit event tagged bbtr');
const hb = push.heartbeatEvent({ mode: 'paper', coins: ['SOL_USDT'], uptimeSec: 5, kill: false, trail: { SOL_USDT: { entry: 120, stop0: 115, stop: 150, best: 285.7, locked_r: 6, best_r: 33.14, moves: 18 } } }, now);
const r = validateBody({ events: [ex, hb].filter(Boolean) });
ok(r.ok, `the dashboard accepts both events${r.ok ? '' : ': ' + r.errors.join('; ')}`);
const sx = r.ok && r.events.find((e) => e.type === 'exit'), sh = r.ok && r.events.find((e) => e.type === 'heartbeat');
ok(sx && sx.data.bot === 'bbtr' && sx.data.mfe_r === 33.14 && sx.data.mae_r === -0.51 && sx.data.gave_back_r === 25.32 && sx.data.stop_at_exit_r === 8.02 && sx.data.trail_moves === 18 && sx.data.bars === 320 && sx.data.funding_r === -0.1989 && Math.abs(sx.data.slip_bp - 3.1) < 1e-9,
  'the stored exit keeps every trend-capture number (best / worst price, give-back, stop at exit, moves, candles, funding, slippage)');
ok(sh && sh.data.bot === 'bbtr' && sh.data.trail && sh.data.trail.SOL_USDT && sh.data.trail.SOL_USDT.stop === 150 && sh.data.trail.SOL_USDT.locked_r === 6, 'the stored heartbeat keeps the open trade\'s current trailing stop');
console.log(`\n${pass} passed, ${failN} failed`);
process.exitCode = failN ? 1 : 0;
