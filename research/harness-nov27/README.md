# harness-nov27

Shared validation harness (reuses `hunt-4h-nov26` / `hunt-1h-nov26` lib + audit; no new deps).

- `checks.js`: `checkStrategy({strat, exFn, coins, tf})` -> object + `.text` table. 1x/2x cost, per-year R, positive years,
  ex-top-10, top-10%-trade profit share, IS (<=2023) / OOS (>=2024), per-coin and leave-one-coin-out, truncation audit.
  `tf` is `'4h'` or `'1h'`; `strat(ctx)` returns `{L,S,stopL?,stopS?,warmup}`; `exFn` is the engine exit object.
  Also `monthlyCorrelation(tradesA, tradesB)` (Pearson on monthly R by exit month) and `tradeOverlap(tradesA, tradesB)`
  (share of A entries with a same-coin, same-side B trade open). Trades come from `result.trades` (each has `coin`, `dir`, `t`, `tExit`, `R`).
- `trials.js`: `logTrial(cfg, result, note)` appends to `trials.log.jsonl`; warns when N>20 (expected best-of-N inflation ~ sqrt(2 ln N) sigma).
- `registry-check.js`: `node registry-check.js <keyword...>`; prints matching `TESTED-STRATEGIES.md` rows, verdict and evidence; exit 1 if a REJECTED row matches.
- `selftest.js`: reproduces ICHI-X4 numbers from `hunt-4h-nov26`. Run before trusting changes.

```js
const { checkStrategy, monthlyCorrelation, tradeOverlap } = require('./checks.js');
const r = checkStrategy({ strat, exFn, tf: '4h' }); console.log(r.text);
```
