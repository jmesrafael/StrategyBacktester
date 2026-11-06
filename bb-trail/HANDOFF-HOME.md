# HANDOFF: install the BB-Trail paper lab (for Claude Code, from home)

> **Superseded in part (Nov 6, 2026):** the current plan is `T-CORE-INSTALL-WHEN-HOME.md` in this folder. The dashboard step (step 2 below) is already done (ledger commit `12046bd`, deployed). The bot is now called T-CORE.

Written Nov 6, 2026. If the owner says "install the trail bot", "do the handoff" or similar, this file is the plan. Everything was built and tested on the work PC; **nothing has been deployed or installed yet.**

## What exists (do not rebuild it)

| Piece | Where | State |
|---|---|---|
| The paper bot (bb-core entry, 2 ATR stop, 14 ATR trail, paper only) | `D:\testing\Strat\StrategyBacktester\bb-trail\` | built, `npm test` passes |
| One-file VPS install (bundle embedded, hash inside) | `bb-trail\VPS-TRAIL-INSTALL.md` | built, hash checked |
| Dashboard support (bot `bbtr`: schema, store, aggregate, page, tests) | `D:\testing\Strat\ledger\` (repo `jmesrafael/ledger`, branch `main`) | edited, **uncommitted**, `npm test` passes (372) |
| Ledger report with the reasoning | `ledger\reports\live-pair-vs-three-bot.html` (also in `reports\index.json`) | written, uncommitted |
| Research behind it | `StrategyBacktester\research\strat-hunt-nov6\` | done |

If those folders are missing on this PC, stop and tell the owner which ones: the files have to be copied over first (the bundle `VPS-TRAIL-INSTALL.md` alone is enough for step 3, but not for step 2).

## Rules

- **Paper only.** Never change `mode`, never add a key file, never remove the `liveAllowed = () => false` line. The installer refuses if any of that is off.
- **Never touch the live bots** (`lucidio`, `icore`, `/opt/lucidio`, `/opt/icore`, their keys, `.env`, state). BB-Trail has its own user `bbtrail`, `/opt/bbtrail`, `/var/lib/bbtrail`, `/etc/bbtrail.env`. The installer prints whether the live bots' start times changed; it must say `unchanged: YES`.
- **Confirm before each outward step** unless the owner already said go in this session: pushing the dashboard (it deploys to production), and running the installer on the VPS. Show what you are about to run first.
- BB-Trail will not take the same trades as BB-Core (different exits, one position per coin per bot). That is expected, not a bug. It is judged only against **its own** backtest (`compare-live-vs-backtest.js`).
- Never print secrets (`DASHBOARD_PUSH_SECRET`, Telegram token). The copy commands below move them without printing.

## Steps

### 1. Re-check on this PC (2 minutes)

```
cd D:\testing\Strat\StrategyBacktester\bb-trail && npm test            # must exit 0 (the research-parity test says "skipped" if the research folder is absent: fine)
cd D:\testing\Strat\ledger && npm test               # must say fail 0
cd D:\testing\Strat\ledger && git status --short     # expect: api/data.js bot-dashboard/app.js bot-dashboard/style.css lib/aggregate.js lib/schema.js lib/store.js
                                                     #          package.json reports/index.json tests/dashboard-capital.test.mjs + new tests/bot-trail.test.mjs and reports/live-pair-vs-three-bot.html
```

If a test fails, fix it before going on and tell the owner. If `bb-trail\VPS-TRAIL-INSTALL.md` is older than any `bb-trail` code change, rebuild it: `bash bb-trail/build-trail-bundle.sh` (Git Bash).

### 2. Deploy the dashboard FIRST (the server rejects unknown bot tags)

1. Ask the owner: "Commit the ledger changes and push to `main` (Vercel deploys it)?"
2. On yes: `cd D:\testing\Strat\ledger && git add -A && git commit -m "Dashboard: BB-Trail paper lab bot (bbtr), trend capture, report" && git push` (commit message ends with the usual attribution lines).
3. Wait for the Vercel deploy to finish (Vercel MCP `list_deployments`, or the owner confirms it is live). Open the dashboard once and make sure it still loads: the new **BB-Trail lab** option only appears after the bot reports, which is expected.

### 3. Install on the VPS

```
scp D:\testing\Strat\StrategyBacktester\bb-trail\VPS-TRAIL-INSTALL.md admin@193.181.221.91:/tmp/
ssh admin@193.181.221.91
cd /tmp && tr -d '' < VPS-TRAIL-INSTALL.md | sed -n '/^BEGIN-BUNDLE$/,/^END-BUNDLE$/p' | sed '1d;$d' | base64 -d > bbtrail.tar.gz && sha256sum bbtrail.tar.gz
```

The hash printed must equal the `SHA-256:` line at the end of the file (also written in the file's text). If not, stop.

```
mkdir -p /tmp/bbtrail && tar -xzf bbtrail.tar.gz -C /tmp/bbtrail && cd /tmp/bbtrail && sudo bash deploy-trail/install-trail-paper.sh
```

Read the whole output. Success = `pre-flight passed`, `running`, `live bots' start times unchanged: YES`. A line starting `FATAL` means it stopped before changing anything further: show the owner the output, do not work around the check.

### 4. Connect it to the dashboard and Telegram (copies values, prints nothing)

```
sudo grep -E '^(DASHBOARD_URL|DASHBOARD_PUSH_SECRET|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=' /opt/lucidio/.env | sudo tee -a /etc/bbtrail.env > /dev/null
sudo grep -cE '^(DASHBOARD_|TELEGRAM_)' /etc/bbtrail.env      # 4 (or 2 if the live bot has no Telegram); 0 means /opt/lucidio/.env is not where the live bot keeps it: `sudo systemctl cat lucidio`
sudo systemctl restart bbtrail
```

### 5. Verify (give it a minute)

```
sudo bash /opt/bbtrail/deploy-trail/status.sh            # service: active, balance $100.00, last log lines
sudo journalctl -u bbtrail -n 20 --no-pager              # "dashboard" lines: no HTTP 4xx errors
sudo bash /opt/bbtrail/deploy-trail/status.sh report     # empty report is normal on day one
```

On the dashboard: the bot selector now offers **BB-Trail lab** (it appears after the first heartbeat). No trades for days is normal (about 7 to 8 a month across the five coins).

Report to the owner: the service state, the live-bots-unchanged line, whether the dashboard shows the lab, and that the first daily comparison runs at 00:55 UTC (`status.sh compare` runs it now).

## If something goes wrong

- Stop the lab: `sudo systemctl stop bbtrail` (the live bots are unaffected).
- Remove it, keep the record: `sudo bash /tmp/bbtrail/deploy-trail/install-trail-paper.sh --uninstall` (add `--purge` to delete the record too).
- Dashboard rejects events (HTTP 400 in the bot log): the dashboard deploy (step 2) is not live yet or is an older version. The events stay in the bot's outbox and the journal; restart the bot after the deploy and they are sent.
- Memory is tight on the 1.6 GB VPS: BB-Trail is capped at 250 MB and low priority; check `free -m`. The 1h lab and recorder installer (`StrategyBacktester/vps-lab`) can add swap with `--add-swap`.

## Later

- Judge by trend capture first (the table on the dashboard's Research page: how many trades reach +3R, +5R, +10R, and how much the trail gives back, against the backtest's rates), totals after about 100 trades.
- The Dec 4 review also covers the 1h lab (`StrategyBacktester/vps-lab/VPS-LAB-INSTALL.md`, still not installed) and this one.
- Going live needs its own review and code changes; this install cannot do it.
