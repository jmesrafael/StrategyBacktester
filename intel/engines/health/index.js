// engines/health - strategy health: live against backtest. INFORMATION ONLY, nothing here reaches a bot.
//
// 1. Parity: does the backtest (the bot's current rules, the bot's own cost model, Binance candles) make the same entries
//    as the live bot did? Live-only and backtest-only entries are listed, with the bot's own reason when it skipped a signal.
// 2. Edge decay: the live result so far (closed + open at the last price) against what the backtest gave for trades
//    entered in windows of the SAME length. Reported as a percentile. An alert fires below the configured percentile.
//    Caveat: trades still open are valued at today's price, backtest trades are final, so a young window reads low.
// 3. Losing run: the live run of losses in a row against the longest run in the backtest.
// 4. Execution: entry slippage and stop overshoot from the execution engine, when it has been built.
// Outputs: dataset "derived/health" (parity.csv, decay.csv, daily.json) and reports/health.md.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const E = require('../backtest/engine'), S = require('../backtest/strategies'), J = require('../journal');
const { D } = U, H4 = 14400;

const PARITY = { bot: 'string', coin: 'string', kind: 'string', entry_s: 'int', side: 'string', live_r: 'number?', bt_r: 'number?', detail: 'string?' };
const DECAY = { bot: 'string', window_days: 'int', live_total_r: 'number', live_closed_r: 'number', n_live: 'int', bt_windows: 'int', bt_median_r: 'number', bt_p5: 'number', bt_p95: 'number', percentile: 'number', alert: 'bool' };

function parity(asOf) {
  const wallets = spine.load('trades', 'wallets.csv'), trades = spine.load('trades', 'trades.csv').filter((t) => t.mode === 'live'), sig = spine.load('trades', 'signals.csv').filter((s) => s.mode === 'live'), rows = [], stat = {};
  for (const [bot, def] of Object.entries(cfg.bots)) {
    const live = trades.filter((t) => t.bot === bot); if (!live.length) continue;
    const botStart = Math.min(...wallets.filter((w) => w.wallet === bot).map((w) => w.t).concat(live.map((t) => t.entry_s))), start = Math.min(...live.map((t) => t.entry_s)) - H4, liveBy = new Map(live.map((t) => [t.coin + '|' + Math.floor(t.entry_s / H4) * H4, t]));
    const btAll = [];
    for (const coin of def.coins) { if (!M.has(coin, '4h')) continue;
      // cold start: the live bot began with no position, so the backtest starts its warm-up so that its first signal is at the live start of this coin
      const cs = Math.max(botStart, cfg.coinStart[coin] ? Date.parse(cfg.coinStart[coin]) / 1000 : 0), warm = S.bot(def.strategy).warmup, B = M.candles(coin, '4h', { from: cs - warm * H4, to: asOf }), F = M.has(coin, 'funding') ? M.bars(coin, 'funding') : null, cost = def.strategy === 'bbcore' ? E.bbNativeCost(undefined, F) : E.icNativeCost(), r = S.liveRules(def.strategy, B, cost);
      for (const t of r.trades.concat(r.open ? [{ ...r.open, R: null, open: true }] : [])) if (t.t >= cs - H4) btAll.push({ coin, t });
    }
    let matched = 0, liveOnly = 0, btOnly = 0, rd = []; const seen = new Set();
    for (const { coin, t } of btAll) { const k = coin + '|' + t.t, l = liveBy.get(k); seen.add(k);
      if (l) { matched++; if (l.status === 'closed' && t.R != null) { rd.push(l.r - t.R); rows.push({ bot, coin, kind: 'matched', entry_s: l.entry_s, side: l.side, live_r: U.round(l.r, 3), bt_r: U.round(t.R, 3), detail: null }); } }
      else { const why = sig.find((s) => s.bot === bot && s.symbol === coin + '_USDT' && s.signal_candle_s === t.sigT); btOnly++;
        rows.push({ bot, coin, kind: 'backtest_only', entry_s: t.t, side: t.dir === 1 ? 'LONG' : 'SHORT', live_r: null, bt_r: t.R == null ? null : U.round(t.R, 3), detail: why ? `bot skipped: ${why.decision}${why.reason ? ' (' + why.reason + ')' : ''}` : 'no skip recorded by the bot' }); } }
    for (const [k, l] of liveBy) if (!seen.has(k)) { liveOnly++; rows.push({ bot, coin: l.coin, kind: 'live_only', entry_s: l.entry_s, side: l.side, live_r: l.r == null ? null : U.round(l.r, 3), bt_r: null, detail: 'the backtest has no entry on this candle' }); }
    stat[bot] = { live: live.length, matched, live_only: liveOnly, backtest_only: btOnly, mean_r_diff: rd.length ? U.round(U.mean(rd), 3) : null, max_abs_r_diff: rd.length ? U.round(Math.max(...rd.map(Math.abs)), 3) : null, closed_compared: rd.length };
  }
  return { rows, stat };
}

function decay(asOf) {
  const live = spine.load('trades', 'trades.csv').filter((t) => t.mode === 'live'), ref = spine.load('derived/reference-trades', 'trades.csv').filter((t) => t.version === 'v3' && t.cost === 'standard'), out = [], streaks = {};
  for (const bot of [...Object.keys(cfg.bots), 'ALL']) {
    const lt = live.filter((t) => bot === 'ALL' || t.bot === bot); if (!lt.length) continue;
    const bt = ref.filter((t) => bot === 'ALL' || t.bot === bot).sort((a, b) => a.t - b.t), start = Math.floor(Math.min(...lt.map((t) => t.entry_s)) / D) * D, len = Math.ceil((asOf - start) / D);
    const liveTotal = U.sum(lt.map((t) => J.rAt(t, asOf))), liveClosed = U.sum(lt.filter((t) => t.status === 'closed').map((t) => t.r));
    const first = Math.max(bt[0].t, Date.UTC(2021, 0, 1) / 1000), wins = []; for (let s = first; s + len * D <= bt[bt.length - 1].t; s += D) wins.push(U.sum(bt.filter((t) => t.t >= s && t.t < s + len * D).map((t) => t.r)));
    wins.sort((a, b) => a - b); const below = wins.filter((w) => w < liveTotal).length, pct = wins.length ? (below / wins.length) * 100 : null;
    out.push({ bot, window_days: len, live_total_r: U.round(liveTotal, 2), live_closed_r: U.round(liveClosed, 2), n_live: lt.length, bt_windows: wins.length, bt_median_r: U.round(U.quantile(wins, 0.5), 2), bt_p5: U.round(U.quantile(wins, 0.05), 2), bt_p95: U.round(U.quantile(wins, 0.95), 2), percentile: U.round(pct, 1), alert: pct != null && pct < cfg.health.alertPercentile });
    // losing run: live closed trades in exit order vs the longest run in the backtest
    const cl = lt.filter((t) => t.status === 'closed').sort((a, b) => a.exit_s - b.exit_s); let cur = 0; for (let i = cl.length - 1; i >= 0 && cl[i].r <= 0; i--) cur++;
    let mx = 0, run = 0; for (const t of bt.sort((a, b) => a.t_exit - b.t_exit)) { if (t.r <= 0) { run++; mx = Math.max(mx, run); } else run = 0; }
    streaks[bot] = { live_current_losing_run: cur, backtest_longest_losing_run: mx, share: U.round(cur / mx, 2) };
  }
  return { rows: out, streaks };
}

function run(opts = {}) {
  const asOf = opts.asOf || M.lastClose('BTC'), p = parity(asOf), d = decay(asOf);
  let exec = null; try { exec = { quality: spine.load('derived/execution', 'entry_quality.csv'), stops: spine.load('derived/execution', 'stop_quality.csv') }; } catch (e) { /* execution engine not built */ }
  const alerts = [];
  for (const x of d.rows) if (x.alert) alerts.push(`${x.bot}: live result is in the lowest ${cfg.health.alertPercentile}% of backtest windows of ${x.window_days} days (percentile ${x.percentile})`);
  for (const [b, s] of Object.entries(d.streaks)) if (s.share >= 0.7) alerts.push(`${b}: ${s.live_current_losing_run} losses in a row, the backtest's longest run is ${s.backtest_longest_losing_run}`);
  for (const [b, s] of Object.entries(p.stat)) if (s.live_only > 0 || (s.max_abs_r_diff != null && s.max_abs_r_diff > 0.15)) alerts.push(`${b}: parity: ${s.live_only} live-only entries, largest R difference ${s.max_abs_r_diff}`);
  const m = spine.write('derived/health', { generator: 'engines/health', inputs: [spine.ref('trades'), spine.ref('market'), spine.ref('derived/reference-trades')],
    checks: [{ name: 'health built', ok: d.rows.length > 0, detail: `${d.rows.length} decay rows, ${p.rows.length} parity rows` }], notes: ['information only: no output of this engine is read by any bot'],
    files: { 'parity.csv': { rows: p.rows, schema: PARITY }, 'decay.csv': { rows: d.rows, schema: DECAY }, 'daily.json': { json: { as_of: asOf, parity: p.stat, losing_runs: d.streaks, alerts } } } });
  const L = ['# Strategy health (information only)', '', `As of ${U.iso(asOf)} UTC. Live bots against their own backtests.`, '', `## Alerts (${alerts.length})`, '', alerts.length ? alerts.map((a) => '- ' + a).join('\n') : 'None.', '',
    '## 1. Does the backtest make the same entries as the live bot?', '', U.mdTable(Object.entries(p.stat), [['Bot', (x) => x[0]], ['Live entries', (x) => x[1].live], ['Matched', (x) => x[1].matched], ['Live only', (x) => x[1].live_only], ['Backtest only', (x) => x[1].backtest_only], ['Closed compared', (x) => x[1].closed_compared], ['Mean R difference', (x) => x[1].mean_r_diff], ['Largest R difference', (x) => x[1].max_abs_r_diff]]), '',
    'Backtest-only entries are signals the backtest took and the bot did not. The bot\'s own reason is in parity.csv (for example another position open on the coin, or a refused entry).', '',
    U.mdTable(p.rows.filter((r) => r.kind !== 'matched'), [['Bot', (r) => r.bot], ['Coin', (r) => r.coin], ['Kind', (r) => r.kind], ['Entry (UTC)', (r) => U.iso(r.entry_s)], ['Side', (r) => r.side], ['Backtest R', (r) => r.bt_r], ['Detail', (r) => r.detail]]), '',
    '## 2. Live result against backtest windows of the same length', '', U.mdTable(d.rows, [['Bot', (r) => r.bot], ['Window', (r) => r.window_days + ' days'], ['Live trades', (r) => r.n_live], ['Live R (closed + open)', (r) => U.signed(r.live_total_r)], ['Live R (closed only)', (r) => U.signed(r.live_closed_r)], ['Backtest median', (r) => U.signed(r.bt_median_r)], ['Backtest 5% to 95%', (r) => `${U.signed(r.bt_p5)} to ${U.signed(r.bt_p95)}`], ['Percentile', (r) => r.percentile], ['Alert', (r) => (r.alert ? 'YES' : 'no')]]), '',
    'Percentile = share of backtest windows (same length, since 2021) that did worse than the live result. Open trades are valued at today\'s price; they may still change.', '',
    '## 3. Losing run', '', U.mdTable(Object.entries(d.streaks), [['Bot', (x) => x[0]], ['Live losses in a row now', (x) => x[1].live_current_losing_run], ['Backtest longest run', (x) => x[1].backtest_longest_losing_run]]), ''];
  if (exec) L.push('## 4. Execution', '', U.mdTable(exec.quality.filter((r) => !r.coin || r.coin === 'ALL' || r.coin === '*'), [['Bot', (r) => r.bot], ['n', (r) => r.n], ['Median slippage R', (r) => r.median_slip_r], ['Worst', (r) => r.worst_slip_r]]), '', 'Full tables: reports/execution.md.', '');
  L.push('## Limits', '', '- A few weeks of live trades cannot show a decay. Read the percentile as "not unusual yet" or "unusual", not as proof.', '- Parity uses Binance candles; the bots trade on MEXC, so a small difference at a threshold can change a signal.');
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'health.md'), L.join('\n') + '\n');
  return m;
}
module.exports = { parity, decay, run };
if (require.main === module) { const m = run(); console.log('health:', m.status, '-> reports/health.md'); }
