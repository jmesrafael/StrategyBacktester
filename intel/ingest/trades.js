// ingest/trades.js - the trade exporter. Builds the spine dataset "trades" from the dashboard database.
//
// Two ways in, both read-only:
//   1. A JSON export file in intel/inputs/db-export/ (the newest file is used). This is how the first seed was made.
//   2. Live, with a READ-ONLY key: set INTEL_SUPABASE_URL and INTEL_SUPABASE_KEY (environment or secrets.local.json).
//      The job then downloads the tables over the REST API, saves them as a new export file, and continues as in 1.
// The raw export file is kept untouched (original data preserved); the dataset is rebuilt from it every run.
//
// Output files: trades.csv (one row per entry, joined to its exit), signals.csv, exchange_closed.csv,
// wallets.csv (every wallet snapshot), compares.csv (each bot's own daily live-vs-backtest check).
'use strict';
const fs = require('fs'), path = require('path');
const spine = require('../lib/spine'), cfg = require('../lib/config'), U = require('../lib/util');

const SCHEMAS = {
  trades: { trade_key: 'string', mode: 'string', bot: 'string', coin: 'string', symbol: 'string', side: 'string', dir: 'int', signal_candle_s: 'int?', entry_s: 'int', entry_price: 'number',
    stop_price: 'number', one_r: 'number', risk_pct: 'number?', qty: 'number?', intended_price: 'number?', entry_slippage_r: 'number?', entry_delay_s: 'number?', costs_kind: 'string?',
    status: 'string', exit_s: 'int?', exit_price: 'number?', r: 'number?', reason: 'string?', mfe_r: 'number?', mae_r: 'number?', bars: 'int?', hold_s: 'number?', stop_at_exit_r: 'number?', entry_event_id: 'string', exit_event_id: 'string?' },
  signals: { event_id: 'string', ts_s: 'int', mode: 'string', bot: 'string', symbol: 'string?', side: 'string?', decision: 'string?', reason: 'string?', detail: 'string?', signal_candle_s: 'int?' },
  exchange_closed: { wallet: 'string', position_id: 'string', symbol: 'string', coin: 'string', side: 'string', closed_s: 'int', realized_usd: 'number', fees_usd: 'number?', funding_usd: 'number?', r_result: 'number?' },
  wallets: { wallet: 'string', t: 'int', equity_usdt: 'number', unrealized_usdt: 'number?', open_positions: 'int?', suspect: 'bool' },
  compares: { event_id: 'string', ts_s: 'int', mode: 'string', bot: 'string', match: 'bool?', matched: 'int?', live_only: 'int?', backtest_only: 'int?', mismatches: 'int?', skipped_signals: 'int?', window_from_s: 'int?', window_to_s: 'int?' },
};
const num = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const int = (v) => { const n = num(v); return n == null ? null : Math.round(n); };
// which bot an event belongs to: data.bot, else the "bot|" prefix of the event id, else BB-CORE for live and "unknown" for paper
// (BB-CORE was the first live bot and its early events carry no tag).
const botOf = (e) => (e.data && e.data.bot) || (e.event_id.includes('|') ? e.event_id.split('|')[0] : e.mode === 'live' ? 'bbcore' : 'unknown');

function transform(exp) {
  const ev = exp.bot_events || [];
  const exits = new Map();
  for (const e of ev) if (e.type === 'exit') exits.set(botOf(e) + '|' + e.mode + '|' + (e.data.trade_id || e.event_id), e);
  const trades = [], usedExits = new Set(), dup = [];
  const seen = new Set();
  for (const e of ev.filter((x) => x.type === 'entry').sort((a, b) => a.ts_ms - b.ts_ms)) {
    const d = e.data || {}, bot = botOf(e), key = bot + '|' + e.mode + '|' + (d.trade_id || e.event_id);
    if (seen.has(key)) { dup.push(key); continue; } seen.add(key);
    const x = exits.get(key); if (x) usedExits.add(key);
    const xd = x ? x.data : {}, entry = num(d.entry), sl = num(d.sl);
    trades.push({ trade_key: key, mode: e.mode, bot, coin: e.symbol.replace('_USDT', ''), symbol: e.symbol, side: e.side, dir: e.side === 'LONG' ? 1 : -1,
      signal_candle_s: d.signal_candle_open_ms ? int(d.signal_candle_open_ms / 1000) : null, entry_s: int(e.ts_ms / 1000), entry_price: entry, stop_price: sl,
      one_r: num(d.one_r) != null ? num(d.one_r) : Math.abs(entry - sl), risk_pct: num(d.risk_pct), qty: num(d.qty), intended_price: num(d.intended_price), entry_slippage_r: num(d.slippage_r),
      entry_delay_s: num(d.delay_sec), costs_kind: d.costs_kind || null, status: x ? 'closed' : 'open', exit_s: x ? int(x.ts_ms / 1000) : null, exit_price: num(xd.exit), r: num(xd.r), reason: xd.reason || null,
      mfe_r: num(xd.mfe_r), mae_r: num(xd.mae_r), bars: int(xd.bars), hold_s: num(xd.hold_sec), stop_at_exit_r: num(xd.stop_at_exit_r), entry_event_id: e.event_id, exit_event_id: x ? x.event_id : null });
  }
  const orphanExits = [...exits.keys()].filter((k) => !usedExits.has(k));
  const signals = ev.filter((x) => x.type === 'signal').map((e) => ({ event_id: e.event_id, ts_s: int(e.ts_ms / 1000), mode: e.mode, bot: botOf(e), symbol: e.symbol || null, side: e.side || null,
    decision: (e.data && e.data.decision) || null, reason: (e.data && e.data.reason) || null, detail: e.data && e.data.detail ? String(e.data.detail).slice(0, 300) : null,
    signal_candle_s: e.data && e.data.signal_candle_open_ms ? int(e.data.signal_candle_open_ms / 1000) : null }));
  const compares = ev.filter((x) => x.type === 'compare').map((e) => { const d = e.data || {}; return { event_id: e.event_id, ts_s: int(e.ts_ms / 1000), mode: e.mode, bot: botOf(e), match: typeof d.match === 'boolean' ? d.match : null,
    matched: int(d.matched), live_only: int(d.live_only), backtest_only: int(d.backtest_only), mismatches: Array.isArray(d.mismatches) ? d.mismatches.length : null, skipped_signals: int(d.skipped_signals),
    window_from_s: d.window_from_ms ? int(d.window_from_ms / 1000) : null, window_to_s: d.window_to_ms ? int(d.window_to_ms / 1000) : null }; });
  const exchange_closed = (exp.closed_trades || []).map((c) => ({ wallet: c.wallet, position_id: String(c.position_id), symbol: c.symbol, coin: c.symbol.replace('_USDT', ''), side: c.side, closed_s: U.toSec(c.closed_at),
    realized_usd: num(c.realized_usd), fees_usd: num(c.fees_usd), funding_usd: num(c.funding_usd), r_result: num(c.r_result) }));
  const cols = exp.wallet_snapshot_columns || ['wallet', 'reported_at_s', 'equity_usdt', 'unrealized_usdt', 'open_positions', 'suspect'];
  const ix = Object.fromEntries(cols.map((c, i) => [c, i]));
  const wallets = (exp.wallet_snapshots || []).map((w) => (Array.isArray(w)
    ? { wallet: w[ix.wallet], t: int(w[ix.reported_at_s]), equity_usdt: num(w[ix.equity_usdt]), unrealized_usdt: num(w[ix.unrealized_usdt]), open_positions: int(w[ix.open_positions]), suspect: !!w[ix.suspect] }
    : { wallet: w.wallet, t: U.toSec(w.reported_at), equity_usdt: num(w.equity_usdt), unrealized_usdt: num(w.unrealized_usdt), open_positions: int(w.open_positions), suspect: !!w.suspect }));
  return { trades, signals, compares, exchange_closed, wallets, dup, orphanExits };
}

function newestExport() {
  const d = cfg.path(cfg.dbExportDir); if (!fs.existsSync(d)) return null;
  const f = fs.readdirSync(d).filter((x) => x.endsWith('.json')).sort().pop();
  return f ? path.join(d, f) : null;
}

// live download with a read-only key. fetchFn is injectable so the function can be tested without a network.
async function download(url, key, fetchFn = fetch) {
  const get = async (table, query) => {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const res = await fetchFn(`${url}/rest/v1/${table}?${query}`, { headers: { apikey: key, Authorization: 'Bearer ' + key, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' } });
      if (!res.ok) throw new Error(`${table}: HTTP ${res.status} (is the key allowed to read this table?)`);
      const rows = await res.json(); out.push(...rows); if (rows.length < 1000) break;
    }
    return out;
  };
  const bot_events = await get('bot_events', 'select=event_id,type,ts_ms,mode,symbol,side,data,received_at&type=in.(entry,exit,signal,compare)&order=ts_ms.asc,event_id.asc');
  const closed_trades = await get('closed_trades', 'select=*&order=closed_at.asc,id.asc');
  const wallet_snapshots = await get('wallet_snapshots', 'select=wallet,reported_at,equity_usdt,unrealized_usdt,open_positions,suspect&order=reported_at.asc,id.asc');
  return { source: 'Supabase REST API with a read-only key', exported_at: new Date().toISOString(), method: 'ingest/trades.js download', bot_events, closed_trades, wallet_snapshots };
}

async function run(opts = {}) {
  const url = cfg.secret('INTEL_SUPABASE_URL'), key = cfg.secret('INTEL_SUPABASE_KEY');
  const notes = [];
  if (!opts.file && url && key) {
    const exp = await download(url, key, opts.fetchFn);
    const f = path.join(cfg.path(cfg.dbExportDir), `export-${new Date().toISOString().slice(0, 10)}.json`);
    U.mkdirp(path.dirname(f)); fs.writeFileSync(f, JSON.stringify(exp)); notes.push('downloaded live with the read-only key');
  } else if (!opts.file) notes.push('no read-only database key configured: built from the newest export file (see intel/README.md, "Trade exporter key")');
  const file = opts.file || newestExport();
  if (!file) return spine.write('trades', { generator: 'ingest/trades.js', checks: [{ name: 'export file', ok: false, detail: 'no export file in ' + cfg.dbExportDir }], files: {} });
  const raw = fs.readFileSync(file), exp = JSON.parse(raw), t = transform(exp);
  const c = exp.counts || {}, n = (exp.bot_events || []).length;
  const checks = [
    { name: 'export parsed', ok: n > 0, detail: `${n} events, ${t.trades.length} trades, ${t.wallets.length} wallet snapshots` },
    { name: 'row counts match the database', ok: c.bot_events_exported == null || (c.bot_events_exported === n && c.closed_trades === t.exchange_closed.length && Math.abs(c.wallet_snapshots - t.wallets.length) <= 50),
      detail: c.bot_events_exported == null ? 'export carries no counts (live download)' : `events ${n}/${c.bot_events_exported}, closed ${t.exchange_closed.length}/${c.closed_trades}, snapshots ${t.wallets.length}/${c.wallet_snapshots} (snapshots arrive every few minutes, a small difference is the time between the two queries)` },
    { name: 'no duplicate trades', ok: t.dup.length === 0, detail: t.dup.length ? t.dup.join(', ') : 'none' },
    { name: 'every exit has an entry', ok: t.orphanExits.length === 0, detail: t.orphanExits.length ? t.orphanExits.join(', ') : 'none' },
    { name: 'prices and stops valid', ok: t.trades.every((x) => x.entry_price > 0 && x.stop_price > 0 && x.one_r > 0 && (x.dir === 1 ? x.stop_price < x.entry_price : x.stop_price > x.entry_price)), detail: 'entry, stop and 1R are positive and the stop is on the losing side' },
  ];
  return spine.write('trades', {
    generator: 'ingest/trades.js', checks, notes,
    source: { kind: 'dashboard database (Supabase project "Backtester")', tables: ['bot_events (entry, exit, signal, compare)', 'closed_trades', 'wallet_snapshots'], export_file: path.relative(cfg.BASE, file).replace(/\\/g, '/'),
      export_sha256: U.sha256(raw), exported_at: exp.exported_at || null, method: exp.method || null },
    files: { 'trades.csv': { rows: t.trades, schema: SCHEMAS.trades }, 'signals.csv': { rows: t.signals, schema: SCHEMAS.signals }, 'exchange_closed.csv': { rows: t.exchange_closed, schema: SCHEMAS.exchange_closed },
      'wallets.csv': { rows: t.wallets, schema: SCHEMAS.wallets }, 'compares.csv': { rows: t.compares, schema: SCHEMAS.compares } },
  });
}
module.exports = { run, transform, download, botOf, SCHEMAS };
if (require.main === module) run({ file: process.argv[2] }).then((m) => { console.log('trades:', m.status); for (const c of m.checks) console.log(' ', c.ok ? 'ok  ' : 'FAIL', c.name + ':', c.detail); process.exit(m.status === 'ok' ? 0 : 1); });
