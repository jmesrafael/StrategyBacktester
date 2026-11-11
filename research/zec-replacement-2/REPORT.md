# ZEC replacement, round 2: tradfi perps + a 5th coin per bot (Nov 12, 2026)

> **Correction (Nov 12, 2026) — the recommendation below is withdrawn.** The portfolio drawdowns in DEEP.md and in the table below are measured at month-end, which hides dips that recover inside a month and made DOT and BNB look like they lower drawdown. Trade by trade (as `perbot.js` and `../zec-replacement/stability.js` measure it) they raise it: BB-CORE 27.4R → 35.1R with DOT; I-CORE 24.1R → 25.7R with BNB. Totals and years won are identical in both studies (same engine, same data). Under the owner's rule (stability over luck: the coin itself must be as steady as the bot's kept coins, `stability.js`), no new coin qualifies for BB-CORE or I-CORE; they stay on SOL, NEAR, ADA, GALA. The tradfi finding (section 1) stands.

Follows `../zec-replacement/REPORT.md` (crypto screen → ETH). Since then ETH was switched on for **T-CORE only** (bot configs, Nov 12): on BB-CORE and I-CORE ETH is weak (2023 −14.8R on BB-CORE; 2023-24 −19R on I-CORE, 43 months below its high; see `../eth-yearly/COMPARE.md`). Open question: a 5th coin for **BB-CORE** and **I-CORE**, and whether any of MEXC's stock / index / metal / oil perps fit.

## 1. MEXC tradfi perps (stocks, indices, gold, oil): none fit

- Universe: MEXC's 563 tradfi contracts; the ~30 with ≥ $5M/day (gold, silver, WTI, Brent, S&P 500, Nasdaq, Dow, NVDA, MU, SNDK, SK Hynix, Samsung, TSLA, AMD, INTC, AVGO, GOOGL, TSM, MSTR, CRCL, CRWV, SOXL…) plus AAPL/MSFT. `fetch.js`.
- Data: Dukascopy 4h (gold/oil/indices 2013+, US stocks 2017+, split-adjusted from Yahoo split history, every remaining jump checked as a real event) and Yahoo 1h→4h for 2 years where Dukascopy has nothing. MEXC funding history per contract (its mean before listing).
- **MEXC tradfi perps trade 24/7** (checked on MEXC's own 4h candles: nights/weekends drift a little, the open gap lands on Monday), so the bot sees 6 candles a day. Main run fills closed hours with flat candles at the last price; robustness run uses exchange-hours candles only. `screen.js`.
- Result (24/7 view): **every long-history market fails** — gold +0.1R/yr with a 69R drawdown, S&P/Nasdaq/Dow ≤ +1.4R/yr, oil ~+1R/yr, big tech mostly negative on BB-CORE (MSFT −12.8R/yr, INTC −7.8, GOOGL −6.6). Only short-history 2025-26 rally names look good (SK Hynix, MSTR, SNDK), and their results swing hard between the two candle views (SNDK T-CORE from +0.6R to +185R per trade): not trustworthy. Per bot, no tradfi market passes the gates (`perbot.js`).
- Reading: the bots are crypto trend/breakout systems; these markets are too mean-reverting at 4h and the 24/7 wrapper adds artificial flat periods.

## 2. A 5th coin per bot (`perbot.js` → PERBOT.md, `deep.js` → DEEP.md)

All ~120 markets (101 crypto + tradfi), each bot separately. Gates fixed before results: ≥ 3 yrs, PF ≥ 1.3, both halves +, ≥ 75% rolling 12-mo windows +, + at 2× costs, MEXC ≥ $1M/day (bot positions are $40-100, so the old $5M bar was stricter than needed). BB-CORE 12 pass, I-CORE 9, T-CORE 10 (ETH first there).

Finalists judged like ETH: Jan 2021 → Oct 2026, the bot's 4 keepers (SOL+NEAR+ADA+GALA) + the coin.

| Bot | Coin | years won / lost (of 7, 2020-26) | the losing year(s) | losing months | 12-mo windows < 0 | worst 12 mo | portfolio ret/DD (keepers alone) | portfolio DD (keepers) |
|---|---|---|---|---|---|---|---|---|
| BB-CORE | **DOT** | 6 won / 1 lost | 2020 −0.6R | 39% | 2% | −1.6R | **29.7** (22.9) | **18.4** (20.1) |
| BB-CORE | **BNB** | **7 won / 0 lost** | none | 51% | 19% | −15.1R | 23.9 (22.9) | 22.7 (20.1) |
| BB-CORE | ETH (for reference) | 6 won / 1 lost | 2023 −14.9R | 47% | 29% | −21.5R | 25.4 | 21.2 |
| I-CORE | **BNB** | 6 won / 1 lost | 2023 −4.0R | 51% | 15% | −10.3R | **32.1** (24.4) | **17.9** (19.0) |
| I-CORE | XRP | **7 won / 0 lost** | none | 51% | 24% | −18.8R | 28.5 (24.4) | 20.8 (19.0) |
| I-CORE | ETH (for reference) | 5 won / 2 lost | 2023 −4.2R, 2024 −10.2R | 54% | 39% | −17.7R | 23.3 | 22.9 |

Year by year (R): BB-CORE DOT −0.6 / +22.1 / +25.3 / +14.9 / +5.1 / +5.2 / +13.9 · BNB +3.9 / +42.8 / +3.0 / +9.0 / +10.7 / +16.3 / +1.1 · ETH +21.9 / +4.1 / +40.8 / −14.9 / +2.9 / +11.6 / +34.7.
I-CORE BNB +7.1 / +83.9 / +9.5 / −4.0 / +15.5 / +3.6 / +2.2 · XRP +6.0 / +26.4 / +1.6 / +4.1 / +70.3 / +13.1 / +11.5 · ETH +24.1 / +36.6 / +20.1 / −4.2 / −10.2 / +7.4 / +20.0 (2020…2026, 2026 to Nov 11).

## Recommendation

- **One coin for both bots: BNB.** Profitable on BB-CORE every year 2020-2026, one small losing year on I-CORE, improves both bots' portfolios (I-CORE's the most of any coin, with a lower drawdown), low correlation with the keepers (0.24 / 0.17), 8.9 years of data, very low delisting risk. Weaknesses: half its months lose on their own; I-CORE's edge faded (+132R first half, +24R second); MEXC volume only $6.2M/day (fine at bot size: 1 contract = $6.86).
- **Best per bot: DOT on BB-CORE + BNB on I-CORE.** DOT gives BB-CORE the smoothest result (fewest losing months, lowest drawdown, almost no losing 12-month window). Caveats: highest correlation with the keepers (0.54, moves with the alts), only 6.1 years of data, price $0.85 after a long decline. DOT fails I-CORE (PF 1.23).
- Keep ETH on T-CORE.

## Limits

- Chosen from ~120 markets: the winner of any screen is flattered by selection (previous report: past rank barely predicts future rank). Treat as a paper-trade candidate first.
- Binance spot/futures candles for crypto; tradfi results use proxies of what MEXC shows. Liquidity is a one-day snapshot (Nov 11-12, 2026).
- Trade-level (perbot) and month-end (deep) portfolio drawdowns differ slightly; the ranking of the picks is the same in both.
