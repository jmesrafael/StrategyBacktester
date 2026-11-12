# HOME TODO — everything not applied yet (VPS, Vercel, PC)

> **DONE Nov 12, 2026: SUI + ARB.** T-CORE trades SUI live since 15:14 UTC; ARB was left off (it fails the stability rule). Record: `archive-done/DONE-SUI-ARB-LIVE.md`. ZEC is back on every bot (MEXC cancelled the delisting).

> **STATUS Nov 11, 2026 (done by Claude over SSH, verified on the VPS)**
> - Part 0 DONE. Part 1 DONE: `newsbb`, `newsic`, `newstc` installed (hash `6fbcb712…` matched, "live bots' start times unchanged: YES", dashboard lines added, no Telegram setting, all three running with 0 errors). The first dashboard heartbeat comes after the 16:00Z candle.
> - Part 4 DONE: both VPS `perf-watch.js` are byte-identical to the new repo file, 0 "digest", `--dry` runs fine.
> - Part 2: check the News Lab tab after the first heartbeat (not verifiable without your login).
> - **STILL OPEN, needs you:** Part 3 (Vercel is not reachable from my tools; `/api/monthly-report` answers 503 "CRON_SECRET is not set", so add the 3 variables and redeploy), Part 5 (backup key is created in the app), Part 7 (optional). Part 6 (old SSH key) is left to the owner.
> - Once Part 3 and 5 are done, rename this file to start with `DONE-`.

Written **Nov 11, 2026**. This is the one list. Do the parts in order; each part says whether it touches the running bots (only Part 4 does, and it doesn't restart them).
Rule for the whole session: **never edit, restart or reinstall a live bot** (`lucidio` BB-CORE, `icore`, `tcore`) or the existing paper bots (`bbtrail`, `lucidio-1h`, recorder). Everything below adds new things beside them.

| # | What | Where | Touches running bots? | Time |
|---|---|---|---|---|
| 0 | Safety check before anything | VPS | no (read-only) | 3 min |
| 1 | **News Lab paper bots** (`newsbb`, `newsic`, `newstc`) | VPS | no, new services only | 20 min |
| 2 | Check the News Lab on the dashboard | browser | no | 5 min |
| 3 | Monthly Telegram report: Vercel settings + dry run | Vercel + PC | no | 15 min |
| 4 | Monthly report: remove the weekly digest on the VPS | VPS | `perf-watch.js` only, no restart | 10 min |
| 5 | Daily books-vs-MEXC check + nightly backup | PC | no (read-only) | 10 min |
| 6 | Security cleanup: remove the old temporary SSH key | VPS | no | 2 min |
| 7 | Optional: Pulse site extras (Upstash, domain) | Vercel | no | 10 min |

---

## What is already done (nothing to do)

- **News Lab code**: gate, backtest, three news paper bots built and tested, committed and pushed (StrategyBacktester `d7d59a5`).
- **Dashboard** (`https://lucidio.vercel.app`): deployed with the new bot tags `bbn` / `icn` / `tcn`, the two new entry fields, and the **Research Lab → News Lab** tab (ledger `a203c95`, 528 tests pass). The tags have to exist before the bots report, so this was done first.
- **News site** (`https://cryptobai.vercel.app`): `/api/signal` and `/api/gate-inputs` are live; the daily 07:00 PHT job runs on GitHub.
- **Monthly report, weekly-digest removal, daily recon script**: code is pushed in `ledger`, `bb-core`, `i-core`. Not set up yet (Parts 3, 4, 5).

---

## Part 0 — Safety check (VPS, read-only)

```bash
# all existing services must be active before you start; note the output
systemctl is-active lucidio icore tcore bbtrail lucidio-1h lucidio-recorder
free -m                      # need ~600 MB free for the three new services; see Part 1 step 1
df -h /                      # need >1 GB free
```
Write down the start time of each live bot, so you can prove later nothing restarted:
```bash
for s in lucidio icore tcore bbtrail lucidio-1h lucidio-recorder; do echo "$s $(systemctl show $s -p ActiveEnterTimestamp --value)"; done
```
If any live bot is not `active`, **stop** and fix that first; do not install anything.

---

## Part 1 — Install the News Lab paper bots (VPS)

**What it installs:** three paper services, $100 simulated each, public MEXC data only, no keys, **Telegram removed from the code**.

| service | strategy | dashboard tag |
|---|---|---|
| `newsbb` | BB-CORE 4h + news gate | `bbn` |
| `newsic` | I-CORE + news gate | `icn` |
| `newstc` | T-CORE (bb-trail P14) + news gate | `tcn` |

The gate only skips or shrinks an entry (8h before CPI / jobs / FOMC / PCE / PPI; no longs within 72h of a hack on the coin's own chain). If the signal URL is unreachable or older than 6h, the bot trades exactly like its original (fail-open).

**1. Memory.** The three services are capped at 200 MB each (600 MB worst case). VPS has 1.6 GB.
If `free -m` shows less than ~700 MB "available", add swap first (the recorder bundle has `add-swap.sh`):
```bash
sudo bash /opt/lucidio-recorder/deploy/add-swap.sh   # only if available memory is low; skip if swap already exists (swapon --show)
```

**2. Get the installer file onto the VPS.** On the PC, pull the repo first:
```
cd D:\testing\Strat\StrategyBacktester
git pull
```
The file is `news-lab-bots\NEWS-LAB-INSTALL.md` (5.4 MB, the whole bundle is embedded). Copy it:
```
scp D:\testing\Strat\StrategyBacktester\news-lab-bots\NEWS-LAB-INSTALL.md YOUR-VPS:/tmp/
```
(Use the same user and host you use for the other bots.)

**3. On the VPS, unpack and check the fingerprint.**
```bash
cd /tmp
sed -n '/^BEGIN-BUNDLE$/,/^END-BUNDLE$/p' NEWS-LAB-INSTALL.md | sed '1d;$d' | tr -d '\r' | base64 -d > newslab.tar.gz
sha256sum newslab.tar.gz
```
The hash must be exactly:
`6fbcb712ca705b750b157c94e2690e54e232787dc483db01c24641b630b2a899`
If it differs, **stop** (the file got changed in transit; copy it again).

**4. Install.**
```bash
mkdir -p /tmp/newslab && tar -xzf newslab.tar.gz -C /tmp/newslab && cd /tmp/newslab
sudo bash deploy/install-news-lab.sh
```
The installer refuses to run if anything is not paper, if a Telegram setting or key is present, or if a live bot's config looks wrong. It runs a read-only pre-flight check for each bot before starting it, and compares the live bots' start times before and after.
**It must end with:** `live bots' start times unchanged: YES` and all three services running.
If one pre-flight fails, that bot and the ones after it are not installed; the ones before stay up. You can re-run with `--only newstc` etc. after fixing.

**5. Point them at the dashboard.** Copy only the two dashboard lines from the BB-CORE env file into each news bot's env file:
```bash
for s in newsbb newsic newstc; do sudo grep -E '^(DASHBOARD_URL|DASHBOARD_PUSH_SECRET)=' /opt/lucidio/.env | sudo tee -a /etc/$s.env >/dev/null; done
```
Check each env file has **only** those two lines plus the installer's own lines, and **no `TELEGRAM_`** line:
```bash
sudo grep -c TELEGRAM /etc/newsbb.env /etc/newsic.env /etc/newstc.env     # every count must be 0
```

**6. Restart only the three new services, then check.**
```bash
sudo systemctl restart newsbb newsic newstc
sudo bash /opt/newsbb/deploy/status.sh newsbb
sudo bash /opt/newsic/deploy/status.sh newsic
sudo bash /opt/newstc/deploy/status.sh newstc
```
Each status should show the service active, the last signal fetch OK (or "unavailable" = trading as normal), and counters for entries / vetoes / shrinks / unavailable.

**7. Prove the live bots were not touched.**
```bash
for s in lucidio icore tcore bbtrail lucidio-1h lucidio-recorder; do echo "$s $(systemctl show $s -p ActiveEnterTimestamp --value)"; done
```
The times must match what you wrote in Part 0.

**Rollback (removes only the news bots):**
```bash
cd /tmp/newslab && sudo bash deploy/install-news-lab.sh --uninstall          # add --purge to delete their data too
```

---

## Part 2 — Check the News Lab on the dashboard (browser)

1. Open `https://lucidio.vercel.app/bot-dashboard/`, press **R** (hard refresh once, the version changed).
2. **Research Lab → News Lab** (or open `#lab/tcn/news`).
3. You should see:
   - **Backtest:** each bot without vs with the gate (BB-CORE +14.8R, I-CORE +9.4R, T-CORE +24R over Oct 2020 → Nov 2026, both before and after 2024).
   - **Shadow:** every real trade of bbcore, icore, tcore, bbtr, bb1h since Nov 1 with what the gate would have said at entry. Works already, no install needed.
   - **Forward test:** tcn vs bbtr (cleanest, same engine), bbn vs bbcore, icn vs icore. Until the bots report, "waiting for first heartbeat". After Part 1 step 6, within ~10 minutes each should show a heartbeat.
4. If a news bot shows nothing after 15 minutes: `sudo journalctl -u newsbb -n 50 --no-pager`. A rejected-report message means the dashboard doesn't know the tag (re-check Part 2 loaded after a hard refresh and that `https://lucidio.vercel.app` is the same deployment the bots point at).

**How to read the results (be patient):** these bots trade on 4h candles and the gate only acts in the hours before a major release or after a hack on a coin. Expect **a few gated moments a month**, so judge the forward test after **8+ weeks**, not days. Compare **tcn vs bbtr first**. The Shadow panel gives useful readings sooner. The backtest cannot show whether a skipped trade is replaced by a different trade; the paper bots measure that.

---

## Part 3 — Monthly Telegram report: Vercel settings and dry run

Full original plan: `MONTHLY-REPORT-INSTALL-WHEN-HOME.md` (same folder) (built Nov 9). The code is pushed; this is the part still to do.

**3a. Re-run the tests (PC, 30 s)**
```
cd D:\testing\Strat\ledger && node --test tests/monthly-report.test.mjs      # pass 7, fail 0
cd ..\bb-core && node test/perf-test.js | tail -2                            # 57 passed, 0 failed
```
**3b. Vercel → the LEDGER project → Settings → Environment Variables → Production:**

| Name | Value |
|---|---|
| `CRON_SECRET` | 32+ random characters (`openssl rand -hex 32`); keep a copy for the dry run |
| `TELEGRAM_BOT_TOKEN` | same bot token the VPS uses (from the server env file, never the repo) |
| `TELEGRAM_CHAT_ID` | same chat id the VPS uses |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already there. **Redeploy** after adding variables (Vercel → Deployments → Redeploy), because the cron schedule is only read from a production deploy.
**3c. Check** Settings → Cron Jobs shows `/api/monthly-report` at `0 7 1 * *`.
**3d. Dry run (sends nothing):**
```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" "https://lucidio.vercel.app/api/monthly-report?dry=1&month=2026-10"
```
Expect `"sent":false` and a `"text"`. Check it matches the dashboard's October Performance tab: only live bots listed (no paper, no labs, **no news bots**), per-bot Trades and Result match, the summary is the sum. A missing `%` in the summary means a live bot doesn't share its balance; that is intentional.
**3e. Optional real send to your chat:** same URL without `dry=1` → `{"month":"2026-10","sent":true}`. `401` = wrong secret, `503` = a variable missing, `502` = Telegram or the store refused.

---

## Part 4 — Remove the weekly digest on the VPS (only after Part 3 works)

This changes `perf-watch.js` only. The trading processes are **not** restarted (the watch is its own daily timer: `lucidio-perf.timer` 01:05 UTC, `icore-perf.timer` 01:15 UTC).
1. Update each bot the way you always do (menu → **Pull changes from GitHub**, see `bb-core/VPS-UPDATE-GUIDE.md` §3d and `i-core/VPS-INSTALL-GUIDE.md`). `bb-core` and `i-core` are already pushed.
2. Check on each VPS (nothing may say "digest"):
```bash
grep -c -i digest /opt/lucidio/perf-watch.js          # expect 0   (I-CORE: /opt/icore/perf-watch.js)
sudo -u lucidio node /opt/lucidio/perf-watch.js --dry # expect "0 message(s) (dry run: nothing sent)"; I-CORE: sudo -u icore node /opt/icore/perf-watch.js --dry
```
3. Done when no Monday digest arrives and on the 1st of next month at 07:00 UTC (3:00 pm PH) the November report arrives by itself.
**If the pull would restart a live bot, stop and ask first;** the guides say how to update without that.

---

## Part 5 — Daily books-vs-MEXC check and nightly backup (PC)

Full doc: `D:\testing\Strat\ledger\docs\daily-recon.md`. Read-only; it uses the same revocable backup key.
1. In the app: **Fund → Log → Backups → Create nightly backup key** (shown once, copy it).
2. `cd D:\testing\Strat\ledger && copy backup.config.example.json backup.config.json`, paste the key. Optional: `"copyTo"` = a Google Drive/OneDrive desktop-synced folder (second copy), and `"telegram": {"token","chatId"}` (same bot as the monthly report).
3. Test: `node scripts/backup-ledger.mjs` then `node scripts/recon-check.mjs` (verdicts: ok / review / not_fresh / no_data).
4. Schedule on the PC that stays on: `node scripts/backup-ledger.mjs --schedule 02:30` and `node scripts/recon-check.mjs --schedule 08:00`.
Known limits: T-CORE live needs its wallet registered in `bot_wallets` to be included; it needs the wallet-snapshot migration (20261130000000) or the verdict is `no_data`.

---

## Part 6 — Security cleanup: old temporary SSH key (VPS)

From `bb-core/PENDING-UPGRADE.md` row 8, still marked TODO since Oct 29:
```bash
nano ~/.ssh/authorized_keys          # delete the line containing: claude-upgrade-2026-10-29
sudo rm /etc/sudoers.d/90-claude-upgrade
```
If either is already gone, that's fine. Then confirm you can still log in with your own key from a **second** terminal before closing the first.

---

## Part 7 — Optional: the Pulse news site (https://cryptobai.vercel.app)

- **Upstash Redis (free):** Vercel project → Storage → connect Upstash Redis, redeploy. The site then keeps a 3-day news history for first-time visitors (`/api/news` shows `"persistent": true`).
- **Domain:** Settings → Domains.
- **GitHub Actions:** make sure Actions can write to the repo (Settings → Actions → Workflow permissions), or the daily 07:00 PHT brief can't save. The first manual run already succeeded; to publish now: Actions → "Pulse highlights" → Run workflow.

---

## Final checklist (tick when done)

- [x] Part 0: all six services active, start times written down, memory OK
- [x] Part 1: hash matches `6fbcb712…`, installer ends with "start times unchanged: YES", no `TELEGRAM` in the three env files
- [ ] Part 2: News Lab tab shows heartbeats for `bbn`, `icn`, `tcn`
- [ ] Part 3: Vercel variables set, cron visible, dry run matches the dashboard
- [x] Part 4: no "digest" in either `perf-watch.js`
- [ ] Part 5: backup key created, recon check scheduled
- [ ] Part 6: old SSH key and sudoers rule removed
- [ ] Part 7 (optional): Upstash connected

## Things I could not verify from this PC (so check them at home)

- I never connected to the VPS. Service names, paths and memory figures come from the install files and the repo's notes. Part 0 and the installer's own pre-flight checks exist to catch any difference.
- I could not open `lucidio.vercel.app/bot-dashboard/` logged in, so the News Lab tab was tested by automated tests (528 pass) and by checking the deployed files load, not by looking at it with real data.
- Whether the monthly report cron and Telegram variables are already set in Vercel is unknown to me; Part 3 says to check rather than assume.
