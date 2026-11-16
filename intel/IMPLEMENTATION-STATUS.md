# Implementation status (2026-11-16)

Scope: the research and intelligence infrastructure, Phase 0 to Phase 5. Research side only. No bot, bot setting, trade, exchange account or database record was changed.

How to run everything: `node run.js all` (about 17 seconds). Tests: `node run.js test`. Manual: `OPERATING-MANUAL.md`.

## Test result

`node run.js test` on 2026-11-16: **227 tests, 227 pass, 0 fail, 0 skipped.** (A bare `node --test` also runs the copies of the tests stored in `backups/` and gives a misleading count; use `node run.js test`.)
Two bugs were found by the tests and fixed: a non-numeric candle time was reported as "not valid JSON", and the experiment log dropped a row when no hard check had failed.

## A. Fully implemented and verified

| Component | Where | How it was verified |
|---|---|---|
| Data store and loader (manifests, checksums, schema, stale and corrupt refusal, hash-chained logs) | `lib/spine.js`, `lib/util.js` | Unit tests: missing, failed, corrupt, stale and wrong-type data are refused; an edited, removed or reordered log row is detected. |
| Candle registry with history check | `ingest/candles.js`, `lib/market.js` | Unit tests; real run: 270 series checked, no old row changed, every required coin ends with BTC. |
| Trade exporter | `ingest/trades.js` | Unit tests incl. a fake paged download; real run: 555 events, 56 trades, 13,188 wallet snapshots, counts match the database. |
| Headline archive (event time, published time, first-seen time kept apart) | `ingest/headlines.js` | Unit tests incl. tamper detection and no-lookahead label lookup; 60 rows from 5 briefs. |
| Truth check | `integrity/truthcheck.js` | Unit tests; real run: all 22 closed trades reconcile with the exchange records. |
| Backup, verify, restore | `backup/backup.js` | Unit tests; real test: 390-file snapshot (330 MB), verified, restored into a clean folder, full pipeline run from the restored copy (10 steps ok). |
| Unified backtest engine and cost models | `engines/backtest` | **Parity test:** reproduces BB-CORE, I-CORE and T-CORE (both rule sets, 5 coins each, 30 runs) trade for trade, R difference 0. T-CORE old rules give 613 trades as documented. |
| Event ledger, reactions, event study, similarity search | `engines/events` | Unit tests for shock detection (incl. no-lookahead), episodes and release types; real run: 13,675 events back to 2019. |
| Daily journal, streaks, clusters, entry stamps | `engines/journal` | Reproduces the earlier replay (largest daily difference 0.006R, same two streaks). Only `rAt` has a unit test; the build is covered by the end-to-end test. |
| Regime engine and unseen-data test | `engines/regime` | Unit tests; parity test: identical to the recorder's classifier on 200 real positions. Verdict: 0 of 6 tests validated, so labels are context only. |
| Correlation and contagion | `engines/correlation` | 9 unit tests incl. no-lookahead; real run in 1 second. |
| Execution quality and capacity (Binance volume) | `engines/execution` | 7 unit tests; real run. |
| Combined exposure and stress test (alert only) | `engines/exposure` | Unit tests; replayed over Nov 5 to 15. |
| Rule gatekeeper and experiment log | `engines/validator` | Unit tests; self-test: the 3 live bots pass, BB fade and RSI(2) are rejected, as in the registry. |
| Strategy health: parity, edge decay, losing run | `engines/health` | Real run: backtest matches 17 of 22, 6 of 7 and 8 of 10 live entries, R differences at most 0.08. |
| Admin report with charts (also lists every component, dataset, test and command, and the VPS plan) | `report/admin-report.js`, output `ledger/reports/intel-system.html` | 8 chart tests; rendered to images and checked page by page. |
| One-command runner | `run.js` | Real run: 14 steps, 13 ok, 1 blocked. |
| Integrity monitor | `integrity/monitor.js` | Real run; covered by the end-to-end test. No unit tests of its own. |

## B. Implemented, waiting for data

| Component | Waiting for |
|---|---|
| Recorder intake and order-book capacity | The VPS pull: `lucidio-recorder\pull-recorder-data.cmd YOUR-VPS` needs your ssh login. The intake is tested on fake data; the capacity code for order-book data (`engines/execution`, section F) has never run on real data. |
| Headline coverage | Only 5 days exist (Pulse began saving briefs 2026-11-11). Headline groups in the event study are marked "too few samples". |
| Owner tags | 5 events, entered after the fact on 2026-11-16 with approximate hours. Live tagging from now on is clean. |
| Edge decay | 8 to 23 days of live trades. The report says "not unusual yet" at best. |

## C. Partially implemented

| Item | What is missing |
|---|---|
| Live database download | Written and tested with a fake server only. No read-only key exists yet, so the seed export was taken once by hand through a read-only session. |
| Validator self-test | 2 rejected ideas and 3 accepted ones were run. The plan asked for 5 rejected. More past rejections must be added as strategy definitions. |
| Exposure alert thresholds | The "fewer than 2 effective bets" rule fires on 91 of 132 history points, so it does not separate normal from unusual. The open-net-R rule (8R) is more selective. Both are first guesses in `config.json`; nothing is tuned. |
| Portfolio stress test | One-factor (BTC beta) only. It does not model coin-specific gaps or exchange outages. |
| Cross-venue check | Binance against MEXC is checked on 5 coins from local samples. The real MEXC data will come with the recorder pull. |
| Unit tests | `journal` build, `events` build and `integrity/monitor` rely on end-to-end checks, not unit tests. |

## D. Blocked by something outside this system

| Blocker | What is needed from the owner |
|---|---|
| VPS recorder pull | Run the pull command (ssh login). |
| Read-only database key | Create a read-only Supabase key and set `INTEL_SUPABASE_URL` and `INTEL_SUPABASE_KEY` (environment or `secrets.local.json`). |
| Restore on a separate computer | Only done in a second folder on this PC. Copy a snapshot to another machine and run `node backup/backup.js restore ...`. |
| Second backup copy | Set `backupCopyTo` in `config.json` to a cloud-synced folder. |
| Commit to git | `StrategyBacktester` has about 500 uncommitted changes including `intel/`. Until committed, snapshots are its only backup. |
| Changes to bots | None needed or made. Bot-code drift (`mexc.js` has 4 versions) is backlog item A1 and needs your authorization. |

## Findings produced (information only)

1. All 22 closed live trades reconcile with the exchange records. The only mismatch is one old I-CORE SOL short that sits in the T-CORE wallet.
2. Exit events reach the dashboard a median of 19 to 125 minutes after the exchange closes the position (longest 231 minutes).
3. Live total: about +24.1R (-8.45R closed, +32.6R open, estimate). Backtest windows of the same length give a median of +6R for all bots together; live is at the 68th percentile.
4. Market shocks do not predict direction. Regime labels failed the unseen-data test.
5. The three live bots move as roughly 1.3 independent bets when all are short. A 10% BTC rise would cost about the amount the 10% fall earned.
6. ARB candles had stopped updating; fixed in `candles/coins.json`, and the integrity step now catches a coin that falls behind.

## Every file and system created or changed

Created: everything under `StrategyBacktester/intel/` (list: `FILES.md`), `StrategyBacktester/INFRASTRUCTURE-PLAN.md`, `StrategyBacktester/research/profit-cause-sim/`.
Changed: `ledger/reports/index.json` (+1 entry) and new `ledger/reports/intel-system.html` (local only, not deployed), `StrategyBacktester/HOME-TODO-VPS-AND-PC.md` (pointer added), `StrategyBacktester/candles/coins.json` (added ARB), `StrategyBacktester/research/TESTED-STRATEGIES.md` (4 rows), candle library data files (new bars from `update.js`), `report-index` and `graphify-out` (regenerated).
Database: read-only SELECT queries only. Nothing written.
Bots, bot configs, VPS, exchange accounts: not touched.
Local only, outside the repo: memory notes in the Claude project folder, a restore test copy in the session scratch folder.
