# Independent audit: 4h Bollinger breakout, SOL + ZEC (Lucidyo)

Audit date 2026-10-23. Code audited: `🔴BB-Core/` as committed (lucidyo-core.js, backtest.js, fetch-data.js, lucidyo.js, live.js, mexc.js, config.js, stress.js). Data: `data/` (Binance USDT-M futures SOL/ZEC to 2026-10-21 04:00 UTC, MEXC contract SOL/ZEC, funding files).
**Confidential: do not share or publish (strategy rules inside).**

Everything below marked **[RAN]** was executed in this audit and the output is in `audit/out/`. Everything marked **[READ]** is from reading code only. **[NOT VERIFIED]** needs data I do not have.

## 0. Verdict

**Ready for paper trading: yes. Ready for a small controlled live test: yes, only at ≤1% risk, after the shadow-parity gate in §8 passes. Not validated as a reproducible multi-year edge on MEXC.**

* The backtester is clean: no look-ahead, no repainting, no accounting bug found. An independently written ledger matches it exactly (§2).
* The profitability claim is weaker than the README headline in three ways: (1) it is measured on Binance candles but traded on MEXC, and on MEXC candles ZEC alone is flat/negative in 2022-2023; (2) the coins, the 4R target and the rules were chosen after seeing the results; (3) no single year is statistically significant on its own.
* Costs are not what threatens it. Harsh costs remove ~8% of profit.

## 1. Defects and risks, prioritized

### Confirmed (reproduced or provable from the code)

| # | Sev | Issue | Where | Evidence |
|---|---|---|---|---|
| C1 | High (reporting) | Headline "7/7 years positive" is measured on **Binance** candles. The bot trades **MEXC**. On MEXC candles ZEC alone: 2022 +0.4R, 2023 **−3.8R** (base costs), −0.7R / −5.8R (harsh). SOL 2020 = +0.1R. Only the SOL+ZEC pair stays positive every year (2020 is 21 trades, +1.6R ≈ zero). The two venues agree on only 95% (SOL) / 83% (ZEC) of signals; wicks differ up to 1.5% (SOL) / 2.6% (ZEC). | README.md results table; `data/` vs `data/MEXC_*` | `out/yearly-mexc.txt`, `out/execdiag.txt`, `out/compare-cross.txt` [RAN] |
| C2 | Low | Time exit holds **49** candles, not the documented 48. `i - pos.i0 >= maxBars` sets the exit at the *next* open, so the exit fills at the open of candle i0+49. The bot has the same rule (`(c.time - st.pos.t0)/IV >= maxBars`), so they agree with each other, but README/comments say "48 candles (8 days)". The independent rebuild only matched when coded as 49. | lucidyo-core.js:65; lucidyo.js:85 | `audit/recon.py` [RAN] |
| C3 | Low-Med | The engine never checks that candles are contiguous. MEXC_ZEC has a 63-day hole (2020-08-11 → 10-13). A trade opened 2020-08-05 "survives" the hole, books 63 days of funding, and exits on the first candle after it at **−2.36R** (−1.34R of that is funding). Indicators also span the hole (3 later trades). Live code counts gaps (lucidyo.js:226-227) but still evaluates signals. | lucidyo-core.js:38-71 | `audit/worst.js`, `audit/out/execdiag.txt` [RAN] |
| C4 | Med | Signal can be lost silently. `fetchCandles` gives up after 120 s even if the new candle is missing (`nowSec()-expected > 120`). Then the just-closed candle is treated as the forming one (`i < n-1` loop), so no decision is made. On the next run, 4 h later, the signal is more than 15 min old and is skipped (line 97). Only a warning is logged. | lucidyo.js:145, 77, 97 | [READ] |
| C5 | Med | Paper results are not comparable to the backtest by design: paper excludes funding, and fills at `B[n-1].close` (price at wake-up) instead of the next open. That is realistic, but anyone comparing paper R with backtest R must expect a gap. | lucidyo.js:57, 241 | [READ]; replay matches because it uses `next.open` and no funding [RAN] |
| C6 | Med | Live exit bookkeeping can mislabel or flatter trades. `checkExit` only asks "is the position open **now**", so after a missed run the exit is assigned to the wrong candle. A manual close, liquidation or ADL is classified as stop/target by nearest price. If the history lookup fails, the exit price falls back to the exact stop/target price (no slippage). | live.js:65, 170-173 | [READ] |
| C7 | Low | MEXC funding before 2025-04-29 is Binance funding (assumption). On the overlap, ZEC funding differs a lot: sum −15.4% on MEXC vs −7.2% on Binance; mean \|rate\| 1.99 bp vs 1.50 bp. SOL is the same (0.16% vs 0.17%). Total funding is only ~4 R over ~300 trades, so impact is small, but it is not verified for 2020-2025 on MEXC. | backtest.js:22-30; stress.js:10-16 | `out/execdiag.txt` [RAN] |
| C8 | Info | The old "103,000 orders, 0 mismatches" claim refers to a different engine (`research/bollinger/`, 325 SOL trades). It does not cover `lucidyo-core.js` (309 trades). I re-ran the equivalent for the current engine (§2). | REPORT-bb-deep.md §2 | [RAN] |

### Potential (plausible, not proven)

* **P1 Target fills.** The backtest treats the target as a resting maker order (0.02% fee, no slippage, must trade 0.05% through). The bot attaches it as a MEXC TP/SL **trigger on last price** (live.js:151), which may execute as a market/taker order. The "harsh" scenario (0.08% every fill, 0.05% slippage on all fills) covers this: SOL+ZEC keeps 206.5R of 223.8R. Confirm with the real test-trade.
* **P2 Stop trigger source.** MEXC triggers on its own last price; the backtest uses Binance wicks. Different wicks mean some stops trigger on one venue and not the other (C1).
* **P3 Closed-candle revision on MEXC.** The bot reads the closed candle 2 s after the close. If MEXC finalizes OHLC after that, the live close could differ from the final close. Binance history shows no revisions (see below); MEXC live behaviour is unmeasured.
* **P4 Late entry.** Backtest fills at the exact next open; the bot fills 2-3 s later at market. Repo research says 1 min late costs about 0.02R/trade (results-late-entry.md; not re-run by me).
* **P5 Liquidity/spread on MEXC ZEC.** No order-book data in the repo. Slippage 0.02%-0.05% is an assumption.
* **P6 Compounding.** Backtest is fixed R, no compounding. The bot uses `riskPct` (currently 0.01 in bot-config.json, allowed up to 0.05) so live equity curves will not match the $5-per-trade curves.

### Unverified assumptions

MEXC fee tier and TP/SL order type; MEXC kline volume units (MEXC volume is in contracts, so my volume ratios are not comparable and I drew no conclusion); that MEXC pre-listing candles (2020) are real traded prices; spread at the 4h open; MEXC API behaviour under load; exchange outages/ADL on isolated margin.

## 2. What I verified is CLEAN

**Look-ahead and repainting [RAN]:** `audit/test-no-lookahead.js`, all passed on SOL, ZEC, MEXC_SOL, MEXC_ZEC:
* A. 200 random cuts per file: trades on `B[0..k]` are identical to the full-history trades that finished by k (~123,000 trade comparisons).
* B. Poison test: every candle after k replaced by random garbage; everything finished by k unchanged.
* E. Signal-bar test: for **every one of the 1,253 trades (309 + 332 + 308 + 304)**, data cut exactly at the signal candle reproduces that setup (dir, stop, target), and cutting one candle earlier does not show it.
* C. 1,200 indicator spot checks against a from-scratch formula.
* The test is not vacuous: I planted a one-bar look-ahead into a copy of the engine (`audit/out/core-planted-bug.js`) and the suite reported 1,246 failures.
* Code reading agrees: indicators use `closes` appended only after the candle's own step; fills use `c.open` of the candle after the signal; stop/target are tested on the candle after entry or the entry candle itself (9 SOL / 6 ZEC trades exit on the entry candle, stop first); no higher-timeframe data, no pivots, no backfilling, so nothing can be revised.

**Indicator formulas [READ+RAN]:** BB uses the population standard deviation (÷20), the same as TradingView/Pine `ta.bb`. SMA200 on closes. ATR(14) is Wilder with an SMA seed (live recomputes it over a 500-candle window; the seed difference decays as (13/14)^486, which is negligible).

**Independent ledger [RAN]:** `audit/recon.py` (pure Python, no numpy) rebuilt the trade list from raw candles and the written rules. Compared with the engine over 4 files × 3 cost scenarios (free / base / harsh, with funding): **same number of trades, same entry and exit candle, same direction, same exit reason, R equal to 1e-9**, e.g. SOL base 309 trades 105.408R, ZEC base 332 trades 118.349R. Limitation: I read the engine before writing the rebuild, so it confirms the code implements the rules, not that the rules are sensible.

**Candle timing and data [RAN]:** `audit/test-no-lookahead.js` D and `audit/compare-candles.js`:
* Binance SOL 13,369 / ZEC 14,700 candles: 0 duplicates, 0 gaps, 0 misaligned timestamps (all on 00/04/08/12/16/20 UTC), 0 bad OHLC, last candle closed.
* **Historical revisions:** re-downloaded the full Binance history today: **0 candles differ** from the stored files (the only differences are 12 newer candles).
* MEXC_SOL clean; MEXC_ZEC has the one hole (C3).
* Source: `fetch-data.js` uses `fapi.binance.com/fapi/v1/klines?symbol=SOLUSDT` and `ZECUSDT` (USDT-M perpetual futures, not spot) and drops the forming candle (`rows[last].t + 14400 > now`).

**Existing bot tests [RAN]:** `node lucidyo.js replay SOL,ZEC` = identical trade-for-trade (SOL 309/109.80R, ZEC 332/122.56R); `node test/selftest.js` 23 passed, 0 failed. Caveat: these run against a **simulated** MEXC, so they prove the bot logic, not MEXC's behaviour.

**Intrabar sequencing [RAN]:** candles that touched both stop and target while in a trade: 0 (SOL and ZEC, both venues), so the stop-first rule never decided a trade. Stops that gapped through (open beyond stop): 0. Worst single trade 1.29R (Binance); the 0.05%-through rule rejected 1 SOL target touch.

## 3. Year-by-year results (R units; 1R = amount risked per trade; closed in that year; no compounding)

Base costs = 0.05% taker, 0.02% maker target, 0.02% slippage, real funding. `PF` = profit factor, `DD` = max drawdown of that year's closed-trade curve, `Expo` = share of candles with a position open.
Full tables with cost split, t-stat and bootstrap interval: `audit/out/yearly-binance.txt`, `audit/out/yearly-mexc.txt`. Reproduce: `node audit/yearly.js` and `node audit/yearly.js mexc`.

**Binance candles, base costs**

| Year | SOL n / R / PF / win / DD / expo | ZEC n / R / PF / win / DD / expo |
|---|---|---|
| 2020* | 12 / +6.0 / 1.91 / 33% / 5.6 / 49% | 42 / +16.1 / 1.64 / 33% / 5.4 / 53% |
| 2021 | 54 / +26.7 / 1.84 / 41% / 7.2 / 61% | 46 / +37.9 / 2.58 / 48% / 3.0 / 57% |
| 2022 | 54 / +12.9 / 1.40 / 37% / 12.8 / 63% | 49 / +3.5 / 1.12 / 41% / 7.3 / 60% |
| 2023 | 47 / +32.9 / 2.47 / 43% / 7.7 / 61% | 52 / +0.9 / 1.02 / 33% / 8.6 / 51% |
| 2024 | 47 / +8.5 / 1.33 / 38% / 7.0 / 60% | 51 / +25.5 / 1.89 / 41% / 5.5 / 59% |
| 2025 | 52 / +8.1 / 1.26 / 37% / 8.2 / 63% | 49 / +25.4 / 1.88 / 41% / 6.1 / 55% |
| 2026* | 43 / +10.2 / 1.37 / 37% / 7.6 / 56% | 43 / +9.1 / 1.34 / 40% / 8.0 / 67% |
| **All** | 309 / +105.4 / 1.59 / 39% / 12.8 / 60% | 332 / +118.3 / 1.60 / 39% / 15.6 / 57% |

**MEXC candles, base costs**

| Year | SOL n / R | ZEC n / R |
|---|---|---|
| 2020* | 9 / +0.1 | 12 / +1.5 |
| 2021 | 54 / +27.7 | 46 / +34.1 |
| 2022 | 57 / +16.0 | 50 / **+0.4** |
| 2023 | 47 / +32.9 | 52 / **−3.8** |
| 2024 | 47 / +8.5 | 52 / +24.6 |
| 2025 | 52 / +8.1 | 49 / +20.8 |
| 2026* | 42 / +11.2 | 43 / +9.2 |
| **All** | 308 / +104.5 (DD 10.8R) | 304 / +86.8 (DD 17.2R) |

\*2020 partial, 2026 to 21 Oct. SOL+ZEC combined on MEXC, base: 2020 +1.6, 2021 +61.9, 2022 +16.4, 2023 +29.1, 2024 +33.1, 2025 +28.9, 2026 +20.4; total +191.4R; max DD 13.9R. Harsh costs: +175.4R, DD 16.2R, still positive every year.

**Costs [RAN]:** in R, fees + slippage take ~8R per coin at base (about 0.026R/trade) and ~16R at harsh; funding ~4R per coin. Profit kept under harsh costs: 206.5R of 223.8R on Binance (92%), 175.4R of 191.4R on MEXC (92%).
**Concentration:** best 10 trades = 40R of 224R; without the best 20 trades the pair still makes +143R.

## 4. Is it statistically and economically credible?

* **Per year, no.** Only 2 of 14 coin-years have a t-stat above 2 (SOL 2023 t=2.4, ZEC 2021 t=2.6). A typical coin-year has ~50 trades with a standard error of ~13R, against a mean of ~17R. "Positive every year" is what an edge of +0.35R would produce, but each year alone is consistent with zero.
* **Pooled, yes (before selection).** SOL+ZEC pooled: 641 trades, +0.35R, t = 4.7 (3.2 and 3.4 per coin). Zero-edge simulation (same trades per year, mean set to 0): P(all 7 years positive) = **0.62%**, P(≥6 of 7) = 5.4% [RAN, `audit/robustness.js`]. Trade R shows no serial correlation (lag-1 = −0.03) and SOL/ZEC monthly R correlation is 0.03, so the two coins add diversification.
* **Selection bias is large and uncorrected.** SOL/ZEC were picked from a screen. The same frozen rules on all 131 other coins in the repo: **115 positive, median +0.125R**, only 6 positive in every year (no funding). So the signal is a broad crypto trend-following premium, not a SOL/ZEC fluke, but SOL/ZEC (+0.35R) sit far above the median, and picking winners overstates the forward edge. The 131 coins are highly correlated (same market regimes) and the list only has coins that exist on Binance now (survivorship). 2020-2026 includes SOL +11,200% and ZEC +810% years. **My judgment (not computed): expect a forward edge nearer +0.10R to +0.25R/trade than +0.35R.** At +0.15R, 100 trades a year per pair = +15R/year with a standard error of ~19R, so a full year can easily end negative.
* **Overfitting of parameters: low.** One-at-a-time changes (bands 1.5-2.5σ, length 15-30, SMA 100-300, target 2-6R, max bars 24-96, ATR filter, no trend filter) all stay positive; 72 of 72 grid sets have positive total R and 62 of 72 are positive in every year. The frozen values are not the optimum (6R target and 96 bars score higher), and an expanding-window walk-forward over the 72 sets (2022-2026) earns 139.9R vs 137.0R for the frozen set. Removing the 200-SMA filter lowers avg R to 0.27 but stays positive. `out/robustness.txt` [RAN].
* **Remaining overfitting:** the 4R target was chosen after seeing all years (README admits it); settings came from 2019-2022 BTC/ETH/SOL, so SOL 2020-22 is in-sample; ZEC was never tuned on, which is the cleanest evidence (+0.36R, but 2022/2023 near zero). About 35 research scripts and 130+ coins were tried; there is no deflated-Sharpe style correction in the repo.
* **Economic size [RAN]:** reshuffling the 641 trades 5,000 times gives max drawdown median 17R, 95th pct 28R, 99th pct 34.5R, and a longest losing streak of 11 (99th pct: 20). The historical 16R is below the median, so the past ordering was mild. At 1% risk per trade the 99th-percentile drawdown is about 29% of equity; at the maximum 5% it is about 83%. The bot's `haltAtR` (−39R) is therefore sensible, but a 1% risk setting is the ceiling for a first live test.

## 5. Costs and risk model review

| Item | Backtest | Live bot | Gap |
|---|---|---|---|
| Entry | next open + 0.02% slip, 0.05% taker | market ~2-3 s after open | late-entry cost ~0.02R/trade if 1 min late [repo research] |
| Stop | candle low/high touch, gap fills at open, +0.02% slip, 0.05% taker | MEXC TP/SL trigger on last price | wick differences across venues (C1/P2) |
| Target | needs price 0.05% through, fills at level, 0.02% maker, no slip | TP trigger, likely taker | covered by harsh case (P1) |
| Time exit | next open, taker + slip | bot market order | same |
| Funding | real, 8h events strictly after entry open, through exit candle +2 h | MEXC actual | C7 |
| Sizing | fixed R, no compounding | `riskPct` of equity, whole contracts, `maxRiskMult` 1.5 | P6 |
| Leverage | not modelled | isolated, liquidation ≈ 2× stop distance (`leverageFor`) | worst historical trade is only 1.3R, but a gap larger than 2× the stop or ADL is not modelled |

## 6. Reproducible tests (all in `🔴BB-Core/audit/`)

```
node audit/test-no-lookahead.js        # A append, B poison-the-future, C indicators, D timing, E signal-bar. exit code 0 = pass
CORE=./out/core-planted-bug.js node audit/test-no-lookahead.js     # proves the suite catches a planted look-ahead (must FAIL)
node audit/dump-core-trades.js && python -I audit/recon.py          # independent ledger rebuild vs engine, 12 comparisons
node audit/yearly.js [mexc]            # year-by-year table, cost split, t-stats, bootstrap CIs
node audit/robustness.js               # 131-coin screen, parameter sensitivity, walk-forward, zero-edge null
node audit/execdiag.js                 # same-candle exits, gaps, venue parity, funding, Monte-Carlo drawdown
node audit/compare-candles.js SOL,ZEC [--mexc | --cross]   # fresh download vs stored data (revisions), Binance vs MEXC basis
```

## 7. Candle-by-candle comparison procedure (Binance and MEXC)

1. Pin the data: copy `data/SOL.json`, `ZEC.json`, `MEXC_*.json` and funding files, record SHA-256.
2. Re-download with `compare-candles.js` (Binance `fapi/v1/klines` USDT-M 4h, MEXC `contract/kline/<COIN>_USDT?interval=Hour4`). Pass: 0 missing/duplicate/misaligned candles; 0 OHLC differences on Binance history (achieved today); for MEXC, record the difference.
3. Venue basis: run `--cross` weekly. Record per-candle |ΔO|,|ΔH|,|ΔL|,|ΔC|. Today: close median 0.008% (SOL) / 0.009% (ZEC), p99 0.04% / 0.18%, wick differences up to 0.8%-2.6%.
4. For each candle in the window, recompute with `audit/recon.py` logic (or `signalFrom`) the BB upper/lower/middle, SMA200, ATR14, signal, stop, target. Compare to the bot's own record (step 8.3) using the tolerances in §8.
5. Replay the ledger: feed the same candles to `backtest()` and to `lucidyo.js replay`; trade lists must be identical. Differences must each be explained by one of: candle revision, gap, late entry, venue wick.

## 8. Shadow-trading (live parity) test design

Run the live bot in **paper mode on MEXC** for at least 60 days (about 360 4h candles per coin) **and** until at least 25 signals have occurred across SOL+ZEC, whichever is later. Add a recorder (not yet written; it is read-only) that stores per 4h candle and per coin:

1. **Raw feed at t+2 s** (what the bot decided on): the closed candle OHLC from MEXC and from Binance, plus `serverTime`. **Again at t+5 min** for the same candle. This directly measures P3 (revision).
2. **Bot's decision record:** BB upper/mid/lower, SMA200, ATR14, signal (long/short/none), stop, target, skip reasons, wake lag.
3. **Reference record:** the same fields from `backtest()` on candles re-downloaded 1 day later (final data), for both MEXC and Binance candles.
4. **Order simulation:** at the open the bot's paper fill (price at wake) vs MEXC best bid/ask at t+2 s (order book snapshot), vs the backtest's `next open ± 0.02%`. After entry, log MEXC last price per minute (or the 1 m candles) so the stop and target touch times can be replayed exactly and compared with the 4h-candle assumption.
5. **Fees and funding:** record the fee tier and every funding settlement actually applied.

### Paper-trading acceptance checklist (all must pass)

| # | Check | Pass criterion |
|---|---|---|
| 1 | Candle completeness | 0 missed or duplicated 4h candles; bot wake lag ≤ 10 s on ≥ 99% of candles, never > 120 s (C4) |
| 2 | Feed revision | t+2 s vs t+5 min OHLC identical on ≥ 99.5% of candles; any close difference never flips a signal |
| 3 | Indicator parity | bot BB/SMA/ATR vs reference: max relative error ≤ 1e-6 on 100% of candles |
| 4 | Signal parity (MEXC data) | 100% of bot signals appear in the reference with same direction, stop and target (tolerance 1 price tick); 0 reference signals missed |
| 5 | Signal parity (Binance vs MEXC) | ≥ 90% of signals agree on direction and candle (today 95% SOL, 83% ZEC); report each disagreement |
| 6 | Entry slippage | median entry price within 0.05% of the signal-candle open; 90th percentile within 0.15%; ≥ 95% of entries within 15 min |
| 7 | Stop/target replay | for every trade, the exit reason and exit candle from 1 m replay equal the 4h-candle backtest on ≥ 90% of trades; zero trades where the live outcome has stop AND target the wrong way round |
| 8 | Cost parity | realised fee + slippage per trade ≤ the harsh assumption (0.08% fee, 0.05% slip), i.e. mean ≤ 0.07R; funding within ±0.02R/trade of the model |
| 9 | Per-trade R parity | for matched trades, median \|R_live − R_backtest\| ≤ 0.10R and the sum over the period within 25% of the backtest (or ±5R, whichever is larger) |
| 10 | Operations | no duplicate orders; every position had stop and target on the exchange within 10 s; 0 unreconciled positions; restart test passes mid-trade |
| 11 | Sizing | realised risk per trade within +/−20% of target at least 90% of the time (contract rounding, `maxRiskMult`) |
| 12 | Risk | max live drawdown stays under the halt level (39R); at 1% risk equity drawdown < 20% |

**Interpretation limit:** 60 days is ~100 trades for the pair, with a standard error of ~0.19R per trade. Passing proves *execution parity*, not profitability. A profitability decision needs 300+ trades (about 2 years for the pair). Use live results only to confirm costs/fills match, and stop-review triggers from the README (rolling 50-trade result below −14R).

## 9. Final assessment

* **Paper trading:** ready. Fix C4 (retry until the new candle appears or raise an alert) and decide how to treat C3 (skip signals when a gap exists in the last 200 candles) before relying on it.
* **Small controlled live test:** acceptable for SOL+ZEC together, at ≤1% risk or the fixed $1, after checklist items 1-10 pass and `test-trade` proves the TP/SL type and fee tier. Treat ZEC as the weaker leg on MEXC data.
* **Validated as a reproducible edge:** no. The evidence is a positive, broad, parameter-stable, Binance-measured premium, not yet shown on MEXC execution, and selected from a large search.

## 10. Smallest additional information needed to finish the audit

1. `state/` from the paper bot (`runs.jsonl`, `events.jsonl`, `state.json`) so I can compute real wake lag, gaps and paper fills.
2. Output of `node lucidyo.js test-trade SOL --yes` (real MEXC fills, fee, TP/SL order type) and your MEXC futures fee tier.
3. MEXC SOL_USDT and ZEC_USDT order-book depth (best bid/ask and ±0.1% depth) at a few 4h opens, for the slippage assumption.
4. The `research/bollinger/` list of every variant ever tried (count), to compute a proper multiple-testing penalty.
