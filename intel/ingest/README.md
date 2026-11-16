# ingest: data intake

Four jobs. Each one builds one dataset from an outside source. Nothing else in intel talks to the outside.

| Job | Builds dataset | Source |
|---|---|---|
| `candles.js` | `market` | the candle library (config `candleLibrary`) |
| `trades.js` | `trades` | the dashboard database export, or a live read-only download |
| `headlines.js` | `headlines` | Pulse daily briefs (config `pulseBriefs`) |
| `recorder.js` | `mexc` | recorder data pulled from the VPS (config `recorderData`) |

Columns of every output: `DATA-DICTIONARY.md`.

## How to run

All four: `node run.js ingest`. One alone, from the `intel` folder:

```
node ingest/candles.js
node ingest/trades.js [export-file.json]
node ingest/headlines.js
node ingest/recorder.js
```

## Method in plain words

- `candles.js` downloads nothing. Refresh the library first with `node ../candles/update.js --no-1m`. It checks every 1h, 4h and funding file: time order, no duplicates, valid OHLC, missing bars. It also checks that rows seen at the last run still hash the same ("history unchanged"). Required coins are `marketCoins` plus every bot coin. They must exist, be clean and end within 2 hours of BTC.
- `trades.js` has two ways in. (1) The newest `.json` in `inputs\db-export\`. (2) If `INTEL_SUPABASE_URL` and `INTEL_SUPABASE_KEY` are set (environment or `secrets.local.json`), it downloads `bot_events`, `closed_trades` and `wallet_snapshots` over the REST API with GET only, saves `export-YYYY-MM-DD.json`, then continues as in (1). The raw export is kept untouched. It joins each entry to its exit and checks counts, duplicates, orphan exits and price sanity.
- `headlines.js` copies every highlight and pinned story of every brief file `YYYY-MM-DD.json` into an append-only, hash-chained log. One row per story and brief date. If the chain is broken, nothing is appended. It lists missing brief days. `knownAt(rows, T)` returns labels as they were known at time T.
- `recorder.js` lists every file of the pulled recorder folder with its SHA-256 (`inventory.json`). A finished `.gz` file that changed or vanished is a fault. It builds `book_daily.csv` (spread and slippage per coin, day and order size). A torn last line in a file is skipped.

## Tests

| File | Covers |
|---|---|
| `test\ingest-candles.test.js` | `checkSeries` |
| `test\ingest-trades.test.js` | `transform`, `download` (with a fake fetch), `botOf`, schemas |
| `test\ingest-headlines.test.js` | `run`, `rowsOfBrief`, `knownAt`, `missingDays` |
| `test\ingest-recorder.test.js` | `run`, `bookDaily`, `readLines` |

## Limits

- The candle registry is only as good as the library. Faulty series are excluded, not repaired.
- Headline coverage starts when Pulse began saving briefs. Earlier history cannot be recovered with honest first-seen times.
- The trade export is a copy. It is as fresh as the last export or download.
- The database key must be READ-ONLY. The code only sends GET requests.
