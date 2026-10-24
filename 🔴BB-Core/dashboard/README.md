# Lucid'io hosted dashboard (Vercel, push model)

The bot on the VPS **pushes** signed events to `POST /api/ingest`. Vercel never connects to the VPS and no inbound port is opened on the server.
Events are stored in a Supabase table (`bot_events`), the pages read them through a password-gated `GET /api/data`.

This folder is **not** inside the LEDGER project: `🔴LEDGER` is its own git repository (static site + Supabase, no `api/` folder), and I did not edit it.
It is built so you can drop it in: copy the contents of this folder into the LEDGER project root and the ledger keeps working exactly as before.

```
dashboard/api/       -> <ledger>/api/        ingest.js  health.js  login.js  data.js     (Vercel functions, CommonJS, no npm packages)
dashboard/lib/       -> <ledger>/lib/        signature, schema, ingest logic, store, auth, aggregate, rate limit
dashboard/bot-dashboard/   -> <ledger>/bot-dashboard/    the page (served at /bot-dashboard/): index.html, app.js, style.css
dashboard/supabase/migrations/20261111000000_bot_events.sql   -> run once in the Supabase SQL editor
```
```bash
cp -r dashboard/api dashboard/lib dashboard/bot-dashboard  <path-to-LEDGER>/        # (Windows: copy the three folders)
cp dashboard/supabase/migrations/*.sql               <path-to-LEDGER>/supabase/migrations/
```
Nothing existing is overwritten (the ledger has no `api/`, `lib/` or `bot-dashboard/`). Its `vercel.json` headers (nosniff, no-referrer, frame deny) apply to the new pages too.
If you would rather host this as a separate Vercel project, deploy this folder as the project root (`api/`, `lib/`, `bot-dashboard/` at its top level) and add a one-line `index.html` redirect.

## Vercel environment variables (Project Settings -> Environment Variables; never in the repo)

| Name | What | Used by |
|---|---|---|
| `DASHBOARD_PUSH_SECRET` | 32+ random characters, shared with the VPS (`openssl rand -hex 32`) | `/api/ingest` |
| `SUPABASE_URL` | the project URL (same as the ledger's) | ingest, data |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service-role** key. Server only: never in the page, the repo or the VPS | ingest, data |
| `DASHBOARD_PASSWORD` | the password for the pages | login |
| `DASHBOARD_SESSION_SECRET` | 16+ random characters (signs the session cookie) | login, data |

Without `DASHBOARD_PASSWORD` / `DASHBOARD_SESSION_SECRET` the pages stay locked (503), never open. You can additionally switch on **Vercel Authentication** for the project.

## VPS environment variables (the server env file `/opt/lucidio/.env`, chmod 600, owner lucidio)

| Name | What |
|---|---|
| `DASHBOARD_URL` | e.g. `https://lucidio.vercel.app` (no trailing path) |
| `DASHBOARD_PUSH_SECRET` | the same value as in Vercel |
| `DASHBOARD_SHARE_LIVE_EQUITY` | leave unset. Only `true` sends real MEXC equity/dollar P&L in live mode (paper balances are always sent) |

Unset = pushing is off and the bot behaves exactly as before.

## Deploy steps

1. Run the SQL migration in Supabase (SQL editor). RLS is on with no policy, so the public key can neither read nor write the table.
2. Copy the folders into the ledger project (above), set the five Vercel variables, deploy (`git push` / `vercel --prod`).
3. Open `https://<your-domain>/api/health` -> `{"ok":true}`; open `https://<your-domain>/bot-dashboard/` -> log in. DASHBOARD_URL is the site root only (https://<your-domain>, no path).
4. On the VPS: edit `/opt/lucidio/.env` (two variables), `sudo systemctl restart lucidio`, then `sudo -u lucidio node /opt/lucidio/lucidio.js check` -> the `dashboard` row says reachable.
5. Send the existing history once: `sudo -u lucidio node /opt/lucidio/lucidio.js dashboard-backfill` (same event ids, safe to repeat).

## What the bot sends

`heartbeat` (every candle close and every 5 min), `signal` (entered and skipped, with reasons), `entry`, `exit` (fees/slippage/funding labelled estimate in paper mode), `equity` (once per candle: R, paper balance), `compare` (summary of `compare-live-vs-backtest.js --push`).
Only SOL_USDT / ZEC_USDT events. Never API keys, tokens, the chat id, IP addresses or file paths (whitelisted fields, plus a final scan that drops any event containing one).

## Request format

`POST /api/ingest`, body `{"events":[...]}` (1 to 50), headers `X-Lucidio-Timestamp` (ms) and `X-Lucidio-Signature` = hex HMAC-SHA256(secret, `${timestamp}.${rawBody}`).
401 bad signature / more than 5 minutes off, 400 schema (unknown symbol, wrong types), 413 over 64 KB, 429 rate limited, 200 `{accepted, duplicates}`.

## Not verified here

A real deploy and real delivery need your Vercel and Supabase access. Tested locally (`node test/dashboard-test.js`): signature, replay, schema, outbox catch-up, aggregation, auth cookie.
Not tested: the Vercel runtime itself (reading the raw body from the stream, Supabase REST calls, the page in a browser, the in-memory rate limiter across instances).

## Capital added or paid out (from the ledger)

`GET /api/data` also reads the ledger's `capital_flows` view (deposits when they join the pool, payouts when marked sent; signed, no names) with the same service-role key. It exists only after
the ledger migration `20261112000000_pool_update.sql` is applied; before that the dashboard simply shows no flows. Capital is **not** profit or loss: it is taken out of "change since start", shows as
labeled steps on the Capital chart and in the log, never appears on the Performance tab (balance with capital taken out, plus a time-weighted return) and never enters the trade statistics.
Flows are applied to live data only; the paper balance has none. Tests: `node test/capital-flows-test.js`. The page also shows when the bot last reported ("Updated ... ago", the newest heartbeat or event).
Live dollar figures need `DASHBOARD_SHARE_LIVE_EQUITY=true` on the VPS; see `DEPLOY.md` section 15.
