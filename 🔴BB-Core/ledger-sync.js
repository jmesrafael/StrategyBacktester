// ledger-sync.js — sends what MEXC says to the Lucid'io Ledger after a run: a snapshot (balance, open positions, open orders) and the
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

module.exports = { postEquity, postSnapshot, keys };
