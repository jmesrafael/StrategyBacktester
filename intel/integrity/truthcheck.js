// integrity/truthcheck.js - the Truth Check: do the three records of the same trading agree?
//   A. the bots' own events (entries and exits pushed to the dashboard)       -> trades.csv
//   B. the exchange's closed positions as the wallets reported them            -> exchange_closed.csv
//   C. the wallet snapshots (equity, unrealised profit, number of open positions) -> wallets.csv
//
// Checks per live bot:
//   1. every exit event has a matching exchange closed position and the R agrees. A bot reports a stop when it next wakes,
//      at the close of its candle, so the exchange close may be up to one 4h candle EARLIER than the exit event (LAG_S).
//      The lag is reported: it is how long the dashboard shows a position that is already closed.
//   2. every exchange closed position has an exit event
//   3. the number of open positions the events imply equals the number the wallet reports, at every snapshot;
//      when they differ for more than 30 minutes the interval is listed with its start time, so the cause can be found
// A finding here is information for the owner. Nothing is corrected automatically.
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../lib/spine'), cfg = require('../lib/config'), U = require('../lib/util');

const FIND = { bot: 'string', check: 'string', status: 'string', detail: 'string', at_s: 'int?' };
const TOL_S = 900, LAG_S = 4 * 3600, R_TOL = 0.1, MIN_GAP_S = 1800;

function check({ trades, exchange, wallets }) {
  const out = [], live = trades.filter((t) => t.mode === 'live'), bots = [...new Set(live.map((t) => t.bot).concat(wallets.map((w) => w.wallet)))].sort();
  for (const bot of bots) {
    const tr = live.filter((t) => t.bot === bot), ex = exchange.filter((e) => e.wallet === bot), used = new Set();
    // 1 + 2: exits against exchange closes
    let matched = 0; const lags = [], closedAt = new Map();
    for (const t of tr.filter((x) => x.status === 'closed')) {
      const c = ex.filter((e, i) => !used.has(i) && e.coin === t.coin && e.side === t.side && e.closed_s <= t.exit_s + TOL_S && e.closed_s >= t.exit_s - LAG_S - TOL_S).sort((a, b) => Math.abs((a.r_result == null ? t.r : a.r_result) - t.r) - Math.abs((b.r_result == null ? t.r : b.r_result) - t.r) || Math.abs(a.closed_s - t.exit_s) - Math.abs(b.closed_s - t.exit_s))[0];
      if (!c) { out.push({ bot, check: 'exit event has an exchange close', status: 'review', detail: `${t.coin} ${t.side} exit ${U.iso(t.exit_s)} (R ${t.r}) has no exchange closed position in the 4h before it`, at_s: t.exit_s }); continue; }
      used.add(ex.indexOf(c)); matched++; lags.push(t.exit_s - c.closed_s); closedAt.set(t.trade_key, c.closed_s);
      if (c.r_result != null && Math.abs(c.r_result - t.r) > R_TOL) out.push({ bot, check: 'R agrees', status: 'review', detail: `${t.coin} ${t.side} ${U.iso(t.exit_s)}: event R ${t.r}, exchange R ${c.r_result}`, at_s: t.exit_s });
    }
    ex.forEach((e, i) => { if (!used.has(i)) out.push({ bot, check: 'exchange close has an exit event', status: 'review', detail: `${e.coin} ${e.side} closed ${U.iso(e.closed_s)} (position ${e.position_id}, R ${e.r_result}) has no exit event`, at_s: e.closed_s }); });
    out.push({ bot, check: 'closed trades reconciled', status: matched === tr.filter((x) => x.status === 'closed').length && matched === ex.length ? 'ok' : 'review', detail: `${matched} matched; ${tr.filter((x) => x.status === 'closed').length} exit events; ${ex.length} exchange closes`, at_s: null });
    if (lags.length) out.push({ bot, check: 'exit reporting lag', status: 'info', detail: `exit events arrive a median ${Math.round(U.median(lags) / 60)} min after the exchange close (longest ${Math.round(Math.max(...lags) / 60)} min): a stopped position stays on the dashboard that long`, at_s: null });
    // 3: open-position count over time (a matched trade counts as closed from the exchange's close time)
    const ws = wallets.filter((w) => w.wallet === bot && !w.suspect && w.open_positions != null).sort((a, b) => a.t - b.t);
    if (!ws.length) { out.push({ bot, check: 'open positions agree', status: 'no_data', detail: 'no wallet snapshots for this bot', at_s: null }); continue; }
    const endOf = (t) => (closedAt.has(t.trade_key) ? closedAt.get(t.trade_key) : t.exit_s);
    const expected = (T) => tr.filter((t) => t.entry_s <= T && (endOf(t) == null || endOf(t) > T)).length;
    let gap = null; const gaps = [];
    for (const w of ws) { const e = expected(w.t), diff = w.open_positions - e;
      if (diff !== 0) { if (!gap || gap.diff !== diff) { if (gap) gaps.push(gap); gap = { from: w.t, to: w.t, diff, wallet: w.open_positions, events: e }; } else gap.to = w.t; }
      else if (gap) { gaps.push(gap); gap = null; } }
    if (gap) gaps.push({ ...gap, open: true });
    const real = gaps.filter((g) => g.to - g.from >= MIN_GAP_S || g.open), last = ws[ws.length - 1], eNow = expected(last.t);
    for (const g of real) {
      // the events closest to the moment the counts parted usually explain it
      const near = tr.filter((t) => Math.abs(t.entry_s - g.from) <= 3 * 3600 || (t.exit_s != null && Math.abs(t.exit_s - g.from) <= 3 * 3600)).map((t) => `${t.coin} ${t.side} entry ${U.iso(t.entry_s)}${t.exit_s ? ' exit ' + U.iso(t.exit_s) : ''}`);
      out.push({ bot, check: 'open positions agree', status: 'review', at_s: g.from,
        detail: `${U.iso(g.from)} to ${g.open ? 'now' : U.iso(g.to)}: wallet ${g.wallet} open, events imply ${g.events} (wallet ${g.diff > 0 ? 'has ' + g.diff + ' more: a position with no entry event' : 'has ' + -g.diff + ' fewer: a position closed with no exit event, or an entry event without a fill'}). Events within 3h of the start: ${near.join('; ') || 'none'}` });
    }
    out.push({ bot, check: 'open positions now', status: last.open_positions === eNow ? 'ok' : 'review', detail: `wallet ${last.open_positions} at ${U.iso(last.t)}; events imply ${eNow} (${tr.filter((t) => t.status === 'open').map((t) => t.coin + ' ' + t.side + ' since ' + U.iso(t.entry_s)).join(', ') || 'none'})`, at_s: last.t });
  }
  return out;
}

function run() {
  const findings = check({ trades: spine.load('trades', 'trades.csv'), exchange: spine.load('trades', 'exchange_closed.csv'), wallets: spine.load('trades', 'wallets.csv') });
  const review = findings.filter((f) => f.status === 'review');
  const m = spine.write('derived/truth-check', { generator: 'integrity/truthcheck.js', inputs: [spine.ref('trades')], checks: [{ name: 'truth check ran', ok: findings.length > 0, detail: `${findings.length} findings, ${review.length} need review` }],
    notes: ['status "review" is a disagreement between records for the owner to look at; it does not make this dataset fail'], files: { 'findings.csv': { rows: findings, schema: FIND } } });
  const L = ['# Truth check: bot events against exchange records', '', `Built ${new Date().toISOString().slice(0, 16)} UTC from the trades dataset (export ${spine.manifest('trades').source.exported_at}).`, '',
    `${review.length} item(s) need review.`, '', U.mdTable(findings, [['Bot', (r) => r.bot], ['Check', (r) => r.check], ['Status', (r) => r.status], ['Detail', (r) => r.detail]]), '',
    '## How to read it', '', '- "review" on open positions means the wallet and the events disagree on how many positions are open. The interval start tells you where to look in the bot log and on the exchange.',
    '- This tool reads only. It changes nothing in the database, the bots or the exchange.'];
  U.mkdirp(cfg.reportsDir); fs.writeFileSync(path.join(cfg.reportsDir, 'truth-check.md'), L.join('\n') + '\n');
  return m;
}
module.exports = { check, run, FIND };
if (require.main === module) { run(); console.log(fs.readFileSync(path.join(cfg.reportsDir, 'truth-check.md'), 'utf8')); }
