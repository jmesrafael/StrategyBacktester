# Research and risk infrastructure: audit, architecture and phased plan

Written 2026-11-16. Status: plan only, nothing built. Owner approval is needed before each phase starts.

## Purpose

A self-contained research and risk system that the owner keeps permanently. It runs with no AI at runtime and
can be maintained by any developer or AI model. It observes and reports. It does not trade.

## Fixed rules

1. No change to any live or paper bot, their configs, or the VPS services without the owner's explicit approval.
2. Database access is read-only. Nothing here writes to the dashboard or ledger database.
3. No AI or outside model is called at runtime. Plain Node.js (v24 is installed), no new npm packages unless approved.
4. Data is stored as CSV or JSON-lines files. Any database file is an index that can be rebuilt from those files.
5. Every component has a README, tests that run with `node --test`, a stated input and output, and exportable data.
6. A component is added only if it has a number that shows whether it helps. If the number says no, it is recorded
   in `research/TESTED-STRATEGIES.md` and dropped.

---

## Part 1. Audit: what exists

### Reusable as it is

| Component | Where | What it gives | Tests |
|---|---|---|---|
| Candle library | `candles/` (`candles.js`, `update.js`, `MANIFEST.json`) | Binance perps 1h, 4h, funding for 89 coins, 1m for 14; closed bars only; gap, duplicate and bad-bar checks on every update | checks built into the updater |
| Regime classifier | `lucidio-recorder/regime.js` | Pure function: 1h candles in, coin state (trending up/down, volatile, quiet, ranging) and market state out, plus a 7-day average correlation | `test/recorder-test.js` |
| Market recorder | `lucidio-recorder/` (on the VPS) | MEXC 1m/1h/4h candles, order-book slippage every 5 minutes, settled funding, hourly regime | yes |
| Report index | `report-index/rq.py` | Search over every report file | none |
| Knowledge graph | `graphify-out/` | Code and document map | none |
| Tested-strategies registry | `research/TESTED-STRATEGIES.md` | Every test, verdict, lesson and the six-step test checklist | n/a |
| Ledger backup and daily check | `ledger/scripts/backup-ledger.mjs`, `recon-check.mjs` | Nightly export of the books; books-against-wallets check | ledger test suite |
| News gate and event calendar | `news-gate/news-gate.js`, `crypto-news/data/events-history.json` | Scheduled US data releases and hacks | `news-lab.test.mjs` |
| Profit-cause replay | `research/profit-cause-sim/sim.js` | Prototype of the shock detector, daily journal, streaks, clusters and entry stamps | none yet |

### Exists in pieces, must be unified before reuse

| Piece | Where | Problem |
|---|---|---|
| Backtest engines | each research folder has its own | Cost and same-bar assumptions differ (backlog item B1) |
| Walk-forward and robustness | `research/coin-walkforward/wf.js`, `bb-core/audit/` (`test-no-lookahead.js`, `multiple-testing.js`, `mc-risk.js`, `robustness.js`), `zec-replacement/stability.js` | One-off scripts tied to one study each |
| Correlation and overlap | `orb-sol/compare-bots.js`, `ichi-ltf/eval.js`, `portfolio-mix/mix.js` | Monthly bot correlation only; nothing rolling, nothing between coins beyond 5 |
| Live against backtest compare | `compare-live-vs-backtest.js` in each bot | Copies have drifted apart (backlog item A3) |
| Regime history | `lucidio-recorder/regime-history.js` | Covers the 1h BB-CORE backtest only. Its own README says regime differences are small |

### Missing

| Gap | Evidence |
|---|---|
| No local copy of the trade record | Trades live only in the dashboard database. The Nov 16 replay needed a hand export |
| No off-server copy of recorder data | `RECORDER_SYNC_CMD` is not set; a VPS disk failure loses the order-book history |
| No long-term headline archive | Pulse deletes raw stories after 8 days and keeps 12 highlights a day for 60 days |
| No single place that says which data is valid | Each dataset has its own checks or none |
| Trade list and wallets disagree | Nov 16: I-CORE shows 4 open in events, 3 in the wallet; T-CORE 7 against 8 |
| No combined exposure measure | Nov 14 to 15: 17 same-direction shorts, +24R then -10R, across three bots judged separately |
| No measure of whether a bot still behaves like its backtest | Daily compare exists per bot but there is no statistical alarm |

---

## Part 2. Architecture

```
SOURCES                 DATA SPINE (validated files)        ENGINES (read only)          OUTPUT
Binance candles    -->  market/   candles, funding     -->  Event study             -->  reports/*.md
VPS recorder       -->  mexc/     candles, book, regime -->  Regime                 -->  datasets (CSV)
Dashboard database -->  trades/   entries, exits, wallets -> Correlation, contagion -->  alerts (text file)
Pulse headlines    -->  events/   event ledger, headlines -> Exposure monitor
Owner's tags       -->                                      Journal, streaks
                        every dataset has a manifest        Validator (gatekeeper)
                        integrity monitor checks all        Edge-decay monitor
```

- **One direction.** Sources feed the spine, engines read the spine, engines write reports and their own output
  dataset. No engine reads another engine's internals. If engine B needs engine A's result, it reads A's published
  dataset through the spine.
- **One loader.** A small library (`spine.js`) is the only way to read data. It refuses a dataset whose manifest
  is missing, stale or failed its checks. This is the single shared dependency.
- **Manifest per dataset.** Schema version, row count, time range, file hash, last check time and result.
- **Engines are independent.** Each is a folder with a README, tests and one command. Deleting an engine breaks
  nothing else.
- **Location.** The spine lives on the work PC. The VPS has 1 vCPU and 15 GB of disk, so it keeps recording only
  and a nightly pull copies its data down.
- **Bots are outside the boundary.** Nothing in this system sends anything to a bot.

---

## Part 3. Components

### Foundation

| # | Component | What it does | Reuses | Measurable result |
|---|---|---|---|---|
| F1 | Data spine and loader | Folder layout, manifests, `spine.js` | `candles/` pattern | Every dataset rebuilds from sources with one command |
| F2 | Trade exporter | Read-only nightly pull of entries, exits, wallet snapshots to CSV | Supabase read access | Local trade file matches database row counts and sums |
| F3 | Recorder pull | Nightly copy of VPS recorder data | `pull-recorder-data.cmd` | A second copy exists, no more than 24h old |
| F4 | Headline archive | Keeps every Pulse highlight with first-seen time, permanently | Pulse briefs | No day missing after the start date |
| F5 | Integrity monitor | Gaps, duplicates, stale feeds, hash changes in old rows, Binance against MEXC price agreement | `MANIFEST.json` checks, `venue-parity.js` | One daily line per dataset: ok or the exact fault |
| F6 | Truth check | Trade events against wallets against closed trades, per bot, daily | `recon-check.mjs` (backlog item C2) | Open-position counts and unrealised profit agree, or the gap is named |

### Engines

| # | Engine | What it answers | Reuses | Measurable result |
|---|---|---|---|---|
| E1 | Event ledger | What happened, when was it first known, what did the market do after | `sim.js` shock detector, Pulse, owner tags | Append-only; old rows never change (hash test) |
| E2 | Event study | After this kind of event, what usually follows | Candle library from 2019 | Reaction tables with sample size and range for each event type |
| E3 | Journal and streaks | Which kind of day pays each bot | `sim.js` | Reproduces the Nov 16 replay numbers exactly |
| E4 | Regime engine | What state is the market in, how long do states last, does state explain bot results | `regime.js` | Out-of-sample test: do bot results differ by regime after 2024 as they did before. If not, regime stays as context only |
| E5 | Correlation and contagion | How alike are the coins now, does a BTC shock reach the alts and how fast, do coins fall together in the worst hours | `regime.js` `corr()`, 89-coin library | Rolling correlation, lead-lag table, worst-5%-hours co-movement |
| E6 | Exposure monitor | How big is the combined bet across all bots right now | E5, F2 | Effective number of independent positions; a warning when it falls below a set level. Warning only |
| E7 | Reference engine and validator | Does a new rule survive a fixed test | Checklist in the registry, `wf.js`, `test-no-lookahead.js`, `multiple-testing.js` (backlog item B1) | Reproduces the three bots' known backtests; rejects the registry's known failures |
| E8 | Edge-decay monitor | Is each live bot still inside what its backtest allows | `mc-risk.js`, per-bot compare | Live drawdown and losing run placed on the backtest's distribution, daily |
| E9 | Cost and capacity | How much size before slippage removes the edge | Recorder order-book data | Slippage by coin and size against R per trade |

E8 and E9 are the additional engines I recommend. Funding and crowding analysis, and any automatic sizing or
entry filter, are left out for now: the first has no clear measure yet and the second would change bot behaviour.

---

## Part 4. Phases

Effort is in working sessions of about half a day and is an estimate.

| Phase | Builds | Depends on | Effort |
|---|---|---|---|
| 0 | Data map of every source and field (backlog item C1); owner decisions below | none | 1 session |
| 1 | F1 to F6 | Phase 0 | 4 to 5 sessions |
| 2 | E1, E2, E3 | Phase 1 | 3 to 4 sessions |
| 3 | E4, E5, E6 | Phase 1; E6 needs E5 | 4 sessions |
| 4 | E7 | Phase 1 | 5 to 6 sessions |
| 5 | E8, E9 | Phase 4 for E8; Phase 1 for E9 | 3 sessions |

Phases 2, 3 and 4 do not depend on each other and can be done in any order after Phase 1.

### Acceptance criteria

| Phase | Done when |
|---|---|
| 0 | Every table, file and feed is listed with owner, update time, and where it is copied |
| 1 | All datasets rebuild from sources with one command on a clean folder. The integrity report shows no unexplained fault for 7 days in a row. The truth check explains the Nov 16 position mismatch. A restore from the export works on a second machine using only the README |
| 2 | The journal reproduces the Nov 16 replay totals. Shocks are back-filled to 2019. Cutting the data at a random past date gives identical earlier rows. Every study table shows its sample size |
| 3 | Regime and correlation history exist from 2020. The regime out-of-sample test has a written verdict. The exposure monitor, replayed over Nov 9 to 15, flags the build-up before Nov 14 |
| 4 | The reference engine matches the known backtests (T-CORE: 613 trades, +1.29R per trade; BB-CORE and I-CORE to their records) within a stated tolerance. Run on five rejected and three accepted registry entries, the validator returns the same verdicts |
| 5 | Each bot's live drawdown is placed on its backtest distribution daily. The capacity table covers every live coin |

### Testing requirements for every component

1. Unit tests for each calculation (`node --test`).
2. A golden test: a small fixed input with a stored expected output.
3. A no-lookahead test where time matters: results up to time T must not change when later data is added.
4. A contract test: the output dataset matches its declared schema.
5. A cold-start test: a person follows the README on a clean folder and gets the same output.

---

## Part 5. Decisions for the owner before Phase 1

| Decision | Recommendation |
|---|---|
| Where the spine lives | Work PC, with a nightly pull from the VPS and the database |
| Read-only database key for the trade exporter | Reuse the revocable backup key the ledger already uses |
| Second copy of the spine | A synced cloud folder, as the ledger backup already supports |
| Order after Phase 1 | Phase 2 first: it uses data that exists today and continues the Nov 16 work |

## Links to the existing backlog (`ledger/FABLE-TODO.md`)

C1 is Phase 0. C2 is F6. A3 feeds E8. B1 is the first half of E7. A1 (the drifted `mexc.js` copies) is bot code
and stays outside this plan.
