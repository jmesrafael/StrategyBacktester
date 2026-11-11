# Rollback: how to undo each phase

Rule of thumb: **change one thing at a time and undo only that thing.** Open trades are never touched by any rollback; their stop (and target) stay on MEXC the whole time.

## If something looks wrong with live trades RIGHT NOW

1. 🧑/🤖 **Kill switch first**: no new entries, open trades stay protected.
   `sudo -u lucidio touch /opt/lucidio/STOP` (BB-Core) · `sudo -u icore touch /opt/icore/STOP` (I-Core). Remove the file to resume.
2. Look before you act: `status`, the last 30 log lines, the MEXC app.
3. Closing a position by hand is **your** decision, in the MEXC app. I do not close trades.

## By phase

| Phase | What went wrong | Undo | Who |
|---|---|---|---|
| 1 Prepare | Nothing is deployed yet | Do not push, or `git revert` the commit. The manual upgrade route never reads GitHub; just do **not** click "Pull changes from GitHub" in the VPS menu until you want it | 🤖 |
| 3 Pin | The pinned config is wrong | Restore the backup: `sudo -u lucidio cp -p /opt/lucidio/bot-config.json.bak-<time> /opt/lucidio/bot-config.json` (same for `icore`). Applies at the next run | 🤖 |
| 4 / 6 Upgrade | Bot not running after the install, a trade missing from `status`, errors in the log | `sudo bash /opt/lucidio/deploy/rollback.sh` (I-Core: `/opt/icore/deploy/rollback.sh`). It stops the bot, restores the newest saved code from `/var/backups/.../code-<stamp>.tar.gz`, starts it. `state/`, `journal/` and keys are never touched. `--list` shows the saved versions | 🤖 (at once if the bot is down, otherwise after telling you) |
| 5 Watch | The first run after the restart shows `errors` or `lagSec` large | Same as above; first check `journalctl -u lucidio -n 50` | 🤖 |
| 7 New risk | The risk or cap is not what you wanted | One command back to flat risk with the old cap: `maxRiskUsd: 10, riskTiers: []` (in `06-COMMANDS.md`). Applies at the **next new trade**; a trade already open keeps its size | 🤖 after your "go" |
| 8 Dashboard | The page is broken | Vercel: promote the previous deployment (I can do it through the Vercel connector), or `git revert` + push `ledger` | 🤖 |

## Two things to know before any code rollback

1. **Do not roll the code back to the 1:4 build while a trade opened by the new code is open.** The old code expects a target on every position and would not manage one without it. Either close that trade first, or fix forward instead of rolling back. Rolling back while only old 1:4 trades are open is fine.
2. **A rollback does not undo Phase 7.** The config file keeps `riskTiers` and the cap you set. The old code ignores `riskTiers` and uses `riskPct`; set the values you want in the JSON by hand if you roll back after Phase 7.

## What is safe to leave as is

- The pinned `"riskTiers": []` in the config: harmless on old and new code.
- The new `peakBalance` field in `state/state.json`: the old code ignores it.
- The journal: append-only, compatible both ways.

## If the state file is ever damaged

`sudo systemctl stop lucidio && sudo tar -xzf /var/backups/lucidio/state-<stamp>.tar.gz -C /opt/lucidio && sudo chown -R lucidio:lucidio /opt/lucidio && sudo systemctl start lucidio` (from `bb-core/UPGRADE-LIVE.md`, section 9). Do this only with the bot flat or after checking the MEXC app first, because the restored state must still know about the open trades.
