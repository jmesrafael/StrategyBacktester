# integrity: monitor and truth check

Two read-only tools. They report problems. They fix nothing.

| File | Builds | Report |
|---|---|---|
| `monitor.js` | dataset `derived/integrity` (`status.csv`) | `reports\integrity.md` |
| `truthcheck.js` | dataset `derived/truth-check` (`findings.csv`) | `reports\truth-check.md` |

## How to run

```
node run.js reports               # both run inside the full report chain
node integrity/monitor.js         # prints one line per check, exit 1 if any fault
node integrity/truthcheck.js      # prints the report
```

## Monitor: inputs and method

Input: every dataset in `data\`, the candle library, config `freshness`. Each check ends as `ok`, `fault` or `blocked`.
`fault` = an engine should not trust that data. `blocked` = an outside step is still needed.

| Area | Check |
|---|---|
| every dataset | manifest present, status ok, every file matches its checksum |
| market | newest BTC 1h bar not older than `freshness.marketHours`; list of faulty series |
| trades | export not older than `freshness.tradesHours`; every live entry price lies within 1 percent of the Binance 1h candle of its hour |
| headlines, events | hash chain intact |
| headlines | no missing brief day; newest brief not older than `freshness.headlinesHours` plus 24 hours |
| venue parity | Binance and MEXC 4h closes agree for SOL, ADA, NEAR, GALA, ZEC. Judged on the last 2,000 bars: 99th percentile of the difference must be 50 bp or less. Uses MEXC sample files `MEXC_<COIN>.json` from the folder in config key `mexcSamples` (not set in `config.json`; the code default is `../../bb-core/data`). If no folder is found: `blocked`. |

## Truth check: inputs and method

Input: dataset `trades` (`trades.csv`, `exchange_closed.csv`, `wallets.csv`). It compares three records of the same trading: bot events, exchange closed positions, wallet snapshots. Per live bot:

1. Every exit event needs a matching exchange close (same coin and side). The close may be up to 4 hours earlier than the exit event (bots report a stop when they wake at the candle close). Time tolerance 900 s. R must agree within 0.1.
2. Every exchange close needs an exit event.
3. Open positions implied by events must equal `open_positions` in the wallet snapshot. A difference lasting 30 minutes or more is listed with its start time and the events within 3 hours of it. Snapshots marked `suspect` are skipped.


## Tests

| File | Covers |
|---|---|
| `test\truthcheck.test.js` | `check()` of the truth check |

`monitor.js` has no unit test. `test\end-to-end.test.js` reads the real datasets and checks that the truth check and the integrity status show no unexpected problem.

## Limits

- Entry-price check uses Binance candles. The bots trade on MEXC. A 1 percent band is wide on purpose.
- `run.js` shows both steps as `ok` even when they find problems (their own checks always pass). Read the reports.
