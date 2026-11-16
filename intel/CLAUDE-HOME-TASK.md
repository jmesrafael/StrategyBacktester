# TASK FOR CLAUDE: finish the Intelligence System setup on the home PC

Read this whole file first. It is the only file you need to carry on. Written 2026-11-16 on the work PC by Claude, for the owner. The owner is not a native English speaker: use short, plain sentences.

## 0. What this is
In one session on Nov 16 2026 we built a read-only research and risk system for the three live bots (BB-CORE, I-CORE, T-CORE) in `StrategyBacktester/intel/`. It finds what causes profit and loss days (price shocks, news events, combined risk) and checks that each bot still behaves like its backtest. No AI runs inside it. It never trades. Overview with charts: `ledger/reports/intel-system.html`. Human guide: `HOME-SETUP.md`. Status and limits: `IMPLEMENTATION-STATUS.md`. VPS plan: `VPS-MONITORING-PLAN.md`. Daily commands: `OPERATING-MANUAL.md`.
The owner works mostly on the home PC, so the home PC is now the MAIN one. The daily task is OFF on the work PC. Do not run `node run.js all` on both PCs.

## 1. Rules (the owner's, do not break them)
1. **Read-only.** Do not change the bots (`bb-core`, `i-core`, `bb-trail`, `bb-core-1h`), their configs, the VPS services, live trading, production database records or exchange accounts.
2. **Ask first, in this session, before any outward or hard-to-undo step:** ssh to the VPS, `git commit` or `git push`, deploying, creating keys, installing anything on the VPS, deleting backups. A "yes" from an earlier day does not count.
3. **Secrets:** never ask the owner to paste a key in chat, and never print one. Keys go only in `intel/secrets.local.json` (git-ignored) or an environment variable.
4. **No published pages.** Never use the Artifact tool. Show results as markdown tables in chat and save local `.md` files.
5. **Honest results.** Do not invent data. If a step is blocked, say exactly why, do what is possible, and go on. Say plainly when something failed.
6. **Save the owner's usage:** give mechanical work (writing docs, small edits, simple tests) to `model: sonnet` agents with a precise brief. Keep thinking, accounting logic and decisions for yourself.
7. **Before testing any new strategy,** read `research/TESTED-STRATEGIES.md`. After a study add a row there and run `python report-index/rq.py update` and `graphify update .`.

## 2. State at hand-over (2026-11-16)
| Item | State |
|---|---|
| Code | 12 engines and monitors, 231 automated tests, all pass on the work PC. `node run.js all` = 14 steps: 13 ok, 1 blocked (the recorder, waiting for the VPS pull). |
| Live result (estimate) | about +24R: -8.45R on 22 closed trades, +32.6R open (valued at Binance prices). The 3 bots were all short, about 1.3 independent bets. |
| Trade record | A one-time export taken Nov 15 23:34 UTC (`inputs/db-export/`). It is OLD by the time you read this. Refresh it in step 4. |
| Headlines | Archive has only Pulse briefs of Nov 11 to 15 (60 rows). New ones need the crypto-news repo pulled. |
| Owner tags | 5 events in `inputs/owner-tags.csv`, entered after the fact. |
| Not done | Recorder pull, read-only key, git commit of `intel/`, second backup copy, report deploy, VPS watcher (Option B is NOT written). |
| Known limits | Few days of live trades; regime labels failed the unseen-data test (context only); the "fewer than 2 effective bets" alert fires almost always (not selective). |

## 3. Steps (in this order)
Tell the owner what you are doing at each step in one or two lines. Mark `[ASK]` steps: wait for a yes first.

### Step 1. Find the files and check the PC
- Check `node -v` is 20 or newer. Find the folder `StrategyBacktester\intel`. If it is missing, the owner has not copied it yet: ask which way they chose (git pull, or a snapshot folder from `intel\backups`) and follow `HOME-SETUP.md`, step 1.
- Check the layout next to it: `..\candles\binance-futures\1h`, `..\..\crypto-news`, `..\..\ledger\reports`, `..\..\bb-core`, `..\..\i-core`, `..\bb-trail`. A missing optional folder only skips some tests or steps. A different path means editing the matching key in `config.json` (`candleLibrary`, `pulseBriefs`, `pulseEvents`, `recorderData`, `adminReportsDir`, `mexcSamples`).

### Step 2. Tests and first run
```
cd StrategyBacktester\intel
node run.js test
node ..\candles\update.js --no-1m
node run.js all
node run.js status
```
Expect: tests all pass (231; a test skips if a bot repo is missing). `run.js all`: 13 ok and 1 blocked, 0 failed. If `candles` says "required coins are current" failed, a coin is missing from `..\candles\coins.json`: add it and rerun the updater. Read `reports\INDEX.md` and `reports\integrity.md`.

### Step 3. Daily task [ASK the time; default 09:00 PC time]
```
powershell -ExecutionPolicy Bypass -File scripts\daily-task.ps1 -Install -At 09:00
powershell -ExecutionPolicy Bypass -File scripts\daily-task.ps1 -Status
```
It runs `scripts\daily.cmd` (candle refresh, `run.js all`, snapshot), only while the owner is logged in. Log: `logs\daily.log`. Remove with `-Remove`. Confirm the task exists with `-Status`.

### Step 4. Refresh the trade record (no database key needed)
The owner has no read-only key yet. Use read-only SELECT queries instead:
1. If the Supabase tools are connected in this session: project "Backtester" (id `vkfetsmnlylcsbwxcord` on Nov 16; check with `list_projects`). Run QUERY 1 and QUERY 2 from `scripts\export-queries.sql` with `execute_sql`. They only SELECT. The tool saves big results to a file; note both file paths.
2. If the tools are not connected: ask the owner to run the two queries in the Supabase SQL editor and save each result to a text file, and tell you the paths.
3. Then:
```
node scripts\make-export.js <result1-file> <result2-file>
node run.js all
```
Expect: a new `inputs\db-export\export-<date>.json`, `trades` step ok, and the integrity report line "export is recent". Check `reports\truth-check.md`: closed trades should reconcile (earlier: all 22 matched). Report any new "review" item to the owner in plain words.
Later option: a real read-only key (`INTEL_SUPABASE_URL` and `INTEL_SUPABASE_KEY` in `secrets.local.json`) makes `run.js all` download by itself. Creating it is the owner's step; guide them, never see the key.

### Step 5. VPS recorder data [ASK]
The recorder on the VPS saves MEXC candles, order-book slippage and funding. Pulling is a read-only copy.
```
..\lucidio-recorder\pull-recorder-data.cmd YOUR-VPS
node run.js all
```
`YOUR-VPS` is the owner's ssh name for the VPS: ask for it. Expect: the `recorder` step turns ok and `reports\execution.md` gets an order-book capacity section. If ssh fails, report the exact message; do not try other ways in.

### Step 6. New headlines [ASK]
Ask before `git pull` in `..\..\crypto-news`. Then `node run.js all`. Expect more rows in the headline archive and new days in `data\headlines\coverage.json`. If a brief date is missing the integrity monitor says so.

### Step 7. Owner events since Nov 16
Ask: "Did anything big happen in the markets or news since Nov 16 (for example a hack, an election result, a big company event, a surprise data release)?" For each one, add a row to `inputs\owner-tags.csv`:
`tag,type,direction,event_time_utc,published_at_utc,first_seen_at_utc,time_precision,source_url,note`
Use ISO UTC times. `first_seen_at_utc` is when the owner or a source first saw it; if unknown, say "time approximate" in `time_precision`. Check the facts with a web search before you write a row; do not invent times. Then `node run.js all` and read `reports\events.md` and `reports\journal.md`: what did BTC do after each event, and what did our bots do?

### Step 8. What changed since Nov 16
Read `reports\journal.md`, `reports\exposure.md`, `reports\health.md`, `reports\truth-check.md`. Tell the owner in a short table: new trades, new streaks, current effective independent bets, live result against backtest windows (percentile), any alert. Compare with section 2. Do not draw rules from a few days of data; say so.

### Step 9. Git [ASK]
`intel/` is not committed (about 500 uncommitted changes in `StrategyBacktester`). Show `git status --short` grouped, and propose committing only: `intel/`, `candles/coins.json`, `research/TESTED-STRATEGIES.md`, `research/profit-cause-sim/`, `INFRASTRUCTURE-PLAN.md`, `HOME-TODO-VPS-AND-PC.md`. Check that `intel/.gitignore` excludes `secrets.local.json`, `backups/` and `logs/`. Do not push without a separate yes. In the `ledger` repo only `reports/index.json` and `reports/intel-system.html` are mine (other changes there are not).

### Step 10. Second backup copy [ASK for the folder]
Set `backupCopyTo` in `config.json` to a cloud-synced folder, run `node run.js snapshot`, and check the copy appears. Old snapshots are never deleted automatically; ask before deleting any.

### Step 11. Admin report
```
node run.js adminreport
```
This rebuilds `ledger\reports\intel-system.html` with fresh numbers (about 25 seconds). Tell the owner to deploy the ledger repo as they usually do (their step; check the report list shows it first).

### Step 12. VPS watcher: present the options, do not install
Read `VPS-MONITORING-PLAN.md`. Option A (record only) needs nothing new. Option B (a small hourly shock watcher on the VPS) is NOT written: if the owner wants it, build and test it here first (spec in the plan: dependency-free, 150 MB memory cap, own Linux user, no keys, installer that refuses code mentioning a key, one install file with a checksum, rollback = stop and delete). Option C (the full system on the VPS) is not advised: 853 MB peak memory on a 1.6 GB machine with the bots. Any VPS install needs the owner's yes and a check that the bots' start times are unchanged afterwards.

### Step 13. Save notes
Update the project memory (the `intel-infrastructure` note) with what was done, then write the final report (section 6).

## 4. Everyday commands
| Command (in `StrategyBacktester\intel`) | What it does |
|---|---|
| `node run.js all` | Refresh every dataset and rebuild every report |
| `node run.js status` | One line per dataset |
| `node run.js test` | All tests (never a bare `node --test`: it also runs copies inside `backups\`) |
| `node run.js snapshot [--with-candles]` | Versioned backup |
| `node run.js validate <strategy>` / `selftest` | Rule gatekeeper on one idea / on known ideas |
| `node run.js adminreport` | Rebuild the admin report |

## 5. If something goes wrong
| Symptom | Likely cause | Fix |
|---|---|---|
| `run.js all`: a step "failed" | Missing input or changed path | Read the one-line reason; check `config.json` paths; rerun that ingest step |
| "dataset ... failed its checks" when an engine loads | The data failed validation | `node run.js status`, then the integrity report; fix the source and rerun `ingest` |
| `candles` step: a required coin is behind BTC | Coin missing in `candles\coins.json` | Add it, `node ..\candles\update.js --no-1m` |
| trades: "export is N hours old" | Old export | Step 4 |
| Truth check shows "review" | Real disagreement between bot events, exchange closes and wallets | Explain it in plain words; never "fix" it in the database |
| Hash chain check fails (events, headlines, experiments) | A log row was changed or removed | Stop appending. Restore the file from the newest snapshot (`node backup\backup.js restore ...`) |
| Daily task did not run | PC off or user not logged in | `daily-task.ps1 -Status`; it runs when the PC is next on |

## 6. Final report to the owner (short, plain words)
1. What was done (steps 1 to 13), each marked done, skipped or blocked, with the reason.
2. A table of the numbers: tests pass, steps ok/blocked/failed, live R now (closed and open), effective independent bets, percentile against backtest, new events logged.
3. Anything that needs the owner (keys, yes/no decisions).
4. Anything you did NOT do and why.
Do not claim something works if you did not run it.
