// ledger-sync.js — sends what MEXC says to the investor Ledger (optional, off by default) after a run: a snapshot (balance, open positions, open orders) and the
// equity reading, so the ledger's unit price follows the account.
//
//   bot-config.json    "ledgerSync": true            (default false: nothing is ever sent)
//   mexc-keys.json     "ledgerUrl"    the Supabase project URL      (same as LEDGER/js/config.js SUPABASE_URL)
//                      "ledgerKey"    the publishable key           (same as LEDGER/js/config.js SUPABASE_KEY; public by design)
//                      "ledgerBotKey" the secret from LEDGER/scripts/new-bot-key.mjs
//
// It calls two database functions. bot_post_snapshot() only records what MEXC reported (it never changes anyone's money);
// bot_post_equity() records an equity reading. The equity is MEXC's own number (cash + open trades), read with the bot's API key,
// never the paper balance, and never sent when the MEXC read failed (an error is not a zero balance). The database skips a reading
// that could misprice the pool (deposit waiting, withdrawal open, unmatched MEXC transfer, a >15% jump) and says why.
// NOT YET SENT: MEXC's transfer history and realised PnL since the last snapshot (the client has no endpoint for them yet), so every
// snapshot is marked transfers_complete = false and a fee settlement with settlement_gate = 'on' needs the manager's written attestation.
// A failure here never stops trading.
'use strict';
const fs = require('fs'), path = require('path');

const KEYS = path.join(__dirname, 'mexc-keys.json');
const MIN_CHANGE = 0.005;               // USDT: below this the balance is "unchanged"
const MAX_QUIET_MS = 24 * 3600 * 1000;  // post at least once a day even when nothing changed, so the ledger shows the bot is alive

function keys() { try { return JSON.parse(fs.readFileSync(KEYS, 'utf8')); } catch { return {}; } }

async function rpc(fn, body, fetchImpl) {
  const k = keys();
  if (!k.ledgerUrl || !k.ledgerKey || !k.ledgerBotKey) return { error: 'ledgerUrl / ledgerKey / ledgerBotKey missing in mexc-keys.json' };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetchImpl(k.ledgerUrl.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: k.ledgerKey, Authorization: 'Bearer ' + k.ledgerKey },
      body: JSON.stringify({ p_key: k.ledgerBotKey, ...body }),
    });
    const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = null; }
    if (!res.ok) return { error: `ledger ${res.status}: ${(data && (data.message || data.hint)) || text.slice(0, 200)}` };
    return { data };
  } catch (e) { return { error: e.name === 'AbortError' ? 'ledger timeout' : e.message }; }
  finally { clearTimeout(timer); }
}

// returns { status: 'off'|'noequity'|'unchanged'|'posted'|'skipped'|'error', ... }. last = { ts, equity } of the previous post (or null).
async function postEquity({ enabled, equity, last = null, dry = false, now = Date.now(), fetchImpl = fetch }) {
  if (!enabled) return { status: 'off' };
  if (!(equity > 0)) return { status: 'noequity', detail: 'no MEXC equity this run (needs an API key with View Account)' };
  if (!keys().ledgerUrl) return { status: 'error', detail: 'ledgerUrl / ledgerKey / ledgerBotKey missing in mexc-keys.json' };
  const eq = Math.round(equity * 1e6) / 1e6;
  if (last && Math.abs(eq - last.equity) < MIN_CHANGE && now - last.ts < MAX_QUIET_MS) return { status: 'unchanged', equity: eq };
  if (dry) return { status: 'dry', equity: eq, detail: 'would post (dry run)' };
  const r = await rpc('bot_post_equity', { p_equity: eq, p_note: 'MEXC balance (bot)' }, fetchImpl);
  if (r.error) return { status: 'error', equity: eq, detail: r.error };
  if (r.data && r.data.ok) return { status: 'posted', equity: eq, unitPrice: r.data.unit_price };
  return { status: 'skipped', equity: eq, detail: (r.data && (r.data.detail || r.data.skipped)) || 'skipped' };
}

// what MEXC reported this run. openPositions / openOrders must be real counts: if they are unknown, nothing is sent.
async function postSnapshot({ enabled, equity, unrealized = null, openPositions, openOrders, dry = false, fetchImpl = fetch }) {
  if (!enabled) return { status: 'off' };
  if (!(equity >= 0) || !Number.isInteger(openPositions) || !Number.isInteger(openOrders)) return { status: 'noequity', detail: 'incomplete MEXC read this run: no snapshot sent' };
  if (dry) return { status: 'dry', detail: 'would send a snapshot (dry run)' };
  const r = await rpc('bot_post_snapshot', {
    p_equity: Math.round(equity * 1e6) / 1e6, p_open_positions: openPositions, p_open_orders: openOrders,
    p_unrealized: unrealized, p_realized_since: null, p_transfers: [], p_transfers_complete: false,
  }, fetchImpl);
  if (r.error) return { status: 'error', detail: r.error };
  return { status: 'sent', snapshotId: r.data && r.data.snapshot_id, recon: r.data && r.data.recon_status, detail: r.data && r.data.recon_detail };
}

// ---- one report per WALLET (ledger migration 20261130000000_wallet_snapshots.sql). OFF unless bot-config.json has "ledgerWalletSync": true, or you run `ledger-wallet-sync`.
// It is signed with THIS wallet's own secret, not the shared bot key:  mexc-keys.json  "ledgerWallet": "bbcore" | "icore"   "ledgerWalletKey": the secret printed by
// LEDGER/scripts/new-wallet-key.mjs  (plus the same "ledgerUrl" / "ledgerKey" as above). It sends only what MEXC returned for THIS account: equity (total equity, unrealized
// P&L included), unrealized, cashBalance (MEXC documents it as the withdrawable balance), availableBalance, and REAL counts of open positions and orders.
// If equity or cashBalance is missing or not a number, NOTHING is sent: a missing value is never replaced by zero, by the equity, or by the available balance.
// seq = the clock in milliseconds: it only goes up, so the ledger refuses a replay and accepts a retry of the very same report. A failure here never stops trading.
const WALLET_RE = /^[a-z][a-z0-9_]{1,19}$/;
const r6 = (v) => Math.round(Number(v) * 1e6) / 1e6;
const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

// the report the ledger will receive, or { error } saying what is missing. creds = { ledgerWallet, ledgerWalletKey }. No network, no secrets in the error text.
function walletReport({ account, openPositions, openOrders, creds = keys(), now = Date.now() }) {
  if (!creds.ledgerWallet || !WALLET_RE.test(String(creds.ledgerWallet))) return { error: 'ledgerWallet missing or invalid in mexc-keys.json (for example "bbcore" or "icore")' };
  if (!creds.ledgerWalletKey) return { error: 'ledgerWalletKey missing in mexc-keys.json' };
  if (!account || !isNum(account.equity) || Number(account.equity) < 0) return { error: 'no MEXC equity this run (an error is not a zero balance)' };
  if (!isNum(account.cashBalance) || Number(account.cashBalance) < 0) return { error: 'MEXC did not return cashBalance (the withdrawable balance): nothing sent, and it is not replaced by another figure' };
  if (!Number.isInteger(openPositions) || openPositions < 0 || !Number.isInteger(openOrders) || openOrders < 0) return { error: 'open positions / orders are not known this run: nothing sent' };
  return { wallet: creds.ledgerWallet, body: {
    p_wallet: creds.ledgerWallet, p_seq: Math.floor(now), p_reported_at: new Date(now).toISOString(),
    p_equity: r6(account.equity), p_unrealized: isNum(account.unrealized) ? r6(account.unrealized) : null,
    p_withdrawable: r6(account.cashBalance), p_available: isNum(account.availableBalance) ? r6(account.availableBalance) : null,
    p_open_positions: openPositions, p_open_orders: openOrders } };
}

async function walletRpc(creds, body, fetchImpl, fn = 'bot_post_wallet_snapshot') {
  if (!creds.ledgerUrl || !creds.ledgerKey) return { error: 'ledgerUrl / ledgerKey missing in mexc-keys.json' };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetchImpl(creds.ledgerUrl.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: creds.ledgerKey, Authorization: 'Bearer ' + creds.ledgerKey },
      body: JSON.stringify({ p_key: creds.ledgerWalletKey, ...body }),
    });
    const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = null; }
    if (!res.ok) return { error: `ledger ${res.status}: ${(data && (data.message || data.hint)) || text.slice(0, 200)}` };
    return { data };
  } catch (e) { return { error: e.name === 'AbortError' ? 'ledger timeout' : e.message }; }
  finally { clearTimeout(timer); }
}

// returns { status: 'off'|'incomplete'|'dry'|'sent'|'error', ... }
async function postWalletSnapshot({ enabled, account, openPositions, openOrders, dry = false, now = Date.now(), creds = keys(), fetchImpl = fetch }) {
  if (!enabled) return { status: 'off' };
  const rep = walletReport({ account, openPositions, openOrders, creds, now });
  if (rep.error) return { status: 'incomplete', detail: rep.error };
  if (dry) return { status: 'dry', wallet: rep.wallet, report: rep.body, detail: 'would send this wallet snapshot (dry run)' };
  const r = await walletRpc(creds, rep.body, fetchImpl);
  if (r.error) return { status: 'error', wallet: rep.wallet, detail: r.error };
  return { status: 'sent', wallet: rep.wallet, snapshotId: r.data && r.data.snapshot_id, replayed: !!(r.data && r.data.replayed), suspect: !!(r.data && r.data.suspect) };
}

// ---- closed trades (ledger migration 20261203000000_closed_trades_auto_pool.sql). Every closed LIVE trade is sent once with the realised P&L MEXC booked for the position
// (history_positions.realised: the same figure the Telegram exit message shows). It is never an estimate: a trade whose MEXC history is missing is NOT sent (it is retried
// from the journal later). The ledger refuses a second copy with other figures and treats an identical resend as a harmless replay, so resending is always safe.
// Signed with the wallet's own key, like the wallet snapshot. A failure here never stops trading.
const sideOf = (v) => (v === 1 || v === 'LONG' ? 'LONG' : v === -1 || v === 'SHORT' ? 'SHORT' : null);

// i = the exit hook's info ({ symbol, dir, R, exitSec, costs }) or a journal exit event ({ symbol, side, r_result, exit_ts, costs, mode }). -> { body } | { error }
function closedTradeReport(i, creds = keys()) {
  if (!creds.ledgerWallet || !WALLET_RE.test(String(creds.ledgerWallet))) return { error: 'ledgerWallet missing or invalid in mexc-keys.json' };
  if (!creds.ledgerWalletKey) return { error: 'ledgerWalletKey missing in mexc-keys.json' };
  if (i && i.mode && i.mode !== 'live') return { error: 'not a live trade' };
  const h = i && i.costs && i.costs.exit && i.costs.exit.mexc_history;
  if (!h || !isNum(h.realised) || h.positionId == null || h.positionId === '') return { error: 'MEXC did not return this position\'s realised P&L: not sent (never an estimate)' };
  const side = sideOf(i.side != null ? i.side : i.dir), symbol = i.symbol;
  const closedMs = isNum(h.updateTime) ? Number(h.updateTime) : i.exitSec != null ? Math.round(Number(i.exitSec) * 1000) : i.exit_ts ? Date.parse(i.exit_ts) : NaN;
  if (!side || !symbol || !Number.isFinite(closedMs)) return { error: 'trade is missing symbol, side or close time' };
  const r = i.r_result != null ? i.r_result : i.R;
  return { wallet: creds.ledgerWallet, body: {
    p_wallet: creds.ledgerWallet, p_position_id: String(h.positionId), p_symbol: String(symbol), p_side: side, p_closed_at: new Date(closedMs).toISOString(),
    p_realized: r6(h.realised), p_fees: isNum(h.fee) ? r6(h.fee) : null, p_funding: isNum(h.holdFee) ? r6(h.holdFee) : null, p_r: isNum(r) ? Math.round(Number(r) * 1e4) / 1e4 : null } };
}

// returns { status: 'off'|'incomplete'|'dry'|'sent'|'error', ... }
async function postClosedTrade({ enabled, trade, dry = false, creds = keys(), fetchImpl = fetch }) {
  if (!enabled) return { status: 'off' };
  const rep = closedTradeReport(trade, creds);
  if (rep.error) return { status: 'incomplete', detail: rep.error };
  if (dry) return { status: 'dry', report: rep.body, detail: 'would send this closed trade (dry run)' };
  const r = await walletRpc(creds, rep.body, fetchImpl, 'bot_post_closed_trade');
  if (r.error) return { status: 'error', positionId: rep.body.p_position_id, detail: r.error };
  return { status: 'sent', positionId: rep.body.p_position_id, replayed: !!(r.data && r.data.replayed), pool: r.data && r.data.pool };
}

// An exit whose journal record has no MEXC history (MEXC had not returned the closed position yet at the exit, as with BB-Core's NEAR short of Nov 10, 2026)
// was never sent, and the ledger then blocked every flow ("bot exit without a booked MEXC result"). history(symbol, startMs) is the bot's READ-ONLY
// history_positions call. The position is taken only when exactly ONE closed position of that coin and side closed within 15 minutes of the exit (and, when the
// journal knows the entry fill, opened within 0.5% of it). Anything else stays unsent: never a guess, never the bot's own estimate.
async function recoverHistory(e, history) {
  const want = sideOf(e.side) === 'LONG' ? 1 : sideOf(e.side) === 'SHORT' ? 2 : null;
  const exitMs = e.exit_ts ? Date.parse(e.exit_ts) : Number(e.ts_ms);
  if (!want || !e.symbol || !Number.isFinite(exitMs)) return null;
  const entry = e.entry_summary && Number(e.entry_summary.fill_price), opened = e.match_key && Number(e.match_key.signal_candle_open_ms);
  const list = await history(e.symbol, (Number.isFinite(opened) && opened > 0 ? opened : exitMs - 30 * 86400000) - 86400000);
  const hits = (Array.isArray(list) ? list : []).filter((x) => +x.state === 3 && +x.positionType === want && Math.abs(+x.updateTime - exitMs) <= 15 * 60000
    && (!(entry > 0) || Math.abs(+x.openAvgPrice / entry - 1) <= 0.005));
  if (hits.length !== 1) return null;
  const h = hits[0];
  return { positionId: h.positionId, realised: h.realised, fee: h.fee, holdFee: h.holdFee, updateTime: h.updateTime, recovered: true };
}

// resend every live exit in the journal newer than sinceMs (safe: the ledger records each trade once). events = journal.readAll().events
// history: optional read-only MEXC lookup (see recoverHistory) for exits without MEXC history, tried back to recoverSinceMs (default 14 days).
async function flushClosedTrades({ enabled, events, sinceMs = 0, dry = false, creds = keys(), fetchImpl = fetch, history = null, recoverSinceMs = Date.now() - 14 * 86400000 }) {
  const out = { sent: 0, replayed: 0, skipped: 0, recovered: 0, errors: [] };
  for (let e of events || []) {
    if (!e || e.type !== 'exit' || e.mode !== 'live') continue;
    const missing = !(e.costs && e.costs.exit && e.costs.exit.mexc_history);
    if (!(Number(e.ts_ms) >= sinceMs) && !(missing && history && Number(e.ts_ms) >= recoverSinceMs)) continue;
    if (missing && history && enabled) {
      let h = null; try { h = await recoverHistory(e, history); } catch (err) { out.errors.push(`${e.symbol} ${e.exit_ts}: MEXC history not read (${err.message})`); }
      if (h) { e = { ...e, costs: { ...(e.costs || {}), exit: { ...((e.costs && e.costs.exit) || {}), mexc_history: h } } }; out.recovered++; }
    }
    const r = await postClosedTrade({ enabled, trade: e, dry, creds, fetchImpl });
    if (r.status === 'sent') (r.replayed ? out.replayed++ : out.sent++);
    else if (r.status === 'error') out.errors.push(`${r.positionId}: ${r.detail}`);
    else out.skipped++;
  }
  return out;
}

module.exports = { postEquity, postSnapshot, postWalletSnapshot, walletReport, closedTradeReport, postClosedTrade, flushClosedTrades, recoverHistory, keys };
