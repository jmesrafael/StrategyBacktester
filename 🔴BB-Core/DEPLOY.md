# Lucid'io - VPS deployment guide (paper mode first)

Target: Ubuntu 22.04 or 24.04, 1 vCPU / 1 GB RAM / 20 GB. The bot is a single Node.js process (no npm packages) that wakes once per 4h candle.
Everything below is copy-paste. `YOUR_IP` = the server's IPv4, `YOU` = your SSH user (`root` on most new VPSs until you add a user).

> **What was verified, and what was not.** Verified on the build machine (Node 22.19, Windows): the bundle builds and contains no secrets; `selftest` (23),
> `fixes-test` (9), `ops-test` (26) and `replay SOL,ZEC` pass when run from the extracted bundle alone; all `.sh` files pass `bash -n`.
> **Not verified:** `setup-vps.sh` and the systemd units were never executed on Ubuntu (no Linux machine here), and nothing was run against MEXC.
> The first run on the VPS is the real test: read the `WARN:` lines it prints, and do the checks in section 7 before you trust it.

## 0. Before you start

- Order the VPS with **Ubuntu 24.04** (or 22.04). Pick the location by your **exchange access**, not by price: MEXC may refuse some countries and
  datacenter IPs, and that is separate from hardware. You find out with `lucidio.js check` (section 3). Check the renewal price, not only the first term.
- Put your SSH **public key** on the server before running setup (setup only switches off password login when a key is already there):

```powershell
# on your PC (PowerShell). Skip ssh-keygen if you already have ~\.ssh\id_ed25519
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@YOUR_IP "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh root@YOUR_IP          # must log in WITHOUT a password prompt for the server's password. If it asks, stop and fix this first.
```

## 1. Build the bundle (on your PC)

```bash
# Git Bash, in the 🔴BB-Core folder
bash deploy/package.sh --with-tests     # first install: adds test/ + 3 data files (~0.8 MB) so you can test the server
bash deploy/package.sh                  # later updates: runtime files only (~56 KB)
```

`package.sh` prints the file list, the size, and a "secrets check" (no `state/`, `mexc-keys.json`, `data/`, `audit/`, `research/`, `.git`, `node_modules`;
no token/key/URL patterns in the content; `bot-config.json` must say `paper`, `riskPct <= 1%`, empty `heartbeatUrl`). If anything fails, it deletes the bundle.
Output: `lucidio-deploy.tar.gz` and `lucidio-deploy.tar.gz.sha256`.

## 2. Copy it to the server and run the setup

```powershell
# PowerShell on your PC (scp ships with Windows 10/11). With rsync instead: rsync -av --progress lucidio-deploy.tar.gz* root@YOUR_IP:/tmp/
scp lucidio-deploy.tar.gz lucidio-deploy.tar.gz.sha256 root@YOUR_IP:/tmp/
ssh root@YOUR_IP
```

```bash
# on the server
cd /tmp && sha256sum -c lucidio-deploy.tar.gz.sha256        # must print: lucidio-deploy.tar.gz: OK
rm -rf /tmp/lucidio && tar -xzf lucidio-deploy.tar.gz && cd /tmp/lucidio
sudo bash deploy/setup-vps.sh                               # re-runnable; read every "WARN:" line it prints
```

What it does (each step checks first, so running it twice is safe): swap (skipped, not fatal, on containers) - chrony + UTC - Node.js 22 LTS from the
NodeSource apt repo (signed key; `NODE_MAJOR=24` to choose another) - ufw (deny in, SSH only) - fail2ban - unattended security upgrades (no auto reboot) -
key-only SSH (only if a key is installed; `--skip-ssh-hardening` to skip) - journald capped at 200 MB - `lucidio` system user - app in `/opt/lucidio` -
systemd: `lucidio.service` (MemoryHigh 300M / MemoryMax 450M, start limit 20 per 10 min, alert on failure), `lucidio-watchdog.timer` (every 10 min: alert
if no run for 4h20m), `lucidio-backup.timer` (daily 03:30 UTC state backup, 14 kept in `/var/backups/lucidio`).
It does **not** start the bot and never enables live trading.

**Do this now:** keep that SSH window open, open a second terminal, and confirm `ssh root@YOUR_IP` still works with your key. Only then close the first.

## 3. Keys, alerts, first checks

```bash
sudo bash /opt/lucidio/deploy/make-keys.sh        # hidden prompts: MEXC apiKey/apiSecret (+ optional Telegram token/chat id). Writes chmod 600, owner lucidio. Never echoes them.
```

MEXC key: **View Account + View Order + Order Placing only, never Withdraw**, bound to the server's IPv4 (the setup summary and `make-keys.sh` print it;
`curl -4 https://checkip.amazonaws.com`). Keys without an IP binding expire after 90 days. For paper mode the keys are optional (they only add the real
balance snapshot), so you can start without them.

Dead-bot alert from outside the server (healthchecks.io, free): create a check with **Period 4 hours, Grace 20 minutes**, copy its ping URL, then:

```bash
read -rsp "Heartbeat URL: " HB; echo
sudo -u lucidio env HB="$HB" node -e 'const c=require("/opt/lucidio/config.js");const v=c.validate({heartbeatUrl:process.env.HB});if(!v.ok){console.error(v.errors);process.exit(1)}c.save(v.next);console.log("heartbeatUrl saved")'
unset HB
```

The bot pings that URL after every successful run (and `/fail` after a failed or stale one). `watchdog.js` is the second, independent alarm on the box itself.

First checks (all read-only, nothing is traded; `check` makes public MEXC requests, plus account reads if keys exist):

```bash
sudo -u lucidio node /opt/lucidio/lucidio.js check               # want: no BAD lines; clock under ~500 ms; "live gate ... mode is paper"
sudo -u lucidio node /opt/lucidio/deploy/watchdog.js --notify "test from the VPS"   # a Telegram message must arrive (if configured)
sudo -u lucidio node /opt/lucidio/test/selftest.js         # 40 passed   (the tests need the --with-tests bundle)
sudo -u lucidio node /opt/lucidio/test/fixes-test.js                          # 9 passed
sudo -u lucidio node /opt/lucidio/test/ops-test.js                            # 26 passed
sudo -u lucidio node /opt/lucidio/test/journal-test.js                        # 21 passed
sudo -u lucidio node /opt/lucidio/test/telegram-test.js                       # 23 passed
sudo -u lucidio node /opt/lucidio/test/compare-test.js                        # 18 passed
sudo -u lucidio node /opt/lucidio/test/dashboard-test.js                      # 52 passed
sudo -u lucidio node /opt/lucidio/test/dashboard-api-test.js                  # 15 passed
sudo -u lucidio node /opt/lucidio/lucidio.js replay SOL,ZEC                   # IDENTICAL trade-for-trade, both coins
```

## 4. Start, status, logs

```bash
sudo systemctl start lucidio                       # paper mode (bot-config.json says paper)
systemctl status lucidio --no-pager                # active (running)
sudo journalctl -u lucidio -f                      # live log, Ctrl+C to leave
sudo journalctl -u lucidio --since "6 hours ago" --no-pager
sudo tail -n 50 /opt/lucidio/state/bot.log         # the bot's own log (same lines)
sudo -u lucidio node /opt/lucidio/lucidio.js status      # balance, open positions, results so far
sudo -u lucidio node /opt/lucidio/deploy/paper-report.js # the automatic rows of the pass/fail table (section 7)
systemctl list-timers 'lucidio-*'                  # watchdog + backup timers
systemctl show lucidio -p MemoryCurrent -p MemoryPeak -p NRestarts
chronyc tracking | grep -E "System time|Leap"      # clock offset
```

Dashboard (read-only view; it only listens on 127.0.0.1 so you reach it through an SSH tunnel; **the local port must be 8787**, other ports are rejected):

```powershell
ssh -L 8787:127.0.0.1:8787 root@YOUR_IP            # leave open, then on the server:
```
```bash
sudo -u lucidio env LUCIDIO_DASH_NO_OPEN=1 node /opt/lucidio/dashboard.js    # run it as lucidio, not root, or it creates root-owned files in state/
# browse to http://127.0.0.1:8787 on your PC. Ctrl+C stops the dashboard only; the bot keeps running.
```

Kill switch (no new entries; open trades keep their stop/target on MEXC): `sudo -u lucidio touch /opt/lucidio/STOP` - remove the file to resume.
Settings (risk, coins, heartbeat) are re-read at every run; `riskPct` is capped at **1%**.

## 5. Update later

```powershell
# PC: bash deploy/package.sh   then
scp lucidio-deploy.tar.gz lucidio-deploy.tar.gz.sha256 root@YOUR_IP:/tmp/
```
```bash
cd /tmp && sha256sum -c lucidio-deploy.tar.gz.sha256 && rm -rf /tmp/lucidio && tar -xzf lucidio-deploy.tar.gz && cd /tmp/lucidio
sudo bash deploy/setup-vps.sh          # saves the old code to /var/backups/lucidio, copies the new, restarts the service if it was running
sudo journalctl -u lucidio -n 30 --no-pager && sudo -u lucidio node /opt/lucidio/lucidio.js status
```

`bot-config.json`, `state/` and `mexc-keys.json` are never overwritten. Do not update while a signal is expected within the next minutes (the restart takes seconds, but a
run in progress is cut short: an order that was already sent is recovered by id on the next start).

## 6. Roll back

```bash
sudo bash /opt/lucidio/deploy/rollback.sh --list                 # code backups, newest first (the last 5 are kept)
sudo bash /opt/lucidio/deploy/rollback.sh                        # newest; or pass a file: .../code-20261101-120000.tar.gz
sudo journalctl -u lucidio -n 30 --no-pager
```

Restore state (positions/trades/run history) and settings from the daily backup - the keys are deliberately not in it:

```bash
ls -1t /var/backups/lucidio/state-*.tar.gz | head -3
sudo systemctl stop lucidio
sudo tar -xzf /var/backups/lucidio/state-YYYYMMDD-HHMMSS.tar.gz -C /opt/lucidio && sudo chown -R lucidio:lucidio /opt/lucidio
sudo systemctl start lucidio
```

## 7. Paper-mode pass / fail table

Run for **at least 14 days** (>= 80 runs) before you spend a second on live. Rows P1-P6 are computed by `deploy/paper-report.js` (exit code 1 if any fails).

| # | Check | How | PASS | FAIL -> do |
|---|---|---|---|---|
| P1 | No 4h candle without a run | `paper-report.js` | 0 missing | find the gap in `journalctl`; reboot/VM pause/crash? fix before live |
| P2 | Wake lag | `paper-report.js` | <= 10 s in >= 99% of candles | VPS too slow/busy or clock off: `chronyc tracking`, other region |
| P3 | Wake lag worst case | `paper-report.js` | never > 120 s (entry window is 900 s) | any > 900 s = a signal would have been skipped; find out why |
| P4 | Run errors / missing candles | `paper-report.js` | 0 runs with errors, 0 stale | read the `ERROR` lines in `bot.log`; MEXC outage vs our bug |
| P5 | Clock vs MEXC | `paper-report.js` | p95 <= 500 ms, max <= 2000 ms | `chronyc sources`; restart chrony; a very long ping inflates this estimate |
| P6 | Run duration | `paper-report.js` | p95 <= 15 s | network path to MEXC is poor: other region |
| M1 | Telegram works | `sudo -u lucidio node /opt/lucidio/deploy/watchdog.js --notify "test"` | message arrives on the phone | token/chat id wrong: rerun `make-keys.sh` |
| M2 | Dead-bot alert | `sudo systemctl stop lucidio`, wait 4h30m | Telegram "no bot run recorded for 4h2xm" and healthchecks goes down; `start` then gives "bot is running again" | `systemctl list-timers 'lucidio-*'`, `journalctl -u lucidio-watchdog` |
| M3 | Heartbeat | healthchecks.io dashboard after 2 days | check is "up", last ping within 4h | `heartbeatUrl` empty/wrong: section 3 |
| M4 | Restart is clean | `sudo systemctl restart lucidio` | active in < 20 s; log shows "stopped (service stop)" then "started loop"; trades/positions in `status` unchanged | read `journalctl -u lucidio -n 50` |
| M5 | Crash recovery | `sudo kill -9 $(systemctl show -p MainPID --value lucidio)` | systemd restarts it within ~15 s, `NRestarts` +1 | unit not installed? `systemctl cat lucidio` |
| M6 | Reboot recovery | `sudo reboot` | after 2 min `systemctl is-active lucidio` = active and a run is logged for the next candle | `systemctl is-enabled lucidio` must say enabled |
| M7 | Memory | after 14 days `systemctl show lucidio -p MemoryPeak`; `free -m` | peak < 150 MB (expected 50-80); available RAM > 300 MB | peak > 300 MB: investigate before upgrading; see "2 GB" below |
| M8 | Disk and logs | `df -h /`; `journalctl --disk-usage`; `sudo du -sh /opt/lucidio/state` | disk < 50% used; journal <= 200 MB; state < 20 MB | prune; check what writes |
| M9 | Backup | after 03:30 UTC `ls -l /var/backups/lucidio/`; `sudo tar -tzf <newest state-*.tar.gz>` | a `state-*.tar.gz` exists, holds `state/state.json`, **no** `mexc-keys.json` | `systemctl status lucidio-backup.timer`, run `sudo systemctl start lucidio-backup.service` |
| M10 | Network exposure | `sudo ufw status`; `sudo ss -ltnp` | ufw active, only SSH allowed; nothing listens on 0.0.0.0 except sshd (the dashboard, if running, on 127.0.0.1) | re-run `setup-vps.sh` |
| M11 | SSH | `sudo sshd -T \| grep -E "^(passwordauthentication\|permitrootlogin)"`; `sudo fail2ban-client status sshd` | `no` / `prohibit-password`; jail active | add your key, re-run `setup-vps.sh` |
| M12 | Secrets | `ls -l /opt/lucidio/mexc-keys.json` | `-rw------- lucidio lucidio` | `sudo chmod 600 ... && sudo chown lucidio:lucidio ...` |
| M13 | Live gate | `systemctl cat lucidio \| grep -i ALLOW_LIVE`; `grep '"mode"' /opt/lucidio/bot-config.json` | no ALLOW_LIVE line; mode `paper` | remove the drop-in: `sudo systemctl revert lucidio` |
| M15 | Telegram trade messages | the first paper trade | an ENTRY message (symbol, side, mode, entry, SL, TP, risk %, 1R, signal candle) and later an EXIT message (reason, price, R, hold time) | section 10; `check` telegram row |
| M16 | Journal | after the first trade: `sudo tail -n 3 /opt/lucidio/journal/trades.jsonl` | one `entry` and one `exit` line per trade, skipped signals as `skip` lines, a `session` line per bot start | `check` journal row (writable?) |
| M17 | Live vs backtest | after 1-2 days: `ls /opt/lucidio/audit/out/` and read the newest `compare-*.txt` | a file per day; `RESULT: MATCH`, or every INVESTIGATE item explained (section 11) | `systemctl status lucidio-compare.timer` |
| M18 | Dashboard (if configured) | open the dashboard page | banner ALIVE, last heartbeat under 4h20m (press Ask bot now for a fresh one), `PAPER` badge, trades match `status` | section 12; `check` dashboard row |
| M14 | Strategy evidence | the strategy audit (`audit/AUDIT-REPORT.md` section 8, in the StrategyBacktester repo under `research/bb-core/`) | **not decidable in 14 days.** The audit wants >= 120 days and >= 25 closed trades, plus the shadow recorder, before live | keep paper running |

Upgrade to 2 GB or more RAM if: `MemoryPeak` stays above ~300 MB, `free -m` shows < 150 MB available or constant swap use, `NRestarts` rises from OOM kills
(`journalctl -k \| grep -i "out of memory"`), or you add the shadow recorder / more coins. More RAM would add headroom only; it does not make execution faster.

## 8. Going live (later - not part of this deployment)

Only after section 7 is green, the audit's paper window is done, and `test-trade` passes. Two things are required, so a copied config or a stray click cannot start real trading:

```bash
sudo -u lucidio node -e 'const c=require("/opt/lucidio/config.js");const v=c.validate({mode:"live",riskPct:0.0025});if(!v.ok){console.error(v.errors);process.exit(1)}c.save(v.next)'   # 1) mode live (state/ from paper must be moved aside first)
sudo systemctl edit lucidio       # 2) the flag - paste:  [Service]  then  Environment=LUCIDIO_ALLOW_LIVE=1
sudo -u lucidio env LUCIDIO_ALLOW_LIVE=1 node /opt/lucidio/lucidio.js test-trade SOL --yes --allow-live   # REAL orders (cents). Must print PASS.
```

Without the flag, a `live` config makes every run end with an error ("live trading is not enabled on this machine"), a Telegram alert and a `/fail` heartbeat - no order is sent.

## 9. If MEXC access is lost (HTTP 403/451, region/IP/permission errors)

- **Still works without the bot:** the stop and target sit on MEXC and trigger on last price. They are not guaranteed (slippage, gaps, MEXC trouble), and liquidation is ~2x the stop distance away.
- **Stops working:** reading positions, re-placing a cancelled stop/target, the time exit (49 candles), new entries, recording exits. The bot alerts on Telegram **once**, does not retry within the run, tries again at the next 4h run, and stays up.
- **Manual steps:** (1) `sudo -u lucidio bash /opt/lucidio/deploy/mexc-reachability.sh` on the server. (2) From your phone/PC open MEXC: does every open position still have BOTH a stop and a target? If not, set them or close it. (3) `sudo -u lucidio touch /opt/lucidio/STOP` (no new entries). (4) Fix: IP binding changed -> update the key's IP; key expired/permission -> new key via `make-keys.sh`; region/IP block -> new VPS region or IP, then rebind the key. (5) `sudo -u lucidio node /opt/lucidio/lucidio.js check`, remove `STOP`; the bot adopts its open position by id, but the time exit may then come late.

## 10. Telegram alerts

Messages sent: **ENTRY** and **EXIT** for every trade, **errors**, **skipped signals** (a skipped signal is a missed trade), MEXC-blocked and dead-bot alerts. Telegram being down or slow never blocks, delays or crashes a trade (8 s timeout, everything caught).
It uses the Telegram Bot API with a bot token and a chat id: no phone number is stored anywhere.

1. In Telegram open **@BotFather**, send `/newbot`, pick a name, copy the **token** it gives you.
2. Open your new bot (the link BotFather shows) from your own account (**@jamesrfael**) and press **Start**.
3. On the server, put the token in the env file and run the setup helper (it checks the token with getMe, finds your chat id with getUpdates, sends a test message; it never prints the token):
```bash
sudo -u lucidio nano /opt/lucidio/.env                           # TELEGRAM_BOT_TOKEN=<paste>   (save: Ctrl+O, Enter, Ctrl+X)
sudo -u lucidio node /opt/lucidio/lucidio.js telegram-setup      # prints "chat id found: ..." and sends a test message
sudo -u lucidio nano /opt/lucidio/.env                           # TELEGRAM_CHAT_ID=<the number it printed>
sudo systemctl restart lucidio
sudo -u lucidio node /opt/lucidio/lucidio.js check               # telegram row: OK, bot @... reachable, chat id set
```
No editor needed: `sudo bash /opt/lucidio/deploy/set-env.sh TELEGRAM_BOT_TOKEN` (hidden prompt: paste the token, Enter) and `sudo bash /opt/lucidio/deploy/set-env.sh TELEGRAM_CHAT_ID <number> --restart` set the values for you. It never prints them and refuses names it does not know.
If it says "No update found yet", open the bot, press Start (or send it any message) and rerun `telegram-setup`. The older `telegramToken` / `telegramChatId` fields in `mexc-keys.json` still work when the env variables are not set.

## 11. The trade journal and the live-vs-backtest check

`/opt/lucidio/journal/trades.jsonl` is append-only (never edited or rewritten; each record is fsync'ed; a torn last line after a crash is sealed, not rewritten). Event types: `entry`, `exit`, `skip` (with the reason), `session` (a bot start).
Every event carries mode (paper/live), git commit, code hash, config hash and bot version. Entries carry the signal candle, the indicator values the decision used, intended and real fill, SL, TP, size, risk % and costs (labelled **estimate** in paper mode).
Trades are matched on **symbol + side + signal candle open time (UTC ms)**. The journal is part of the daily backup in `/var/backups/lucidio`, together with the state and the compare reports.

```bash
sudo tail -n 3 /opt/lucidio/journal/trades.jsonl                                     # newest events
sudo -u lucidio node /opt/lucidio/compare-live-vs-backtest.js                        # journal window vs freshly downloaded MEXC candles; exit 0 = match, 1 = not a match
sudo -u lucidio node /opt/lucidio/compare-live-vs-backtest.js --tolerance 0.1 --from 2026-10-24 --push    # options: --journal --from --to --mode --shadow-dir --out-dir
ls /opt/lucidio/audit/out/ && systemctl list-timers 'lucidio-compare*'               # a report per day (00:40 UTC), JSON and text
```
It only reads public MEXC candles (the still-forming candle is dropped), never needs a key and never sends an order. **MATCH** = same trade set, same exit reasons, R and entry price within the tolerance (default 0.05R).
Everything else is an **INVESTIGATE** item with its evidence: skipped signals that explain a backtest-only trade, candles that differ from the final download, and the distance of the signal close to its nearest threshold (the earlier audit found every venue mismatch within about 0.06% of one).
Paper fills use the price at wake-up and no funding, so a small R gap against the backtest is normal. A candle difference, or a close within 0.06% of a threshold, is the usual cause of a missing or extra trade. It compares from the first journal event, so run it after the bot has been up for a few candles. With no trades on either side it reports a match "by absence".

## 12. Hosted dashboard (Vercel)

Optional. The bot pushes signed events from the VPS to your Vercel project; Vercel never connects to the server and no port is opened. Off unless both variables are set.
Everything to deploy (SQL, API routes, pages, Vercel variables) is in **`dashboard/README.md`**. On the VPS only two variables are needed in `/opt/lucidio/.env`:
```bash
sudo -u lucidio nano /opt/lucidio/.env          # DASHBOARD_URL=https://<your-domain>   DASHBOARD_PUSH_SECRET=<same value as in Vercel>
sudo systemctl restart lucidio
sudo -u lucidio node /opt/lucidio/lucidio.js check                    # dashboard row: reachable, N event(s) queued
sudo -u lucidio node /opt/lucidio/lucidio.js dashboard-backfill       # send the journal history once (safe to repeat: same event ids)
```
Heartbeats go out at every candle close (6 a day), once a day as a safety net (`DASHBOARD_HEARTBEAT_SEC`, default 86400) and at once when you press **Ask bot now** on the dashboard (the bot asks `/api/poll` outbound every `DASHBOARD_ASK_POLL_SEC` seconds, default 60, 0 = never; it stays quiet while a run is in progress). If the dashboard is down, events queue on disk (`state/outbox.jsonl`) and catch up in order, without duplicates, when it is back. Real MEXC equity and dollar P&L are never sent in live mode unless you set `DASHBOARD_SHARE_LIVE_EQUITY=true`.

## 13. Pulling the data for the live-vs-backtest review (research)

While the bot trades live at 0.5%, three things are recorded so a later review can compare it with the backtester, trade by trade. None of them changes a trade:

| File / field | What it holds |
|---|---|
| `journal/trades.jsonl` (entry) | intended vs real fill, entry delay, slippage in R, contracts, leverage, risk $ and %, balance used, and **`costs.order_book`**: how deep the book was within 0.1% / 0.5% / 1% when the order went in |
| `journal/trades.jsonl` (exit) | MEXC's own realised P&L, fees and funding, and **`costs.exit`**: who closed the trade (`mexc_trigger`, `bot_time_exit`, `bot_abort`), the stop/target trigger price, the real fill, exit slippage in R, and MEXC's position-history fields |
| `journal/snapshots.jsonl` (new, one line per run, about every 4 h) | MEXC equity, available balance, unrealized P&L, margin, the positions MEXC reports, the positions the bot believes it holds, bot balance and total R |

**1. On the VPS**, pack the journal (read-only, no keys inside):
```bash
sudo bash /opt/lucidio/deploy/export-journal.sh
```
**2. On your PC (PowerShell)**, copy and unpack it (folder `live-data/` is gitignored):
```powershell
cd "C:\Users\james\Desktop\StrategyBacktester\🔴BB-Core"
scp admin@YOUR_SERVER_IP:/tmp/lucidio-journal-YYYYMMDD.tgz .
mkdir live-data -Force; tar xzf lucidio-journal-YYYYMMDD.tgz -C live-data
```
**3. On your PC**, build the report (reads only; public candle downloads, no key):
```powershell
node live-review.js --journal live-data/journal --history
```
It writes `review/live-review-<date>.html` (open it in a browser), `.txt` and `.json`. Options: `--risk 0.005,0.01,0.02,0.05` (what-if levels), `--start-balance 52`, `--mode paper`, `--tolerance 0.05`.

What the report contains: live trades paired with the backtest trade on the same candles (matched / live-only / backtest-only / skipped, with reasons); for every pair the R gap split into entry slippage, exit slippage, fees, funding and "the rest"; the journal reconciled against the MEXC account snapshots (USD that is in the account but not in the journal); live vs backtest equity as % of capital; and the **risk what-if**: the same trades re-sized at 0.5 / 1 / 2 / 5 % with the bot's own sizing (whole contracts, 20x cap, margin, 39R halt, compounding, **no $10 cap**). `--history` also runs the what-if over the full stored MEXC history, because ~24 live trades in 3 months cannot show profitability (the audit counts ~98 trades a year for SOL+ZEC).
The bot itself stays capped at 1%: other risk levels exist only inside this simulation. Test: `node test/review-test.js`.

## 14. Updating the bot from GitHub (the "Pull changes from GitHub" menu entry)

The bot code has its own private repo, `jmesrafael/bb-core` (only this folder, not the whole StrategyBacktester). Workflow: **edit here on the PC, commit and push (VS Code: the BB-Core repository -> Commit -> Sync Changes, or `git push`) -> on the VPS, `lucidio` -> "Pull changes from GitHub"**.

What the menu entry does, step by step (nothing is installed unless every step passes):
1. fetches the repo into a read-only mirror at `/opt/lucidio-src` (root-owned, never edited) and shows what is new, with a diff summary against the installed version;
2. asks "Pull these changes? [y/N]"; refuses near a 4-hour candle close (5 min before to 12 min after) unless you type `force`;
3. runs `selftest`, `ops-test`, `journal-test` and `fixes-test` on the new code. **Any failure stops the update; the bot keeps the old code**;
4. builds the bundle with the same `deploy/package.sh` (secrets scan included) and installs it with the same `deploy/setup-vps.sh` as a manual update. Your `bot-config.json`, `state/`, `journal/`, `.env` and `mexc-keys.json` are never touched, and `LUCIDIO_ALLOW_LIVE` stays as it is;
5. waits 8 s; if the bot is not running again it **rolls back to the previous code automatically** (`deploy/rollback.sh`); otherwise it records the installed commit and sends "code updated to <commit>" to Telegram.
`Server health` in the menu shows which commit is installed.

**One-time setup on the VPS** (the menu walks you through it): choose the update entry, paste `git@github.com:jmesrafael/bb-core.git`; it creates a key for this server and prints it. On GitHub: repo `bb-core` -> Settings -> Deploy keys -> Add deploy key -> paste it, leave "Allow write access" **unchecked** (the server can only read). Press Enter in the menu to continue.

Safety notes: pushing to `main` does not touch the bot; only clicking Update does. Turn on two-factor authentication on the GitHub account, because whoever can push to `bb-core` can change the code that trades. To make that harder, set `LUCIDIO_UPDATE_BRANCH=release` and only move the `release` branch when you mean to ship. Test it without installing: `LUCIDIO_UPDATE_DRYRUN=1 lucidio --action update`.

## 15. Money in and out: queued money stays in Spot, Update Pool, and what the dashboard shows

The bot's results never move the pool by themselves. Full design, numbers and settings: `🔴LEDGER/docs/pool-update.md`. What changes on this server and in your routine:

- **Queued money stays in MEXC Spot.** A joiner's USDT arrives in **Spot**, never straight into Futures. The bot sizes on Futures equity, so money in Spot is not traded and
  cannot change the position size or take part in a trade before the person is in the pool.
- **Acceptance includes the Spot -> Futures transfer.** In the ledger: Record -> Balance -> **Update Pool** (or **Update Pool and accept ticked**). Right after you click, in MEXC
  transfer the accepted amount from **Spot to Futures**. The bot's next run (within 4 hours) sees the larger Futures equity and sizes the next trade on it. That increase is capital, not profit.
- **Withdrawals:** Update Pool first, then Redeem; then Futures -> Spot, withdraw, and click **Sent from MEXC** in the same sitting.
- **Only a flat account can move money** (no open position, both coins). From the backtest the account is flat only about 19% of the time and a random moment waits about 5 days (median).
  Collect joins and payouts, set a cut-off, pause new entries with the kill switch, and act at the first flat window. `node flat-time-report.js` prints the numbers.
- **To see dollar P&L on the dashboard in live mode** set `DASHBOARD_SHARE_LIVE_EQUITY=true` in `/opt/lucidio/.env` (privacy trade-off: the password-protected dashboard then shows real dollar
  amounts). Without it live exits arrive without a dollar figure and Update Pool cannot add up the pending result.
- **Bot config:** leave `"ledgerSync"` as it is. Even when on, the bot can no longer move the unit price: the ledger setting `bot_equity_sync` is `off`; only snapshots (balance, open positions, unrealized)
  are accepted, and they feed the reconciliation.
- **Dashboard:** capital added or paid out appears as labeled steps on the Capital chart and in the log, is taken out of "change since start", and never shows on the Performance curve or in the trade statistics.
  It reads the ledger's `capital_flows` view with the Vercel service-role key (nothing new to configure; before the ledger migration exists the dashboard simply shows no flows).

### Order of the Supabase files (staging first, never production first)

`20261106000000_capital_workflow.sql`, `20261109000000_settlement_controls_backup.sql`, `20261110000000_contact_details.sql`, `20261111000000_bot_events.sql`, then
`20261112000000_pool_update.sql` (each only if it is not already applied; apply in filename order). Rollback for the last one: `supabase/rollback/20261112000000_rollback_pool_update.sql`.
Then deploy the dashboard files (`dashboard/lib`, `dashboard/api`, `dashboard/bot-dashboard`, already copied into the ledger project) and the ledger page (`js/poolupdate.js`, `js/app.js`, `index.html`).

## 16. Shadow recorder (optional sidecar for live-vs-backtest data; install it WITHOUT restarting the bot)

A separate, read-only process that records every finished 4-hour candle next to the live bot, so `compare-live-vs-backtest.js` can show what the engine decided on the same candles, and when they were fetched.
Per finished candle and per coin it saves: the last 200 closed candles plus the new (forming) candle exactly as fetched, the indicator values (BB upper/mid/lower, SMA200, ATR14, distance to the nearest threshold),
the decision the engine makes on them (LONG / SHORT / none, stop, target, the reasons), the order book and fees, and the **fetch time** (when the response arrived, how long the request took, how many seconds after the close,
a `late` flag). Every line carries the bot journal's own match key: **symbol + side + signal candle open (UTC ms)** (`matchkey.js`).

What isolates it from the bot (all enforced, none of it is a promise):
- **Own user, own folders:** user `lucidio-shadow`; code in `/opt/lucidio-shadow` (owned by root, so it cannot change its own code); data in `/var/lib/lucidio-shadow`.
- **No keys, no bot files:** the systemd unit hides `/opt/lucidio`, `/var/backups` and `/etc/lucidio` from it (`InaccessiblePaths`), so `mexc-keys.json`, `.env`, `state/` and `journal/` do not exist for it; `ProtectSystem=strict` makes everything else read-only except its data folder; the code never imports `mexc.js` and every write is path-checked inside its data folder.
- **Public GETs only:** its single network function refuses anything that is not an https GET to `contract.mexc.com` / `fapi.binance.com` or whose path contains private, order, account, position, stoporder, asset or trade.
- **Nothing shared with the bot:** no file, socket or lock. Stopping, killing or crashing it cannot change what the bot does. It restarts itself (`Restart=always`) and logs to the journal (capped by the journald limit above).
- **Disk limits:** files are rotated per UTC day, gzipped after a day, the oldest are deleted while the folder is over 300 MB (`SHADOW_MAX_MB` in the unit), and it stops writing when less than 500 MB of disk is free.

**Install without touching the bot** (the bot service is never stopped, started or restarted; the installer prints the bot's start time before and after as proof):

**PC** (Git Bash, in the `🔴BB-Core` folder):
```bash
bash deploy/package-shadow.sh
```
**PC** (PowerShell; replace `YOUR_IP` and `admin`):
```powershell
scp lucidio-shadow.tar.gz lucidio-shadow.tar.gz.sha256 admin@YOUR_IP:/tmp/
```
**VPS**:
```bash
cd /tmp && sha256sum -c lucidio-shadow.tar.gz.sha256 && tar -xzf lucidio-shadow.tar.gz
sudo bash /tmp/lucidio/deploy/install-shadow.sh
```
(With a full bundle already extracted you can instead run `sudo bash deploy/setup-vps.sh --shadow-only`, which does only this. `setup-vps.sh --with-shadow` installs it after a normal update, which restarts the bot as every update does.)

Check it:
```bash
sudo systemctl status lucidio-shadow --no-pager | head -6
sudo cat /var/lib/lucidio-shadow/status.json                        # last cycle, bytes, errors
sudo ls -lh /var/lib/lucidio-shadow | head                          # records-<day>.jsonl and windows-<day>.jsonl appear after the next candle close + 2 s
sudo -u lucidio-shadow cat /opt/lucidio/.env                        # must fail: Permission denied / No such file (it cannot see the bot's folder)
```
The first records appear at the next 4-hour close. Once the bot runs the journal version, its daily compare job (`lucidio-compare`) picks the folder up by itself (`/var/lib/lucidio-shadow`) and joins the recorder to the journal on the match key.
**Before that upgrade** the bot on the VPS has the old compare script, so compare on your PC against copies (the report lists what the no-journal mode cannot check):

**VPS**: `sudo cp /opt/lucidio/state/state.json /tmp/state.json && sudo chmod 644 /tmp/state.json`
**PC** (PowerShell, in the `🔴BB-Core` folder):
```powershell
scp admin@YOUR_IP:/tmp/state.json .
scp -r admin@YOUR_IP:/var/lib/lucidio-shadow ./shadow-copy
node compare-live-vs-backtest.js --no-journal --state state.json --shadow-dir shadow-copy --out-dir compare-out
```
 Remove it any time: `sudo bash /tmp/lucidio/deploy/install-shadow.sh --uninstall` (the data stays; add `--purge` to delete it).

Moving a bot that is already running to the journal version: `UPGRADE-LIVE.md`.

## 17. The VPS menu (`lucidio`)

Type `lucidio` (or `menu`) after you sign in. It shows the logo, then the bot state (active / stopped / kill switch on) with the trade count and R, the account (mode, equity, risk), the clock
(`PH` = your time, UTC) and the next 4-hour candle close with a countdown bar. The clock redraws every second, and the bot rows are re-read every 30 seconds. Items are in three groups: Tools, Monitor, Control
(the red ones change something: kill switch, restart, disconnect).

- **Trading details** (Monitor group) is where the per-coin numbers live: for each coin the trades, wins and losses, result in R and dollars, what is open, the last five trades; and the totals. The main screen shows no coin names.
- **Account balance** replaces the old "MEXC account balance" item.
- **Window size:** the logo and the three item groups need **37 rows** and 58 columns. With **27 to 36 rows** the logo stays and the item list scrolls (arrow keys; the footer says "more below"). With 26 rows or fewer you get the text title "Lucid'io Bot" and a scrolling list. Narrower than 58 columns also shows the text title. A terminal that is not UTF-8 gets the plain-ASCII version. Nothing breaks either way: maximise the window to see everything.
- **Colours:** 24-bit colour is used (Windows Terminal and most terminals show it). On a terminal without it run `LUCIDIO_MENU_COLOR=16 lucidio`; `LUCIDIO_MENU_LOGO=off` hides the logo; `LUCIDIO_MENU_ASCII=1` draws plain characters.
- **Your offset:** `PH` is UTC+8. Set `LUCIDIO_MY_UTC_OFFSET` (hours ahead of UTC) to show another zone, labelled `UTC+n`.
- The design sheet is `design/menu-design.html` (open it in a browser). The menu is installed with the normal update, through **Pull changes from GitHub**.

## 18. MEXC API key expiry and the reserve key

A MEXC key that is **not linked to an IP** expires after 90 days (MEXC: "Link IP Address (optional): keys that are not linked to an IP address are valid for 90 days only"). **A key linked to the VPS IPv4 does not expire**: link it (step-by-step in `VPS-UPDATE-GUIDE.md` section 6) and answer `y` to "LINKED to this server's IP" in `make-keys.sh` / `add-reserve-key.sh`; the bot then shows "does not expire" and sends no expiry warnings for that key (`apiKeyIpBound: true` in `mexc-keys.json`). `mexc-keys.json` can hold a **primary** and a **reserve** key.

- **Tell the bot when the key was created:** `sudo bash /opt/lucidio/deploy/make-keys.sh` now asks for the creation day (like `2026-10-23`). Expiry = creation day + 90 days; if MEXC shows an expiry day you can put it in as `apiKeyExpires`.
- **Add the reserve key (a day or more before expiry):** create a second key on MEXC (View Account + View Order + Order Placing, never Withdraw, bound to the VPS IPv4), then `sudo bash /opt/lucidio/deploy/add-reserve-key.sh`. The secret is typed at a hidden prompt. No restart: the bot re-reads the file when it changes.
- **What the bot does:** signs with the primary. When MEXC rejects it as expired/invalid (code 402), or its recorded expiry day starts, that call is repeated **once** with the reserve and the reserve stays in use. Network errors, timeouts, 406 (IP not bound), signature and other errors never switch key, and an order is never repeated for them. The rejection is remembered 24 hours (invalid: 1 hour), then the primary is tried again.
- **After the switch:** create the next key and run `add-reserve-key.sh` again. If the primary has expired, the old reserve is promoted to primary and the new key becomes the reserve.
- **Telegram warnings** (from the watchdog, every 10 minutes, each sent once): 14, 7, 3 and 1 days before expiry (it says whether a reserve will take over), on the expiry day, every day while no valid key is left, when a key has no date recorded, and when the bot really switched keys. Nothing secret is ever sent, logged or written to `state/`.
- **See it:** the menu's *Health check* (and `node /opt/lucidio/keyinfo.js --status`) lists each key's expiry day and which one is in use. Tests: `node test/keys-test.js`.
