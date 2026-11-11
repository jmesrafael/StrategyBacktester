# Monthly Telegram report: install when home

Built Nov 9, 2026. Replaces the weekly Telegram digest with ONE monthly message: a block per live bot (BB-CORE, I-CORE, T-CORE: Trades, Result, Drawdown) and a summary of all the accounts. Paper bots and labs are never included.
Nothing is deployed yet. Until you do the steps below, the old weekly message keeps arriving and no monthly message is sent.

It does not change how any bot decides or sizes a trade, and it never restarts a bot. The bots are only touched in step 4 (a small `perf-watch` job, not the trading process).

## What changed (all on the PC, not pushed yet)

| Where | Files | What |
|---|---|---|
| LEDGER (Vercel) | `lib/monthly.js`, `api/monthly-report.js`, `vercel.json` (cron), `tests/monthly-report.test.mjs`, `package.json` (test list) | builds + sends the monthly message on the 1st, 07:00 UTC, for the month that just ended |
| BB-Core | `perf-watch.js`, `test/perf-test.js`, `deploy/lucidio-perf.service`, `README.md`, `PENDING-UPGRADE.md` | weekly digest removed (daily rule-change alarms stay) |
| I-Core | `perf-watch.js`, `deploy/icore-perf.service`, `README.md` | same (identical `perf-watch.js`) |
| T-CORE / BB-1H | nothing | they have no weekly digest |

Tests already run on the PC: `node --test tests/monthly-report.test.mjs` in the ledger folder (7 pass), `node test/perf-test.js` in bb-core (57 pass).

## Order

Do the Vercel part first, check the dry run, and only then remove the weekly digest on the VPS. That way you are never left with no report at all.

### 1. PC: re-run the tests (30 seconds)

```bash
cd ledger && node --test tests/monthly-report.test.mjs      # expect: pass 7, fail 0
cd ../bb-core && node test/perf-test.js | tail -2            # expect: 57 passed, 0 failed
```
If anything fails, stop here.

### 2. Vercel: three variables

Vercel project (the LEDGER one) → Settings → Environment Variables → Production:

| Name | Value |
|---|---|
| `CRON_SECRET` | 32+ random characters (`openssl rand -hex 32`). Vercel sends it to the cron by itself; keep a copy for the dry run |
| `TELEGRAM_BOT_TOKEN` | the same bot token the VPS uses (server env file, never in the repo) |
| `TELEGRAM_CHAT_ID` | the same chat id the VPS uses |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already there for the dashboard.

### 3. Deploy the LEDGER, then dry run

PC, in the ledger folder: commit and push (the way you always deploy it). Vercel only reads the cron schedule from a production deploy. Check: Vercel → project → Settings → Cron Jobs shows `/api/monthly-report` at `0 7 1 * *`.

Dry run (sends nothing, shows the real October report from your real data):

```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" "https://<your-domain>/api/monthly-report?dry=1&month=2026-10"
```
Expected: JSON with `"sent":false` and `"text"`. Check against the dashboard:
- only the live bots are listed (no paper, no lab),
- each bot's Trades and Result match the dashboard's Performance tab for October,
- the Summary R and dollars are the sum of the bots.
If a `%` is missing in the summary, one live bot's balance at the start of the month is not known (see "Known limits"). That is intentional, not a bug.

Optional, see it in Telegram right now: the same call without `dry=1` sends the real message (use `month=2026-10`). It goes to your chat only.

```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" "https://<your-domain>/api/monthly-report?month=2026-10"
```
Expected `{"month":"2026-10","sent":true}`. `401` = wrong secret, `503` = a variable is missing, `502` = Telegram or the store refused.

### 4. VPS: remove the weekly digest (BB-Core and I-Core)

Same way you update the bots today: PC → commit + push `bb-core` and `i-core` → on each VPS menu → "Pull changes from GitHub" (see `bb-core/VPS-UPDATE-GUIDE.md` section 3d and `i-core/VPS-INSTALL-GUIDE.md`). Only `perf-watch.js` changed, so pick a quiet moment, but the trading process does not need to be restarted for it: the watch runs as its own daily job (`lucidio-perf.timer` 01:05 UTC, `icore-perf.timer` 01:15 UTC) and loads the new file on its next run.

Check on each VPS (nothing should say "weekly" or "digest"):

```bash
grep -c -i "digest" /opt/lucidio/perf-watch.js     # expect 0   (I-Core: /opt/icore/perf-watch.js)
sudo -u lucidio node /opt/lucidio/perf-watch.js --dry      # I-Core: sudo -u icore node /opt/icore/perf-watch.js --dry
```
Expected: "... 0 message(s) (dry run: nothing sent)" when no rule changed. Old state files with a `digest_week` field are fine, it is simply ignored.

### 5. Done when

- Dry run matches the dashboard, the test message arrived (optional), cron shows in Vercel.
- Both VPS copies have no "digest". No Monday message arrives any more.
- On the 1st of next month at 07:00 UTC (3:00pm Philippines) the November report arrives by itself.

## Known limits

- The % in the summary = result ÷ combined balance of the live bots at the start of the month. A bot that does not share its live balance (`DASHBOARD_SHARE_LIVE_EQUITY` not true) has no known start balance: the % is then left out, the R and dollars still show.
- Dollars come from the P&L MEXC booked (`closed_trades`). If a trade has no booked dollar figure yet, that bot shows R only.
- Drawdown = biggest fall from a high point inside the month (not carried over from the month before), in R and in dollars separately. The summary one is for the combined account.
- A bot counts only while its own mode is live. If T-CORE is still paper when the report runs, it is left out.
- The cron fires once. If Telegram is down at that moment, nothing retries; run the same URL (without `dry=1`) by hand.
- R is summed across bots in the summary even though each bot's R may be worth a different dollar amount. The dollar and % lines are the reliable overall figure.
