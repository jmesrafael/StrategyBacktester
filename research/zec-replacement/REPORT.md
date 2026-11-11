# ZEC replacement screen (Nov 11, 2026)

ZEC is being delisted. Question: which coin should take its place in the TRI-CORE bots (BB-CORE, I-CORE, T-CORE) next to SOL, NEAR, ADA and GALA?

## Method

- **Bots, unchanged:** the live rules via `../strat-hunt-nov6` (engine validated against `lucidio-core.js` / `icore-core.js` by `validate.js`): BB-CORE `bb-core|BBX`, I-CORE `i-core|P7`, T-CORE `bb-trail|P14`. TRI-CORE view = 50/25/25 weighting of R.
- **Costs:** 0.05% taker per side, 0.02% slippage per fill, real Binance funding from each coin's futures listing (zero before it). Double and triple costs checked.
- **Data:** Binance **spot** 4h candles (futures only start in 2019-20, too short for 7 years). Outage gaps filled with flat candles (all coins ≤ 16 slots except CVC, 925 slots).
- **Universe:** every Binance spot USDT coin with 4h history from **Nov 11, 2019** or earlier that also trades on MEXC futures: 43 coins (`universe.json`).
- **Same window for all:** trades entered from Nov 11, 2019 to Nov 11, 2026 (7 years). Earlier candles only warm up the SMA200.
- **Gates (fixed before seeing results):** 7 full years; BB-CORE avg ≥ +0.10R; all three bots positive; TRI-CORE ≥ 6/7 years positive; positive both before and after 2023; ≥ 4 of 5 market regimes positive; still positive at double costs; MEXC ≥ $5M/day or Binance futures ≥ $30M/day.

Scripts: `universe.js` → `fetch.js` → `screen.js` (results.json, trades.json) → `deep.js` (deep.json) → `walkforward.js`.

## Screen result

9 coins pass all gates: DOGE, ONE, ADA, BTC, ZEC, ETH, BNB, XRP, LINK. ADA is already traded and ZEC is the one leaving, so **7 contenders: ETH, ONE, DOGE, BTC, XRP, BNB, LINK**.
Failed only on liquidity: VET (MEXC $0.4M/day). Strong recent form but failed consistency: XLM (5/7 years, 3/5 regimes), ENJ, FET, ALGO, HBAR (also illiquid). Losers: ATOM, ONG, ARPA, MTL, TRX (BB-CORE negative), and most old alts (ETC, LTC, BAND, IOST, RVN negative since 2023).

## The contenders vs ZEC (7 years, TRI-CORE weighted R)

| Coin | BB-CORE avgR | I-CORE avgR | T-CORE avgR | Total R | Max DD | Years + | Without best year (R/yr) | 2023-26 R/yr | 2023-26 at 3x costs | Corr. with keepers | Portfolio ret/DD |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **ZEC (leaving)** | +0.46 | +1.15 | +1.76 | +186.9 | 19.0 | 6/7 | +14.5 (no 2025: +100R) | **+31.8** | +115.1 | **0.05** | **23.6** |
| **ETH** | +0.35 | +0.49 | +1.34 | +124.0 | 15.5 | 6/7 | **+15.5** | +10.4 | +30.2 | 0.26 | **19.8** |
| ONE | +0.38 | +0.55 | +2.18 | +162.8 | 10.8 | 7/7 | +14.0 | +13.5 | +40.1 | 0.45 | 15.8 |
| DOGE | +0.75 | +0.75 | +1.38 | +213.1 | 14.0 | 6/7 | +17.3 (2021 alone 109R) | +11.4 | +31.7 | 0.29 | 14.2 |
| BTC | +0.23 | +0.60 | +1.98 | +135.3 | 11.8 | 6/7 | +13.8 | +11.9 | +30.3 | 0.42 | 17.4 |
| XRP | +0.39 | +0.66 | +0.43 | +116.3 | 24.3 | 6/7 | +12.4 | +9.3 | +23.6 | 0.45 | 14.6 |
| BNB | +0.32 | +0.61 | +0.99 | +121.0 | 18.1 | 7/7 | +8.9 | +8.7 | +16.3 | 0.11 | 15.9 |
| LINK | +0.28 | +0.15 | +0.58 | +72.3 | 15.4 | 6/7 | +5.8 | +8.8 | +23.5 | 0.49 | 12.2 |

Portfolio = SOL + NEAR + ADA + GALA + the coin, from Oct 18, 2021 (when all keepers trade). Keepers alone: +353.6R, DD 20.9, ret/DD 16.9. With ZEC: +489.6R, DD 20.7. **With ETH: +422.9R, DD 21.4 (ret/DD 19.8)**, ONE +425.2R DD 26.8, DOGE +411.4R DD 29.0, BTC +400.0R DD 22.9.

Year by year (TRI-CORE R): ETH +31 / +24 / +29 / −8 / +4 / +16 / +28 (2020…2026); ZEC +39 / +16 / +9 / −15 / +8 / **+100** / +30.

## What the data says

1. **Nothing fully replaces ZEC.** ZEC's edge is real every year, but its lead comes from 2025 (+100R, its huge rally). Without that year ZEC makes +14.5R/yr, the same level as the top contenders. Expect the portfolio to earn about 14% less than with ZEC (+423R vs +490R over 5 years) whichever coin is chosen.
2. **Past rank barely predicts future rank.** Ranking the 39 seven-year coins on 2019-22 and checking 2023-26 gives a rank correlation of only 0.17 (ZEC was 16th before 2023, 1st after). So the choice should rest on robustness (consistency, drawdown, diversification, liquidity), not on the highest backtest total.
3. **ETH is the most robust pick.** It is the only contender that adds return to the portfolio without adding drawdown (DD 21.4 vs 20.9 for the keepers alone), and it has the best portfolio return/drawdown (19.8), the best result once its best year is removed (+15.5R/yr), the best recent form (2026 +27.6R, last 12 months +26.4R), low correlation with the keepers (0.26), the deepest MEXC market ($1.5B/day) and the lowest MEXC taker fee (0.02%).

## Ranking

1. **ETH — recommended.** Weaknesses: BB-CORE alone is only +0.18R after 2023 (most of ETH's recent edge comes from T-CORE, +0.93R); 2023 lost 8R; ETH follows BTC closely in crashes. **Sizing:** one MEXC contract = 0.01 ETH ≈ $20.50 (ZEC ≈ $9.74), so at T-CORE's ~$40 size a wide stop can be smaller than one contract: check how the bot rounds before switching.
2. **ONE — runner-up on numbers, high project risk.** Best 2023-26 return (+13.5R/yr, still +40R at 3x costs), 7/7 years, smallest standalone DD. But: price $0.0016, MEXC only ~$7.7M/day, 0.04% taker, Harmony's 2022 bridge hack, correlation 0.45 and portfolio DD 26.8. A coin like this is itself a delisting risk: the problem you are trying to fix.
3. **DOGE.** Highest 7-year total, but half of it is 2021 (meme run); BB-CORE fell from +1.50R to +0.16R after 2023; worst portfolio DD (29.0).
4. **BTC.** Clean and liquid, but correlation 0.42 with the keepers, BB-CORE positive in only 4/7 years, 2025 negative, and BB-CORE's top 10 trades are 152% of its profit (the rest lose).
5. **XRP, BNB, LINK.** Pass the gates but weaker: XRP DD 24R and BB-CORE ≈ 0 after 2023; BNB's last 12 months +0.7R; LINK lowest total and highest correlation (0.49).

## Follow-up: Binance futures candles, and "all 7 years positive" (`fut.js`)

Binance USDT-M futures only start Sep 2019 (BTC) / Nov 2019 (ETH) / early 2020 (most): only **BTC has 7 full years** of futures history; ETH 6.9.
TRI-CORE by year on futures (2020…2026): ETH +14 / +23 / +25 / −8 / +6 / +15 / +27 (6/7) · BTC +33 / +52 / 0 / +25 / +14 / −6 / +11 (6/7) · ADA 7/7 (already traded) · BNB loses 2020 (−11) · ONE only from Mar 2021, +70R (vs +163R on spot: its spot lead came from before futures existed) · VET loses 2025.
**No tradable new coin is positive in all 7 years**, on spot or futures. On spot, TRI-CORE 7/7 = ADA (taken), BNB (2023 and 2026 only +2R each; loses 2020 on futures), ONE (fails on futures history), VET and ANKR (illiquid). No coin has all three bots positive every year. ETH's only losing year is 2023 (−8R) on both data sets; the ETH recommendation stands.

## 10-year run (Dec 2, 2016 → Nov 11, 2026; `fetch10.js`, `run10.js`, results10.json)

Data: Poloniex 4h (USDT pairs) until each coin's Binance spot data begins, then Binance spot (XMR: Poloniex throughout). Splice check: median close difference 0.2–0.5% over 60 overlapping days; 2–14 bad wicks clipped per coin. Funding zero before each coin's Binance perp (no perps existed in 2016-19 except BTC/ETH on BitMEX).
Only 9 coins have data back to 2016 on any free source: BTC, ETH, XRP, LTC, DASH, XMR, ETC, XLM, ZEC. ADA (8.5 yrs), SOL (6.2), NEAR (6.0), GALA (5.1) shown with all the history that exists.

| Coin | Span | Total R | R/yr | Max DD | Ret/DD | Years + | R/yr without best year | Worst year | MEXC $/day |
|---|---|---|---|---|---|---|---|---|---|
| **BTC** | 9.9 | +265 | +26.6 | **11.8** | **22.4** | 9/10 | **+23.7** | −5 (2025) | $3.3B |
| **ETH** | 9.9 | **+343** | **+34.5** | 17.9 | 19.1 | 9/10 | +19.6 (2017 alone +168) | −8 (2023) | $1.5B |
| XLM | 9.9 | +312 | +31.4 | 19.8 | 15.8 | 8/10 | +23.9 | −7 (2026) | $27M |
| ZEC (leaving) | 9.9 | +243 | +24.5 | 19.0 | 12.8 | 9/10 | +16.0 | −15 (2023) | $2.2B |
| XRP | 9.9 | +272 | +27.4 | 24.3 | 11.2 | 8/10 | +20.1 | −3 | $327M |
| ETC / LTC / DASH | 9.9 | +146 to +207 | +15 to +21 | 28–30 | 5–7 | 7–8/10 | +9 to +14 | −10 to −13 | $1.5–17M |
| XMR | 9.9 | +22 | +2.2 | 83 | 0.3 | 6/10 | −2.9 | −34 | $3.6M |
| GALA (keeps) | 5.1 | +126 | +24.9 | 7.3 | 17.4 | 6/6 | +20.0 | +9 | — |
| ADA (keeps) | 8.5 | +169 | +19.9 | 12.1 | 14.0 | **9/9** | +17.4 | +0.7 | — |
| SOL (keeps) | 6.2 | +151 | +24.6 | 11.8 | 12.8 | 7/7 | +18.3 | +3.6 | — |
| NEAR (keeps) | 6.0 | +90 | +15.0 | 7.9 | 11.4 | 5/7 | +11.3 | −8 | — |

- **BTC is the best 10-year coin on its own:** smallest drawdown, best return/drawdown, positive in all 7 market regimes (2017 bubble, 2018 bear, 2019, 2020-21 bull, 2022 bear, 2023-24, 2025-26), highest result without its best year.
- **ETH is the best 10-year total** and the only coin where T-CORE is positive all 10 years, but half its total is 2017 (thin Poloniex market); it lost the 2023-24 regime (−3.9R).
- **As ZEC's replacement next to SOL, NEAR, ADA, GALA (since Oct 2021): ETH beats BTC** (ret/DD 19.8 vs 17.4, DD 21.4 vs 22.9; ETH bot results correlate 0.26 with the keepers, BTC 0.42). Both ETH and BTC (6 coins): ret/DD 19.4, no better than ETH alone (ETH vs BTC results correlate 0.46).
- **Only ADA is positive every year** of its history (9/9), and it is already traded. No 10-year coin is positive all 10 years.

**Decision: ETH replaces ZEC.** BTC is the strongest 10-year coin by itself and the clear second choice, but it adds less to this portfolio.

## Top-100 screen (CoinGecko market cap, Nov 11, 2026; `parity.js`, `top100.js`, `fetch-other.js`, `screen100.js`, results100.json)

**Engine = the live bots.** `parity.js` runs the research engine against the bots' own core files (`🔴BB-Core/lucidio-core.js`, `🔴I-Core/icore-core.js`, `bb-trail/icore-core.js`; byte-identical to `/opt/lucidio`, `/opt/icore`, `/opt/tcore` on the VPS apart from line endings) at zero cost on ZEC, ETH, BTC, DOGE, XRP, SOL: 16 of 18 bot/coin pairs identical trade for trade; BB-CORE differs on 3 of ~6,000 trades where the price equals the Bollinger middle to the last decimal (floating-point tie).

Universe: top 100 after removing stablecoins, wrapped/staked copies and tokenized funds; 78 trade on MEXC futures (the bots' venue) and were tested on all their 4h history (up to 10 years: Poloniex 2016 + Binance spot; else Binance futures; else MEXC futures).
Gates: ≥ 2 years; all three bots positive; both halves of the history positive; ≥ 75% of rolling 12-month windows positive; positive at double costs; MEXC ≥ $5M/day.
Deciding test: SOL+NEAR+ADA+GALA + coin vs + ETH over the same period (from Oct 2021, or the coin's start if later).

13 coins besides ETH pass the gates. **None beats ETH in the portfolio:**

| Coin (rank) | History | R/yr | DD | Portfolio ret/DD with coin vs with ETH, same period |
|---|---|---|---|---|
| ARB (46) | 3.5 yrs | +10.0 | 10.6 | 13.75 vs 13.75 (tie; −3R total) since Apr 2023 |
| ENA (29) | 2.5 yrs | +15.5 | 8.1 | 7.57 vs 7.59 since May 2024 |
| BTC (1) | 9.9 | +26.6 | 11.8 | 17.44 vs 19.77 |
| PEPE (28) | 3.4 | +16.5 | 7.0 | 11.82 vs 14.21 (more R, deeper DD 26.8) |
| SUI (20) | 3.4 | +12.9 | 7.4 | 11.41 vs 14.16 |
| BNB (3) | 8.9 | +19.0 | 18.1 | 15.94 vs 19.77 |
| XLM (13) | 9.9 | +31.4 | 19.8 | 15.16 vs 19.77 |
| DOT (38) | 6.1 | +12.0 | 8.8 | 15.11 vs 19.77 |
| XRP (4) | 9.9 | +27.4 | 24.3 | 14.63 vs 19.77 |
| DOGE (10) | 7.3 | +28.9 | 14.0 | 14.17 vs 19.77 |
| UNI, AVAX, LINK | 6–7.7 | +8 to +16 | 11–15 | 12.2 to 14.2 vs 19.77 |

Good numbers but too thin on MEXC (< $5M/day): VET, SHIB ($4.8M), STX, SEI, FET, RAY, ALGO, STRK, CAKE. Too new (< 2 years): HYPE (1.4 yrs, I-CORE negative), PI, PENGU, VVV, AERO, KITE, NIGHT, M. Losers (some bot negative): AAVE, TAO, BCH, XMR, APT, JUP, ATOM, ONDO, TIA, WLD, ASTER, WLFI, VIRTUAL, STABLE, most 2025-26 listings.

**ETH stays the pick.** ARB and ENA only tie it, on 2.5–3.5 years of data, against ETH's 10.

## ZEC vs ETH through TRADING_MATH.txt (`math.js`, math.json)

Per coin, all three bots, every trade since Nov 2019 (R per trade):

| Measure (TRADING_MATH section) | ZEC | ETH | Reading |
|---|---|---|---|
| 1.1 sample size | 636 | 645 | equal |
| 1.2 mean / median R | +0.95 / −1.01 | +0.60 / −1.02 | typical trade is a full loss for both: a trend system lives on outliers |
| win rate, avg win / avg loss, EV | 30.7%, +5.33 / 0.99, **+0.95** | 31.3%, +4.08 / 0.99, +0.60 | ZEC's EV is higher |
| 1.3 std dev of R, skew | 10.62, +16.2 | **3.98**, +5.7 | ZEC's EV comes from a few huge trades |
| top 1% of trades = share of profit | 81% | **49%** | without its 6 best trades ZEC is ordinary |
| 1.6 t-stat of the mean (> 2 = unlikely luck) | 2.25 | **3.80** | ETH's edge is the more certain one |
| t-stat per bot BB / IC / TC | 3.02 / 1.38 / 1.17 | 2.20 / 1.95 / 2.46 | ZEC's I-CORE and T-CORE edges are not significant on their own |
| 1.1 in-sample (to 2022) → out-of-sample (2023→) | +0.64 → +1.15 | +1.03 → +0.32 | ZEC improved (its 2025 rally); ETH decayed but stayed positive |
| 1.7 mean R given BTC up-trend / down-trend | +0.03 / +2.02 | +0.56 / +0.64 | ZEC only made money when BTC was falling; ETH works in both |
| 3.2 lag-1 autocorrelation of trade R | +0.41 | +0.16 | ZEC's wins cluster in one episode |

Portfolio SOL+NEAR+ADA+GALA + 5th coin, monthly, Oct 2021 → Nov 2026 (62 months):

| Measure | + ZEC | + ETH |
|---|---|---|
| total R / per year | **+490 / +96.6** | +423 / +83.5 |
| median month / std dev of a month | +3.76 / 16.2 | **+5.42 / 11.7** |
| 4.2 Sharpe (annualised) / Sortino | 1.69 / **9.4** | **2.03** / 7.7 |
| 4.3 max drawdown / positive months / worst month | **20.7** / **69%** / **−10.7** | 21.4 / 65% / −13.7 |
| 4.1 VaR 95% month: historical / normal formula / CVaR | **6.7** / 18.8 / **8.1** | 7.7 / **12.4** / 9.6 |
| 1.4 5th coin's correlation with the other four | **0.03** | 0.18 |
| 2.3 5th coin's share of portfolio risk (w'Σw) | **56%** | 13% |
| 2.5 PCA effective number of independent bets (of 5) | **4.37** | 4.11 |
| 4.4 Monte Carlo max DD median / 95% / 99% | 13.4 / 19.9 / 23.9 | 13.0 / 19.5 / 23.4 |
| 4.4 P(losing 12 months) / 5th-percentile year | 1.2% / +21.6R | 1.3% / +19.5R |

Risk shares: + ZEC: SOL 11%, NEAR 6%, ADA 14%, GALA 13%, **ZEC 56%**. + ETH: SOL 23%, NEAR 13%, ADA 26%, GALA 25%, ETH 13%.

**Verdict.** ZEC gave the bigger total and the gentler bad months, but more than half the portfolio's risk sat on one coin whose profit is 81% from 1% of its trades, and its edge is statistically the weaker one (t 2.25 vs 3.80). With ETH the portfolio makes ~14% less but is smoother (higher Sharpe, lower monthly volatility, better median month) and the risk is spread across all five coins. Drawdown, Monte Carlo drawdowns and the chance of a losing year are the same. ZEC is leaving anyway; ETH is the replacement that keeps the portfolio's risk profile intact.

## Limits

- Spot prices, not MEXC futures prices; funding is zero for the first weeks to ~16 months before each coin's Binance futures listing (ETH: Nov 27, 2019, so almost nothing missing).
- Liquidity is a one-day snapshot (Nov 11, 2026).
- 43 coins were screened; the winner of any screen is flattered by selection. The walk-forward check above says how much: a lot.
- R-based. Dollar results depend on each bot's size and on MEXC contract rounding.
