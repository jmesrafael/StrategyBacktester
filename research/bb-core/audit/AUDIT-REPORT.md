# Independent audit: 4h Bollinger breakout, SOL + ZEC (Lucid'io)

Audit date 2026-10-23. Code audited: `🔴BB-Core/` as committed (lucidio-core.js, backtest.js, fetch-data.js, lucidio.js, live.js, mexc.js, config.js, stress.js). Data: `data/` (Binance USDT-M futures SOL/ZEC to 2026-10-21 04:00 UTC, MEXC contract SOL/ZEC, funding files).
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
| C2 | Low · **DOCUMENTED 2026-10-23** | Time exit holds **49** candles, not the documented 48. `i - pos.i0 >= maxBars` sets the exit at the *next* open, so the exit fills at the open of candle i0+49. The bot has the same rule (`(c.time - st.pos.t0)/IV >= maxBars`), so they agree with each other, but README/comments say "48 candles (8 days)". The independent rebuild only matched when coded as 49. **Decision: document, do not change.** Coding exactly 48 held candles (maxBars 47) moves net R by +2.4R (SOL), -4.3R (ZEC), +1.4R (MEXC SOL), -4.6R (MEXC ZEC): mixed sign, inside noise, and it would void every validated number (recon, replay, README). The rule is now written in the lucidio-core.js header and lucidio.js: "maxBars counts candles after the entry candle; 49 held". `audit/out/v2/3-c2-decision.txt`. | lucidio-core.js:65; lucidio.js:85 | `audit/recon.py` [RAN] |
| C3 | Low-Med · **FIXED 2026-10-23** | The engine never checks that candles are contiguous. MEXC_ZEC has a 63-day hole (2020-08-11 → 10-13). A trade opened 2020-08-05 "survives" the hole, books 63 days of funding, and exits on the first candle after it at **−2.36R** (−1.34R of that is funding). Indicators also span the hole (3 later trades). Live code counts gaps (lucidio.js:226-227) but still evaluates signals. **Fix:** `gapInWindow()` in lucidio-core.js; `backtest()` and the bot both skip a signal when a candle is missing among the last max(bbLen, trendLen) = 200 candles (cfg `gapSkip`, default on; the bot logs "signal SKIPPED: gap"). Effect: Binance files have no gaps so SOL/ZEC Binance results are unchanged; MEXC_ZEC loses the 3 trades whose indicators spanned the hole (304 -> 301 trades, 86.8R -> 84.6R base). Not covered: a position already open when a hole starts (the -2.36R trade of 2020-08) is still held across it; irrelevant for live (the bot never holds across a missing-candle fetch) but present in that one backtest trade. `test/fixes-test.js`. | lucidio-core.js:38-71 | `audit/worst.js`, `audit/out/execdiag.txt` [RAN] |
| C4 | Med · **FIXED 2026-10-23** | Signal can be lost silently. `fetchCandles` gives up after 120 s even if the new candle is missing (`nowSec()-expected > 120`). Then the just-closed candle is treated as the forming one (`i < n-1` loop), so no decision is made. On the next run, 4 h later, the signal is more than 15 min old and is skipped (line 97). Only a warning is logged. **Fix:** `fetchCandles` now polls until the new candle exists (1.5 s, then 4.5 s after ~1 min) for up to 10 min after the close; if it is still missing it returns `stale`, `runOnce` makes NO decision, raises an ERROR event (-> Telegram, run record `stale: [coins]`), and `loop()` retries every 30 s until the 15-min entry window closes, then raises a final "gave up: signals on that candle are lost" error. `test/fixes-test.js` (mocked MEXC: candle appearing on the 4th poll is used; never appearing -> stale after 602 s, two alerts, no state advanced). | lucidio.js:145, 77, 97 | [READ] |
| C5 | Med | Paper results are not comparable to the backtest by design: paper excludes funding, and fills at `B[n-1].close` (price at wake-up) instead of the next open. That is realistic, but anyone comparing paper R with backtest R must expect a gap. | lucidio.js:57, 241 | [READ]; replay matches because it uses `next.open` and no funding [RAN] |
| C6 | Med | Live exit bookkeeping can mislabel or flatter trades. `checkExit` only asks "is the position open **now**", so after a missed run the exit is assigned to the wrong candle. A manual close, liquidation or ADL is classified as stop/target by nearest price. If the history lookup fails, the exit price falls back to the exact stop/target price (no slippage). | live.js:65, 170-173 | [READ] |
| C7 | Low | MEXC funding before 2025-04-29 is Binance funding (assumption). On the overlap, ZEC funding differs a lot: sum −15.4% on MEXC vs −7.2% on Binance; mean \|rate\| 1.99 bp vs 1.50 bp. SOL is the same (0.16% vs 0.17%). Total funding is only ~4 R over ~300 trades, so impact is small, but it is not verified for 2020-2025 on MEXC. | backtest.js:22-30; stress.js:10-16 | `out/execdiag.txt` [RAN] |
| C8 | Info | The old "103,000 orders, 0 mismatches" claim refers to a different engine (`research/bollinger/`, 325 SOL trades). It does not cover `lucidio-core.js` (309 trades). I re-ran the equivalent for the current engine (§2). | REPORT-bb-deep.md §2 | [RAN] |

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

**Existing bot tests [RAN]:** `node lucidio.js replay SOL,ZEC` = identical trade-for-trade (SOL 309/109.80R, ZEC 332/122.56R); `node test/selftest.js` 23 passed, 0 failed. Caveat: these run against a **simulated** MEXC, so they prove the bot logic, not MEXC's behaviour.

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
* **Economic size [RAN]:** reshuffling the 641 trades 5,000 times gives max drawdown median 17R, 95th pct 28R, 99th pct 34.5R, and a longest losing streak of 11 (99th pct: 20). The historical 16R is below the median, so the past ordering was mild. At 1% risk per trade the 99th-percentile drawdown is about 29% of equity; at the maximum 5% it is about 83%. **(Superseded by section 11 item 7: proper compounded Monte Carlo, 99th percentile 32% at 1% risk on MEXC candles, and it assumes the historical +0.31R edge.)** The bot's `haltAtR` (−39R) is therefore sensible, but a 1% risk setting is the ceiling for a first live test.

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
node audit/venue-parity.js             # (2026-10-23) signal parity per year + cause of every disagreement since 2024
node audit/mexc-primary.js [--nogap]   # year-by-year on MEXC candles only, base + harsh, 2020-23 vs 2024-26
node audit/c2-decision.js              # 48 vs 49 candles held
node test/fixes-test.js                # C3 gap rule + C4 stale-candle handling (mocked MEXC)
node audit/fetch-1m.js mexc|binance && node audit/replay-1m.js mexc|binance   # 1-minute replay of stop/target/time exits
node audit/acceptance-math.js          # trades per window, binomial and power tables behind the rewritten checklist
node audit/multiple-testing.js         # count of variants/coins tried, effective N, Sidak, deflated Sharpe, empirical Bayes
node audit/mc-risk.js                  # compounded drawdown Monte Carlo at 0.25 / 0.5 / 1% risk
node audit/shadow-recorder.js selfcheck|once|loop|reconcile   # read-only shadow recorder
```

## 7. Candle-by-candle comparison procedure (Binance and MEXC)

1. Pin the data: copy `data/SOL.json`, `ZEC.json`, `MEXC_*.json` and funding files, record SHA-256.
2. Re-download with `compare-candles.js` (Binance `fapi/v1/klines` USDT-M 4h, MEXC `contract/kline/<COIN>_USDT?interval=Hour4`). Pass: 0 missing/duplicate/misaligned candles; 0 OHLC differences on Binance history (achieved today); for MEXC, record the difference.
3. Venue basis: run `--cross` weekly. Record per-candle |ΔO|,|ΔH|,|ΔL|,|ΔC|. Today: close median 0.008% (SOL) / 0.009% (ZEC), p99 0.04% / 0.18%, wick differences up to 0.8%-2.6%.
4. For each candle in the window, recompute with `audit/recon.py` logic (or `signalFrom`) the BB upper/lower/middle, SMA200, ATR14, signal, stop, target. Compare to the bot's own record (step 8.3) using the tolerances in §8.
5. Replay the ledger: feed the same candles to `backtest()` and to `lucidio.js replay`; trade lists must be identical. Differences must each be explained by one of: candle revision, gap, late entry, venue wick.

## 8. Shadow-trading (live parity) test design (rewritten 2026-10-23)

**How many events a window really contains** (computed from the data; `audit/acceptance-math.js`, `audit/out/v2/5-acceptance-math.txt`). The first version of this section said "60 days is about 100 trades for the pair". That was wrong by a factor of six: **~98 trades per YEAR** for SOL+ZEC (MEXC 97.9/yr, Binance 96.9/yr; 101, 107, 100, 98, 101 in 2021-2025).

| Window | Expected trades (pair) | 5th-95th percentile over all historical start days (MEXC) | P(at least 25 trades) |
|---|---|---|---|
| 60 days | 16 | 11 - 21 | 1% |
| 90 days | 24 | 18 - 30 | 55% |
| 120 days | 32 | (not tabulated; >= 25 trades 95% of the time, see below) | ~95% |
| 180 days | 48 | 43 - 58 | 100% |
| 365 days | 98 | 93 - 109 | 100% |

Days needed to hold >= 25 closed trades: 90 days for 50% of start dates, 100 for 80%, **115 for 95%**. So: **run the paper bot and the recorder for at least 120 days AND until >= 25 closed trades have happened**, whichever is later. (Coin-candles, not trades, carry most of the statistics: 2 coins x 6 candles x 120 days = **1,440 candle observations**.)

**Recorder: built.** `node audit/shadow-recorder.js loop` (read-only: public GET endpoints of MEXC and Binance only, no keys, `httpGet` refuses anything private; proved by `selfcheck`, 15/15). Per 4h close and coin it stores: (1) closed candle OHLCV from MEXC and Binance at **t+2 s and again at t+5 min**, server times, request latency, polls until the new candle existed, wake lag; (2) decision record per venue (BB upper/mid/lower, SMA200, ATR14, signal, stop, target, skip reasons incl. the C3 gap rule); (3) order book: best bid/ask, spread, depth within +/-0.05% and +/-0.1%, simulated market-order slippage for $100/$1k/$10k/$50k both sides, Binance top of book; (4) if the bot would enter: three fills side by side (bot paper fill = price now + slip, backtest fill = forming-candle open + slip, order-book walk for the real notional) in R; (5) public fee rates, current funding rate and next settlement; (6) the 1-minute candles of the finished 4h period from both venues (`m1/`), so every stop/target touch can be replayed. `node audit/shadow-recorder.js reconcile` (run it a day later) re-downloads FINAL candles and reports revisions, indicator and decision parity and venue disagreements. It does **not** read the account fee tier or actual funding paid (those need the private API; take them from the bot's `state/`).

### Paper-trading acceptance checklist (statistically sized)

Statistics used: exact binomial, one-sided 95% (the number of failures a criterion may contain and still prove the stated rate); paired differences with 95% confidence intervals. **ASSUMED** inputs (standard deviations of slippage and of live-minus-reference R) are marked and must be replaced by the measured values after the first 10 trades.

**A. Feed and logic. Sample = candle observations (1,440 in 120 days).** Allowed failures at n = 1,440: 2 prove a rate <= 0.5%; 7 prove <= 1%; 58 prove <= 5%.

| # | Check | Pass criterion |
|---|---|---|
| A1 | Candle completeness and wake lag | 0 missed or duplicated 4h candles; wake lag > 10 s at most **7** times in 1,440 (proves <= 1%); never > 120 s (C4 alerts must have stayed silent or have been explained) |
| A2 | Feed revision (P3) | t+2 s vs t+5 min OHLC differs in at most **2** of 1,440 candle observations (proves <= 0.5%) and no difference flips a decision. (Already measured: 342 of 342 MEXC 4h candles equal their 1m aggregate.) |
| A3 | Indicator parity | 0 of 1,440 with relative error > 1e-6. Deterministic code: a single miss is a bug, not noise. |
| A4 | Decision parity (MEXC, bot vs reference) | 0 differences in direction, stop or target (1 tick) over all 1,440 decisions. Deterministic. |
| A5 | Venue parity (Binance vs MEXC) | raw-signal agreement >= 97% (history 2024-2026: 98.95%, 12 disagreements in ~1,150 signal events; expect 1-2 in 120 days) and every disagreement has a close-price gap <= 0.06% (history: largest 0.055%, all caused by close differences, none by wicks or gaps) |

**B. Execution. Sample = trades (>= 25). With 25 trades even zero failures only proves a failure rate <= 11.6% (<= 30% with 3 failures), so percentages of trades are NOT used as pass/fail; use paired differences with confidence intervals, and treat any deterministic mismatch as an investigation trigger.**

| # | Check | Pass criterion |
|---|---|---|
| B1 | Entry slippage | upper 95% confidence bound of the mean (entry - signal-candle open, in trade direction) <= 0.05% of price (ASSUMED sd 0.05% -> half-width 0.02% at n = 25); every entry within 15 min of the open. Median and 90th percentile are reported, not tested. |
| B2 | Stop/target replay on 1m data | 0 mismatches in exit reason or exit candle across all trades. Prior evidence: 0 of 641 Binance trades, 0 of 10 MEXC trades. Any mismatch is analysed (it would be the first ever). Zero mismatches in 25 proves only "<= 11.6%", so this is a tripwire, not a proof. |
| B3 | Cost parity | upper 95% bound of the mean (fees + slippage) <= 0.07R per trade (the harsh assumption); mean funding difference vs model within +/-0.02R per trade (sum within +/-0.5R over 25 trades) |
| B4 | R parity, paired | for the same trades, mean (R_live - R_reference) within +/-0.10R at 95% confidence (ASSUMED sd 0.20R -> half-width 0.078R at n = 25). **Never compare live totals with backtest totals**: the sum of 25 trades has a standard error of about 9R (trade sd 1.86R). |
| B5 | Operations | no duplicate orders; every position had stop and target on the exchange within 10 s; 0 unreconciled positions; restart test passes mid-trade (binary) |
| B6 | Sizing | no trade above `maxRiskMult` x target; median realised risk within +/-10% of target |

**C. Risk and profit. Not decidable inside a paper window; do not turn them into pass/fail items.**

* Drawdown: use the Monte-Carlo table in section 11 (item 7). The old "at 1% risk equity drawdown < 20%" is not a safe criterion: at 1% risk a >20% drawdown has a 25% chance over six years even if the historical edge repeats, and 90% if the edge is only +0.12R.
* Profit: 120 days is ~32 trades, a 95% confidence interval of +/-0.65R around the mean (trade sd 1.86R). To reject "no edge" with 80% power: **947 trades (9.7 years) if the true edge is +0.15R, 341 trades (3.5 years) if +0.25R, 174 trades (1.8 years) if +0.35R**. The earlier text "300+ trades, about 2 years" was also wrong: 300 trades is 3.1 years.
* Stop-review trigger: the README rule "rolling 50-trade result below -14R" fires by chance in **63%** of 3-year runs even when the true edge is +0.15R (25% at +0.30R). Replace it with **"rolling 100 trades below -30R"** as a REVIEW trigger: 0.7% false alarms at +0.30R, 7.8% at +0.15R, 39% at 0R, 68% at -0.10R (`audit/out/v2/5-acceptance-math.txt` section 3b). A review is not proof of failure.

Passing A and B proves *execution parity*, not profitability.

## 9. Final assessment

* **Paper trading:** ready. C4 and C3 are fixed and re-tested (section 11); C2 is documented.
* **Small controlled live test:** acceptable for SOL+ZEC together, at **0.25%-0.5%** risk per trade (not 1%: see section 11 item 7) or the fixed $1, after checklist items A1-A5 and B1-B5 pass and `test-trade` proves the TP/SL type and fee tier. Treat ZEC as the weaker leg on MEXC data.
* **Validated as a reproducible edge:** no. The evidence is a positive, broad, parameter-stable, Binance-measured premium, not yet shown on MEXC execution, and selected from a large search.

## 10. Smallest additional information needed to finish the audit

1. `state/` from the paper bot (`runs.jsonl`, `events.jsonl`, `state.json`) so I can compute real wake lag, gaps and paper fills.
2. Output of `node lucidio.js test-trade SOL --yes` (real MEXC fills, fee, TP/SL order type) and your MEXC futures fee tier.
3. MEXC SOL_USDT and ZEC_USDT order-book depth (best bid/ask and ±0.1% depth) at a few 4h opens, for the slippage assumption.
4. ~~The `research/bollinger/` list of every variant ever tried~~ counted on 2026-10-23 (section 11 item 6).
5. Still missing: the paper bot `state/`, the `test-trade` output, and the account fee tier. MEXC's PUBLIC contract detail shows taker 0.01% / maker 0% for SOL and 0% / 0% for ZEC (read on 2026-10-23), far below the 0.05% / 0.02% assumed; that is the contract default, not necessarily this account, so it is NOT used as evidence.

## 11. Second pass, 2026-10-23: results of the eight follow-up items

Raw output of every item is in `audit/out/v2/` (file names below). Everything here was run; numbers are copied from those files.

**1. Venue parity by year** (`1-venue-parity.txt`). Signal = the entry rule on every closed candle, position state ignored; agree = same candle and same direction. Agreement over the union of both venues' signals:

| Year | SOL | ZEC |
|---|---|---|
| 2020 | 69.0% | 24.5% |
| 2021 | 93.9% | 95.8% |
| 2022 | 97.7% | 96.1% |
| 2023 | 99.5% | 97.4% |
| 2024 | 100.0% | 98.6% |
| 2025 | 99.5% | 99.0% |
| 2026 | 98.7% | 97.6% |
| all | 97.2% | 87.6% |

2020 is not a price disagreement: MEXC_SOL starts 11 days after Binance (its 13 only-Binance signals are warm-up), MEXC_ZEC starts almost 5 months after and has a 63-day hole (101 of its 2020 disagreements are on candles that do not exist in the MEXC file). From 2024: **12 disagreements** (3 SOL, 9 ZEC), 0 opposite-direction. Cause, found by substituting the other venue's data into the venue that differed and re-running: **5 are the signal bar's own close** (e.g. ZEC 2026-08-30 16:00: MEXC closed 0.023% below Binance and 0.007% short of the band that Binance's close cleared) and **7 are close differences earlier in the 20/200-candle window** (the bands or SMA moved enough); **0 are wicks (ATR filter), 0 are gaps.** The stop-too-tight filter never decided one. Ten of the 12 were a Bollinger-band miss (by 0.004%-0.185%), two a SMA200 miss (the close sat 0.009% and 0.013% from the SMA). So the venues disagree only when a close lands within ~0.06% of a threshold (largest close gap in the 12: 0.055%).

**2. MEXC-primary numbers** (`2-mexc-primary.txt`; with the C3 fix; the before-fix file reproduces the old 191.4R / 175.4R). Base costs, then harsh. R, PF, win rate, max drawdown of the closed-trade curve in the period, exposure, cost contributions in R (negative = cost):

| | Trades | Net R | Avg R | PF | Win | Max DD | Exposure | Fees | Slippage | Funding | t |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SOL 2020-23 | 167 | +76.7 | 0.46 | 1.83 | 40% | 10.8R | 60% | -2.3 | -0.9 | -3.3 | 3.0 |
| SOL 2024-26 | 141 | +27.8 | 0.20 | 1.34 | 38% | 8.5R | 60% | -3.3 | -1.3 | -1.4 | 1.4 |
| ZEC 2020-23 | 157 | +30.0 | 0.19 | 1.30 | 38% | 17.2R | 53% | -3.1 | -1.2 | -4.4 | 1.3 |
| ZEC 2024-26 | 144 | +54.5 | 0.38 | 1.63 | 39% | 8.0R | 61% | -2.2 | -0.8 | +0.6 | 2.4 |
| **Pair 2020-23** | 324 | **+106.7** | 0.33 | 1.55 | 39% | 13.9R | 60/53% | -5.4 | -2.1 | -7.6 | 3.1 |
| **Pair 2024-26** | 285 | **+82.4** | 0.29 | 1.49 | 38% | 11.2R | 60/61% | -5.5 | -2.1 | -0.8 | 2.7 |
| Pair all | 609 | +189.1 | 0.31 | 1.52 | 38% | 13.9R | | -10.9 | -4.2 | -8.4 | 4.1 |
| *Harsh:* pair 2020-23 | 324 | +98.5 | 0.30 | 1.50 | 39% | 16.2R | | -9.2 | -5.8 | -7.6 | 2.9 |
| *Harsh:* pair 2024-26 | 285 | +74.7 | 0.26 | 1.43 | 38% | 11.6R | | -9.2 | -5.8 | -0.8 | 2.5 |
| *Harsh:* pair all | 609 | +173.2 | 0.28 | 1.47 | 38% | 16.2R | | -18.4 | -11.5 | -8.4 | 3.8 |

By year (pair, base): 2020 -0.6, 2021 +61.9, 2022 +16.4, 2023 +29.1, 2024 +33.1, 2025 +28.9, 2026 +20.4; harsh: -1.0, +60.0, +13.9, +25.6, +30.5, +26.5, +17.7. Reading: the split is not kind to SOL (+0.46R/trade in 2020-23 vs +0.20R in 2024-26, t 1.4) and the pair's 2024-26 edge is carried by ZEC. ZEC 2020-23 is weak (+0.19R, t 1.3; 2022 +0.4R, 2023 -3.8R). Funding was a 7.6R drag in 2020-23 and about nothing in 2024-26.

**3. Fix and re-test** (`final-*.txt`, `3-c2-decision.txt`). C2 documented, C3 and C4 fixed (see the table in section 1). After the changes, re-run in this order, all with exit code 0:

| Suite | Result |
|---|---|
| `node audit/test-no-lookahead.js` | **ALL LOOK-AHEAD TESTS PASSED** (SOL 309, ZEC 332, MEXC_SOL 308, MEXC_ZEC 301 trades; signal-bar cuts = trades) |
| `node audit/dump-core-trades.js && python -I audit/recon.py` | **ALL MATCH**, 12 of 12 (recon.py was extended with the same gap rule, written independently) |
| `node test/selftest.js` | **23 passed, 0 failed** |
| `node lucidio.js replay SOL,ZEC` | IDENTICAL trade-for-trade (SOL 309/109.80R, ZEC 332/122.56R) |
| `node test/fixes-test.js` (new) | 9 passed, 0 failed |

Limits of the evidence: `replay` and `selftest` use the Binance files (no gaps), so the C3 rule is exercised by `fixes-test.js` on MEXC_ZEC; the C4 test mocks MEXC (no real MEXC outage was reproduced).

**4. Stop/target replay on 1-minute data** (`4-replay-mexc.txt`, `4-replay-binance.txt`). **MEXC keeps only ~44,000 one-minute rows (about 30.6 days, from 2026-09-22 18:01)**, so MEXC 1m exists for 10 of the 609 MEXC trades (3 SOL, 7 ZEC): **10 of 10 match** on exit reason, exit 4h candle and R (sum of differences 0.0000R), and 342 of 342 MEXC 4h candles equal their own 1m aggregate to 1e-9. The data are saved in `audit/out/v2/mexc-1m-*.json` because the API will not serve them later. For the full history, the same replay on **Binance 1m (all 641 trades of the Binance backtest, 2.0M one-minute rows per coin)**: **0 mismatches (0.00%)** in exit reason, exit candle or R (mean |dR| 0.00002R); exits 106 target, 183 time, 352 stop all unchanged. No candle in any trade touched both stop and target, which is why the match is exact: stop-first sequencing never decided a trade. The mismatch rate on the MEXC *venue* for 2020-2026 cannot be measured; the shadow recorder collects the missing data from now on. A data-quality side finding: 6 of 16,516 Binance 4h candles in the trade windows do not equal their own 1m aggregate (SOL 2023-11-10 12:00 by 0.46%; five ZEC candles in May-June 2020 by 0.02%-0.07%); none changed a trade.

**5. Acceptance checklist corrected.** See section 8 (rewritten). Corrected numbers: ~16 trades per 60 days, ~24 per 90, ~48 per 180, ~98 per year; >= 25 trades needs 115 days for 95% of start dates; profit cannot be decided before 174-947 trades depending on the true edge.

**6. Multiple testing** (`6-multiple-testing.txt`). **Count.** research/bollinger/ evaluated **6,607 strategy settings** (breakout 1,235 including the 768-setting explore1 grid; the 2h re-tune 3,072; the rival FVG strategy family 2,300) plus this audit's 94, across 5 strategy families, 9 timeframes (5m to 1D) and **133 coin files**, with ~25 coins examined in detail and 2 chosen; about 20,000 setting x coin evaluations. Not countable (not recorded): interactive discards and the ~200 earlier "v7" variants. **Effective number of independent trials**: the 66 coins with data since 2021 collapse to **16** (average pairwise weekly-R correlation 0.20; applied to all 133); the 243 parameter variants of the robustness grid to **3.4** (correlation 0.52); together **~56**. **Sidak-adjusted p** (best of N): SOL t 3.35 / ZEC t 3.52 individually become p 0.022 / 0.012 at N = 56 and 0.052 / 0.029 at N = 133; the pair (t 4.86) stays 3e-5 / 8e-5. **Deflated Sharpe Ratio**, pair pooled (daily SR 0.0934, skew 3.2, kurtosis 18): 99.4% at N = 56, 98.3% at 133 coins, 91.7% at 912 raw settings, 60% at the extreme 133 x 243. But the selection happened coin by coin, and **per coin** (SOL, ZEC; daily SR 0.0704): **87-88% at N = 56, 78-79% at N = 133, 62% at 133 x 3.4** - below the usual 95%. **Empirical Bayes** over the 133 coins (SOL and ZEC included): the spread of coin averages is **not larger than sampling noise** (Q 125.5 on 132 df, p = 0.64; estimated true between-coin sd 0.000R). The data therefore cannot show that SOL/ZEC beat the average coin (0.117R/trade); if the true between-coin sd were 0.10R the shrunk estimate is **0.23R**, at 0.05R it is 0.16R. The report's judgment ("expect 0.10R to 0.25R, not 0.35R") stands and now has a computation behind it. Caveat: coins share market regimes, so independent-error shrinkage understates the selection effect.

**7. Risk sizing** (`7-mc-risk.txt`). Compounded: every trade risks r x current equity. 20,000 paths per row, three resampling schemes (iid, blocks of 10, whole calendar months). MEXC candles, base costs + funding, full history (609 trades), month-block resampling (iid and block-10 agree within about 2 points):

| Risk per trade | Median max DD | **95th pct** | **99th pct** | P(DD > 20%) | P(DD > 30%) | Median end equity |
|---|---|---|---|---|---|---|
| 0.25% | 4.4% | **7.0%** | **8.8%** | 0.0% | 0.0% | x1.59 |
| 0.50% | 8.7% | **13.7%** | **16.8%** | 0.2% | 0.0% | x2.49 |
| 1.00% | 16.9% | **25.9%** | **31.7%** | 25.1% | 1.6% | x5.92 |

Shorter horizons (month resampling, 1 year = 100 trades): 95th/99th pct DD 4.8/6.2% (0.25%), 9.4/11.9% (0.5%), 18.2/22.7% (1%); 2 years: 5.7/7.2%, 11.3/13.9%, 21.3/26.3%. Harsh costs: 7.6/9.5%, 14.7/18.0%, 27.6/33.7% (full history). Binance candles: 6.4/7.8%, 12.4/15.0%, 23.5/28.1%. **These rows assume the historical +0.31R edge repeats.** With the mean re-centred to the shrinkage estimate **+0.12R**, the full-history 95th/99th pct become 13.8/17.5% (0.25%), 26.1/32.5% (0.5%), **46.7/55.8% (1%)**, and the chance of finishing a 1-year window below its start is 27%; with **no edge** 22.9/27.5%, 40.6/48.2%, 66.6/74.1%. For reference, the levels the config still allows (`7-mc-risk-2pct-5pct.txt`, same method): at 2% the full-history 95th/99th pct DD is 46.4% / 53.8%; at the 5% maximum it is **81.9% / 88.4%** with a 94% chance of a >50% drawdown over six years, even though the median end equity is x1,063 - and with the +0.12R edge, 5% ends a 1-year window at a loss 43% of the time. Recommendation: **0.25%-0.5% per trade for a first live phase**; 1% is only comfortable if the full historical edge is real. The bot's `haltAtR` of -39R equals a 9.3% / 17.8% / 32.4% equity drawdown at 0.25% / 0.5% / 1%.

**8. Shadow recorder: built** (`audit/shadow-recorder.js`, design in section 8). Read-only by construction. `selfcheck` **15 passed, 0 failed** (`8-shadow-selfcheck.txt`): no trading/auth tokens in the code, all 10 endpoint paths public, `httpGet` refuses private paths / other hosts / plain http (5 of 5), order-book maths, `decide()` reproduces direction, stop and target of the last 60 trades on SOL and MEXC_ZEC and its BB/SMA/ATR equal a recomputation, and a full snapshot with a fake transport writes the five record kinds with exactly 7 public GET requests. A live run against the real public endpoints worked (`8-shadow-live-once.txt`, data in `audit/out/v2/shadow-demo/`): MEXC SOL spread 0.96 bp, market-buy slippage 0.48 bp at $100 to $50,000; MEXC ZEC spread 0.16 bp, 0.08-0.14 bp; depth within 0.1%: SOL ~$6.1-6.6M, ZEC ~$0.9-1.5M per side; Binance and MEXC agreed on the (no-signal) decision; `reconcile` found 0 revisions and 2 of 2 1m aggregates equal. That run was taken 97 minutes after the close, so it is labelled `late` and proves the plumbing, not the t+2 s timing. Start the real measurement with `node audit/shadow-recorder.js loop` (a VPS next to the bot) and run `reconcile` daily.
