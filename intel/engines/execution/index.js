// engines/execution - how well do live orders get filled, what do they cost, and how much size can the coins take.
// Read-only and informational. It never suggests a change to any bot.
//
// Inputs (through the spine): trades, market, and (when available) mexc.
// Outputs: dataset "derived/execution" (entry_quality, stop_quality, costs, liquidity, capacity, book_capacity) and reports/execution.md.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../../lib/spine'), cfg = require('../../lib/config'), U = require('../../lib/util'), M = require('../../lib/market');
const { D } = U;

const Q = { n: 'int', median_slip_r: 'number?', mean_slip_r: 'number?', worst_slip_r: 'number?', median_delay_s: 'number?', p90_delay_s: 'number?', n_bp: 'int', median_slip_bp: 'number?', mean_slip_bp: 'number?' };
const ENTRY_QUALITY = { bot: 'string', coin: 'string', ...Q };
const STOP_QUALITY = { bot: 'string', n: 'int', median_overshoot_r: 'number?', p90_overshoot_r: 'number?', worst_overshoot_r: 'number?' };
const COSTS = { bot: 'string', n_closed: 'int', fees_usd: 'number', funding_usd: 'number', realized_usd: 'number', fees_share_of_gross: 'number?', n_cost_r: 'int', avg_cost_r: 'number?' };
const LIQUIDITY = { coin: 'string', n_bars_30d: 'int', n_bars_180d: 'int', median_usd_30d: 'number?', median_usd_180d: 'number?', ratio_30d_180d: 'number?', falling: 'bool', median_range_bp_30d: 'number?' };
const CAPACITY = { bot: 'string', coin: 'string', n_trades: 'int', n_sized: 'int', notional_usd: 'number?', median_hour_usd_30d: 'number?', participation: 'number?', max_notional_1pct_usd: 'number?', headroom_x: 'number?' };
const BOOK_CAPACITY = { coin: 'string', size_usd: 'number', n_days: 'int', roundtrip_bp: 'number?', stop_bp: 'number?', limit_bp: 'number?', ok: 'bool' };

// ---- pure helpers (plain arrays in, numbers out) ----
const nums = (a) => a.filter((v) => v != null && Number.isFinite(v));
const med = (a) => { const b = nums(a); return b.length ? U.median(b) : null; };
const q90 = (a) => { const b = nums(a); return b.length ? U.quantile(b, 0.9) : null; };
const avg = (a) => { const b = nums(a); return b.length ? U.mean(b) : null; };
// slippage in basis points of price: positive = paid more than intended (worse), for long and short
function slipBp(t) {
  if (t.intended_price == null || !(t.intended_price > 0) || t.entry_price == null) return null;
  return (t.entry_price - t.intended_price) / t.intended_price * 1e4 * t.dir;
}
// how much worse than the stop the exit was, in R. Positive = exit was beyond the stop.
function overshootR(t) {
  if (t.stop_price == null || t.exit_price == null || !(t.one_r > 0)) return null;
  return t.dir * (t.stop_price - t.exit_price) / t.one_r;
}
// does the trade still have its first stop at exit? bbcore always does; others only when stop_at_exit_r is null or near -1
const stopUnmoved = (t) => t.bot === 'bbcore' || t.stop_at_exit_r == null || Math.abs(t.stop_at_exit_r + 1) <= 0.05;
// cost of one trade in R: (fees + paid funding) / dollar value of 1R. Null when r_result is about 0 or data is missing.
function costR(c) {
  if (c.r_result == null || Math.abs(c.r_result) <= 0.05 || c.realized_usd == null || c.fees_usd == null) return null;
  const oneR = c.realized_usd / c.r_result;
  if (!oneR || !Number.isFinite(oneR)) return null;
  return (c.fees_usd + Math.min(c.funding_usd || 0, 0)) / oneR;
}
// liquidity from hourly bars [t, o, h, l, c, v]: asOf in unix seconds
function liquidityStats(bars, asOf) {
  const win = (days) => bars.filter((b) => b[0] >= asOf - days * D && b[0] < asOf);
  const b30 = win(30), b180 = win(180);
  const m30 = med(b30.map((b) => b[5] * b[4])), m180 = med(b180.map((b) => b[5] * b[4]));
  const ratio = liquidityRatio(m30, m180);
  return { n_bars_30d: b30.length, n_bars_180d: b180.length, median_usd_30d: m30, median_usd_180d: m180, ratio_30d_180d: ratio, falling: ratio != null && ratio < 0.6,
    median_range_bp_30d: med(b30.map((b) => (b[3] > 0 ? (b[2] / b[3] - 1) * 1e4 : null))) };
}
const liquidityRatio = (m30, m180) => (m30 == null || m180 == null || !(m180 > 0) ? null : m30 / m180);
// notional of a trade = risk_pct x equity x entry price / one_r
const notionalOf = (t, equity) => (t.risk_pct == null || equity == null || !(t.one_r > 0) ? null : t.risk_pct * equity * t.entry_price / t.one_r);
const participation = (notional, hourUsd) => (notional == null || !(hourUsd > 0) ? null : notional / hourUsd);
const maxNotional1pct = (hourUsd) => (hourUsd == null ? null : hourUsd * 0.01);
const headroom = (hourUsd, notional) => (hourUsd == null || !(notional > 0) ? null : maxNotional1pct(hourUsd) / notional);
// last snapshot at or before entry_s from a list sorted by t
function equityBefore(snaps, T) {
  let lo = 0, hi = snaps.length - 1, ans = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (snaps[m].t <= T) { ans = snaps[m]; lo = m + 1; } else hi = m - 1; }
  return ans ? ans.equity_usdt : null;
}
const group = (rows, key) => { const m = new Map(); for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
function entryStats(g) {
  const bp = nums(g.map(slipBp)), sl = nums(g.map((t) => t.entry_slippage_r));
  return { n: g.length, median_slip_r: U.round(med(sl)), mean_slip_r: U.round(avg(sl)), worst_slip_r: U.round(sl.length ? Math.min(...sl) : null), median_delay_s: U.round(med(g.map((t) => t.entry_delay_s)), 1),
    p90_delay_s: U.round(q90(g.map((t) => t.entry_delay_s)), 1), n_bp: bp.length, median_slip_bp: U.round(med(bp), 2), mean_slip_bp: U.round(avg(bp), 2) };
}

function build(opts = {}) {
  const asOf = opts.asOf || M.lastClose('BTC'), notes = [];
  const all = spine.load('trades', 'trades.csv'), live = all.filter((t) => t.mode === 'live' && t.entry_s <= asOf);
  const closedEx = spine.load('trades', 'exchange_closed.csv').filter((c) => c.closed_s <= asOf), wallets = spine.load('trades', 'wallets.csv');
  const bots = [...new Set(live.map((t) => t.bot))].sort();

  // A. entry quality
  const entry = [];
  for (const bot of bots) {
    const gb = live.filter((t) => t.bot === bot);
    entry.push({ bot, coin: 'ALL', ...entryStats(gb) });
    for (const [coin, g] of [...group(gb, (t) => t.coin)].sort()) entry.push({ bot, coin, ...entryStats(g) });
  }
  // B. stop quality
  const stop = bots.map((bot) => {
    const g = live.filter((t) => t.bot === bot && t.status === 'closed' && t.reason === 'stop' && stopUnmoved(t)), o = nums(g.map(overshootR));
    return { bot, n: o.length, median_overshoot_r: U.round(med(o)), p90_overshoot_r: U.round(q90(o)), worst_overshoot_r: U.round(o.length ? Math.max(...o) : null) };
  });
  // C. costs
  const costs = [...new Set(closedEx.map((c) => c.wallet))].sort().map((w) => {
    const g = closedEx.filter((c) => c.wallet === w), grossAbs = U.sum(g.map((c) => Math.abs(c.realized_usd))), cr = nums(g.map(costR)), fees = U.sum(g.map((c) => c.fees_usd || 0));
    return { bot: w, n_closed: g.length, fees_usd: U.round(fees, 2), funding_usd: U.round(U.sum(g.map((c) => c.funding_usd || 0)), 2), realized_usd: U.round(U.sum(g.map((c) => c.realized_usd)), 2),
      fees_share_of_gross: grossAbs > 0 ? U.round(Math.abs(fees) / grossAbs, 4) : null, n_cost_r: cr.length, avg_cost_r: U.round(avg(cr), 4) };
  });
  // D. liquidity
  const coins = [...new Set(Object.values(cfg.bots).flatMap((b) => b.coins))].sort(), liquidity = [], hourUsd = {}, missing = [];
  for (const coin of coins) {
    let ok = false; try { ok = M.has(coin, '1h'); } catch (e) { ok = false; }
    if (!ok) { missing.push(coin); continue; }
    const s = liquidityStats(M.bars(coin, '1h'), asOf); hourUsd[coin] = s.median_usd_30d;
    liquidity.push({ coin, ...s, median_usd_30d: U.round(s.median_usd_30d, 0), median_usd_180d: U.round(s.median_usd_180d, 0), ratio_30d_180d: U.round(s.ratio_30d_180d, 3), median_range_bp_30d: U.round(s.median_range_bp_30d, 1) });
  }
  if (missing.length) notes.push('no clean 1h candles for: ' + missing.join(', '));
  // E. capacity
  const snaps = new Map(); for (const w of wallets) { if (!snaps.has(w.wallet)) snaps.set(w.wallet, []); snaps.get(w.wallet).push(w); }
  for (const a of snaps.values()) a.sort((x, y) => x.t - y.t);
  const capacity = [];
  for (const bot of bots) for (const [coin, g] of [...group(live.filter((t) => t.bot === bot), (t) => t.coin)].sort()) {
    const ns = nums(g.map((t) => notionalOf(t, equityBefore(snaps.get(bot) || [], t.entry_s)))), n = ns.length ? U.median(ns) : null, h = hourUsd[coin] == null ? null : hourUsd[coin];
    capacity.push({ bot, coin, n_trades: g.length, n_sized: ns.length, notional_usd: U.round(n, 0), median_hour_usd_30d: U.round(h, 0), participation: U.round(participation(n, h), 6),
      max_notional_1pct_usd: U.round(maxNotional1pct(h), 0), headroom_x: U.round(headroom(h, n), 1) });
  }
  // F. order-book capacity
  let book = null, bookCapacity = [];
  try { book = spine.load('mexc', 'book_daily.csv'); } catch (e) { notes.push('order-book capacity is waiting for the recorder pull'); }
  if (book) {
    const from = U.day(asOf - 30 * D);
    for (const [coin, g] of [...group(book.filter((r) => r.day >= from), (r) => r.coin)].sort()) {
      const lv = live.filter((t) => t.coin === coin), stopBp = med(lv.map((t) => t.one_r / t.entry_price * 1e4)), limit = stopBp == null ? null : stopBp * 0.1, rows = [];
      for (const [size, gs] of [...group(g, (r) => r.size_usd)].sort((a, b) => a[0] - b[0])) {
        const rt = med(gs.map((r) => (r.buy_bp_median != null && r.sell_bp_median != null ? r.buy_bp_median + r.sell_bp_median : null)));
        rows.push({ coin, size_usd: size, n_days: gs.length, roundtrip_bp: U.round(rt, 2), stop_bp: U.round(stopBp, 1), limit_bp: U.round(limit, 2), ok: rt != null && limit != null && rt < limit });
      }
      bookCapacity.push(...rows);
    }
  }
  return { asOf, live, bots, entry, stop, costs, liquidity, capacity, book, bookCapacity, notes, missing };
}

function standsOut(x) {
  const out = [];
  for (const e of x.entry.filter((r) => r.coin === 'ALL' && r.median_slip_r != null && r.median_slip_r < -0.05)) out.push(`Bot ${e.bot}: median entry slippage is ${U.signed(e.median_slip_r, 3)}R (worse than -0.05R), from ${e.n} live entries.`);
  for (const s of x.stop.filter((r) => r.median_overshoot_r != null && r.median_overshoot_r > 0.05)) out.push(`Bot ${s.bot}: stops fill a median ${s.median_overshoot_r}R beyond the stop price (${s.n} stops).`);
  for (const l of x.liquidity.filter((r) => r.falling)) out.push(`${l.coin}: liquidity falling. Last 30 days trade ${l.ratio_30d_180d}x the 180-day median hourly volume.`);
  for (const c of x.capacity.filter((r) => r.headroom_x != null && r.headroom_x < 20)) out.push(`${c.bot} ${c.coin}: headroom is ${c.headroom_x}x (below 20x), from ${c.n_sized} sized trades.`);
  const hi = x.costs.filter((c) => c.fees_share_of_gross != null && c.fees_share_of_gross > 0.2);
  for (const c of hi) out.push(`Bot ${c.bot}: fees are ${(c.fees_share_of_gross * 100).toFixed(0)}% of gross result (${c.n_closed} closed trades).`);
  if (!out.length) out.push('No bot, coin or cost crossed any of the simple warning levels.');
  const hr = x.capacity.filter((r) => r.headroom_x != null).sort((a, b) => a.headroom_x - b.headroom_x)[0];
  if (hr && hr.headroom_x >= 20) out.push(`Lowest headroom: ${hr.bot} ${hr.coin} at ${hr.headroom_x}x (${hr.n_sized} sized trades).`);
  const ent = x.entry.filter((r) => r.coin === 'ALL' && r.median_slip_r != null);
  if (ent.length) out.push('Median entry slippage per bot: ' + ent.map((r) => `${r.bot} ${U.signed(r.median_slip_r, 3)}R (n=${r.n})`).join(', ') + '.');
  return out.slice(0, 5);
}

function run(opts = {}) {
  const x = build(opts);
  const files = { 'entry_quality.csv': { rows: x.entry, schema: ENTRY_QUALITY }, 'stop_quality.csv': { rows: x.stop, schema: STOP_QUALITY }, 'costs.csv': { rows: x.costs, schema: COSTS },
    'liquidity.csv': { rows: x.liquidity, schema: LIQUIDITY }, 'capacity.csv': { rows: x.capacity, schema: CAPACITY } };
  if (x.book) files['book_capacity.csv'] = { rows: x.bookCapacity, schema: BOOK_CAPACITY };
  const inputs = [spine.ref('trades'), spine.ref('market')]; if (x.book) inputs.push(spine.ref('mexc'));
  const m = spine.write('derived/execution', { generator: 'engines/execution', inputs,
    checks: [{ name: 'trades loaded', ok: x.live.length > 0, detail: `${x.live.length} live trades as of ${U.iso(x.asOf)} UTC` }, { name: 'liquidity rows', ok: x.liquidity.length > 0, detail: `${x.liquidity.length} coins` }],
    notes: x.notes.concat(['capacity is an estimate from Binance volume, not MEXC order-book data', 'cost in R is an estimate: fees plus paid funding divided by the dollar value of 1R']), files });
  if (m.status === 'ok' && !opts.noReport) report(x);
  return m;
}

function report(x) {
  const f = (v, d = 2) => (v == null ? '-' : Number(v).toFixed(d)), L = ['# Execution quality and capacity', '', `As of ${U.iso(x.asOf)} UTC. Live trades only unless stated. Read-only and informational: nothing here suggests a change to any bot.`, ''];
  L.push('## A. Entry quality', '', `Sample: ${x.live.length} live entries. Slippage in R: negative means worse than intended. Slippage in bp: positive means paid more than intended.`, '',
    U.mdTable(x.entry, [['Bot', (r) => r.bot], ['Coin', (r) => r.coin], ['n', (r) => r.n], ['Median slip R', (r) => U.signed(r.median_slip_r, 3)], ['Mean slip R', (r) => U.signed(r.mean_slip_r, 3)], ['Worst R', (r) => U.signed(r.worst_slip_r, 3)],
      ['Median delay s', (r) => f(r.median_delay_s, 1)], ['P90 delay s', (r) => f(r.p90_delay_s, 1)], ['n bp', (r) => r.n_bp], ['Median bp', (r) => U.signed(r.median_slip_bp, 1)]]));
  L.push('', '## B. Stop quality', '', 'Closed trades that ended on the stop and still had the first stop. Overshoot in R: positive means the exit was worse than the stop price.', '',
    U.mdTable(x.stop, [['Bot', (r) => r.bot], ['n', (r) => r.n], ['Median R', (r) => U.signed(r.median_overshoot_r, 3)], ['P90 R', (r) => U.signed(r.p90_overshoot_r, 3)], ['Worst R', (r) => U.signed(r.worst_overshoot_r, 3)]]));
  L.push('', '## C. Cost per trade (exchange records)', '', 'Fees and funding in USD (negative = paid). Cost in R is an estimate.', '',
    U.mdTable(x.costs, [['Bot', (r) => r.bot], ['n closed', (r) => r.n_closed], ['Fees USD', (r) => f(r.fees_usd)], ['Funding USD', (r) => f(r.funding_usd)], ['Realized USD', (r) => f(r.realized_usd)], ['Fees / gross', (r) => (r.fees_share_of_gross == null ? '-' : (r.fees_share_of_gross * 100).toFixed(1) + '%')],
      ['n for R', (r) => r.n_cost_r], ['Avg cost R', (r) => U.signed(r.avg_cost_r, 3)]]));
  L.push('', '## D. Liquidity and its trend (Binance 1h bars)', '', `Sample: ${x.liquidity.length} coins. Ratio below 0.6 is flagged as liquidity falling.`, '',
    U.mdTable(x.liquidity, [['Coin', (r) => r.coin], ['Bars 30d / 180d', (r) => `${r.n_bars_30d} / ${r.n_bars_180d}`], ['Median hour USD 30d', (r) => (r.median_usd_30d == null ? '-' : Math.round(r.median_usd_30d).toLocaleString('en-US'))],
      ['Median hour USD 180d', (r) => (r.median_usd_180d == null ? '-' : Math.round(r.median_usd_180d).toLocaleString('en-US'))], ['Ratio 30d/180d', (r) => f(r.ratio_30d_180d, 2)], ['Flag', (r) => (r.falling ? 'liquidity falling' : '')], ['Median hour range bp (30d)', (r) => f(r.median_range_bp_30d, 1)]]));
  L.push('', '## E. Capacity estimate (estimate from Binance volume, because MEXC order-book data is not available yet)', '', 'Notional = risk % x equity at entry x entry price / 1R distance, median per bot and coin. Max size = 1% of the median hourly dollar volume (30d). Headroom = max size / notional.', '',
    U.mdTable(x.capacity, [['Bot', (r) => r.bot], ['Coin', (r) => r.coin], ['Trades / sized', (r) => `${r.n_trades} / ${r.n_sized}`], ['Notional USD', (r) => (r.notional_usd == null ? '-' : Math.round(r.notional_usd).toLocaleString('en-US'))],
      ['Participation', (r) => (r.participation == null ? '-' : (r.participation * 100).toFixed(4) + '%')], ['Max size 1% USD', (r) => (r.max_notional_1pct_usd == null ? '-' : Math.round(r.max_notional_1pct_usd).toLocaleString('en-US'))], ['Headroom x', (r) => f(r.headroom_x, 1)]]));
  if (x.book) L.push('', '## F. Order-book capacity (MEXC recorder)', '', 'Round trip = median over the last 30 days of buy bp + sell bp. Limit = 10% of the median stop distance in bp.', '',
    x.bookCapacity.length ? U.mdTable(x.bookCapacity, [['Coin', (r) => r.coin], ['Size USD', (r) => r.size_usd], ['Days', (r) => r.n_days], ['Round trip bp', (r) => f(r.roundtrip_bp, 2)], ['Stop bp', (r) => f(r.stop_bp, 1)], ['Limit bp', (r) => f(r.limit_bp, 2)], ['Below limit', (r) => (r.ok ? 'yes' : 'no')]]) : 'No rows in the last 30 days.');
  else L.push('', '## F. Order-book capacity', '', 'Order-book capacity is waiting for the recorder pull. The MEXC dataset is not available yet.');
  L.push('', '## What stands out', '', ...standsOut(x).map((s) => '- ' + s));
  L.push('', '## Limits', '', '- Small samples: many bot and coin groups have only a few trades. One trade can move a median.', '- Binance volume stands in for MEXC volume. The bots trade on MEXC, so real capacity can differ.', '- Costs in R are estimates built from fees, paid funding and a dollar value of 1R derived from the exchange record.');
  if (x.notes.length) L.push('', 'Notes: ' + x.notes.join('; '));
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'execution.md'), L.join('\n') + '\n');
}

module.exports = { build, run, report, slipBp, overshootR, stopUnmoved, costR, liquidityStats, liquidityRatio, notionalOf, participation, maxNotional1pct, headroom, equityBefore, standsOut };
if (require.main === module) {
  try { const m = run(); const c = m.checks.map((k) => `${k.name}: ${k.ok ? 'ok' : 'FAIL'}`).join(', '); console.log('execution:', m.status, '(' + c + ') -> reports/execution.md'); } catch (e) { console.log('execution: failed -', e.message); process.exitCode = 1; }
}
