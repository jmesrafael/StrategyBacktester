# Data dictionary

Every dataset the system builds. The data store is called the spine (code: `lib/spine.js`). It lives in `intel\data\`.

## Rules that apply to every dataset

- A dataset is one folder: `data\<name>\`. It holds data files and one `manifest.json`.
- Datasets built from other datasets live in `data\derived\<name>\`.
- All times are UTC. A time column is a Unix time in seconds, unless the column says otherwise.
- The data root can be moved with the environment variable `INTEL_DATA` (default: the `data` folder).
- Engines read data only through `spine.load(dataset, file)`. It refuses data that is missing, failed, damaged, too old or off-schema.

### Column types

| Type | Meaning |
|---|---|
| `string` | text |
| `number` | finite decimal number |
| `int` | whole number |
| `bool` | true or false (CSV text `true` / `false`) |
| `json` | any JSON value (CSV cell holds JSON text) |
| `type?` | the value may be empty (null) |

An empty CSV cell means null. A field without `?` must never be empty, or the write fails with a schema error.

### File formats

| Extension | Format |
|---|---|
| `.csv` | header row = schema keys in order. RFC 4180 quoting. |
| `.jsonl` | one JSON object per line. All schema keys always present (missing = null). |
| `.json` | free JSON. No row schema. `rows` is null in the manifest. |

### manifest.json format

| Key | Meaning |
|---|---|
| `dataset` | dataset name, for example `derived/journal` |
| `schema_version` | integer, now 1 for all |
| `status` | `ok` if every check passed, else `failed` |
| `built_at` | ISO time of the build |
| `generator` | the code that built it, for example `ingest/trades.js` |
| `source` | where the data came from (free JSON) |
| `inputs` | list of `{ dataset, built_at, manifest_sha256 }`: the exact builds that were read (lineage) |
| `files` | per file: `rows`, `sha256`, `bytes`, `schema` |
| `checks` | list of `{ name, ok, detail }` |
| `notes` | list of plain-text notes |

`load()` rejects a dataset when: no manifest (MISSING), status not `ok` (FAILED), older than the caller allows (STALE), file missing, checksum different (CORRUPT), row count different from `rows` (CORRUPT), or a row does not match its schema (SCHEMA).
`node run.js status` prints one line per dataset and counts faults found by re-hashing every file (`spine.verify`).

### Hash chain rule (append-only logs)

Three logs are append-only: `events` (events.jsonl), `headlines` (headlines.jsonl) and `experiments` (log.jsonl).

- Each stored row has three extra columns: `seq`, `prev_hash`, `row_hash`.
- `seq` starts at 1 and goes up by 1.
- `prev_hash` of row 1 is 64 zeros. Later rows copy the `row_hash` of the row before.
- `row_hash` = SHA-256 of (`prev_hash` text + canonical JSON of the row without `seq`, `prev_hash`, `row_hash`).
- Canonical JSON has its keys sorted, so the same row always gives the same hash.
- Before each append, the code checks the whole chain (`spine.chainVerify`). It returns the first broken `seq`.
- If the chain is broken, nothing is appended and the dataset is marked `failed`. Restore from a backup. See `BACKUP-AND-RESTORE.md`.
- Changing, removing or inserting an old row breaks every later hash. This is how tampering is detected.

---

## Inputs to the system

### market (built by `ingest/candles.js`)

Registry of the candle library. It does not copy candles. The candles stay in `..\candles\binance-futures\`. Rebuilt on every `node run.js ingest` and `all`. Depends on the files in the candle library only.

File `registry.json` (JSON). Keys: `tf_seconds` (`{1h: 3600, 4h: 14400}`), `row_format`, `series`.
`series` has one entry per `COIN/1h`, `COIN/4h` and `COIN/funding`:

| Field | Meaning |
|---|---|
| `rows` | number of rows |
| `first`, `last` | open time of the first and last row |
| `gaps` | number of places where bars are missing |
| `missing` | total number of missing bars |
| `faults` | list of problems. A series with faults is not used. |
| `bytes` | file size. `lib/market.js` refuses a file whose size changed. |
| `rows_sha256` | hash of all rows. Used for the "history unchanged" check. |

Candle row format in the library files: `[openTimeSec, open, high, low, close, volume]`. Funding row: `[timeSec, rate]`.
Checks written to the manifest: series found, required coins present, required coins clean, history unchanged, required coins are current (within 2 hours of the BTC last bar).

### trades (built by `ingest/trades.js`)

The live and paper trades of the bots, from the dashboard database. Rebuilt on every run from the newest file in `inputs\db-export\`. Depends on the export file (or on the read-only database key, which creates a new export file).
Manifest `source` holds `export_file`, `export_sha256`, `exported_at`, `method`.

**trades.csv** (one row per entry, joined to its exit)

| Column | Type | Meaning |
|---|---|---|
| `trade_key` | string | `bot|mode|trade_id` (unique) |
| `mode` | string | `live` or `paper` |
| `bot` | string | bot tag, for example `bbcore`. From `data.bot`, else the prefix of the event id, else `bbcore` for live and `unknown` for paper |
| `coin`, `symbol` | string | coin (`SOL`) and exchange symbol (`SOL_USDT`) |
| `side` | string | `LONG` or `SHORT` |
| `dir` | int | 1 long, -1 short |
| `signal_candle_s` | int? | open time of the candle that gave the signal |
| `entry_s` | int | entry time |
| `entry_price` | number | fill price |
| `stop_price` | number | first stop price |
| `one_r` | number | 1R as a price distance (entry to first stop) |
| `risk_pct` | number? | fraction of equity risked |
| `qty` | number? | position size in coin units |
| `intended_price` | number? | price the bot wanted |
| `entry_slippage_r` | number? | entry slippage in R (negative = worse) |
| `entry_delay_s` | number? | seconds from signal to fill |
| `costs_kind` | string? | cost model name reported by the bot |
| `status` | string | `open` or `closed` |
| `exit_s` | int? | exit time |
| `exit_price` | number? | exit price |
| `r` | number? | result in R |
| `reason` | string? | exit reason from the bot |
| `mfe_r`, `mae_r` | number? | best and worst excursion in R |
| `bars` | int? | candles held |
| `hold_s` | number? | seconds held |
| `stop_at_exit_r` | number? | stop position at exit, in R |
| `entry_event_id`, `exit_event_id` | string, string? | source event ids |

**signals.csv** (every signal event the bots reported)

| Column | Type | Meaning |
|---|---|---|
| `event_id` | string | source event id |
| `ts_s` | int | time |
| `mode`, `bot` | string | as above |
| `symbol`, `side` | string? | symbol and side |
| `decision` | string? | what the bot did with the signal |
| `reason` | string? | why |
| `detail` | string? | detail text, cut to 300 characters |
| `signal_candle_s` | int? | signal candle open time |

**exchange_closed.csv** (closed positions as the exchange wallets reported them)

| Column | Type | Meaning |
|---|---|---|
| `wallet` | string | wallet name (same as bot tag) |
| `position_id` | string | exchange position id |
| `symbol`, `coin`, `side` | string | as above |
| `closed_s` | int | close time |
| `realized_usd` | number | realised profit in USD |
| `fees_usd`, `funding_usd` | number? | fees and funding paid (negative = paid) |
| `r_result` | number? | result in R |

**wallets.csv** (every wallet snapshot)

| Column | Type | Meaning |
|---|---|---|
| `wallet` | string | wallet name |
| `t` | int | snapshot time |
| `equity_usdt` | number | equity |
| `unrealized_usdt` | number? | unrealised profit |
| `open_positions` | int? | number of open positions |
| `suspect` | bool | the snapshot is flagged as doubtful; engines skip it |

**compares.csv** (each bot's own daily live-versus-backtest check)

| Column | Type | Meaning |
|---|---|---|
| `event_id` | string | source event id |
| `ts_s` | int | time |
| `mode`, `bot` | string | as above |
| `match` | bool? | the bot says live and backtest agree |
| `matched`, `live_only`, `backtest_only` | int? | counts |
| `mismatches` | int? | number of mismatches listed |
| `skipped_signals` | int? | signals skipped |
| `window_from_s`, `window_to_s` | int? | compared window |

Checks: export parsed, row counts match the database, no duplicate trades, every exit has an entry, prices and stops valid.

### headlines (built by `ingest/headlines.js`)

Permanent archive of Pulse headlines. Append-only, hash chained. One row per (story id, brief date). Rebuilt on every `ingest`. Depends on the folder named by config `pulseBriefs`.
Time rules: `event_time` is always empty here. A label may be used for time T only if `brief_generated_at <= T`.

**headlines.jsonl**

| Column | Type | Meaning |
|---|---|---|
| `key` | string | `id|brief_date` (unique) |
| `id` | string | Pulse story id |
| `brief_date` | string | brief date, YYYY-MM-DD |
| `brief_generated_at` | int | when the label on this row was computed |
| `title` | string | headline |
| `source`, `link`, `category` | string? | source name, URL, category |
| `event_time` | int? | when the thing happened. Always empty. |
| `published_at` | int? | earliest publication time among the story's sources |
| `first_seen_at` | int | when Pulse first saw the story |
| `last_seen_at` | int? | when Pulse last saw it |
| `archived_at` | int | when this archive stored the row |
| `bias` | string | `LONG`, `SHORT` or `NEUTRAL` (default `NEUTRAL`) |
| `strength` | number | label strength |
| `impact` | bool | market-impact flag |
| `story_count` | int? | number of stories merged |
| `score` | number? | Pulse score |
| `assets` | json | list of assets |
| `keywords` | json | list of keywords |
| `seq`, `prev_hash`, `row_hash` | int, string, string | hash chain |

**coverage.json**: `first`, `last` (brief dates), `dates` (list), `missing` (brief dates missing inside the range).

### mexc (built by `ingest/recorder.js`)

Data from the VPS recorder, after the owner pulled it to this PC. Rebuilt on every `ingest`. Depends on the folder named by config `recorderData`.
If the folder is missing, the dataset has `status: failed`, no files, and a check named `recorder data pulled`. The run shows this as `blocked`.

**inventory.json**: `root` and `files` (relative path to `{ bytes, sha256 }`). A finished `.gz` file that changed or vanished since the last run is a fault.

**book_daily.csv** (per coin, day and order size)

| Column | Type | Meaning |
|---|---|---|
| `symbol`, `coin` | string | for example `SOL_USDT`, `SOL` |
| `day` | string | YYYY-MM-DD (from the file name) |
| `snapshots` | int | order-book snapshots that day |
| `spread_bp_median` | number? | median spread in basis points (1 bp = 0.01 percent) |
| `size_usd` | int | order size tested in USD |
| `buy_bp_median`, `buy_bp_p90` | number? | slippage of a market buy, median and 90th percentile, in bp |
| `sell_bp_median`, `sell_bp_p90` | number? | same for a market sell |

### experiments (built by `engines/validator`)

One row per validator run. Append-only, hash chained. Created by the first `node run.js validate <name>` (the folder does not exist before that). `selftest` does not write to it.

**log.jsonl**

| Column | Type | Meaning |
|---|---|---|
| `name` | string | strategy name |
| `at` | int | run time |
| `coins` | string | coins tested, space separated |
| `verdict` | string | `PASSES`, `WATCH` or `REJECTED` |
| `hard_failed` | string? | ids of hard checks that failed, comma separated. Empty when none failed. |
| `trades` | int | number of trades |
| `avg_r` | number | average R per trade |
| `params_hash` | string | first 16 characters of the hash of the strategy parameters |
| `seq`, `prev_hash`, `row_hash` | | hash chain |

---

## Derived datasets

Each is rebuilt on every `node run.js reports` and `all`, in the order of `run.js`.

### events (built by `engines/events`, `buildLedger`)

Append-only, hash chained ledger. Depends on: market, headlines (optional), Pulse calendar file (`pulseEvents`), `inputs\owner-tags.csv`.

**events.jsonl**

| Column | Type | Meaning |
|---|---|---|
| `event_id` | string | `shock:COIN:T`, `sched:name:T`, `owner:tag:T` or `headline:id` |
| `kind` | string | `price_shock`, `scheduled`, `owner_tag` or `headline` |
| `subtype` | string? | `market` or `coin` (shock); CPI, NFP, FOMC, PCE, PPI, GDP or other (scheduled); owner `type`; headline category |
| `asset` | string | coin the event is about (BTC for all but coin shocks) |
| `title` | string | text |
| `direction` | string? | `up`/`down` (shock), `bullish`/`bearish` (headline, owner tag as typed) |
| `event_time` | int? | when it happened |
| `published_at` | int? | publication time |
| `first_seen_at` | int | when the system could first know it. The no-lookahead anchor. |
| `usable_at` | int | earliest time it may be used (for headlines: the later of first seen and brief time) |
| `recorded_at` | int | when this row was written |
| `backfilled` | bool | true if written more than 2 hours after `first_seen_at` |
| `time_precision` | string? | how exact the time is |
| `magnitude` | json | shock: `z`, `vol_ratio`, `pct`. Headline: `strength`, `stories`, `label_known_at`. Else empty. |
| `episode_id` | string? | shocks of one asset less than 24h apart share an episode |
| `episode_first` | bool? | true for the first shock of an episode |
| `source`, `link`, `note` | string? | origin, URL, comment |
| `seq`, `prev_hash`, `row_hash` | | hash chain |

Shock rule: a 1h bar whose return is at least `shock.minZ` times the normal size, on at least `shock.minVolRatio` times the normal volume. Normal = previous `shock.lookbackBars` bars. Only events with `first_seen_at` not later than now enter the ledger.

### derived/event-reactions (`engines/events`, `buildReactions`)

Depends on: events, market. **reactions.csv**: what the price did after each event. Returns are in percent, from the last closed 1h bar at or before `first_seen_at`.

| Column | Type | Meaning |
|---|---|---|
| `event_id`, `kind`, `subtype`, `asset` | | copied from the event |
| `measured` | string | coin measured (BTC, and the event coin if different) |
| `direction` | string? | copied |
| `first_seen_at` | int | copied |
| `base_t` | int | the hour used as the base |
| `base_price` | number | close at `base_t` |
| `pre_24h`, `pre_72h` | number? | move in percent over the 24h and 72h before |
| `r_1h`, `r_24h`, `r_72h`, `r_7d` | number? | move in percent after 1h, 24h, 72h, 7d. Empty if not finished at the as-of time. |
| `episode_first` | bool? | copied |
| `z`, `vol_ratio` | number? | shock size and volume ratio |

### derived/event-study (`engines/events`, `buildStudy`)

Depends on: event-reactions, market. **study.csv**: one row per event group and horizon.

| Column | Type | Meaning |
|---|---|---|
| `group` | string | event group, for example `BTC down shock, all` |
| `measured` | string | coin measured, or `own coin` for pooled alt coins |
| `horizon` | string | `r_1h`, `r_24h`, `r_72h` or `r_7d` |
| `n` | int | samples |
| `n_nonoverlap` | int | samples whose windows do not overlap |
| `mean`, `median`, `p10`, `p90` | number | statistics of the return in percent |
| `share_down` | number | share of samples below zero (0 to 1) |
| `mean_abs` | number | mean absolute return |
| `base_mean`, `base_mean_abs` | number | same for every hour of the coin (the baseline) |
| `diff_mean` | number | `mean` minus `base_mean` |
| `diff_ci_lo`, `diff_ci_hi` | number | 95 percent bootstrap interval (1,000 resamples, fixed seed) |
| `n_before_2024`, `mean_before_2024` | int, number? | samples and mean before 2024-01-01 |
| `n_from_2024`, `mean_from_2024` | int, number? | samples and mean from 2024-01-01 |
| `verdict` | string | `too few samples` (under 30 non-overlapping), `not different from baseline`, or `differs from baseline, ...` |

### derived/reference-trades (`engines/backtest`)

Depends on: market. The backtests of the three bots on their live coins, 4h candles, whole history. Four runs per bot: rules `v3` or `legacy`, cost `standard` or `native`.

**trades.csv**

| Column | Type | Meaning |
|---|---|---|
| `bot` | string | `bbcore`, `icore`, `tcore` |
| `version` | string | `v3` (current rules) or `legacy` |
| `cost` | string | `standard` or `native` |
| `coin` | string | coin |
| `dir` | int | 1 long, -1 short |
| `sig_t` | int | open time of the signal candle |
| `t` | int | entry time (open of the next candle) |
| `t_exit` | int | exit time |
| `r` | number | result in R after costs |
| `why` | string | exit reason: `stop` or `time` |
| `bars` | int | candles held |
| `mfe_r` | number | best excursion in R |

**summary.json**: one entry per bot, version and cost: `n`, `total_r`, `avg_r`, `win_rate`, `max_dd_r`, `max_loss_streak`, `t_stat`, `total_without_top10`, `from`, `to`, `coins`.

### derived/regime (`engines/regime`)

Depends on: market, reference-trades (optional).

**history.csv** (every 4h from 2020-06-01, per coin)

| Column | Type | Meaning |
|---|---|---|
| `t` | int | time |
| `coin` | string | coin |
| `state` | string | `trending_up`, `trending_down`, `volatile`, `quiet` or `ranging` |
| `er48` | number? | efficiency ratio over 48h (0 to 1) |
| `bbw_pctile` | number? | Bollinger band width percentile over the last 90 days |
| `trend_pct` | number? | percent distance of close from its 800 hour average |
| `rv7d` | number? | 7 day realised volatility, percent |

**market.csv** (market state from the five core coins)

| Column | Type | Meaning |
|---|---|---|
| `t` | int | time |
| `market_state` | string | `trending_up`, `trending_down`, `choppy` or `mixed` |
| `n` | int | coins with a reading |
| `trending_n`, `up_n`, `down_n` | int | counts of trending coins |
| `breadth_up_pct` | number? | percent of coins above their 800 hour average |
| `avg_corr_7d` | number? | average pairwise correlation, 168 hours |

**validation.csv** (does the label explain bot results?)

| Column | Type | Meaning |
|---|---|---|
| `bot` | string | bot |
| `label` | string | `coin_state` or `market_state` |
| `state` | string | regime state |
| `n_before_2024`, `avg_r_before_2024` | int, number? | trades and average R before 2024 |
| `n_from_2024`, `avg_r_from_2024` | int, number? | same from 2024 |

**transitions.json**: `states` (hours, stays, share, avg_stay_hours), `matrix` (what follows what), `current` (per coin), `changes_7d`, `market_now`.
**volatility.json**: autocorrelation of absolute BTC returns and next-day move after calm and wild days.
**verdict.json**: `as_of`, `validated_as_signal`, `tests` (per bot and label: verdict, best and worst states, spreads, `p_value`).

### derived/correlation (`engines/correlation`)

Depends on: market, events. Full column list: `engines\correlation\README.md` (files `daily.csv`, `matrix.json`, `contagion.csv`, `leadlag.csv`, `tail.csv`). The schemas below are copied from the manifest.

| File | Columns |
|---|---|
| `daily.csv` | `day` string, `t` int, `n_coins` int, `avg_pair_corr` number, `avg_corr_to_btc` number?, `min_pair_corr` number, `pctile_1y` number? |
| `contagion.csv` | `direction`, `coin`, `window` (string); `n` int; `btc_median_pct`, `coin_median_pct`, `ratio`, `same_direction_share` number?; `n_before_2024` int; `ratio_before_2024` number?; `n_from_2024` int; `ratio_from_2024` number? |
| `leadlag.csv` | `coin` string, `lag_h` int, `corr` number?, `n` int |
| `tail.csv` | `coin` string, `n_btc_tail_hours` int, `p_down_together`, `p_up_together` number?, `baseline` number, `n_before_2024` int, `p_down_before_2024` number?, `n_from_2024` int, `p_down_from_2024` number? |
| `matrix.json` | `as_of`, `window_hours`, `coins`, `corr`, `beta_to_btc`, `vol_1h_pct` |

### derived/journal (`engines/journal`)

Depends on: trades, market, events, headlines (optional). Live bots only. Row `bot = ALL` is the sum of all live bots.

**days.csv** (one row per bot per UTC day)

| Column | Type | Meaning |
|---|---|---|
| `day` | string | YYYY-MM-DD |
| `bot` | string | bot or `ALL` |
| `day_r` | number | change of total R during the day (realised plus open) |
| `realized_r` | number | R of trades that exited that day |
| `open_n` | int | positions open at the day end |
| `entries_n` | int | entries that day |
| `btc_day` | number? | BTC change that day, percent |
| `btc_7d` | number? | BTC change over 7 days to the day end, percent |
| `phase` | string | `down` (7d at or below -4), `up` (at or above +4), `sideways`, or `unknown` |
| `range_x` | number? | BTC day range divided by the median of the last 30 days |
| `shocks_down`, `shocks_up` | int | BTC shocks that day |
| `mood` | number? | news mood from labels known at the time (bearish minus bullish, weighted by strength / 100) |
| `mood_hindsight` | number? | same, also with labels computed later. For comparison only. |
| `tags` | string? | owner tags first seen that day |

**stamps.csv** (one row per live entry: what was known at entry)

| Column | Type | Meaning |
|---|---|---|
| `trade_key`, `bot`, `coin`, `side` | string | trade identity |
| `entry_s` | int | entry time |
| `btc_24h`, `btc_72h` | number? | BTC move before entry, percent |
| `context` | string | `after down-shock`, `after up-shock`, `after both`, `quiet` (BTC shocks in the 72h before) |
| `mood`, `mood_hindsight` | number? | as above |
| `tags` | string? | owner tags in the 72h before |
| `r_now` | number | R now (closed result, or open valued at the last price) |
| `status`, `reason` | string, string? | trade status and exit reason |

**streaks.csv** (3 or more days in a row with the same sign; a day within 0.05R of zero is flat)

| Column | Type | Meaning |
|---|---|---|
| `bot`, `kind` | string | bot; `profit` or `loss` |
| `from`, `to` | string | first and last day |
| `days` | int | length |
| `total_r` | number | R over the streak |
| `btc_pct` | number? | BTC move over the streak |
| `phases` | string | phases seen, joined by `/` |
| `avg_range_x` | number? | average `range_x` |
| `shock_days` | int | days with a shock |
| `tags` | string? | tags in the streak |

**clusters.csv** (3 or more entries, live and paper, inside 4 hours)

| Column | Type | Meaning |
|---|---|---|
| `first_entry_s` | int | time of the first entry |
| `entries` | int | entries |
| `bots`, `coins`, `sides` | string | sets of bots, coins, sides |
| `btc_72h` | number? | BTC move 72h before |
| `shocks_72h`, `tags_72h` | string? | shock directions and tags in the 72h before |
| `live_r` | number | R now of the live entries |
| `live_won`, `live_lost` | int | live entries above / at or below 0R now |

**summary.json**: `as_of` and per bot `closed_n`, `closed_won`, `closed_r`, `open_n`, `open_r`, `total_r`.

### derived/execution (`engines/execution`)

Depends on: trades, market (and mexc, optional). Full definitions: `engines\execution\README.md`. Schemas from the manifest:

| File | Columns |
|---|---|
| `entry_quality.csv` | `bot`, `coin` (coin `ALL` = whole bot), `n` int, `median_slip_r`, `mean_slip_r`, `worst_slip_r`, `median_delay_s`, `p90_delay_s`, `n_bp` int, `median_slip_bp`, `mean_slip_bp` |
| `stop_quality.csv` | `bot`, `n` int, `median_overshoot_r`, `p90_overshoot_r`, `worst_overshoot_r` |
| `costs.csv` | `bot`, `n_closed` int, `fees_usd`, `funding_usd`, `realized_usd`, `fees_share_of_gross`, `n_cost_r` int, `avg_cost_r` |
| `liquidity.csv` | `coin`, `n_bars_30d` int, `n_bars_180d` int, `median_usd_30d`, `median_usd_180d`, `ratio_30d_180d`, `falling` bool, `median_range_bp_30d` |
| `capacity.csv` | `bot`, `coin`, `n_trades` int, `n_sized` int, `notional_usd`, `median_hour_usd_30d`, `participation`, `max_notional_1pct_usd`, `headroom_x` |
| `book_capacity.csv` | only when dataset `mexc` exists. See the README. |

### derived/exposure (`engines/exposure`)

Depends on: trades, market, derived/correlation (through `Corr.latest`, computed from market). Alert only.

**history.csv** (every 4h)

| Column | Type | Meaning |
|---|---|---|
| `t` | int | time |
| `n_open` | int | open live positions |
| `gross_risk_usd` | number | sum of risk in USD over open positions. Risk = `risk_pct` x bot equity at entry. |
| `net_risk_usd` | number | signed sum (long plus, short minus) |
| `long_share` | number? | share of risk that is long (0 to 1) |
| `effective_bets` | number? | (sum of abs signed risk) squared divided by (s' C s). 1 = one bet. |
| `open_net_r` | number | open R summed |
| `top_coin`, `top_coin_share` | string?, number? | coin with the most risk and its share |
| `alert` | string? | alert text if a threshold was crossed |

**stress.csv**

| Column | Type | Meaning |
|---|---|---|
| `scenario` | string | `BTC -10%`, `BTC -5%`, `BTC +5%`, `BTC +10%` |
| `bot`, `coin`, `side` | string | position |
| `move_pct` | number | coin move = beta x BTC move |
| `loss_r`, `loss_usd` | number | result in R and USD (negative = loss) |

**alerts.csv**: `t` int, `kind` string (`exposure`), `detail` string.
**now.json**: current `as_of`, totals, `by_bot`, `positions`.

### derived/health (`engines/health`)

Depends on: trades, market, reference-trades (and derived/execution, optional).

**parity.csv**

| Column | Type | Meaning |
|---|---|---|
| `bot`, `coin` | string | bot and coin |
| `kind` | string | `matched`, `backtest_only` or `live_only` |
| `entry_s` | int | entry time |
| `side` | string | `LONG` or `SHORT` |
| `live_r`, `bt_r` | number? | live and backtest R |
| `detail` | string? | the bot's own reason when it skipped a signal |

**decay.csv** (one row per bot and `ALL`)

| Column | Type | Meaning |
|---|---|---|
| `bot` | string | bot or `ALL` |
| `window_days` | int | days since the first live entry |
| `live_total_r`, `live_closed_r` | number | live R (closed plus open) and closed only |
| `n_live` | int | live trades |
| `bt_windows` | int | number of backtest windows of the same length |
| `bt_median_r`, `bt_p5`, `bt_p95` | number | backtest window result: median, 5th and 95th percentile |
| `percentile` | number | share of backtest windows that did worse than live (0 to 100) |
| `alert` | bool | percentile below `health.alertPercentile` |

**daily.json**: `as_of`, `parity` (per bot counts), `losing_runs`, `alerts`.

### derived/truth-check (`integrity/truthcheck.js`)

Depends on: trades. **findings.csv**

| Column | Type | Meaning |
|---|---|---|
| `bot` | string | bot or wallet |
| `check` | string | check name |
| `status` | string | `ok`, `review`, `info` or `no_data` |
| `detail` | string | text |
| `at_s` | int? | related time |

`review` does not make the dataset fail. It is a disagreement for the owner to look at.

### derived/integrity (`integrity/monitor.js`)

Depends on: every dataset. **status.csv**: `area` string, `check` string, `status` string (`ok`, `fault` or `blocked`), `detail` string.
