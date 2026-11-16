# validator: the rule gatekeeper

One fixed set of checks that every new strategy or rule must pass before it may be tried on a paper bot. It reads data and writes a verdict. It never changes a bot.

## Inputs

Dataset `market` (4h candles and funding). Dataset `derived/reference-trades` (for check 6; if missing, check 6 is skipped with a note). The regime engine (for check 11). A strategy factory in `engines\backtest\strategies.js`. Default coins: SOL ZEC NEAR ADA GALA. Costs: the standard cost model, real funding.

## Outputs

- `reports\validation\<name>.md`: verdict and one row per check.
- Dataset `experiments` (`log.jsonl`, hash chained): one row per run. The count of past rows raises the bar for check 2. Columns: `DATA-DICTIONARY.md`.

## How to run

```
node run.js validate <strategy> [--coins SOL,ZEC]
node run.js selftest
node engines/validator/index.js <strategy|selftest> [--coins SOL,ZEC]
```

`<strategy>` is a key exported by `strategies.js`: `bbcore`, `icore`, `tcore`, `bbFade`, `rsi2`, or your own factory. The code header also lists `--variants N`. The command line code does not read it. `selftest` runs the five known strategies. The three bots must give `PASSES` or `WATCH`. `bbFade` and `rsi2` must give `REJECTED`. It does not write to the experiment log. Exit code 1 on a mismatch.

## The 11 checks

Verdict: any hard failure gives `REJECTED`. Else any soft failure gives `WATCH` (allowed on a paper bot only). Else `PASSES`. There is no check number 7.

| # | Type | Check | Pass rule in the code |
|---|---|---|---|
| 1 | hard | No look-ahead (truncation audit) | 4 random cut-offs per coin: trades found on the cut data must equal the earlier trades of the full run |
| 2 | hard | Enough trades, significant | at least 150 trades and t-stat at least `2 + 0.5 x sqrt(2 ln N)`, where N = experiments logged so far plus this one (N = 1 needs 2) |
| 3 | hard | Positive from 2024 on | at least 40 trades entered from 2024-01-01 and a positive average R |
| 4 | hard | Survives 2x costs | average R above 0 with fee, slippage and flat funding doubled |
| 5 | hard | Positive without its 10 best trades | total R minus the 10 best is above 0 |
| 6 | hard | Not a copy of the live bots | fewer than 70 percent of its trades start while a live-bot reference trade holds the same coin and side, and monthly correlation with TRI-CORE (50/25/25 of BB-CORE, I-CORE, T-CORE) is not above 0.85 |
| 8 | soft | Neighbouring settings (+-20%) mostly positive | at least 75 percent of the neighbouring parameter settings are positive overall and from 2024 |
| 9 | soft | Most years positive | at least 60 percent of years have positive R |
| 10 | soft | Leave-one-coin-out stays positive | total R stays above 0 after removing any one coin |
| 11 | soft | No single regime holds most of the profit | the best regime state holds at most 70 percent of total R (regime at the signal) |
| 12 | soft | Walk-forward parameter choice works | from 2022, each year picks the best setting on earlier years; the total of picked results is above 0 and at least half of the default's total |

For a live bot itself, check 6 is skipped (`skipOverlap`).

## Tests

`test\validator.test.js` covers `concentration`, `perYear`, `leaveOneCoinOut`, `outOfSample`, `sizeAndSignificance` and `logExperiment` (chain, tampering). It sets `INTEL_DATA` to a temp folder. The other checks (1, 4, 6, 8, 11, 12) and `selftest` have no unit test.

## Limits

- A pass is not a promise. It means the idea survived these tests on past data.
- Soft checks use few samples for some strategies. Read the detail column.
- Next step after a verdict: record it in `research\TESTED-STRATEGIES.md`.
