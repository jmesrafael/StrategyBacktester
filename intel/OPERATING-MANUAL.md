# Operating manual

All alerts in this system are information only. No alert stops, changes or starts a trade. No bot reads anything from intel.

Run every command in the `intel` folder unless the text says otherwise.

## 1. Daily routine

1. Refresh the candle library (needs network):
   `node ../candles/update.js --no-1m`
2. Pull the `crypto-news` repo (git pull) so new Pulse briefs arrive. Config key: `pulseBriefs`.
3. Optional, when you want fresh bot data: pull the recorder data (see section 3) and set the database key (see section 3).
4. Run everything:
   `node run.js all`
5. Read `reports\INDEX.md`. It has one line per step: `ok`, `blocked` or `failed`.
6. Open the reports you need (section 2).
7. Optional: `node run.js status` for the age of each dataset, and `node run.js snapshot` for a backup.

Other run commands:

| Command | What it does |
|---|---|
| `node run.js all` | ingest, then every engine and report |
| `node run.js ingest` | only the four intake steps (candles, trades, headlines, recorder). It does not write `INDEX.md`. |
| `node run.js reports` | only the engines and reports, from the data already in the store |
| `node run.js status` | one line per dataset: state, age, files, faults on disk |
| `node run.js test` | the full test suite (`node --test "test/*.test.js"`; do not run a bare `node --test`, it would also run the copies of the tests inside `backups/`) |
| `node run.js snapshot [--with-candles] [--with-recorder]` | versioned backup |
| `node run.js validate <strategy>` | the gatekeeper on one strategy (`bbFade`, `rsi2`, `bbcore`, `icore`, `tcore`, or your own) |
| `node run.js selftest` | the gatekeeper on the known strategies |
| `node run.js help` | short usage |

A step that fails or is blocked does not stop the others. The exit code is 1 only if a step `failed`.

## 2. What each report answers

| Report | Question it answers |
|---|---|
| [reports\INDEX.md](reports/INDEX.md) | Which steps ran, and did each succeed? |
| [reports\integrity.md](reports/integrity.md) | Can the data be trusted? Fresh, intact, checksums right, venue prices agree? |
| [reports\truth-check.md](reports/truth-check.md) | Do the bot events, the exchange closes and the wallet snapshots agree? |
| [reports\journal.md](reports/journal.md) | Which kind of day makes or loses money for each bot? Streaks and entry clusters. |
| [reports\events.md](reports/events.md) | What did BTC do after shocks, releases, owner tags and headlines? Closest past shock matches. |
| [reports\regime.md](reports/regime.md) | What regime is each coin and the market in now? Does the label explain bot results? |
| [reports\correlation.md](reports/correlation.md) | How much do the coins move together? Do they follow BTC? |
| [reports\exposure.md](reports/exposure.md) | How big is the one combined bet of all live bots? What would a BTC move do? |
| [reports\execution.md](reports/execution.md) | How good are fills? What do fees cost? Is there enough liquidity? |
| [reports\health.md](reports/health.md) | Do live bots behave like their backtests? Is the live result unusually low? |
| [reports\backtest.md](reports/backtest.md) | What do the reference backtests of the three bots show? |
| `reports\validation\<name>.md` | Did a strategy pass the gatekeeper? |

## 3. Reading "blocked" and "failed"

`run.js` marks a step:

- `ok`: all its checks passed.
- `blocked`: a check failed and the step wrote no files. An outside step is needed.
- `failed`: a check failed and files exist, or the code threw an error. Read the detail text.

Two steps are special. `truth check` and `integrity` always report `ok` as a step, even when they find problems. The findings are inside their reports (`reports\truth-check.md`, `reports\integrity.md`). Always read those two.

| Step | Typical message | What to do |
|---|---|---|
| recorder | `recorder data pulled: folder not found` (blocked) | The VPS recorder data is not on this PC. Run `lucidio-recorder\pull-recorder-data.cmd YOUR-VPS`. It needs the VPS ssh login, so the owner runs it. Then run `node run.js ingest`. Target folder: config key `recorderData`. |
| trades | note `no read-only database key configured: built from the newest export file` | Not an error. The trade data is as old as the newest file in `inputs\db-export\`. To get live data, set `INTEL_SUPABASE_URL` and `INTEL_SUPABASE_KEY` in the environment or in `secrets.local.json`. Use a READ-ONLY key. The job downloads the tables and saves a new `export-YYYY-MM-DD.json`. With no key, refresh the export by hand and put the JSON file in `inputs\db-export\` (the newest file name, sorted by name, is used). |
| trades | `no export file in inputs/db-export` (blocked) | Put an export JSON file there, or set the key. |
| trades | `HTTP 401` or `HTTP 403` | The key may not read that table. Check the key and its rights. |
| trades | `row counts match the database` failed | The export is incomplete. Make a new export. |
| candles | `required coins are current` failed | A coin ends more than 2 hours before BTC. Add it to `..\candles\coins.json`, run `node ../candles/update.js --no-1m`, then `node run.js ingest`. |
| candles | `history unchanged` failed | Old candle rows changed since the last run. See `..\candles\README.md`. Do not ignore it: every backtest depends on those rows. |
| candles | `required coins clean` failed | A series has bad data (order, duplicates, OHLC). The message names the series. |
| headlines | `archive intact (hash chain)` failed | An old archive row was altered or removed. Nothing is appended. Restore `data\headlines` from a snapshot. |
| headlines | `source folder found` failed | `pulseBriefs` points to a missing folder. Check the path in `config.json` and pull the crypto-news repo. |
| events | `ledger intact (hash chain)` failed | Same as headlines, for `data\events`. |
| any engine | `[MISSING]`, `[FAILED]`, `[STALE]`, `[CORRUPT]`, `[SCHEMA]` | The engine refused a bad input. The text names the dataset. Rebuild the input (`node run.js all`). If `CORRUPT`, a file changed after it was built: rebuild, or restore from a snapshot. |
| validator | `experiment log was altered` | `data\experiments` chain is broken. Restore it from a snapshot. |

## 4. Add an owner event tag

Open `inputs\owner-tags.csv`. Add one line. The header is:

`tag,type,direction,event_time_utc,published_at_utc,first_seen_at_utc,time_precision,source_url,note`

| Column | Meaning |
|---|---|
| `tag` | the name of the event. Required. |
| `type` | free text, for example `hack`, `politics`, `macro`, `stocks`. Stored as the event subtype. |
| `direction` | free text, for example `bearish`. Stored as the event direction. |
| `event_time_utc` | when the thing happened, ISO time (`2026-11-10T13:30:00Z`). May be empty. |
| `published_at_utc` | when it was published. May be empty. |
| `first_seen_at_utc` | when you could first have known it. Required. Rows without it are skipped. |
| `time_precision` | for example `exact (scheduled release)` or `hour approximate` |
| `source_url` | link |
| `note` | free text. Use quotes if it holds a comma. |

Then run `node run.js reports`. The ledger is append-only: a new tag is added once. A tag already in the ledger is not changed if you edit the CSV later. The event id is built from the tag text and the `first_seen_at_utc` time. Use the real first-seen time, never a time chosen after seeing the price move.

## 5. Test a new strategy with the gatekeeper

1. Open `engines\backtest\strategies.js`. Add a factory function that takes overrides and returns a strategy object. Copy `bbFade` or `rsi2` as a pattern. The object needs `name`, `params`, `interval`, `atr`, `atrLen`, `warmup`, `gapLookback`, `stopMode`, `timeExit`, `maxBars`, `signal(ctx, i)` and exit settings.
2. Export it in `module.exports` of the same file.
3. Run `node run.js validate <name>`. Add `--coins SOL,ZEC` to change the coins (default: SOL ZEC NEAR ADA GALA).
4. Read `reports\validation\<name>.md`. Verdict: `REJECTED` (a hard check failed), `WATCH` (hard checks passed, a soft check failed), `PASSES`.
5. Record the verdict as a new row in `research\TESTED-STRATEGIES.md` (in the parent project, outside intel).

Every run is added to the experiment log. More runs raise the bar for the t-statistic. Do not run the same idea many times with small changes to look for a pass. Details: `engines\validator\README.md`.

## 6. Change thresholds

All in `config.json`. After a change, run `node run.js reports`.

| Key | Meaning | Used by |
|---|---|---|
| `shock.lookbackBars` | number of 1h bars that define "normal" (720) | events |
| `shock.minZ` | shock size, in multiples of normal (3) | events |
| `shock.minVolRatio` | shock volume, in multiples of normal volume (2) | events |
| `exposure.corrWindowHours` | correlation window in hours (168) | correlation, exposure |
| `exposure.alertEffectiveBets` | alert when effective bets fall below this (2) | exposure |
| `exposure.alertNetR` | alert when open net R is beyond plus or minus this (8) | exposure |
| `health.alertPercentile` | alert when the live result is below this percentile of backtest windows (5) | health |
| `freshness.marketHours` | max age of the newest BTC bar (30) | integrity |
| `freshness.tradesHours` | max age of the trade export (30) | integrity |
| `freshness.headlinesHours` | newest brief age limit. The code uses this value plus 24 hours. | integrity |
| `coinStart.<COIN>` | UTC date a coin went live on a bot after the bot started (ARB, SUI, ETH) | health parity |
| `bots.<bot>.coins` | the coin list of each bot | backtest, regime, health |
| `marketCoins` | coins used for shocks and correlation | events, correlation |
| `backupCopyTo` | folder for a second copy of each snapshot (null = none) | backup |

`shock` changes only affect shocks found in the future: old ledger rows stay as written.

## 7. Run a replay as of an earlier date

Several engines accept `opts.asOf` (Unix seconds, UTC). They then use only data known at that time.

Engines with `asOf`: `engines/journal`, `engines/regime`, `engines/exposure`, `engines/health`, `engines/correlation`, and `buildReactions` in `engines/events`. The `events` ledger uses `opts.now` instead (see the warning).

Example (journal as of 2026-11-10 00:00 UTC):

```
node -e "console.log(require('./engines/journal').run({ asOf: Date.UTC(2026,10,10)/1000, noReport: true }).status)"
```

Warnings:

- A replay writes the normal dataset in `data\derived\...`. It overwrites the current one. Run `node run.js reports` afterwards to restore it.
- To keep the real data safe, set `INTEL_DATA` to another folder for the replay. That moves the dataset output. Reports still go to `reports\`, except where `noReport` exists (journal only).
- The event ledger is append-only. Do not replay `buildLedger` with an old `now` on the real store: it would append rows with a wrong `recorded_at`.
- The backtest engine has no `asOf`. It runs over all candles. See `engines\backtest\README.md`.

## 8. What the alerts mean

| Where | Alert text | Meaning |
|---|---|---|
| `reports\exposure.md` | `effective bets X below 2` | With 3 or more open positions, the positions behave like fewer than 2 independent bets. The bots hold the same kind of trade. |
| `reports\exposure.md` | `open net R X beyond +-8` | The open positions together are far in profit or loss. |
| `reports\health.md` | `live result is in the lowest 5% of backtest windows` | The live result since start is worse than 95 percent of backtest periods of the same length. Not proof of decay on a short period. |
| `reports\health.md` | `N losses in a row, the backtest's longest run is M` | Current live losing run is at least 70 percent of the longest backtest run. |
| `reports\health.md` | `parity: N live-only entries, largest R difference X` | The live bot entered where the backtest did not, or R differs by more than 0.15. |
| `reports\integrity.md` | `fault` | Do not trust engines that use that data until fixed. |
| `reports\integrity.md` | `blocked` | An outside step is needed (usually the recorder pull). |
| `reports\truth-check.md` | `review` | Two records of the same trading disagree. Check the bot log and the exchange. |
| `reports\regime.md` | `not validated` | The regime label is context only. Do not use it as a filter. |

## 9. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `node run.js status` shows `FAULT(S) on disk` | A file in `data\` changed after it was built | `node run.js all`. If it stays, restore from a snapshot. |
| Step `blocked` for recorder | No recorder data on this PC | Section 3, recorder row. |
| Integrity: `newest BTC bar is recent` fault | Candle library is older than 30 hours | `node ../candles/update.js --no-1m`, then `node run.js all`. |
| Integrity: `export is recent` fault | Trade export older than 30 hours | Set the database key, or make a new export file. |
| Integrity: `newest brief is recent` fault | Pulse briefs are old | Pull the `crypto-news` repo, then `node run.js ingest`. |
| Integrity: `no missing days` fault | A Pulse brief day is missing inside the range | The archive cannot recover it. Note it. The fault stays. |
| Integrity: venue parity `blocked` | No MEXC candle samples found | Provided by the recorder pull. See `integrity\README.md`. |
| Integrity: venue parity `fault` | Binance and MEXC 4h closes differ (99th percentile over 50 bp) | MEXC prices differ from Binance for that coin. Read the detail. Backtests use Binance. |
| Integrity: `entry prices match the market` fault | A live entry price is outside its Binance candle by more than 1 percent | Check that trade on the exchange. |
| Truth check: `open positions agree` review | Wallet and events disagree on open positions | Use the interval start time in the report to find the cause. |
| `[SCHEMA]` error on build | A value is empty or of the wrong type | Read the column named in the message. Check the source file. |
| `[STALE]` error | A dataset is older than the caller allows | Rebuild with `node run.js all`. |
| `market: COIN/1h is not in the registry` | Coin missing from the candle library | Add it to `..\candles\coins.json`, update, then `node run.js ingest`. |
| Tests skipped in `backtest-parity` | Bot repos or market dataset not present | Expected on a computer without the bot repos. |
| Validator `reference backtests not built` | `derived/reference-trades` missing | `node run.js reports` first. |
| Reports are old | Run did not finish | Check the summary lines for `failed`. |

## Daily automatic run (moved to the home PC)

**Update:** the task was turned OFF on the work PC on 2026-11-16. Install it on the home PC with `scriptsdaily-task.ps1 -Install` (see `HOME-SETUP.md`). The description below still applies.

A Windows scheduled task named **Lucidio Intel Daily** runs `scripts\daily.cmd` every day at 09:00 PC time (Taipei, which is 01:00 UTC, after the 00:00 UTC candle has closed).

What it does, in order: refresh the public candles (`candles\update.js --no-1m`), `node run.js all`, `node run.js snapshot`. Log: `logs\daily.log` (git-ignored). It does not pull git repos, and it does not touch bots, the VPS or any database.

| Question | Answer |
|---|---|
| When does it run? | Only while the user WEB is logged in. If the PC was off at 09:00, it runs when the PC is next on and logged in (StartWhenAvailable). |
| Time limit | 30 minutes; a second copy never starts while one is running. |
| New headlines | The task does not pull the crypto-news repo. Pull it by hand so new Pulse briefs reach the archive. |
| Snapshots | One per day; unchanged files are hard-linked, so disk use stays small. Old snapshots are not deleted automatically: delete old folders in `backups\` yourself when needed. |
| Check it worked | Open `logs\daily.log` (last line `exit 0`), or `node run.js status`. |
| Turn it off | PowerShell: `Unregister-ScheduledTask -TaskName 'Lucidio Intel Daily' -Confirm:$false` |
