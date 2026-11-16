# Setting up the intelligence system on the home PC

Status: PREPARED on the work PC, 2026-11-16. The daily task on the work PC is turned OFF. Make the home PC the main one, and do not run `node run.js all` on both PCs. Two copies would grow apart (the event ledger and the headline archive only add rows, per PC).

## What the home PC needs
| Need | Check |
|---|---|
| Node.js 20 or newer | `node -v` |
| The repo folders next to each other, same layout as the work PC | `D:\testing\Strat\StrategyBacktester`, `..\crypto-news`, `..\ledger`, `..\bb-core`, `..\i-core` (optional ones only skip some tests or steps) |
| The candle library | `StrategyBacktester\candles\binance-futures\1h` exists. If not, copy the snapshot made with `--with-candles`, or run `node candles\update.js --no-1m` (a long first download) |

## Step 1. Get the `intel` folder onto the home PC (pick one)
**A. With git** (needs your decision to commit; `intel/` is NOT committed yet). On the work PC: ask Claude to commit and push `intel/`, `candles/coins.json` and the registry change. At home: `git pull` in `StrategyBacktester`.
**B. By copying a snapshot** (no git needed). On the work PC take a fresh one: `node run.js snapshot` in `StrategyBacktester\intel` (add `--with-candles` if the home PC has no candle library). The folder is `intel\backups\<time>`. Copy it to the home PC (USB or a cloud folder). At home, in `StrategyBacktester\intel`, if the `intel` folder does not exist yet, first copy any one file of it, or run the restore on the snapshot's own code:
```
node <snapshot>\intel\backup\backup.js restore <snapshot> D:\temp\intel-restore
```
Then copy `D:\temp\intel-restore\intel` to `StrategyBacktester\intel` (and `D:\temp\intel-restore\candles` over `StrategyBacktester\candles` only if it holds data you need). The restore refuses a damaged snapshot and prints what it did.

## Step 2. First run at home
```
cd D:\testing\Strat\StrategyBacktester\intel
node run.js test          expect: 227 tests (a test skips when a bot repo is missing; it never fails for that)
node ..\candles\update.js --no-1m
node run.js all           expect: 13 ok, 1 blocked (recorder, until step 4)
node run.js status
```
If a path differs from the work PC, change the keys in `config.json` (`candleLibrary`, `pulseBriefs`, `pulseEvents`, `recorderData`, `adminReportsDir`, `mexcSamples`). Do not put secrets there.

## Step 3. Turn on the daily run at home
```
powershell -ExecutionPolicy Bypass -File scripts\daily-task.ps1 -Install -At 09:00
powershell -ExecutionPolicy Bypass -File scripts\daily-task.ps1 -Status
```
The time is the home PC's time. It runs only while you are logged in; if the PC was off, it runs when it is next on. Remove: same command with `-Remove`. Log: `logs\daily.log` (last line `exit 0`).
The daily run does not pull the crypto-news repo. Pull it by hand now and then so new Pulse headlines reach the archive.

## Step 4. The things only the home PC can do
1. `lucidio-recorder\pull-recorder-data.cmd YOUR-VPS`, then `node run.js all`. The `recorder` step turns ok and the order-book capacity table fills.
2. Create a **read-only** Supabase key. Put `INTEL_SUPABASE_URL` and `INTEL_SUPABASE_KEY` in `intel\secrets.local.json` (git-ignored) or in the environment. Never paste the key into chat. Then `node run.js all` downloads trades by itself.
3. Commit `intel/` to git.
4. Set `backupCopyTo` in `config.json` to a cloud-synced folder.
5. Rebuild the admin report: `node run.js adminreport`, then deploy the ledger repo as you usually do.
6. The VPS watcher: read `VPS-MONITORING-PLAN.md`. Option A (record only) needs nothing new. Option B is not written yet.

## Check list when done
- [ ] `node run.js test` all pass
- [ ] `node run.js all` 14 steps, 0 failed, recorder ok after the pull
- [ ] daily task installed (`-Status` shows the next run)
- [ ] `logs\daily.log` ends with `exit 0` after the first scheduled run
- [ ] the work PC task is off (it is) and `node run.js all` is not run there any more
