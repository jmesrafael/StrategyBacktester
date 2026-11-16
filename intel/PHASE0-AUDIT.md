# Phase 0: infrastructure audit (2026-11-16)

This is the written result of the audit that came before the build. It lists what existed, what overlaps, what was missing, and the risks found. Nothing in the existing system was changed because of it.

## 1. What existed (inventory)

| Area | Where | What it is |
|---|---|---|
| Live bots | `../../bb-core`, `../../i-core`, `../bb-trail` (T-CORE), `../bb-core-1h` (paper) | Node.js bots. Each has its own copy of `mexc.js`, `ledger-sync.js`, `telegram.js`, `dashboard-push.js`, `journal.js`, `live.js`. |
| Candle library | `../candles` | Binance perps 1h, 4h, funding for 89 coins, 1m for 14. Closed bars only. Checks gaps, duplicates and bad bars on each update. |
| Recorder | `../lucidio-recorder` (runs on the VPS) | MEXC candles, order-book slippage every 5 minutes, funding, hourly regime. Pull to this PC needs an ssh login. |
| News site "Pulse" | `../../crypto-news` | Headlines with keyword labels. Keeps raw stories 8 days and daily briefs 60 days. |
| Dashboard and ledger | `../../ledger`, Supabase project "Backtester" | Trades, wallet snapshots, books. Tables used here: `bot_events`, `closed_trades`, `wallet_snapshots`, `bot_wallets`. |
| Research | `../research` (about 25 study folders, 1.4 GB) | One-off studies. Registry: `../research/TESTED-STRATEGIES.md`. |
| Indexes | `../report-index`, `../graphify-out` | Report search and code graph. |

## 2. Duplicated or conflicting functionality

| Finding | Evidence | Effect |
|---|---|---|
| Backtest engine written many times | 12 engine files and 5 files defining `backtest` under `research/` | Different cost and same-bar assumptions per study. Replaced for new work by `engines/backtest` (parity-tested against the three bots). |
| Shared bot modules have drifted | `mexc.js` has 4 different checksums across `bb-core`, `i-core`, `bb-trail`, `bb-core-1h` (also `ledger-sync.js`, `telegram.js`, `dashboard-push.js`) | A fix in one bot may be missing in another. Bot code, so NOT changed here. Already item A1 in `../../ledger/FABLE-TODO.md`. |
| Three ATR/indicator variants | BB-CORE seeds ATR at candle 0; I-CORE and T-CORE seed at candle 1 | Both reproduced exactly in `engines/backtest/engine.js` (`atrA`, `atrB`). |
| Live-versus-backtest compare per bot | `compare-live-vs-backtest.js` in each bot, drifted | `engines/health` makes one comparison for all three. |
| Regime code in two places | `lucidio-recorder/regime.js` and `research/bollinger/bb-deep.js` | `engines/regime` re-implements the recorder's version and a test proves identical output on 300 real checks. |

## 3. Data flow (before this build)

Binance public API → candle library → research scripts (each loads and checks data its own way).
Bots → dashboard push → Supabase (`bot_events`, `wallet_snapshots`) → dashboard. Nothing copied that data back to a research folder.
VPS recorder → files on the VPS only.
Pulse feeds → daily brief files, raw stories deleted after 8 days.

After this build: every source feeds one validated data store (`intel/data`), engines read only from it. See `README.md`.

## 4. Missing before the build

| Gap | Now |
|---|---|
| No local copy of the trade record | `ingest/trades.js` (seed export taken 2026-11-15; live download needs a read-only key) |
| No permanent headline archive | `ingest/headlines.js`, append-only, from the first saved brief (2026-11-11) |
| No recorder copy on this PC | `ingest/recorder.js`; waits for the pull |
| No single validity check across datasets | `lib/spine.js` (manifests, checksums) and `integrity/monitor.js` |
| No combined exposure measure | `engines/exposure` |
| No standard validation for new ideas | `engines/validator` |

## 5. Risks found

| Risk | Detail | Action |
|---|---|---|
| Ledger backups not found on this PC | `../../ledger/backups` and `backup.config.json` do not exist here. The ledger doc describes a nightly backup that runs "on any computer that stays on". It may run on another machine. | Owner to confirm where it runs. Not changed. |
| No off-server copy of recorder data | `RECORDER_SYNC_CMD` not set (per project notes) | Run the pull; `run.js snapshot --with-recorder` then keeps a copy here. |
| `StrategyBacktester` has 496 uncommitted changes (285 modified, 211 new), including all of `intel/` | `git status` | Commit is the owner's decision. Until then `run.js snapshot` is the only backup of `intel/`. |
| Candle library not in git | 2.1 GB, 1m files ignored by design | Re-downloadable with `candles/update.js`. Snapshots can include 1h/4h with `--with-candles`. |
| Secrets | `.gitignore` covers `.env`; only `mexc-keys.example.json` files were found; a search of `intel/` for key patterns found nothing | `intel/secrets.local.json` is git-ignored. Database access must use a read-only key. |
| One bad candle series | `KNC` 1h has a bad bar (known) | Excluded automatically by `ingest/candles.js`; KNC is not a traded coin. |
| ARB candles had stopped updating | `ARB` was not in `candles/coins.json`, so the routine update skipped it (ended 2026-11-12) | Added to `coins.json`. The integrity step now fails if a required coin ends more than 2 hours behind BTC. |

## 6. Decisions

- Build a new folder (`intel`) and leave existing code in place. Reuse the candle library and the regime definition.
- Read-only everywhere. No engine writes to a database, a bot, or an exchange.
- Plain files (CSV, JSON lines, JSON) with a manifest per dataset. No database engine, no packages.
