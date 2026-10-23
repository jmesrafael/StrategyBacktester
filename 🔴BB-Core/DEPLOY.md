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
cd /opt/lucidio && sudo -u lucidio node test/selftest.js         # 23 passed   (these three need the --with-tests bundle)
sudo -u lucidio node test/fixes-test.js                          # 9 passed
sudo -u lucidio node test/ops-test.js                            # 26 passed
sudo -u lucidio node lucidio.js replay SOL,ZEC                   # IDENTICAL trade-for-trade, both coins
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
| M14 | Strategy evidence | `AUDIT-REPORT.md` section 8 | **not decidable in 14 days.** The audit wants >= 120 days and >= 25 closed trades, plus the shadow recorder, before live | keep paper running |

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
- **Manual steps:** (1) `bash /opt/lucidio/deploy/mexc-reachability.sh` on the server. (2) From your phone/PC open MEXC: does every open position still have BOTH a stop and a target? If not, set them or close it. (3) `sudo -u lucidio touch /opt/lucidio/STOP` (no new entries). (4) Fix: IP binding changed -> update the key's IP; key expired/permission -> new key via `make-keys.sh`; region/IP block -> new VPS region or IP, then rebind the key. (5) `sudo -u lucidio node /opt/lucidio/lucidio.js check`, remove `STOP`; the bot adopts its open position by id, but the time exit may then come late.
