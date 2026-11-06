#!/usr/bin/env node
// lab-report.js — what the BB-Trail paper lab has done so far, next to what its own backtest says to expect. Read-only: journal + state + the history in data/.
//   node lab-report.js            the report on screen
//   node lab-report.js --json     the same as JSON (for a script or a later analysis)
//
// Sections
//   1. results       trades, win rate, average R, total R, worst drop, longest losing streak, trades a month: the lab vs the 2020-2026 backtest of the same rules
//   2. trend capture how far trades ran in our favour (MFE) and against us (MAE), how much the 14-ATR trail gave back, how often the stop moved, how long trades lasted;
//                    "reached +3R" style rates vs the backtest. This strategy lives on a few long runs, so these are the numbers that tell early whether it works.
//   3. costs         fees, slippage (entry from the order book, exit from the recorder or the book), funding, per trade in R: the real-world drag the backtest only estimates
//   4. per coin and side, open trades (with the stop locked in R), skipped signals by reason
// A paper record of a few dozen trades says little about a strategy that wins 21% of the time: the report says how many trades it has, and the backtest needed 613.
'use strict';
const fs = require('fs'), path = require('path');
const core = require('./icore-core.js'), journal = require('./journal.js');
const STATE = path.join(process.env.ICORE_STATE_DIR || path.join(__dirname, 'state'), 'state.json');
const asJson = process.argv.includes('--json');
const sum = (a) => a.reduce((x, y) => x + y, 0), mean = (a) => (a.length ? sum(a) / a.length : null), med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? '—' : (v > 0 ? '+' : '') + v.toFixed(d));
const pct = (v) => (v == null ? '—' : (v * 100).toFixed(0) + '%');

// ---- the backtest's own picture of the same rules (data/ history, frictionless entries, flat costs) ----
function expected() {
  const all = [];
  for (const coin of ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA']) {
    const fpath = path.join(__dirname, 'data', coin + '.json'); if (!fs.existsSync(fpath)) continue;
    const B = JSON.parse(fs.readFileSync(fpath, 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }));
    for (const t of core.backtest(B).trades) all.push({ ...t, coin });
  }
  if (!all.length) return null;
  all.sort((a, b) => a.tExit - b.tExit);
  return summarize(all.map((t) => ({ R: t.R, mfe: t.mfeR, mae: t.maeR, bars: t.bars, tExit: t.tExit, t0: t.t })), (all[all.length - 1].tExit - all[0].t) / 86400 / 30.44);
}
function summarize(tr, months) {
  const R = tr.map((t) => t.R), n = tr.length;
  let eq = 0, pk = 0, dd = 0, st = 0, longest = 0;
  for (const r of R) { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); if (r <= 0) longest = Math.max(longest, ++st); else st = 0; }
  const mfe = tr.map((t) => t.mfe).filter((v) => v != null), mae = tr.map((t) => t.mae).filter((v) => v != null);
  const reach = (k) => (mfe.length ? mfe.filter((v) => v >= k).length / mfe.length : null);
  return { trades: n, win_rate: n ? R.filter((r) => r > 0).length / n : null, avg_r: mean(R), median_r: med(R), total_r: eq, max_dd_r: dd, longest_losing: longest, trades_per_month: months > 0 ? n / months : null,
    best_r: n ? Math.max(...R) : null, mfe_median: med(mfe), mae_median: med(mae), reached_1r: reach(1), reached_3r: reach(3), reached_5r: reach(5), reached_10r: reach(10),
    gave_back_median: med(tr.filter((t) => t.mfe != null).map((t) => t.mfe - t.R)), bars_median: med(tr.map((t) => t.bars).filter((v) => v != null)) };
}

const { events, bad } = journal.readAll();
const entries = new Map(events.filter((e) => e.type === 'entry').map((e) => [e.trade_id, e]));
const exits = events.filter((e) => e.type === 'exit').sort((a, b) => a.ts_ms - b.ts_ms);
const skips = events.filter((e) => e.type === 'skip');
const firstSeen = events.length ? Math.min(...events.map((e) => e.ts_ms)) : null;
const trades = exits.map((x) => {
  const en = entries.get(x.trade_id) || {}, ex = x.excursion || {}, c = x.costs || {};
  return { id: x.trade_id, symbol: x.symbol, side: x.side, entry_ms: en.ts_ms ?? null, exit_ms: x.ts_ms, R: x.r_result, usd: x.usd_pnl, why: x.exit_reason, mfe: ex.mfe_r ?? null, mae: ex.mae_r ?? null, gave_back: ex.gave_back_r ?? null,
    trail_moves: ex.trail_moves ?? null, bars: ex.bars ?? null, fees_r: c.fees_r ?? null, funding_r: c.funding_r ?? null, slip_bp: c.slippage_pct != null ? c.slippage_pct * 100 : null, entry_slip_bp: en.costs ? en.costs.entry_slip_bp ?? null : null,
    exit_slip_source: c.exit_slip_source ?? null, degraded: c.degraded || (en.costs && en.costs.degraded) || null, tExit: x.ts_ms / 1000 };
});
const months = firstSeen ? Math.max(1 / 30, (Date.now() - firstSeen) / 86400000 / 30.44) : 0;
const lab = summarize(trades, months), exp = expected();
let state = null; try { state = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
const open = state ? Object.entries(state.coins || {}).filter(([, c]) => c.pos).map(([coin, c]) => { const p = c.pos, oneR = Math.abs(p.entry - (p.stop0 ?? p.stop)); return { coin, side: p.dir === 1 ? 'LONG' : 'SHORT', since: new Date(p.t0 * 1000).toISOString().slice(0, 16), entry: p.entry, stop: p.stop, stop_locked_r: oneR > 0 ? p.dir * (p.stop - p.entry) / oneR : null, best_r: oneR > 0 ? p.dir * ((p.ext ?? p.entry) - p.entry) / oneR : null, trail_moves: p.trailMoves || 0 }; }) : [];
const groupBy = (k) => Object.entries(trades.reduce((m, t) => ((m[t[k]] = m[t[k]] || []).push(t), m), {})).map(([g, a]) => ({ [k]: g, trades: a.length, total_r: sum(a.map((t) => t.R)), win_rate: a.filter((t) => t.R > 0).length / a.length }));
const costs = { fees_r: mean(trades.map((t) => t.fees_r).filter((v) => v != null)), funding_r: mean(trades.map((t) => t.funding_r).filter((v) => v != null)), slippage_bp: mean(trades.map((t) => t.slip_bp).filter((v) => v != null)), entry_slip_bp: mean(trades.map((t) => t.entry_slip_bp).filter((v) => v != null)), degraded_trades: trades.filter((t) => t.degraded).length };
const skipCounts = skips.reduce((m, s) => ((m[s.reason] = (m[s.reason] || 0) + 1), m), {});
const out = { generated_at: new Date().toISOString(), strategy: core.STRATEGY, journal_events: events.length, unreadable_lines: bad, watching_since: firstSeen ? new Date(firstSeen).toISOString() : null, months_watched: months, lab, expected: exp, costs, per_coin: groupBy('symbol'), per_side: groupBy('side'), open, skips: skipCounts, trades };

if (asJson) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
const L = [];
L.push(`BB-Trail paper lab · ${core.STRATEGY}`);
L.push(`watching since ${out.watching_since ? out.watching_since.slice(0, 16).replace('T', ' ') + 'Z' : '— (no journal yet)'} · ${months.toFixed(1)} months · ${trades.length} closed trade(s), ${open.length} open · journal ${events.length} events${bad ? `, ${bad} unreadable` : ''}`);
L.push('');
L.push('1. RESULTS                     lab        backtest 2020-2026 (same rules)');
const row = (name, a, b) => L.push(`   ${name.padEnd(26)} ${String(a).padEnd(10)} ${b}`);
row('trades', lab.trades, exp ? exp.trades : '—'); row('trades a month', f(lab.trades_per_month, 1).replace('+', ''), exp ? exp.trades_per_month.toFixed(1) : '—');
row('win rate', pct(lab.win_rate), exp ? pct(exp.win_rate) : '—'); row('average R', f(lab.avg_r), exp ? f(exp.avg_r) : '—'); row('median R', f(lab.median_r), exp ? f(exp.median_r) : '—');
row('total R', f(lab.total_r, 1), exp ? f(exp.total_r, 1) : '—'); row('worst drop (R)', lab.max_dd_r.toFixed(1), exp ? exp.max_dd_r.toFixed(1) : '—'); row('longest losing streak', lab.longest_losing, exp ? exp.longest_losing : '—'); row('best trade', f(lab.best_r, 1), exp ? f(exp.best_r, 1) : '—');
L.push('');
L.push('2. TREND CAPTURE (R of the initial risk)');
row('best price reached, median', f(lab.mfe_median), exp ? f(exp.mfe_median) : '—'); row('worst price, median', f(lab.mae_median), exp ? f(exp.mae_median) : '—');
row('reached +1R / +3R', `${pct(lab.reached_1r)} / ${pct(lab.reached_3r)}`, exp ? `${pct(exp.reached_1r)} / ${pct(exp.reached_3r)}` : '—'); row('reached +5R / +10R', `${pct(lab.reached_5r)} / ${pct(lab.reached_10r)}`, exp ? `${pct(exp.reached_5r)} / ${pct(exp.reached_10r)}` : '—');
row('given back to the trail, median', f(lab.gave_back_median), exp ? f(exp.gave_back_median) : '—'); row('candles held, median', lab.bars_median ?? '—', exp ? exp.bars_median : '—');
L.push('');
L.push('3. REAL-WORLD COSTS per trade (realistic paper; the backtest assumes 0.05% fee + 0.02% slippage per side and flat funding)');
L.push(`   fees ${f(costs.fees_r, 3)}R · funding ${f(costs.funding_r, 3)}R · slippage ${costs.slippage_bp == null ? '—' : costs.slippage_bp.toFixed(1)} bp in+out (entry ${costs.entry_slip_bp == null ? '—' : costs.entry_slip_bp.toFixed(1)} bp from the book) · trades with a fallback cost model: ${costs.degraded_trades}`);
L.push('');
L.push('4. PER COIN / SIDE');
for (const g of out.per_coin) L.push(`   ${g.symbol.padEnd(10)} ${String(g.trades).padStart(3)} trades  ${f(g.total_r, 1).padStart(7)}R  win ${pct(g.win_rate)}`);
for (const g of out.per_side) L.push(`   ${g.side.padEnd(10)} ${String(g.trades).padStart(3)} trades  ${f(g.total_r, 1).padStart(7)}R  win ${pct(g.win_rate)}`);
L.push(`   open: ${open.length ? open.map((o) => `${o.coin} ${o.side} since ${o.since} (best ${f(o.best_r, 1)}R, stop locks ${f(o.stop_locked_r, 1)}R, ${o.trail_moves} moves)`).join(' · ') : 'none'}`);
L.push(`   skipped signals: ${Object.keys(skipCounts).length ? Object.entries(skipCounts).map(([k, v]) => `${k} ${v}`).join(', ') : 'none'}`);
L.push('');
L.push(trades.length < 100 ? `Too early to judge: ${trades.length} trades. The edge comes from a few long runs (backtest: 21% winners, the median trade loses 1R); compare the trend-capture rates first, the totals after ~100 trades.` : 'Enough trades to compare totals with the backtest.');
L.push('Does each trade match this bot\'s own backtest on the same candles?   node compare-live-vs-backtest.js');
console.log(L.join('\n'));
