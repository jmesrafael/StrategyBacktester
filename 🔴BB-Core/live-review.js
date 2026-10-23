#!/usr/bin/env node
// live-review.js - research report: real live trades next to the backtester, and "what if the risk had been X%".
//
//   node live-review.js [--journal DIR] [--mode live|paper] [--risk 0.005,0.01,0.02,0.05] [--start-balance USD] [--history]
//                       [--tolerance 0.05] [--out-dir review] [--quiet]
//
// DIR holds trades.jsonl and snapshots.jsonl (copied from the VPS, see DEPLOY.md "Pulling the data"). Reads only: it never sends an order and needs no key.
// 1. pairs every live trade with the backtest trade on the same MEXC candles (compare-live-vs-backtest.js buildReport, unchanged)
// 2. splits the R difference of each pair into entry slippage, exit slippage, fees, funding and "the rest" (backtest-model difference)
// 3. reconciles the journal against the MEXC account snapshots (equity change vs the sum of journal P&L)
// 4. re-sizes the SAME trades at other risk levels with the bot's own sizing rules (whole contracts, leverage, margin, 39R halt, compounding)
//    --history also runs that over the full stored MEXC history (data/), which is far more than 3 months of live trades can show
// Writes review/live-review-<date>.json, .txt and .html (self-contained: charts are inline SVG, nothing is loaded from the web).
'use strict';
const fs = require('fs'), path = require('path');
require('./envfile.js').load();
const core = require('./lucidio-core.js');
const journal = require('./journal.js');
const config = require('./config.js');
const { buildReport, downloadCandles } = require('./compare-live-vs-backtest.js');
const { sizeOrder, leverageFor } = require('./live.js');

const IV = 14400, S = core.DEFAULTS;
// contract specs read from MEXC on 2026-10-23 (`node lucidio.js check`): 1 contract = 0.1 SOL / 0.01 ZEC, minimum 1 contract. Edit here if MEXC changes them.
const DEFAULT_SPECS = {
  SOL_USDT: { contractSize: 0.1, volUnit: 1, minVol: 1, maxLeverage: 300, maintenanceMarginRate: 0.005 },
  ZEC_USDT: { contractSize: 0.01, volUnit: 1, minVol: 1, maxLeverage: 150, maintenanceMarginRate: 0.005 },
};
const iso = (sec) => (sec == null ? '—' : new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 16) + 'Z');
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : null);
const stats = (a) => {
  const v = a.filter((x) => x != null && Number.isFinite(x));
  if (!v.length) return { n: 0, mean: null, sd: null, se: null, ci95: null };
  const m = mean(v), sd = v.length > 1 ? Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / (v.length - 1)) : null, se = sd == null ? null : sd / Math.sqrt(v.length);
  return { n: v.length, mean: m, sd, se, ci95: se == null ? null : [m - 1.96 * se, m + 1.96 * se] };
};

// ------------------------------------------------------------------ live trades out of the journal
function deriveLive(en, ex) {
  const riskUsd = en.risk && en.risk.risk_usd, c = ex && ex.costs && ex.costs.kind === 'actual' ? ex.costs : null;
  const feesUsd = c && c.fees_usd != null ? -Math.abs(c.fees_usd) : null, fundingUsd = c && c.funding_usd != null ? c.funding_usd : null;
  const perR = (usd) => (usd != null && riskUsd > 0 ? usd / riskUsd : null);
  const qty = en.position && en.position.qty, book = (en.costs && en.costs.order_book) || null;
  return {
    id: en.trade_id, symbol: en.symbol, side: en.side, sigMs: en.match_key.signal_candle_open_ms, closed: !!ex,
    R: ex ? ex.r_result : null, usd: ex ? ex.usd_pnl : null, riskUsd, riskPct: en.risk ? en.risk.risk_pct : null, balanceUsed: en.risk ? en.risk.balance_used : null,
    entry: en.entry.fill_price, stop: en.sl, tp: en.tp, tEntry: en.entry.next_candle_open_ms / 1000, tExit: ex ? Date.parse(ex.exit_ts) / 1000 : null,
    exitReason: ex ? ex.exit_reason : null, closedBy: c && c.exit ? c.exit.closed_by : null, delaySec: en.entry.delay_sec ?? null,
    entrySlipR: en.entry.slippage_r ?? null, exitSlipR: c && c.exit ? c.exit.slippage_r : null, feeR: perR(feesUsd), fundingR: perR(fundingUsd),
    notionalUsd: qty ? qty * en.entry.fill_price : null, contracts: en.position ? en.position.contracts : null, book,
    depthRatio: qty && book && book.notional_usd_0_5pct > 0 ? (qty * en.entry.fill_price) / book.notional_usd_0_5pct : null,
  };
}
function pairLive(events) {
  const m = new Map();
  for (const e of events) if (e.type === 'entry') m.set(e.trade_id, { en: e, ex: null });
  for (const e of events) if (e.type === 'exit' && m.has(e.trade_id)) m.get(e.trade_id).ex = e;
  return [...m.values()].map((p) => deriveLive(p.en, p.ex));
}

// ------------------------------------------------------------------ backtest trades on the same candles (same window rule as buildReport)
function backtestTrades(candles, fromSig, symbols) {
  const out = [];
  for (const s of symbols) {
    const C = candles[s]; if (!C || !C.length) continue;
    const toSig = C[C.length - 1].time - IV, startT = fromSig - S.warmup * IV, k = C.findIndex((c) => c.time >= startT);
    if (k < 0) continue;
    const slice = C.slice(k), res = core.backtest(slice, {}, null);
    for (const t of res.trades) {
      const sig = t.t - IV; if (sig < fromSig || sig > toSig) continue;
      out.push({ id: `${s}|${t.dir === 1 ? 'LONG' : 'SHORT'}|${sig * 1000}`, symbol: s, side: t.dir === 1 ? 'LONG' : 'SHORT', tEntry: t.t, tExit: t.tExit, entry: t.entry, stop: t.stop, R: t.R, why: t.why });
    }
  }
  return out.sort((a, b) => a.tEntry - b.tEntry);
}
// the whole stored history (data/), used for the long-run risk what-if
function historyTrades(dataDir, coins = ['MEXC_SOL', 'MEXC_ZEC']) {
  const read = (c) => { const f = path.join(dataDir, 'funding', c + '.json'); try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const out = [];
  for (const coin of coins) {
    let B; try { B = JSON.parse(fs.readFileSync(path.join(dataDir, coin + '.json'), 'utf8')).map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] })); } catch { continue; }
    const own = read(coin), bin = coin.startsWith('MEXC_') ? read(coin.slice(5)) : null;
    const funding = coin.startsWith('MEXC_') ? (!own || !own.length ? bin : bin ? [...bin.filter((x) => x[0] < own[0][0]), ...own] : own) : own;
    const symbol = config.coinToSymbol(coin.replace(/^MEXC_/, ''));
    for (const t of core.backtest(B, {}, funding).trades) out.push({ id: `${symbol}|${t.t}`, symbol, side: t.dir === 1 ? 'LONG' : 'SHORT', tEntry: t.t, tExit: t.tExit, entry: t.entry, stop: t.stop, R: t.R, why: t.why });
  }
  return out.sort((a, b) => a.tEntry - b.tEntry);
}

// ------------------------------------------------------------------ the risk what-if (the bot's own sizing rules, compounding, one shared balance)
// trades: closed trades { id, symbol, tEntry, tExit (sec), entry, stop, R }. Result R is scaled by the real risk of the whole-contract size.
// maxRiskUsd defaults to no cap: the bot's own $10 cap would silently turn a 5% what-if into a fixed-dollar one once the balance passes $200.
function simulate({ trades, startBalance, riskPct, specs = DEFAULT_SPECS, maxLeverage = 20, maxRiskMult = 1.5, maxRiskUsd = Infinity, haltR = 39, marginBuffer = 1.1 }) {
  const list = trades.filter((t) => t.R != null && t.tExit != null).sort((a, b) => a.tEntry - b.tEntry);
  let bal = startBalance, totalR = 0, peakR = 0, peakBal = bal, maxDd = 0, minBal = bal, streak = 0, maxStreak = 0, worstPct = 0;
  const open = [], taken = [], skipped = {}, curve = [{ t: list.length ? list[0].tEntry : 0, balance: bal }];
  const settle = (upto) => {
    open.sort((a, b) => a.tExit - b.tExit);
    while (open.length && open[0].tExit <= upto) {
      const o = open.shift(); bal += o.pnl; totalR += o.R; peakR = Math.max(peakR, totalR);
      peakBal = Math.max(peakBal, bal); minBal = Math.min(minBal, bal); maxDd = Math.max(maxDd, peakBal > 0 ? (peakBal - bal) / peakBal : 0);
      streak = o.pnl < 0 ? streak + 1 : 0; maxStreak = Math.max(maxStreak, streak); curve.push({ t: o.tExit, balance: bal });
    }
  };
  for (const t of list) {
    settle(t.tEntry);
    const skip = (r) => { skipped[r] = (skipped[r] || 0) + 1; };
    if (peakR - totalR >= haltR) { skip('drawdown_halt'); continue; }
    if (open.some((o) => o.symbol === t.symbol)) { skip('position_exists'); continue; }
    const spec = specs[t.symbol]; if (!spec) { skip('no_spec'); continue; }
    if (!(bal > 0)) { skip('no_balance'); continue; }
    const sz = sizeOrder({ riskUsd: Math.min(maxRiskUsd, bal * riskPct), px: t.entry, stop: t.stop, spec, maxRiskMult });
    if (!sz) { skip('risk_cap'); continue; }
    const lev = leverageFor(t.entry, t.stop, spec, maxLeverage), notional = sz.vol * spec.contractSize * t.entry, margin = notional / lev;
    if (bal - sum(open.map((o) => o.margin)) < margin * marginBuffer) { skip('insufficient_margin'); continue; }
    const pnl = t.R * sz.riskUsd;
    open.push({ symbol: t.symbol, tExit: t.tExit, R: t.R, pnl, margin });
    taken.push({ id: t.id, notional, riskUsd: sz.riskUsd, riskPctReal: sz.riskUsd / bal, contracts: sz.vol, lev });
    worstPct = Math.min(worstPct, pnl / bal);
  }
  settle(Infinity);
  return { risk_pct: riskPct, start: startBalance, final: bal, return_pct: (bal / startBalance - 1) * 100, max_dd_pct: maxDd * 100, min_balance: minBal, trades_taken: taken.length,
    skipped, skipped_total: sum(Object.values(skipped)), total_r_taken: totalR, avg_real_risk_pct: mean(taken.map((x) => x.riskPctReal)) * 100, worst_trade_pct: worstPct * 100,
    max_losing_streak: maxStreak, halted: !!skipped.drawdown_halt, taken, curve };
}

// ------------------------------------------------------------------ the analysis (pure: no network, no clock unless given)
// o: { events, snapshots, candles { SOL_USDT: [...] }, mode, tolerance, now, riskLevels, startBalance, history (trades[]), specs }
function analyze(o) {
  const mode = o.mode || 'live', warnings = [];
  const events = (o.events || []).filter((e) => e.mode === mode && (!e.symbol || config.ALLOWED_SYMBOLS.includes(e.symbol)));
  const snaps = (o.snapshots || []).filter((s) => s.mode === mode).sort((a, b) => a.ts_ms - b.ts_ms);
  if (!events.length) return { error: `no journal events for mode "${mode}"` };
  const cmp = buildReport({ events, candles: o.candles, shadow: new Map(), tolerance: o.tolerance ?? 0.05, mode, now: o.now });
  if (cmp.error) return cmp;
  const live = pairLive(events), liveBy = new Map(live.map((t) => [t.id, t]));
  const symbols = [...new Set(cmp.trades.map((r) => r.symbol).concat(live.map((t) => t.symbol)))];
  const bt = backtestTrades(o.candles, Math.floor(cmp.window.from_ms / 1000), symbols.length ? symbols : config.ALLOWED_SYMBOLS);

  // pairs: a live trade and its backtest twin, both closed
  const pairs = [];
  for (const r of cmp.trades) {
    if (r.status === 'live-only' || r.status === 'backtest-only') continue;
    const L = liveBy.get(`${r.symbol}|${r.side}|${r.signal_candle_open_ms}`);
    if (!L || !L.closed || r.backtest.R == null) continue;
    const comp = { entry_slip: L.entrySlipR != null ? -L.entrySlipR : null, exit_slip: L.exitSlipR != null ? -L.exitSlipR : null, fees: L.feeR, funding: L.fundingR };
    const known = sum(Object.values(comp).filter((x) => x != null)), gap = L.R - r.backtest.R;
    pairs.push({ id: L.id, symbol: r.symbol, side: r.side, signal: iso(r.signal_candle_open_ms / 1000), live_R: L.R, backtest_R: r.backtest.R, gap_R: gap, components_R: comp, rest_R: gap - known,
      live_exit: L.exitReason, backtest_exit: r.backtest.why, closed_by: L.closedBy, delay_sec: L.delaySec, depth_ratio: L.depthRatio, status: r.status, diffs: r.diffs || [] });
  }
  const gapStats = { gap: stats(pairs.map((p) => p.gap_R)), entry_slip: stats(pairs.map((p) => p.components_R.entry_slip)), exit_slip: stats(pairs.map((p) => p.components_R.exit_slip)),
    fees: stats(pairs.map((p) => p.components_R.fees)), funding: stats(pairs.map((p) => p.components_R.funding)), rest: stats(pairs.map((p) => p.rest_R)) };

  const closedLive = live.filter((t) => t.closed), btRows = cmp.trades.filter((r) => r.backtest && r.backtest.R != null);
  const winRate = (a) => (a.length ? a.filter((x) => x > 0).length / a.length : null);
  const totals = {
    live: { trades: closedLive.length, open: live.length - closedLive.length, total_r: sum(closedLive.map((t) => t.R)), avg_r: mean(closedLive.map((t) => t.R)), win_rate: winRate(closedLive.map((t) => t.R)), usd: sum(closedLive.map((t) => t.usd || 0)) },
    backtest: { trades: btRows.length, total_r: sum(btRows.map((r) => r.backtest.R)), avg_r: mean(btRows.map((r) => r.backtest.R)), win_rate: winRate(btRows.map((r) => r.backtest.R)) },
    matched_pairs: { n: pairs.length, live_total_r: sum(pairs.map((p) => p.live_R)), backtest_total_r: sum(pairs.map((p) => p.backtest_R)) },
  };

  // account vs journal
  const acct = snaps.map((s) => ({ t: s.ts_ms / 1000, equity: s.equity })).filter((p) => p.equity != null);
  let reconciliation = null;
  if (acct.length >= 2) {
    const first = snaps.find((s) => s.equity != null), last = [...snaps].reverse().find((s) => s.equity != null);
    const dEq = last.equity - first.equity, dUnreal = (last.unrealized || 0) - (first.unrealized || 0), pnl = sum(closedLive.filter((t) => t.tExit * 1000 > first.ts_ms - IV * 1000).map((t) => t.usd || 0));
    reconciliation = { from: first.ts, to: last.ts, equity_change_usd: dEq, journal_pnl_usd: pnl, unrealized_change_usd: dUnreal, unexplained_usd: dEq - pnl - dUnreal,
      note: 'unexplained = equity change - journal P&L - change in unrealized. Near zero means the journal and MEXC agree; a deposit, withdrawal, transfer or a trade the journal missed shows up here.' };
  }
  const startBalance = o.startBalance ?? (snaps.find((s) => s.equity != null) || {}).equity ?? (live[0] && live[0].balanceUsed) ?? 52;
  const specs = o.specs || DEFAULT_SPECS, levels = o.riskLevels && o.riskLevels.length ? o.riskLevels : [0.005, 0.01, 0.02, 0.05];
  const liveTrades = closedLive.map((t) => ({ id: t.id, symbol: t.symbol, tEntry: t.tEntry, tExit: t.tExit, entry: t.entry, stop: t.stop, R: t.R }));
  const gapMean = gapStats.gap.mean;
  const adjusted = gapMean != null && pairs.length >= 3 ? bt.filter((t) => t.R != null).map((t) => ({ ...t, R: t.R + gapMean })) : null;
  if (!adjusted) warnings.push('fewer than 3 matched live/backtest pairs: the cost-adjusted backtest series is not shown (a mean over so few trades says nothing)');
  const depthOf = (series) => { const ratios = series.taken.map((x) => (liveBy.get(x.id) && liveBy.get(x.id).book && liveBy.get(x.id).book.notional_usd_0_5pct > 0) ? x.notional / liveBy.get(x.id).book.notional_usd_0_5pct : null).filter((x) => x != null); return ratios.length ? Math.max(...ratios) : null; };
  const whatif = levels.map((rp) => {
    const sim = (trades) => { const r = simulate({ trades, startBalance, riskPct: rp, specs }); return r; };
    const L = sim(liveTrades), B = sim(bt), A = adjusted ? sim(adjusted) : null;
    return { risk_pct: rp, live_trades: { ...L, max_depth_ratio: depthOf(L) }, backtest: B, backtest_cost_adjusted: A };
  });
  let history = null;
  if (o.history && o.history.length) {
    history = { from: iso(Math.min(...o.history.map((t) => t.tEntry))), to: iso(Math.max(...o.history.map((t) => t.tExit || 0))), trades: o.history.length, results: levels.map((rp) => simulate({ trades: o.history, startBalance, riskPct: rp, specs })) };
  }
  const strip = (r) => { if (!r) return r; const { taken, ...rest } = r; return rest; };
  return {
    generated_at: new Date((o.now ?? Date.now() / 1000) * 1000).toISOString(), mode, window: cmp.window, counts: cmp.counts, match: cmp.match, tolerance_r: cmp.tolerance_r,
    totals, pairs, gap_stats: gapStats, reconciliation, account_curve: acct, start_balance: startBalance,
    live_trades: live, skipped: cmp.skipped, investigation: cmp.investigation,
    whatif: whatif.map((w) => ({ risk_pct: w.risk_pct, live_trades: strip(w.live_trades), backtest: strip(w.backtest), backtest_cost_adjusted: strip(w.backtest_cost_adjusted) })),
    history: history && { ...history, results: history.results.map(strip) },
    provenance: cmp.provenance, warnings: warnings.concat(cmp.warnings || []),
    caveats: [
      'The backtester is run without funding (same as the compare tool); live R includes the funding MEXC charged. The "rest" column is everything the listed costs do not explain: the backtest\'s own modeled fees and slippage, and price-path differences.',
      'MEXC reports fees and funding as numbers whose sign is not documented here: fees are always counted as a cost; funding is shown as MEXC reports it. Check the first few trades against the MEXC app before trusting the funding column.',
      'Re-sizing uses each trade\'s R as measured. R already includes the real costs of a tiny position; at a larger size the price impact grows, which this report does not model. The depth ratio (order notional / book depth within 0.5%) shows where that starts to matter.',
      'Few trades cannot show profitability: the audit estimates ~98 trades a year for SOL+ZEC and needs far more than 3 months for an edge. This report is for execution fidelity first.',
    ],
  };
}

// ------------------------------------------------------------------ text + HTML
const f2 = (v) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(2)), fR = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(3)}R`);
const usd = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`), pc = (v) => (v == null || !Number.isFinite(v) ? '—' : `${v.toFixed(1)}%`);
function renderText(r) {
  if (r.error) return `live-review: ${r.error}\n`;
  const L = [], g = r.gap_stats, t = r.totals;
  L.push(`Lucid'io live review · ${r.mode.toUpperCase()} · ${r.window.from_iso} to ${r.window.to_iso}`, `generated ${r.generated_at} · start balance ${usd(r.start_balance)}`, '');
  L.push(`Trades: live ${t.live.trades} closed (${t.live.open} open) · backtest ${t.backtest.trades} · matched pairs ${t.matched_pairs.n} · live-only ${r.counts.live_only} · backtest-only ${r.counts.backtest_only} · skipped signals ${r.counts.skipped_signals}`);
  L.push(`Live: ${fR(t.live.total_r)} total, avg ${fR(t.live.avg_r)}, win rate ${t.live.win_rate == null ? '—' : pc(t.live.win_rate * 100)}, ${usd(t.live.usd)}`);
  L.push(`Backtest same window: ${fR(t.backtest.total_r)} total, avg ${fR(t.backtest.avg_r)}, win rate ${t.backtest.win_rate == null ? '—' : pc(t.backtest.win_rate * 100)}`);
  L.push(`Matched pairs only: live ${fR(t.matched_pairs.live_total_r)} vs backtest ${fR(t.matched_pairs.backtest_total_r)}`, '');
  L.push('Average cost per matched trade (R; negative = cost to the live result):');
  const row = (name, s) => L.push(`  ${name.padEnd(22)} ${fR(s.mean).padStart(9)}   n=${s.n}${s.ci95 ? `   95% range ${fR(s.ci95[0])} to ${fR(s.ci95[1])}` : ''}`);
  row('live minus backtest', g.gap); row('entry slippage', g.entry_slip); row('exit slippage', g.exit_slip); row('fees', g.fees); row('funding', g.funding); row('rest (model/path)', g.rest);
  if (r.reconciliation) { const q = r.reconciliation; L.push('', `Account vs journal: equity change ${usd(q.equity_change_usd)}, journal P&L ${usd(q.journal_pnl_usd)}, unrealized change ${usd(q.unrealized_change_usd)}, unexplained ${usd(q.unexplained_usd)}`); }
  L.push('', 'What if the risk per trade had been different (same trades, same start balance, whole contracts, compounding):');
  for (const w of r.whatif) {
    for (const [name, s] of [['live trades', w.live_trades], ['backtest', w.backtest], ['backtest minus live cost', w.backtest_cost_adjusted]]) if (s) L.push(`  ${(w.risk_pct * 100).toFixed(2)}% ${name.padEnd(24)} final ${usd(s.final)} (${pc(s.return_pct)}) · max drawdown ${pc(s.max_dd_pct)} · taken ${s.trades_taken}, skipped ${s.skipped_total}${s.halted ? ' · HALTED at 39R' : ''}${s.max_depth_ratio != null ? ` · biggest order = ${(s.max_depth_ratio * 100).toFixed(0)}% of book depth` : ''}`);
  }
  if (r.history) { L.push('', `Long run (stored MEXC history ${r.history.from} to ${r.history.to}, ${r.history.trades} trades), start ${usd(r.start_balance)}:`); for (const s of r.history.results) L.push(`  ${(s.risk_pct * 100).toFixed(2)}%  final ${usd(s.final)} (${pc(s.return_pct)}) · max drawdown ${pc(s.max_dd_pct)} · worst trade ${pc(s.worst_trade_pct)} · longest losing streak ${s.max_losing_streak} · taken ${s.trades_taken}, skipped ${s.skipped_total}${s.halted ? ' · HALTED at 39R' : ''}`); }
  if (r.warnings.length) L.push('', 'Warnings:', ...r.warnings.map((w) => '  - ' + w));
  L.push('', 'Read this carefully:', ...r.caveats.map((c) => '  - ' + c));
  return L.join('\n') + '\n';
}

function svgLines(series, { w = 640, h = 240, yfmt = (v) => v.toFixed(0) + '%', xfmt = (v) => iso(v).slice(0, 10) } = {}) {
  const pts = series.flatMap((s) => s.pts); if (!pts.length) return '<p class="muted">No data yet.</p>';
  const L = 52, R = 10, T = 10, B = 24, x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]), x0 + 1);
  let y0 = Math.min(0, ...pts.map((p) => p[1])), y1 = Math.max(0, ...pts.map((p) => p[1])); if (y1 === y0) y1 = y0 + 1;
  const sx = (x) => L + ((x - x0) / (x1 - x0)) * (w - L - R), sy = (y) => T + (1 - (y - y0) / (y1 - y0)) * (h - T - B);
  let o = `<svg viewBox="0 0 ${w} ${h}" role="img"><line class="ax" x1="${L}" y1="${sy(0)}" x2="${w - R}" y2="${sy(0)}"/><line class="ax" x1="${L}" y1="${T}" x2="${L}" y2="${h - B}"/>`;
  series.forEach((s, i) => { if (s.pts.length) o += `<path class="ln c${i}" d="${s.pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ')}"/>`; });
  o += `<text x="${L - 6}" y="${T + 8}" text-anchor="end">${yfmt(y1)}</text><text x="${L - 6}" y="${h - B}" text-anchor="end">${yfmt(y0)}</text><text x="${L}" y="${h - 6}">${xfmt(x0)}</text><text x="${w - R}" y="${h - 6}" text-anchor="end">${xfmt(x1)}</text></svg>`;
  return o + `<div class="legend">${series.map((s, i) => `<span><i class="sw c${i}"></i>${s.name}</span>`).join('')}</div>`;
}
function svgScatter(pairs) {
  if (!pairs.length) return '<p class="muted">No matched pairs yet.</p>';
  const w = 320, h = 260, L = 40, B = 24, T = 10, R = 10, v = pairs.flatMap((p) => [p.live_R, p.backtest_R]), lo = Math.min(-1.2, ...v), hi = Math.max(1.2, ...v);
  const sx = (x) => L + ((x - lo) / (hi - lo)) * (w - L - R), sy = (y) => T + (1 - (y - lo) / (hi - lo)) * (h - T - B);
  return `<svg viewBox="0 0 ${w} ${h}" role="img"><line class="ax" x1="${sx(lo)}" y1="${sy(lo)}" x2="${sx(hi)}" y2="${sy(hi)}" stroke-dasharray="4 4"/><line class="ax" x1="${sx(lo)}" y1="${sy(0)}" x2="${sx(hi)}" y2="${sy(0)}"/><line class="ax" x1="${sx(0)}" y1="${sy(lo)}" x2="${sx(0)}" y2="${sy(hi)}"/>${pairs.map((p) => `<circle class="dot" cx="${sx(p.backtest_R).toFixed(1)}" cy="${sy(p.live_R).toFixed(1)}" r="4"><title>${p.symbol} ${p.side} ${p.signal}: backtest ${p.backtest_R.toFixed(2)}R, live ${p.live_R.toFixed(2)}R</title></circle>`).join('')}<text x="${w - R}" y="${h - 6}" text-anchor="end">backtest R →</text><text x="${L + 4}" y="${T + 8}">live R ↑</text></svg>`;
}
function svgBars(items) {
  const w = 320, rowH = 26, h = items.length * rowH + 8, m = Math.max(0.05, ...items.map((i) => Math.abs(i.v || 0))), mid = 170, sc = 120 / m;
  return `<svg viewBox="0 0 ${w} ${h}" role="img">${items.map((it, i) => { const y = 4 + i * rowH, v = it.v || 0; return `<text x="0" y="${y + 15}">${it.name}</text><rect class="${v < 0 ? 'neg' : 'pos'}" x="${v < 0 ? mid + v * sc : mid}" y="${y + 3}" width="${Math.abs(v) * sc}" height="14" rx="3"/><text x="${w}" y="${y + 15}" text-anchor="end">${fR(it.v)}</text>`; }).join('')}<line class="ax" x1="${mid}" y1="0" x2="${mid}" y2="${h}"/></svg>`;
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderHtml(r) {
  if (r.error) return `<!doctype html><meta charset="utf-8"><title>Live review</title><p>${esc(r.error)}</p>`;
  const t = r.totals, g = r.gap_stats, mid = r.whatif.find((w) => w.risk_pct === 0.005) || r.whatif[0];
  const toPct = (c, st) => c.map((p) => [p.t, (p.balance / st - 1) * 100]);
  const acct = r.account_curve.map((p) => [p.t, (p.equity / r.account_curve[0].equity - 1) * 100]);
  const curves = svgLines([{ name: 'MEXC account (snapshots)', pts: acct }, { name: `live trades re-sized @${(mid.risk_pct * 100).toFixed(1)}%`, pts: toPct(mid.live_trades.curve || [], r.start_balance) }, { name: `backtest @${(mid.risk_pct * 100).toFixed(1)}%`, pts: toPct(mid.backtest.curve || [], r.start_balance) }]);
  const card = (k, v, s) => `<div class="card"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s || ''}</div></div>`;
  const wiRows = r.whatif.map((w) => [['live trades', w.live_trades], ['backtest', w.backtest], ['backtest − live cost', w.backtest_cost_adjusted]].filter((x) => x[1]).map(([n, s]) => `<tr><td>${(w.risk_pct * 100).toFixed(2)}%</td><td class="l">${n}</td><td>${usd(s.final)}</td><td class="${s.return_pct >= 0 ? 'good' : 'bad'}">${pc(s.return_pct)}</td><td>${pc(s.max_dd_pct)}</td><td>${s.trades_taken}/${s.skipped_total}</td><td>${s.halted ? 'HALT 39R' : ''}${s.max_depth_ratio != null ? ` depth ${(s.max_depth_ratio * 100).toFixed(0)}%` : ''}</td></tr>`).join('')).join('');
  const histRows = r.history ? r.history.results.map((s) => `<tr><td>${(s.risk_pct * 100).toFixed(2)}%</td><td>${usd(s.final)}</td><td class="${s.return_pct >= 0 ? 'good' : 'bad'}">${pc(s.return_pct)}</td><td>${pc(s.max_dd_pct)}</td><td>${pc(s.worst_trade_pct)}</td><td>${s.max_losing_streak}</td><td>${s.trades_taken}/${s.skipped_total}</td><td>${s.halted ? 'HALT 39R' : ''}</td></tr>`).join('') : '';
  const histCurves = r.history ? svgLines(r.history.results.map((s) => ({ name: `${(s.risk_pct * 100).toFixed(2)}%`, pts: s.curve ? toPct(s.curve, r.start_balance) : [] })), { yfmt: (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(0) + 'k%' : v.toFixed(0) + '%') }) : '';
  const pairRows = r.pairs.map((p) => `<tr><td class="l">${p.symbol.replace('_USDT', '')} ${p.side}</td><td class="l">${p.signal}</td><td>${fR(p.live_R)}</td><td>${fR(p.backtest_R)}</td><td>${fR(p.gap_R)}</td><td>${fR(p.components_R.entry_slip)}</td><td>${fR(p.components_R.exit_slip)}</td><td>${fR(p.components_R.fees)}</td><td>${fR(p.components_R.funding)}</td><td>${fR(p.rest_R)}</td><td class="l">${esc(p.live_exit)}${p.live_exit !== p.backtest_exit ? ` ≠ ${esc(p.backtest_exit)}` : ''}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lucid'io live review</title><style>
:root{--bg:#f4f4f0;--card:#fff;--ink:#0d0d0d;--mut:#6f6f74;--line:#e1e1db;--acc:#4f7a00;--c0:#0d0d0d;--c1:#4f7a00;--c2:#2563eb;--c3:#c93131;--c4:#b8860b;--bad:#c93131;--good:#2e7d32}
@media (prefers-color-scheme:dark){:root{--bg:#070708;--card:#111113;--ink:#f5f5f0;--mut:#8e8e93;--line:#26262a;--acc:#c8ff3d;--c0:#f5f5f0;--c1:#c8ff3d;--c2:#6ea8ff;--c3:#ff6b6b;--c4:#e6b800;--bad:#ff6b6b;--good:#7ddc7d}}
*{box-sizing:border-box}body{margin:0;padding:16px;background:var(--bg);color:var(--ink);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:1100px;margin:0 auto}
h1{font-size:22px;margin:8px 0 2px}h2{font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:var(--mut);margin:0 0 10px}.muted{color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}.card,.panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px}.panel{margin:12px 0}
.k{font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.4px}.v{font-size:20px;font-weight:800}.s{font-size:12px;color:var(--mut)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:760px){.two{grid-template-columns:1fr}}
svg{width:100%;height:auto;display:block}svg text{fill:var(--mut);font-size:11px}.ax{stroke:var(--line);stroke-width:1}.ln{fill:none;stroke-width:2}.c0{stroke:var(--c0);background:var(--c0)}.c1{stroke:var(--c1);background:var(--c1)}.c2{stroke:var(--c2);background:var(--c2)}.c3{stroke:var(--c3);background:var(--c3)}.c4{stroke:var(--c4);background:var(--c4)}
.dot{fill:var(--acc);opacity:.8}.pos{fill:var(--good)}.neg{fill:var(--bad)}.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--mut);margin-top:6px}.sw{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px}
.scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}th{color:var(--mut);font-size:10.5px;text-transform:uppercase}td.l,th.l{text-align:left}.good{color:var(--good)}.bad{color:var(--bad)}
ul{margin:6px 0 0;padding-left:18px}li{margin:3px 0}</style></head><body>
<h1>Lucid'io live review</h1><div class="muted">${esc(r.mode.toUpperCase())} · ${esc(r.window.from_iso)} to ${esc(r.window.to_iso)} · start balance ${usd(r.start_balance)} · generated ${esc(r.generated_at)}</div>
<div class="grid">${card('Live trades', t.live.trades, `${t.live.open} open · ${t.live.win_rate == null ? '—' : pc(t.live.win_rate * 100)} win`)}${card('Live result', fR(t.live.total_r), usd(t.live.usd))}${card('Backtest, same window', fR(t.backtest.total_r), `${t.backtest.trades} trades`)}${card('Matched pairs', t.matched_pairs.n, `live-only ${r.counts.live_only} · backtest-only ${r.counts.backtest_only}`)}${card('Avg cost / trade', fR(g.gap.mean), 'live minus backtest')}${card('Journal vs MEXC', r.reconciliation ? usd(r.reconciliation.unexplained_usd) : '—', 'unexplained USD')}</div>
<div class="panel"><h2>Return on capital over time</h2>${curves}</div>
<div class="two"><div class="panel"><h2>Live R vs backtest R (each dot = one trade)</h2>${svgScatter(r.pairs)}</div><div class="panel"><h2>Where the difference comes from (avg R per trade)</h2>${svgBars([{ name: 'entry slippage', v: g.entry_slip.mean }, { name: 'exit slippage', v: g.exit_slip.mean }, { name: 'fees', v: g.fees.mean }, { name: 'funding', v: g.funding.mean }, { name: 'rest (model/path)', v: g.rest.mean }, { name: 'live − backtest', v: g.gap.mean }])}</div></div>
<div class="panel"><h2>What if the risk per trade had been different</h2><div class="scroll"><table><tr><th>Risk</th><th class="l">Trades</th><th>Final</th><th>Return</th><th>Max drawdown</th><th>Taken/skipped</th><th>Notes</th></tr>${wiRows}</table></div><p class="muted">Same trades, same start balance, whole contracts, 20x cap, margin check, compounding, 39R halt. “Depth” = biggest order as a share of the order-book depth within 0.5% of the price.</p></div>
${r.history ? `<div class="panel"><h2>Long run: stored MEXC history ${esc(r.history.from)} to ${esc(r.history.to)} (${r.history.trades} trades)</h2>${histCurves}<div class="scroll"><table><tr><th>Risk</th><th>Final</th><th>Return</th><th>Max drawdown</th><th>Worst trade</th><th>Losing streak</th><th>Taken/skipped</th><th>Notes</th></tr>${histRows}</table></div></div>` : ''}
<div class="panel"><h2>Every matched trade</h2><div class="scroll"><table><tr><th class="l">Trade</th><th class="l">Signal candle</th><th>Live</th><th>Backtest</th><th>Gap</th><th>Entry slip</th><th>Exit slip</th><th>Fees</th><th>Funding</th><th>Rest</th><th class="l">Exit</th></tr>${pairRows || '<tr><td class="l" colspan="11">No matched trades yet.</td></tr>'}</table></div></div>
<div class="panel"><h2>Read this carefully</h2><ul>${r.caveats.map((c) => `<li>${esc(c)}</li>`).join('')}${r.warnings.map((w) => `<li><b>Warning:</b> ${esc(w)}</li>`).join('')}</ul></div>
</body></html>`;
}

// ------------------------------------------------------------------ CLI
function args(argv) { const o = {}; for (let i = 2; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2), nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) o[k] = true; else { o[k] = nx; i++; } } } return o; }
async function main(argv = process.argv, deps = {}) {
  const a = args(argv), dir = a.journal || journal.dir();
  const tf = fs.existsSync(dir) && fs.statSync(dir).isDirectory() ? path.join(dir, 'trades.jsonl') : dir, sf = path.join(path.dirname(tf), 'snapshots.jsonl');
  const { events, bad } = journal.readAll(tf);
  if (!events.length) { console.error(`live-review: no journal events in ${tf}`); return 2; }
  const mode = a.mode || events[events.length - 1].mode, mine = events.filter((e) => e.mode === mode);
  if (!mine.length) { console.error(`live-review: no events for mode "${mode}" in ${tf}`); return 2; }
  const snapshots = journal.readAll(sf).events, nowS = deps.nowSec ?? Math.floor(Date.now() / 1000);
  const first = Math.min(...mine.map((e) => e.ts_ms)) / 1000, fromSig = Math.floor(first / IV) * IV - IV;
  const client = deps.client || require('./mexc.js').createClient();
  const candles = {};
  for (const s of config.ALLOWED_SYMBOLS) candles[s] = await downloadCandles(client, s, fromSig - (S.warmup + 4) * IV, nowS, nowS);
  const levels = a.risk ? String(a.risk).split(',').map(Number).filter((x) => x > 0 && x < 1) : [0.005, 0.01, 0.02, 0.05];
  const history = a.history ? historyTrades(deps.dataDir || path.join(__dirname, 'data')) : null;
  const report = analyze({ events, snapshots, candles, mode, tolerance: a.tolerance != null ? +a.tolerance : 0.05, now: nowS, riskLevels: levels, startBalance: a['start-balance'] != null ? +a['start-balance'] : undefined, history });
  if (report.error) { console.error('live-review: ' + report.error); return 2; }
  if (bad) report.warnings.push(`${bad} unreadable journal line(s) skipped`);
  if (!snapshots.length) report.warnings.push('no snapshots.jsonl found next to the journal: the account curve and the reconciliation need it (the bot writes it from this version on)');
  const day = new Date(nowS * 1000).toISOString().slice(0, 10), outDir = a['out-dir'] || path.join(__dirname, 'review');
  fs.mkdirSync(outDir, { recursive: true });
  const text = renderText(report);
  fs.writeFileSync(path.join(outDir, `live-review-${day}.json`), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(outDir, `live-review-${day}.txt`), text);
  fs.writeFileSync(path.join(outDir, `live-review-${day}.html`), renderHtml(report));
  if (!a.quiet) process.stdout.write(text);
  console.log(`written: ${path.join(outDir, `live-review-${day}`)}.html / .txt / .json`);
  return 0;
}

module.exports = { analyze, simulate, deriveLive, pairLive, backtestTrades, historyTrades, renderText, renderHtml, DEFAULT_SPECS, main };
if (require.main === module) main().then((c) => { process.exitCode = c; }, (e) => { console.error('live-review failed: ' + e.message); process.exitCode = 2; });
