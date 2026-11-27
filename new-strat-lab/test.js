// test.js — do the paper bots trade what was researched?   node test.js   (builds both first; exit code 1 on any failure)
//   A. the bot's strategy file takes the same entries as the research engine (same candles, no costs)
//   B. the bot's own loop (replay) gives its strategy file's trades, trade for trade
//   C. the safety locks are really in the built copies
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { BOTS, COINS, build } = require('./build.js');
const L4 = require('../research/hunt-4h-nov26/lib.js'), F4 = require('../research/hunt-4h-nov26/fam.js');
const L1 = require('../research/hunt-1h-nov26/lib.js'), FV = require('../research/hunt-1h-nov26/fam-vol.js');
const { run } = require('../research/strat-hunt-nov6/engine.js');
let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++; };
const NOCOST = { fee: 0, slip: 0 };
const TAGS = { wide: 'bbw', ichi: 'ichix' };   // the dashboard tag of each lab bot

const outs = Object.fromEntries(Object.keys(BOTS).map((k) => [k, build(k)]));
const ICHI = { fam: 'ichi', p: { t: 9, k: 26, s: 52, mode: 'cross' }, trend: 0, exit: { k: 2, bars: 12 } };
const WIDE = [{ len: 80, mult: 2.6, trend: 800, minStop: 0.3, filt: null }, { kind: 'M', bars: 192 }];
const RESEARCH = {
  ichi: { lib: L4, strat: (x) => F4.build(x, ICHI), ex: F4.exOf(ICHI), iv: 14400, bt: (core, B) => core.backtest(B, { cost: core.FREE }).trades },
  wide: { lib: L1, strat: FV.strat(...WIDE), ex: FV.mkEx(WIDE[1]), iv: 3600, bt: (core, B) => core.backtest(B, { cost: core.FREE }).trades },
};

console.log('\nA. strategy file against the research engine (Binance candles from 2020, no fees, slippage or funding)');
for (const [key, r] of Object.entries(RESEARCH)) {
  const core = require(path.join(outs[key], BOTS[key].core));
  for (const coin of COINS) {
    const x = r.lib.coin(coin), a = run(x.B, x.atr14, r.strat(x), r.ex, null, r.iv, NOCOST).trades, b = r.bt(core, x.B);
    const keyOf = (t) => `${t.t}|${t.dir}`, A = new Map(a.map((t) => [keyOf(t), t])), B = new Map(b.map((t) => [keyOf(t), t]));
    const same = [...A.keys()].filter((k) => B.has(k)), onlyA = a.length - same.length, onlyB = b.length - same.length;
    const gap = same.reduce((s, k) => s + Math.abs(A.get(k).R - B.get(k).R), 0), sumA = a.reduce((s, t) => s + t.R, 0), sumB = b.reduce((s, t) => s + t.R, 0);
    // the last trades of a series may differ by the one candle each engine leaves undecided
    ok(onlyA <= 1 && onlyB <= 1 && Math.abs(sumA - sumB) < Math.max(1.5, 0.01 * Math.abs(sumA)),
      `${key} ${coin}: research ${a.length} trades ${sumA.toFixed(1)}R · bot ${b.length} trades ${sumB.toFixed(1)}R · only research ${onlyA}, only bot ${onlyB}, R difference on shared trades ${gap.toFixed(2)}`);
  }
}

console.log('\nB. the bot loop against its strategy file (replay)');
for (const [key, b] of Object.entries(BOTS)) {
  let text = '';
  try { text = cp.execFileSync(process.execPath, [b.main, 'replay', COINS.join(',')], { cwd: outs[key], encoding: 'utf8', maxBuffer: 1 << 28, env: { ...process.env, LUCIDIO_NO_NOTIFY: '1', ICORE_NO_NOTIFY: '1' } }); }
  catch (e) { text = String(e.stdout || '') + String(e.stderr || ''); }
  for (const coin of COINS) { const line = text.split('\n').find((l) => l.startsWith(coin + ':')) || ''; ok(line.includes('IDENTICAL trade-for-trade'), `${key} ${line || coin + ': no replay result'}`); }
  if (!text.includes('IDENTICAL')) console.log(text.slice(0, 2000));
}

console.log('\nC. locks in the built copies');
for (const [key, b] of Object.entries(BOTS)) {
  const read = (f) => fs.readFileSync(path.join(outs[key], f), 'utf8');
  ok(read(b.main).includes('const liveAllowed = () => false;'), `${key}: live trading is impossible`);
  process.env.DASHBOARD_BOT = 'bbcore'; process.env.DASHBOARD_ASK_POLL_SEC = '60';   // a wrong env file must change nothing
  const push = require(path.join(outs[key], 'dashboard-push.js')), tag = TAGS[key];
  const ev = [push.heartbeatEvent({ mode: 'paper', status: 'ok' }), ...push.fromJournal({ type: 'entry', mode: 'paper', symbol: 'ARB_USDT', side: 'LONG', ts_ms: Date.now(), event_id: 'paper:entry:ARB:1', trade_id: 't1', sl: 0.9, match_key: { signal_candle_open_ms: Date.now() }, entry: { fill_price: 1, intended_price: 1 }, position: { qty: 1, contracts: 1 }, risk: { risk_pct: 0.025, one_r_price: 0.1, risk_usd: 5, balance_used: 200 } })];
  ok(ev.length >= 2 && ev.every((e) => e.bot === tag && e.event_id.startsWith(tag + '|')), `${key}: every dashboard event is tagged ${tag} (${ev.length} checked, ARB included)`);
  process.env.DASHBOARD_URL = 'https://example.invalid'; process.env.DASHBOARD_PUSH_SECRET = 'x';
  ok(push.startAskPoll({ provider: () => ({}), busy: () => false }) === false, `${key}: never asks the dashboard for requests`);
  delete process.env.DASHBOARD_URL; delete process.env.DASHBOARD_PUSH_SECRET;
  ok(push.status().enabled === false, `${key}: pushes nothing until the dashboard address and secret are set`);
  delete process.env.DASHBOARD_BOT; delete process.env.DASHBOARD_ASK_POLL_SEC;
  ok((read('telegram.js').match(/new strategy lab: Telegram is disabled/g) || []).length === 2, `${key}: Telegram is disabled`);
  const cfg = JSON.parse(read('bot-config.json'));
  ok(cfg.mode === 'paper' && cfg.ledgerSync === false && cfg.ledgerWalletSync === false && cfg.realisticPaper === true && !cfg.sharedSizing, `${key}: paper, realistic costs, no ledger, no shared sizing`);
  ok(cfg.maxRiskUsd === 0 && cfg.startBalance === 200, `${key}: US$200 paper start, no US$ risk cap`);
}
console.log(`\n${fails ? fails + ' FAILED' : 'all checks passed'}`);
process.exit(fails ? 1 : 0);
