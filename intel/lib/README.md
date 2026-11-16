# lib: shared code

Four small files. Plain Node.js. No packages. Every other folder uses them.

## Files

| File | What it does |
|---|---|
| `spine.js` | The data store. Writes and reads datasets in `data\<name>\` with a `manifest.json`. Also the hash chain for append-only logs. |
| `config.js` | Reads `config.json`. Resolves paths. `secret(name)` reads an environment variable, else `secrets.local.json`. Exposes `reportsDir`. |
| `market.js` | Validated access to the candle library. Refuses a coin that is not registered, has faults, or whose file size changed. |
| `util.js` | Statistics, hashing, CSV and JSONL, time helpers, Markdown tables. |

## Inputs and outputs

- `spine.js` reads and writes `data\` (root can be moved with `INTEL_DATA`).
- `market.js` reads dataset `market` (`registry.json`) and the candle files in `<candleLibrary>\binance-futures\<1h|4h|funding>\<COIN>.json`.
- None of them runs on its own. They are libraries.

## Method in plain words

- `spine.write(name, {files, checks, inputs, ...})` checks every row against its schema, writes the files, hashes them, and writes the manifest. If any check fails, status is `failed`.
- `spine.load(name, file, {maxAgeHours})` re-hashes the file and re-checks rows. It throws a `SpineError` with a code: `MISSING`, `FAILED`, `STALE`, `CORRUPT`, `SCHEMA`.
- `spine.chainAppend` and `spine.chainVerify` implement the hash chain. See `DATA-DICTIONARY.md`.
- `market.bars(coin, tf, {from, to})` returns rows `[openTimeSec, open, high, low, close, volume]`. `market.candles` returns objects. `market.priceAt(coin, T)` returns the close of the last bar that closed at or before T, never a forming bar.
- `util.js` uses the population standard deviation (divide by n) everywhere, a fixed-seed random generator (mulberry32) so bootstraps repeat, and canonical JSON (sorted keys) for hashes.
- Times are Unix seconds, UTC. `toSec` turns an ISO string or a millisecond number into seconds.

## Tests

| File | Covers |
|---|---|
| `test\spine.test.js` | spine write, load, verify, hash chain |
| `test\util.test.js` | `util.js` helpers |

`config.js` and `market.js` have no test file of their own. `test\ingest-candles.test.js` covers the series check that `market.js` relies on.

## Limits

- `market.js` caches candle files in memory. Call `reset()` after the library changes in the same process.
- `market.js` handles 1h and 4h bars. Funding rows are `[timeSec, rate]`.
