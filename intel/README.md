# Intel: research and risk system

## What it is

Intel is a self-contained research and risk system for three trading bots: BB-CORE, I-CORE and T-CORE.
It reads data. It writes datasets and Markdown reports. That is all.

- It never trades.
- Nothing in it is read by a bot.
- It has no AI at runtime. Every number comes from plain code.
- It needs only Node.js (version 20 or newer; run on v24). No npm packages. No network, except two optional steps (a read-only database download and the candle update, which is a separate tool).

## Quick start

Run these in the `intel` folder.

```
node ../candles/update.js --no-1m   # refresh the candle library (needs network)
node run.js all                     # ingest data, build every dataset and report (about 1 minute)
node run.js status                  # one line per dataset: state, age, files
node run.js test                    # the full automated test suite
```

Then open `reports\INDEX.md`. It lists the result of every step and links to every report.
The daily routine is in `OPERATING-MANUAL.md`.

## Folder map

| Folder or file | What it holds |
|---|---|
| `run.js` | the one command: `all`, `ingest`, `reports`, `status`, `test`, `snapshot`, `validate`, `selftest`, `help` |
| `config.json` | paths, bot coin lists, thresholds. No secrets. |
| `lib\` | shared code: spine (data store), config, candle access, helpers. [lib\README.md](lib/README.md) |
| `ingest\` | the four data intake jobs. [ingest\README.md](ingest/README.md) |
| `integrity\` | data integrity monitor and truth check. [integrity\README.md](integrity/README.md) |
| `backup\` | versioned snapshots and restore. [backup\README.md](backup/README.md) |
| `engines\events\` | event ledger and event study. [README](engines/events/README.md) |
| `engines\journal\` | daily journal, streaks, clusters. [README](engines/journal/README.md) |
| `engines\backtest\` | one backtest engine and the reference backtests. [README](engines/backtest/README.md) |
| `engines\regime\` | market regime labels and their test. [README](engines/regime/README.md) |
| `engines\correlation\` | coin correlation, contagion, lead-lag. [README](engines/correlation/README.md) |
| `engines\execution\` | fill quality, costs, liquidity, capacity. [README](engines/execution/README.md) |
| `engines\exposure\` | combined exposure and stress test. [README](engines/exposure/README.md) |
| `engines\validator\` | the rule gatekeeper for new strategies. [README](engines/validator/README.md) |
| `engines\health\` | live against backtest. [README](engines/health/README.md) |
| `inputs\` | hand-made and exported inputs: `owner-tags.csv`, `db-export\*.json` |
| `data\` | the data store: one folder per dataset, each with a `manifest.json` |
| `reports\` | the Markdown reports (rebuilt on every run) |
| `backups\` | snapshots (not in git) |
| `test\` | automated tests (`node run.js test`) |

## Architecture

```
 SOURCES                      DATA STORE (spine)            ENGINES                 REPORTS
 candle library  ----ingest-> data\market        -+
 dashboard DB    ----ingest-> data\trades         |
 Pulse briefs    ----ingest-> data\headlines      +--> events, backtest, regime,   reports\*.md
 VPS recorder    ----ingest-> data\mexc           |    correlation, journal,       reports\INDEX.md
 owner tags (csv) ----------> engines\events     -+    execution, exposure,
                                                        health, validator
                              data\derived\*   <-------- engines write here
                                   |
                                   +--> integrity monitor, truth check, backup
```

Every engine reads data only through the spine. The spine checks every file against its manifest before it hands the data over.

## Rules

1. Read-only. Nothing here sends an order, changes a bot or writes to the database. All alerts are information only.
2. No secrets in code. Keys come from environment variables or `secrets.local.json` (ignored by git).
3. Append-only logs. `events`, `headlines` and `experiments` are hash chained. An old row cannot change without detection.
4. No engine reads another engine's internals. An engine reads datasets through the spine. The only direct code imports between engines are small exported helpers (for example the exposure engine calls `engines\correlation` `latest()` and `engines\journal` `rAt()`).
5. No look-ahead. A value is used only at a time when it was already known.

## Documents

| Document | Use it for |
|---|---|
| [OPERATING-MANUAL.md](OPERATING-MANUAL.md) | the daily routine, reading reports, fixing problems |
| [DATA-DICTIONARY.md](DATA-DICTIONARY.md) | every dataset and every column |
| [BACKUP-AND-RESTORE.md](BACKUP-AND-RESTORE.md) | snapshots and restore on a new computer |
| `reports\INDEX.md` | result of the last run, links to every report |

## Trade exporter key

The trade intake can download live data with a READ-ONLY database key. Set `INTEL_SUPABASE_URL` and `INTEL_SUPABASE_KEY` in the environment or in `secrets.local.json`. Without a key, the intake uses the newest file in `inputs\db-export\`. Details: [ingest\README.md](ingest/README.md).
