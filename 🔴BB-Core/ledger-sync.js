// ledger-sync.js — posts the real MEXC futures equity to the Lucidyo Ledger after a run, so the ledger's unit price follows the account.
//
//   bot-config.json    "ledgerSync": true            (default false: nothing is ever sent)
//   mexc-keys.json     "ledgerUrl"    the Supabase project URL      (same as LEDGER/js/config.js SUPABASE_URL)
//                      "ledgerKey"    the publishable key           (same as LEDGER/js/config.js SUPABASE_KEY; public by design)
//                      "ledgerBotKey" the secret from LEDGER/scripts/new-bot-key.mjs
//
// It calls ONE database function, bot_post_equity(), which can only record an equity reading. The equity is MEXC's own number
// (cash + open trades), read with the bot's API key, never the paper balance. The database skips a reading that could misprice the
// pool (deposit waiting, withdrawal open, a >15% jump) and says why; the bot logs that as a warning. A failure here never stops trading.
'use strict';
const fs = require('fs'), path = require('path');

const KEYS = path.join(__dirname, 'mexc-keys.json');
const MIN_CHANGE = 0.005;               // USDT: below this the balance is "unchanged"
const MAX_QUIET_MS = 24 * 3600 * 1000;  // post at least once a day even when nothing changed, so the ledger shows the bot is alive

function keys() { try { return JSON.parse(fs.readFileSync(KEYS, 'utf8')); } catch { return {}; } }

// returns { status: 'off'|'noequity'|'unchanged'|'posted'|'skipped'|'error', ... }. last = { ts, equity } of the previous post (or null).
async function postEquity({ enabled, equity, last = null, dry = false, now = Date.now(), fetchImpl = fetch }) {
  if (!enabled) return { status: 'off' };
  if (!(equity > 0)) return { status: 'noequity', detail: 'no MEXC equity this run (needs an API key with View Account)' };
  const k = keys();
  if (!k.ledgerUrl || !k.ledgerKey || !k.ledgerBotKey) return { status: 'error', detail: 'ledgerUrl / ledgerKey / ledgerBotKey missing in mexc-keys.json' };
  const eq = Math.round(equity * 1e6) / 1e6;
  if (last && Math.abs(eq - last.equity) < MIN_CHANGE && now - last.ts < MAX_QUIET_MS) return { status: 'unchanged', equity: eq };
  if (dry) return { status: 'dry', equity: eq, detail: 'would post (dry run)' };
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetchImpl(k.ledgerUrl.replace(/\/+$/, '') + '/rest/v1/rpc/bot_post_equity', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: k.ledgerKey, Authorization: 'Bearer ' + k.ledgerKey },
      body: JSON.stringify({ p_key: k.ledgerBotKey, p_equity: eq, p_note: 'MEXC balance (bot)' }),
    });
    const text = await res.text(); let body; try { body = JSON.parse(text); } catch { body = null; }
    if (!res.ok) return { status: 'error', equity: eq, detail: `ledger ${res.status}: ${(body && (body.message || body.hint)) || text.slice(0, 200)}` };
    if (body && body.ok) return { status: 'posted', equity: eq, unitPrice: body.unit_price };
    return { status: 'skipped', equity: eq, detail: (body && (body.detail || body.skipped)) || 'skipped' };
  } catch (e) { return { status: 'error', equity: eq, detail: e.name === 'AbortError' ? 'ledger timeout' : e.message }; }
  finally { clearTimeout(timer); }
}

module.exports = { postEquity, keys };
