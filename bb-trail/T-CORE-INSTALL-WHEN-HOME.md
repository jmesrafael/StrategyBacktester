# T-CORE paper lab: install on the VPS (prepared Nov 6, 2026, to run when the owner is home)

**For Claude Code.** If the owner says "install T-CORE", "install the trail bot", "do the handoff" or "continue the T-CORE install", this is the plan. Read it top to bottom, check the state section, then do only the steps still marked TODO. Everything below was prepared on the work PC; the owner was not home, so **steps 3 to 5 have not been run.**

## Where the files are

This folder is in the **StrategyBacktester** git repo (`jmesrafael/StrategyBacktester`, folder `bb-trail/`), next to `research/` and `vps-lab/`. On the home PC run `git pull` in the StrategyBacktester folder first. The dashboard support is in the separate **ledger** repo (`jmesrafael/ledger`, already pushed): `git pull` there too if you want to re-run its tests. The install file `VPS-TRAIL-INSTALL.md` carries the whole bot inside it, so step 3 needs nothing else from this PC. (An older copy of the folder at `D:\testing\Strat\bb-trail` on the work PC is obsolete; the repo copy is the real one.)

## Names (they all mean the same bot)

| Where | Name |
|---|---|
| What the owner calls it | **T-CORE** (third bot of **TRI-CORE** = BB-CORE + I-CORE + T-CORE, 50/25/25) |
| Folder | `D:\testing\Strat\StrategyBacktester\bb-trail\` |
| Dashboard bot tag | `bbtr` (shown as "T-CORE lab") |
| VPS service / user / paths | `bbtrail`, user `bbtrail`, `/opt/bbtrail`, `/var/lib/bbtrail`, `/etc/bbtrail.env` |
| Old name | BB-Trail, bb-trail P14 |

The bot's own Telegram messages and console text still say "BB-Trail". That is expected and harmless; renaming them means editing `apply-trail-patch.js`, rebuilding the bundle (`bash build-trail-bundle.sh`) and re-checking the hash. Offer it to the owner as an optional follow-up, do not do it during the install.

## State when this was written (Nov 6, 2026)

| Piece | State |
|---|---|
| Bot code (`bb-trail/`) | built, `npm test`: 41 passed, 0 failed |
| Install file `bb-trail/VPS-TRAIL-INSTALL.md` | built, newer than every code file. SHA-256 of the embedded bundle: `91f86622d4e3bed2eaa0cd64733a673f756d9bb407844e7a4613ff1a02780b28` |
| Dashboard support (`ledger/`, repo `jmesrafael/ledger`) | **DONE.** Committed and pushed to `main` as `12046bd` ("Dashboard: T-CORE paper lab bot (bbtr), trend capture, TRI-CORE report"). `npm test`: 372 passed, 0 failed. The public site (lucidio.vercel.app) was serving the new report right after the push, so the deploy is live. |
| Dashboard label | renamed "BB-Trail lab" to "T-CORE lab" (before the push) |
| VPS install | **TODO** (the owner thought it might already be there; the files say it is not. Check first, see step 0) |
| Live trading | not enabled and not part of this install. See `LIVE-READINESS-TCORE.md` |

## Rules (do not break)

- **Paper only.** Never change `mode`, never add a key file, never remove the `liveAllowed = () => false` line. The installer refuses if any of that is off.
- **Never touch the live bots** (`lucidio`, `icore`, `/opt/lucidio`, `/opt/icore`, their keys, `.env`, state). The installer prints whether their start times changed; it must say `unchanged: YES`.
- **Confirm before running the installer on the VPS**, unless the owner already said go in this session. Show the commands first.
- Never print secrets (`DASHBOARD_PUSH_SECRET`, Telegram token). The copy command below moves them without printing.
- T-CORE will not take the same trades as BB-CORE. It is judged only against its own backtest (`compare-live-vs-backtest.js`).

## Steps

### 0. Is it already installed? (read-only, 1 minute)

On the VPS (`ssh admin@193.181.221.91`):

```
systemctl is-active bbtrail 2>&1; ls /opt/bbtrail 2>&1 | head -3; sudo bash /opt/bbtrail/deploy-trail/status.sh 2>&1 | head -20
```

- `active` and a status page: already installed. Skip to step 4 (connect) and step 5 (verify). Do not reinstall.
- `inactive`, `failed`, or "No such file": go on to step 1.

### 1. Re-check on the PC (2 minutes, skip if nothing changed since Nov 6)

```
cd D:\testing\Strat\StrategyBacktester\bb-trail && npm test                 # must end "0 failed"
cd D:\testing\Strat\ledger && git status --short         # should be clean; git log -1 should show 12046bd or later
```

If any `bb-trail` code file is newer than `VPS-TRAIL-INSTALL.md`, rebuild: `bash bb-trail/build-trail-bundle.sh` (Git Bash).

### 2. Dashboard: already deployed (verify only)

Open https://lucidio.vercel.app/ and make sure it still loads. The "T-CORE lab" option in the bot selector appears only after the bot's first report. Nothing to push.

### 3. Install on the VPS

```
scp D:\testing\Strat\StrategyBacktester\bb-trail\VPS-TRAIL-INSTALL.md admin@193.181.221.91:/tmp/
ssh admin@193.181.221.91
cd /tmp && tr -d '' < VPS-TRAIL-INSTALL.md | sed -n '/^BEGIN-BUNDLE$/,/^END-BUNDLE$/p' | sed '1d;$d' | base64 -d > bbtrail.tar.gz && sha256sum bbtrail.tar.gz
```

The printed hash must equal `91f86622d4e3bed2eaa0cd64733a673f756d9bb407844e7a4613ff1a02780b28` (also the `SHA-256:` line at the end of the file). If not, stop.

```
mkdir -p /tmp/bbtrail && tar -xzf bbtrail.tar.gz -C /tmp/bbtrail && cd /tmp/bbtrail && sudo bash deploy-trail/install-trail-paper.sh
```

Read all the output. Success means `pre-flight passed`, `running`, and `live bots' start times unchanged: YES`. A line starting `FATAL` means it stopped before changing anything further: show the owner the output and do not work around the check.

### 4. Connect it to the dashboard and Telegram (copies values, prints nothing)

```
sudo grep -E '^(DASHBOARD_URL|DASHBOARD_PUSH_SECRET|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=' /opt/lucidio/.env | sudo tee -a /etc/bbtrail.env > /dev/null
sudo grep -cE '^(DASHBOARD_|TELEGRAM_)' /etc/bbtrail.env      # 4 (or 2 if the live bot has no Telegram). 0 means the live bot keeps them elsewhere: sudo systemctl cat lucidio
sudo systemctl restart bbtrail
```

### 5. Verify (give it a minute)

```
sudo bash /opt/bbtrail/deploy-trail/status.sh            # service: active, balance $100.00
sudo journalctl -u bbtrail -n 20 --no-pager              # dashboard lines: no HTTP 4xx
sudo bash /opt/bbtrail/deploy-trail/status.sh report     # empty on day one is normal
```

On the dashboard, the bot selector should offer **T-CORE lab** after the first heartbeat. No trades for days is normal (about 7 to 8 a month across the five coins). The first daily comparison runs at 00:55 UTC (`status.sh compare` runs it now).

Report back to the owner: the service state, the `live bots' start times unchanged` line, whether the dashboard shows the lab, and that the install is paper only.

## If something goes wrong

- Stop it: `sudo systemctl stop bbtrail` (the live bots are unaffected).
- Remove it, keep the record: `sudo bash /tmp/bbtrail/deploy-trail/install-trail-paper.sh --uninstall` (add `--purge` to delete the record too).
- Dashboard rejects events (HTTP 400 in the log): the dashboard deploy is older than `12046bd`. Events stay in the outbox; restart the bot once it is current.
- Low memory (1.6 GB VPS): T-CORE is capped at 250 MB and low priority; check `free -m`. The 1h lab installer (`StrategyBacktester/vps-lab`) can add swap with `--add-swap`.

## After the install

- Dec 4, 2026 review: expect only about 8 trades by then. Judge the machinery (no errors, daily comparison matches its own backtest, real costs) and the first trend-capture numbers on the dashboard's Research page. Totals need about 100 trades (about 13 months).
- Going live is a separate, later job with its own gates: **LIVE-READINESS-TCORE.md** in this folder.
- The 1h BB-CORE lab (`StrategyBacktester/vps-lab/VPS-LAB-INSTALL.md`) is also still not installed as of Nov 6.
