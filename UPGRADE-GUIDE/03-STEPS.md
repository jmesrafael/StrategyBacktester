# The steps, start to finish

Tags: 🤖 I do it · 🧑 only you · 🤝 I prepare, you approve · ⛔ I stop and wait for your "go".
**Rule for every step:** if the result is not what "Expect" says, **stop** and tell me; do not continue to the next step.
VPS address used in the repo docs: `admin@193.181.221.91`. The 4h clock and all commands in one place: `06-COMMANDS.md`.

---

## PHASE 1: Prepare on the PC (nothing leaves the PC except the push)

**1. 🧑 Answer `02-DECISIONS.md`.** Expect: D1-D6 answered. *Nothing else starts before this.*

**2. 🤖 Test everything again, from a clean state.**
All suites in both bots, then both replays. Expect: `1117 passed, 0 failed` (or more, never fewer), and every coin `IDENTICAL trade-for-trade` for both `lucidio.js replay` and `icore.js replay`.

**3. 🤝 Show you what will be pushed.** I list the files changed per repo (`bb-core` about 33, `i-core` 6, `StrategyBacktester` the study folder) and a one-paragraph summary. You read it.

**4. ✅ DONE Oct 29 (you said "deploy all to git"): committed and pushed `bb-core`, `i-core` and `StrategyBacktester` to `main`, and `ledger` to the branch `bb-core-no-target-dashboard`.** At home: `git pull` in the first three; `git fetch` in `ledger`. Expect: `git log -1` in each shows the Oct 29 commit.
*Why `ledger` is on a branch:* pushing its `main` makes Vercel deploy the new dashboard text ("no target") to production days before the bot changes. The branch avoids that; Phase 8 moves it to `main`.

**5. 🤖 Build the two bundles from the committed code.**
`bash deploy/package.sh` in `bb-core` and `i-core`, output into `$STRAT/bundles/` (outside every repo; `$STRAT` is the folder holding the clones, see `06-COMMANDS.md`). Building after the commit matters: the bundle records the commit it came from and marks itself `dirty` otherwise.
Expect for each: `secrets check ... 0 matches`, `OK: <path>`, and a `.sha256` file next to it. Bundle size about 160 KB (BB-Core) and about 125 KB (I-Core).

---

## PHASE 2: Get ready on the VPS (read-only)

**6. 🧑 Give me access** (Option A in `01-WHO-DOES-WHAT.md`) **or** tell me you will paste commands (Option B).
Expect (A): `ssh -i ~/.ssh/claude_vps admin@193.181.221.91 'echo ok'` prints `ok`.

**7. 🤖 Read the real state of both bots (read-only).** I collect, for each bot: service state, the open positions with entry/stop/target, the saved config values (`riskPct`, `maxRiskUsd`, whether `riskTiers` exists), the installed commit, the last run time, the timers, the shadow recorder, the wallet-sync log, and the newest state backup.
Expect: both services `active`, `lastRun` under 260 minutes, no `UNFINISHED ORDER`. I then show you a table. **This is where I tell you I-Core's real current risk** (needed for D2).

**8. 🧑 Check the MEXC app, both accounts.**
BB-Core: the main wallet. I-Core: its sub-account. Futures > Positions shows exactly the trades I listed in step 7, each with its TP/SL; Open orders shows nothing else.
Expect: matches. **If anything is different, stop and tell me.**

**9. 🤝 Pick the window.** A start time 30 to 90 minutes after a 4h close (table in `06-COMMANDS.md`). I confirm it by running the readiness check at that moment, not before.

---

## PHASE 3: Pin the risk first (so the upgrade cannot change risk by accident)

*Why:* the new code switches the risk steps on by itself if the server's config does not say otherwise (I tested this). For I-Core that could jump the risk from today's value to 2.5% at the moment of the restart. Writing `riskTiers: []` into each server config first means the new code starts with exactly today's flat risk. The old code ignores the extra key (tested).

**10. 🤖 Back up and pin BB-Core's config.**
`cp` the file to `bot-config.json.bak-<time>`, add `"riskTiers": []`, nothing else. Do it at least 15 minutes away from a candle close (the bot re-reads settings each run).
Expect: the file shows the same `riskPct` and `maxRiskUsd` as in step 7, plus `riskTiers: []`.

**11. 🤖 Same for I-Core.** Expect the same.

---

## PHASE 4: Upgrade BB-Core (with trades open)

**12. 🤖 Copy the new readiness script and run it with `--keep-open`.**
`scp deploy/upgrade-ready.sh admin@193.181.221.91:/tmp/` then `sudo bash /tmp/upgrade-ready.sh --keep-open`.
Expect: **`READY (keep open)`**. Blockers it can print: an unfinished order (wait one run), less than 15 minutes after / 30 minutes before a close (wait), service not running, no backup.

**13. 🤖 Copy the bundle and verify it.**
`scp lucidio-deploy.tar.gz lucidio-deploy.tar.gz.sha256 admin@193.181.221.91:/tmp/`, then on the VPS `sha256sum -c`, extract to `/tmp/lucidio-new`.
Expect: `lucidio-deploy.tar.gz: OK`.

**14. 🤖 Back up the state, then run the preflight.**
`sudo systemctl start lucidio-backup.service`, then `sudo bash /tmp/lucidio-new/lucidio/deploy/preflight-upgrade.sh --keep-open --engine-change`.
Expect: ends with **`GO`**, lists each open position as `is kept: stop ..., target ...`, says the engine file differs "on purpose".

**15. 🧑 Compare the numbers.** The preflight printed stop and target for every open trade. Check that the MEXC app shows the same stop (and target, for 1:4 trades). *This is your independent check; the bot cannot do it for you.* Expect: same numbers.

**16. ⛔ Install (this restarts BB-Core).** After your "go":
`cd /tmp/lucidio-new/lucidio && sudo bash deploy/setup-vps.sh --skip-ssh-hardening`
It saves the old code to `/var/backups/lucidio/code-<stamp>.tar.gz`, keeps `state/`, `journal/`, `mexc-keys.json`, `.env`, `bot-config.json`, restarts the service. The stop-to-start gap is a few seconds.
Expect: no `WARN` lines that matter, service `active`.

**17. 🤖 Check right away.** `systemctl is-active lucidio lucidio-perf.timer`; `lucidio.js status` shows the **same open trades** (same entry, stop, target); `journalctl -u lucidio -n 30` has no error; the `check` command's `risk` row shows your flat risk and `max $10` (steps pinned off, so no `steps` in that row).
Expect: all true. **If the bot is not running or a trade is missing from `status`: roll back immediately** (`04-ROLLBACK.md`), then tell me.

**18. 🧑 Look at the MEXC app again.** TP/SL still on every open trade. Expect: yes.

---

## PHASE 5: Watch BB-Core through one candle close

**19. 🤖 After the next 4h close (+2 to +10 minutes), check the first run on the new code.**
`tail -n 2 /opt/lucidio/state/runs.jsonl | cut -c1-300`: a new run, `lagSec` small (about 2 to 10), `errors: []`, every coin fetched. `status`: positions unchanged or closed normally. No `stop / target missing` warning in the log.
Expect: clean. If a trade closed at its stop or target, I confirm the journal has the exit linked to its entry.

**20. 🤖 Next day, 00:40 UTC compare.** The daily live-vs-backtest check should say `match` (it judges the older trades against the 1:4 backtest and new ones against the no-target engine). Expect: match, or only differences I can explain.

---

## PHASE 6: Upgrade I-Core

Same route, other names. I-Core's engine file is unchanged, so no `--engine-change`.

**21. 🤖 Copy the bundle and verify it.** `icore-deploy.tar.gz` + `.sha256` to `/tmp`, extract to `/tmp/icore-new`.

**22. 🤖 Back up and preflight.** `sudo systemctl start icore-backup.service`, then `sudo bash /tmp/icore-new/icore/deploy/preflight-upgrade.sh --app /opt/icore --keep-open`.
Expect: **`GO`**, engine file `IDENTICAL`, each open position listed.

**23. 🧑 Compare the numbers in the MEXC sub-account.** I-Core positions have a stop only (no target): the stop must match.

**24. ⛔ Install (this restarts I-Core).** `cd /tmp/icore-new/icore && sudo bash deploy/setup-vps.sh --skip-ssh-hardening`.

**25. 🤖 Check right away** (`icore-perf.timer` active, `icore.js status` shows the same open trades and trailing stops, no errors) and **after the next close** (step 19 for `/opt/icore`).

---

## PHASE 7: Switch on the new risk and cap (⛔ real money)

Only after Phases 5 and 6 are clean, and preferably on a different day than the restarts.

**26. ⛔ Apply your D2 and D3 decisions, per bot.** Each is one command that validates before saving (`06-COMMANDS.md`):
- BB-Core: `riskTiers` = the three steps, `maxRiskUsd` = your D3 value.
- I-Core: as you decided in D2 (steps on, or leave `riskTiers: []`).
Takes effect at the **next new trade**; open trades keep their size.
Expect: the command prints `saved ...`; the `risk` row of `check` says e.g. `risk 2.5% of balance/trade (steps $0+ 2.5%, $500+ 2%, $1000+ 1.5%, by the highest balance $...), max $500`.

**27. 🤖 Check the first new trade.** From Telegram/the journal: risk in dollars = balance x the step percentage (and never above the cap), and the Telegram "Target" row says `none`.

---

## PHASE 8: Hosted dashboard (Vercel) and Supabase

**28. ⛔ Put the dashboard change on `main`.** Two files changed (`bot-dashboard/app.js`, `lib/perf.js`): text and expected numbers only. It is already on GitHub in the branch `bb-core-no-target-dashboard` (pushed on Oct 29 so you can pull it at home without Vercel deploying it early). Fast-forward `main` to it and push (commands in `06-COMMANDS.md`).

**29. 🤖 Check Vercel.** The production deployment of the new commit is live (I read it from Vercel), `/api/health` answers `{"ok":true}`.
**🧑 Open `/bot-dashboard/`** in the browser: six tabs, press **R** once; BB-Core's description says "no profit target"; there is no "Target-hit rate" tile.

**30. 🤖 Supabase read-only check** (which migrations are applied). Nothing to change. Fee migration stays off unless you said otherwise in D6.

---

## PHASE 9: Close out

**31. 🤖 Update the records.** `RUN-LOG.md` (what was installed, commits, when, the new measurement window start), `PENDING-UPGRADE.md` (tick rows 1, 1b, 1c, 2), this folder's `07-CHECKLIST.md`.

**32. 🧑 Remove my access** (if you used Option A): delete the key line from `~/.ssh/authorized_keys` and `sudo rm /etc/sudoers.d/90-claude-upgrade`. I remind you and then verify the key no longer works.

**33. 🤖 Keep for one month:** the two bundles (in `$STRAT/bundles/`) and the server backups in `/var/backups/lucidio` and `/var/backups/icore`.

Next: `05-AFTER-THE-UPGRADE.md`.
