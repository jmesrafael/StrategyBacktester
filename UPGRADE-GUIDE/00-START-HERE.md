# UPGRADE GUIDE: BB-Core (no target) + I-Core Tandem

Written Oct 29, 2026. One folder, start to finish. Open the files in order; each says who does what.

## FIRST STEP

**Read `02-DECISIONS.md` and answer its 6 questions.** Nothing is deployed until you do. Then tell me **"go prepare"** and I start at step 1 of `03-STEPS.md`.

## What this upgrade changes

| | BB-Core (`/opt/lucidio`, MEXC main wallet) | I-Core (`/opt/icore`, MEXC sub-account) |
|---|---|---|
| Strategy | **No profit target any more** (stop or 8-day time limit). Was a fixed 1:4. | Unchanged (Ichimoku, trailing stop) |
| Risk per trade | Steps down as the account grows: 2.5% below $500, 2.0% from $500, 1.5% from $1,000 (by the highest balance so far) | Same steps (you choose whether to switch them on, see D2) |
| $ cap per trade | Removed (or raised to $500, see D3) | Same |
| Also | Performance watch, new Telegram format, wallet sync, "upgrade with trades open" scripts | Performance watch |

Hosted dashboard (Vercel): small text/number changes (no target, expected numbers). Not part of the bots.

**Open trades are NOT closed.** Their stop (and target, for 1:4 trades) are orders on MEXC and keep working during the few-second restart. The new code adopts each open trade exactly as it is.

## Where things stand (Oct 29, 2026)

- **Done and tested on this PC:** the code of both bots, 1,117 test checks passing, both bots' replays identical to their backtests, both deploy bundles build clean (secret scan: 0 matches).
- **On GitHub since Oct 29:** all code, this guide and the study (`bb-core`, `i-core`, `StrategyBacktester` on `main`; `ledger` on the branch `bb-core-no-target-dashboard`). **Not deployed anywhere:** the VPS and Vercel still run the old versions.
- **Commits to pull at home:** `bb-core` `c4192df`, `i-core` `fd9f232` (both `main`), `ledger` `461cb59` (branch `bb-core-no-target-dashboard`), and `StrategyBacktester` (this guide and the study; its newest commit on `main`). At home: `git pull` in `bb-core`, `i-core`, `StrategyBacktester`; `git fetch` in `ledger`. Then `export STRAT=<folder with the clones>` (see `06-COMMANDS.md`) and continue at step 5.
- **Fixed on the way:** the bundle build was refusing to ship (a hash in `upgrade-ready.sh` looked like a secret). It builds now.
- The VPS still runs the Oct 26 build of BB-Core (`bf4efd`) and an older I-Core (`e4eabaf`).

## The folder

This folder lives in the **StrategyBacktester** repo (`StrategyBacktester/UPGRADE-GUIDE/`), so `git pull` brings it anywhere.

| File | What it is |
|---|---|
| `00-START-HERE.md` | this page |
| `01-WHO-DOES-WHAT.md` | what I can do with admin access, what only you can do, and the access I need |
| `02-DECISIONS.md` | the 6 decisions only you can make, with my recommendation |
| `03-STEPS.md` | **the procedure**, step 1 to the end, each step tagged with who does it |
| `04-ROLLBACK.md` | how to undo each phase |
| `05-AFTER-THE-UPGRADE.md` | what to watch, what "good" looks like, when to stop and review |
| `06-COMMANDS.md` | every command in one place, plus the 4-hour candle clock |
| `07-CHECKLIST.md` | tick-box version of the whole thing |

Deeper reference (already in the repos): `bb-core/UPGRADE-LIVE.md` (section 3b), `bb-core/VPS-UPDATE-GUIDE.md` (section 11), `bb-core/DEPLOY.md`, `bb-core/RUN-LOG.md`, `bb-core/PENDING-UPGRADE.md`, `StrategyBacktester/research/bb-core/no-target/RESULTS.md` (the study).

## Legend used in the steps

- 🤖 **CLAUDE**: I do it.
- 🧑 **YOU**: only you can.
- 🤝 **BOTH**: I prepare and show it, you approve.
- ⛔ **STOP**: I stop and wait for your explicit "go". I do not continue on my own.

## The order at a glance

| Phase | What | Who | Touches money? |
|---|---|---|---|
| 1 | Prepare on the PC: test, commit, build bundles | 🤖 (you approve the push) | no |
| 2 | Get access and read the VPS (read-only) | 🧑 grants, 🤖 reads | no |
| 3 | **Pin the risk** so the upgrade changes nothing about risk | 🤖 | no, protects money |
| 4 | Upgrade BB-Core with trades open | 🤖 (you verify in the MEXC app) | restarts the bot |
| 5 | Watch BB-Core through one full 4h candle | 🤖 + 🧑 | live |
| 6 | Upgrade I-Core | 🤖 | restarts the bot |
| 7 | Switch on the new risk and cap, the way you decided | 🤖 after your "go" | **yes** |
| 8 | Hosted dashboard (GitHub, Vercel) | 🤖 (you check in the browser) | no |
| 9 | Close out: logs, new measurement window | 🤖 | no |

Total hands-on time: about 2 hours spread over a day, because Phases 5 and 6 wait for candle closes.
