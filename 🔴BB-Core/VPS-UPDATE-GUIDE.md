# Putting everything on the VPS: step by step

Written Oct 24, 2026 for the Lucid'io bot (BB-Core) and its dashboard (LEDGER). The bot is **LIVE** (0.5% risk), so this guide is built around one rule: **nothing changes how the bot decides or sizes a trade**, and nothing restarts it near a candle close or while a position is open.

Every command says where it runs: **PC** (Git Bash or PowerShell, in the `🔴BB-Core` folder unless stated) or **VPS** (your SSH session). Copy each block exactly. If a check does not give the expected answer, **stop and do not continue** (the "If something goes wrong" table at the end says what to do).

---

## 0. What is new, and where each piece lives

| # | What | Lives on | Needs |
|---|---|---|---|
| 1 | Supabase: the "Ask bot now" request type (`20261113000000_bot_ask.sql`) | Supabase (SQL editor) | nothing else |
| 2 | Dashboard: Ask bot now button, `/api/ask`, `/api/poll`, 4-hour status logic | Vercel (LEDGER repo) | step 1 first |
| 3 | Bot code: journal, compare tools, shadow recorder files, dashboard poll, reserve API key, watchdog key alerts, new menu | VPS (`/opt/lucidio`) | published to the **bb-core** repo (3a), then the menu's "Pull changes from GitHub" |
| 4 | Shadow recorder (separate service, own user, optional) | VPS (`/opt/lucidio-shadow`) | does not touch the bot, can be done any time |
| 5 | MEXC key linked to the VPS IP (never expires) + optional reserve key | MEXC website, VPS | step 3 done |

Already done earlier (nothing to repeat unless step 1 below says otherwise): Supabase `109`, `110`, `111`, `112` (your seven checks were all `true`).

**Order that matters:** 1 (SQL) → 2 (Vercel) → 3 (bot). The bot can be updated before Vercel is ready: its "ask" polling would just get an error and slow itself down (harmless), but the button needs steps 1 and 2.

**Timing rule for the bot restart (step 3):** candles close at 12:00am, 4:00am, 8:00am, 12:00pm, 4:00pm and 8:00pm **UTC** (that is 8:00am, 12:00pm, 4:00pm, 8:00pm, 12:00am and 4:00am in the Philippines). Update **between 15 minutes after a close and 10 minutes before the next one**, for example 4:15am to 7:50am UTC (12:15pm to 3:50pm PH). The menu refuses inside 5 minutes before / 12 minutes after a close, so staying in my window is safer than the minimum.

---

## 1. Supabase: one new SQL file

What it does: lets the `bot_events` table hold two more row types (`ask`, `ask_done`) for the button. It changes **only** `bot_events`, creates **no** table, and touches no LEDGER table or function (so the backup-coverage check is not affected). It is safe to run twice. Undo: [the rollback file](../🔴LEDGER/supabase/rollback/20261113000000_rollback_bot_ask.sql).

**PC** (VS Code): open the file and copy all of it:

- [20261113000000_bot_ask.sql](../🔴LEDGER/supabase/migrations/20261113000000_bot_ask.sql)

Supabase dashboard → **SQL Editor** → New query → paste → **Run**. Expected: "Success. No rows returned".

Check it worked (paste in a new query, expect `true`):

```sql
select pg_get_constraintdef(oid) like '%ask_done%' as ask_enabled
from pg_constraint where conname = 'bot_events_type_check';
```

(If you want to try it on your staging project first, run the same file there. Production is only touched by you, never by me.)

---

## 2. Vercel: deploy the dashboard changes

**PC**: the LEDGER folder is its own repo (`jmesrafael/ledger`). In VS Code → Source Control → pick the **ledger** repository → review the changed files → Commit → Sync Changes. (Or in Git Bash: `cd "../🔴LEDGER" && git add -A && git commit -m "bot dashboard: Ask bot now" && git push`.)

Vercel builds by itself. Watch it: Vercel dashboard → the project → **Deployments** → the newest one must say **Ready**.

No new Vercel settings are needed (`DASHBOARD_PUSH_SECRET`, Supabase keys and the password already exist and are reused).

Check: open the bot dashboard page → log in → **Status** tab. You now see an **Ask bot now** button under the tiles. Do **not** press it yet (the bot on the VPS does not answer until step 3). If you press it anyway, after 3 minutes it says "No answer yet": that is expected.

---

## 3. The bot on the VPS

### 3a. Push the bot code to GitHub (PC)

This is all you do on the PC for the bot: **commit and push**. You never run `package.sh` or `scp` for it; the menu pull in 3d builds and installs everything on the VPS.

**Important:** the VPS pulls from the GitHub repo `jmesrafael/bb-core`, which is a **different repository** from the StrategyBacktester one your normal VS Code commits go to (it has its own history). Committing here does **not** change what the VPS sees; if the VPS menu shows an old commit, this is why.

1. Commit the BB-Core changes in your normal repository (VS Code, as always).
2. **PC** (Git Bash, in the `🔴BB-Core` folder): copy the committed files into a local clone of bb-core and review them:

   ```bash
   bash deploy/publish-to-bbcore.sh
   ```

   It stops after listing the changed files (it never commits or pushes by itself) and checks that `lucidio-core.js` is still `7cc03e24e38143b9303eb260cf1830a0e38b2e34`. `keyinfo.js` must be in the list.
3. Publish with the two commands it prints (commit and `push origin main` inside `~/bb-core-publish`).
4. Check on GitHub: `jmesrafael/bb-core` shows a new commit and `keyinfo.js` in the main folder.

Optional (the VPS runs its own safety tests during the pull): run the full safety tests on your PC (**PC**, Git Bash, in `🔴BB-Core`):

```bash
for t in selftest ops-test fixes-test journal-test telegram-test compare-test review-test menu-test shadow-test capital-flows-test dashboard-test dashboard-api-test dashboard-ui-test keys-test ask-test; do printf "%s: " $t; node test/$t.js 2>&1 | grep -E "passed" | tail -1; done
git hash-object lucidio-core.js
```

Expected: every line ends `0 failed`, and the last line is exactly `7cc03e24e38143b9303eb260cf1830a0e38b2e34` (the trading engine, unchanged).

### 3b. Check what the VPS has right now (VPS)

```bash
sudo -u lucidio node /opt/lucidio/lucidio.js status
sudo git hash-object /opt/lucidio/lucidio-core.js
sudo ls /opt/lucidio/keyinfo.js /opt/lucidio/journal 2>&1 | head -3
sudo systemctl is-active lucidio lucidio-watchdog.timer lucidio-shadow 2>&1
sudo cat /opt/lucidio/BUILD_INFO.json 2>/dev/null | head -5
```

Read it:

- `status` must show **no open position and no `UNFINISHED ORDER`** for either coin. **In live mode also open MEXC**: Futures → Positions empty, Open orders 0. If a trade is open, wait until it has closed, then start this step again.
- The hash line must be `7cc03e24e38143b9303eb260cf1830a0e38b2e34`. If it is different, **stop**: the bot on the VPS runs a different decision engine than the one I tested, and this is no longer a plain update (tell me).
- `keyinfo.js` / `journal` missing and `lucidio-shadow` `inactive` or "could not be found" just mean those parts were never installed. That is what this guide fixes.

### 3c. Back up first (VPS)

```bash
sudo systemctl start lucidio-backup.service
sudo tar -czf /var/backups/lucidio/pre-update-code-$(date -u +%Y%m%d-%H%M).tar.gz -C /opt/lucidio --exclude=./state --exclude=./journal --exclude=./audit --exclude=./.env --exclude=./mexc-keys.json .
ls -lh /var/backups/lucidio | tail -5
```

Expected: two fresh, non-empty files. (The installer also saves the old code by itself and `rollback.sh` uses that copy. Your keys and `.env` are never in a backup or touched by the update.)

### 3d. Pull the changes (VPS menu)

1. Check the time. It must be inside the safe window from section 0 (for example 4:15am to 7:50am UTC). The VPS menu shows the UTC time and the next candle close.
2. **VPS**: type `lucidio` to open the menu → **Pull changes from GitHub**.
3. It shows what is new and a list of changed files. Read it: you should see `keyinfo.js`, `dashboard-push.js`, `mexc.js`, `deploy/watchdog.js`, `deploy/add-reserve-key.sh` and `deploy/lucidio-menu.sh`, and **not** `lucidio-core.js`. Then answer `y`.
Each step now shows a coloured progress bar with a spinner, the step count (for example 4/9) and the time it has taken, then a green tick or a red cross. (Your old menu does not have this yet; it appears from the next pull on. Set `LUCIDIO_MENU_PLAIN=1` for plain lines.)
4. It runs the safety tests on the VPS (a minute or two). **Any FAIL stops the update and the bot keeps the old code.**
5. It builds the bundle (with a secrets scan) and installs it. The bot restarts for a few seconds. If the bot does not come back it **rolls back by itself**.
6. Last line: `Updated to: <commit>`, and a Telegram message "code updated to ...".

First time on this VPS the menu asks for the repo address and prints a deploy key to add on GitHub (read-only); follow what it prints. If the menu already pulled before, it just works.

### 3e. Check the bot is healthy (VPS)

```bash
sudo -u lucidio node /opt/lucidio/lucidio.js check
sudo systemctl status lucidio --no-pager | head -8
sudo journalctl -u lucidio -n 30 --no-pager
sudo git hash-object /opt/lucidio/lucidio-core.js
```

Expected:

- `check`: no `BAD` lines. It now also has `API key expiry` lines for each key (a date, or "does not expire"); `WARN` there only means a key is near its date or has none recorded.
- the service is `active (running)`, started a minute ago, and the log says it started in the **same mode as before** (live, risk 0.5%).
- the last line is again `7cc03e24e38143b9303eb260cf1830a0e38b2e34`.

Then reopen the menu (`lucidio`). It looks different now: that is the new menu. Choose **Health check**: the API key lines appear at the bottom.

### 3f. Verify the first candle after the update

About 2 to 3 minutes after the next 4-hour close:

```bash
sudo tail -n 2 /opt/lucidio/state/runs.jsonl | cut -c1-300
sudo -u lucidio node /opt/lucidio/lucidio.js status
```

Expected: a new run with a small `lagSec` (about 2 to 10), `errors: []`, both coins fetched, and "last candle" moved forward. With no signal, no trade line is normal.

### 3g. Optional environment settings (VPS)

Only if you want to change the defaults. Edit with `sudo -u lucidio nano /opt/lucidio/.env`:

```
DASHBOARD_ASK_POLL_SEC=60        # how often the bot asks "did anyone press Ask bot now?" (default 60, minimum 20, 0 = never)
DASHBOARD_HEARTBEAT_SEC=86400    # the extra safety-net heartbeat (default once a day; the bot also reports at every 4-hour candle close)
```

Changes apply at the next restart; do not restart in the candle window.

---

## 4. The shadow recorder (separate, any time, no bot restart)

It records what the engine would decide on every finished candle, next to the live bot. It runs as its own user and cannot see your keys, `.env`, `state/` or `journal/`. It **never stops, starts or restarts the bot**; it prints the bot's start time before and after as proof.

**Do this after step 3d.** The pull already put the full code on the VPS in `/opt/lucidio-src`, so there is nothing to package or copy from the PC.

**VPS**:

```bash
sudo bash /opt/lucidio-src/deploy/install-shadow.sh
```

(The manual route with `package-shadow.sh` and `scp` is in DEPLOY.md section 16; you do not need it.)

Check it:

```bash
sudo systemctl status lucidio-shadow --no-pager | head -6
sudo cat /var/lib/lucidio-shadow/status.json
sudo -u lucidio-shadow cat /opt/lucidio/.env       # must FAIL (Permission denied / No such file): it cannot see the bot's folder
```

The first record files appear about 2 seconds after the next 4-hour close. Do this **after** step 3d if you can: once the bot has the journal version, its daily compare job finds the recorder's folder by itself. (The full explanation and the PC-side compare command for the time before are in DEPLOY.md section 16.) Remove it any time: `sudo bash /tmp/lucidio/deploy/install-shadow.sh --uninstall`.

---

## 5. Test "Ask bot now" (after steps 1, 2 and 3)

1. Open the bot dashboard → **Status** tab → **Ask bot now**.
2. Within about a minute the line under the button says "The bot answered at <time>" and **Last heartbeat** changes to "a moment ago".
3. If it says "No answer yet" after 3 minutes, check on the **VPS**:

```bash
sudo journalctl -u lucidio -n 40 --no-pager | grep -i -E "dashboard|ask"
sudo -u lucidio node /opt/lucidio/lucidio.js check
```

Common causes: step 1 or 2 not done (the button then shows an error or the bot's polls fail), the bot is inside a run (it answers when the run ends), or `DASHBOARD_URL` / `DASHBOARD_PUSH_SECRET` missing in `/opt/lucidio/.env`.

What it costs: one tiny signed request a minute from the bot (about 1,440 a day, 43,000 a month) and almost no storage (it writes a row only when you press the button). Set `DASHBOARD_ASK_POLL_SEC=300` for one every 5 minutes if you want it lower. The bot never accepts a connection from outside: it asks.

---

## 6. MEXC key: link the VPS IP so it never expires

On the MEXC API page the field is **Link IP Address (optional)**: "keys that are not linked to an IP address are valid for 90 days only". A key linked to the VPS IP does not expire.

1. **VPS**: get the address MEXC will see (IPv4):

   ```bash
   curl -4 -s https://checkip.amazonaws.com
   ```

2. **MEXC website** → API Management. Permissions stay: **View Account, View Order, Order Placing**; **never Withdraw**. Enter that IPv4 in **Link IP Address**.
   - If MEXC lets you **edit** the existing key and add the IP, do that. The key and secret stay the same, nothing else to do except step 4.
   - If it only lets you create a new key, create one with the IP linked and continue with step 3.
3. **VPS**: put the new key in (hidden prompts, the bot picks the file up by itself, no restart):

   ```bash
   sudo bash /opt/lucidio/deploy/make-keys.sh
   ```

   Enter the new apiKey and apiSecret, answer **y** to "LINKED to this server's IP", leave the creation day empty, press Enter on the Telegram questions to keep them. (Use `add-reserve-key.sh` instead if you want the new key as the standby behind the current one.)
4. **VPS**: confirm MEXC accepts it from this server:

   ```bash
   sudo -u lucidio node /opt/lucidio/lucidio.js check
   ```

   The `API key` line must say `works`, and the `API key expiry` line must say "linked to the server IP: does not expire". A **406** means MEXC does not see the linked address: the server may be sending through IPv6, so tell me what `check` prints and I will fix it (do not go back and forth with the live key until it works; the old key stays valid while you try).
5. Never delete the old key on MEXC until `check` is fine with the new one **and** no trade is open.

**Keeping the reserve key anyway:** a second key on MEXC is a cheap safety net. For a key that is **not** linked to an IP, the watchdog warns 14, 7, 3 and 1 days before day 90, and the bot switches to the reserve by itself when MEXC rejects the first. Add it with `sudo bash /opt/lucidio/deploy/add-reserve-key.sh`.

---

## 7. The whole thing as one checklist

- [ ] 1. Supabase: `20261113000000_bot_ask.sql` ran, the check query says `true`
- [ ] 2. LEDGER pushed, Vercel deployment **Ready**, the button is visible
- [ ] 3a. BB-Core pushed to `jmesrafael/bb-core` (`keyinfo.js` visible on GitHub), tests pass on the PC, core hash `7cc03e24…`
- [ ] 3b. VPS: flat (no position, MEXC open orders 0), core hash `7cc03e24…`
- [ ] 3c. VPS: backups listed
- [ ] 3d. VPS menu → Pull changes from GitHub, inside the safe window, "Updated to ..."
- [ ] 3e. `check` has no BAD, service running, core hash still `7cc03e24…`
- [ ] 3f. First candle after the update is fine
- [ ] 4. Shadow recorder installed (optional)
- [ ] 5. Ask bot now answers
- [ ] 6. API key linked to the VPS IP, `check` happy

## If something goes wrong

| What you see | What to do |
|---|---|
| The update says a test FAILED | nothing was installed, the bot runs the old code. Send me the lines it printed. |
| The bot did not come back after the update | the menu already rolled back. Check `sudo -u lucidio node /opt/lucidio/lucidio.js status`. To roll back by hand: `sudo bash /opt/lucidio/deploy/rollback.sh` (`--list` shows versions). State and keys are never touched. |
| `check` shows BAD after the update | read the line. If you cannot fix it in a minute and no trade is open: `sudo bash /opt/lucidio/deploy/rollback.sh`. |
| The core hash is not `7cc03e24…` | stop, do not trade on it, tell me. |
| Pressing Ask bot now shows "store unavailable" | step 1 (SQL) was not run on the Supabase project the dashboard uses. |
| Ask bot now never gets an answer | section 5 troubleshooting. |
| MEXC says 406 after linking the IP | the address MEXC sees is not the one you entered (often IPv6). Keep the old key, tell me what `check` prints. |
| You want to undo the SQL | [rollback file](../🔴LEDGER/supabase/rollback/20261113000000_rollback_bot_ask.sql). It deletes only the ask rows and restores the old type list. |

More detail: `UPGRADE-LIVE.md` (the manual route with a preflight script), `DEPLOY.md` sections 14 (GitHub updates), 16 (shadow recorder), 17 (menu) and 18 (API key expiry and reserve key).
