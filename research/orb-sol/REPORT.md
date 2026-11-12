# ORB (Opening Range Breakout) on SOL, 1h and 4h: live replay (Nov 12, 2026, CORRECTED)

**Correction:** the first version of this report (same day) used the bb-core audit's 1m cache, which only
covers windows around that audit's trades (232 holes, hours to weeks long). Positions inside a hole
skipped their stops and targets, which produced fake 20R "time exit" wins. `fill-gaps.js` downloaded the
missing minutes: 3,189,662 continuous 1m candles, 0 gaps. The engine now throws if a gap ever reappears
under an open order. All numbers below are from the clean data. The first version's numbers are void.

Data: Binance SOLUSDT perp, Oct 20 2020 to Nov 12 2026: 1h, 4h, 1m and real funding.
In-sample (IS) = Oct 2020 to Dec 2023, out-of-sample (OOS) = 2024 to Nov 2026.

## How the replay stays honest
Candles are fed one at a time and indicators are built only from closed candles. A signal fills on the
next 1m open plus slippage. Stops, targets and limits are simulated minute by minute; if both are hit in
the same minute, the stop wins. Costs: taker 0.04%, maker 0.02%, slippage 0.02% (stops 0.03%), real
funding. 1% risk per trade. `audit-lookahead.js`: 18 random cut-offs, trades before each cut are identical. PASS.

## Results (R per trade, net of costs)
| Setup | Trades/mo | Win | Avg R | Sum R | Positive years | IS / OOS | 2026 YTD | Without top 10 winners |
|---|---|---|---|---|---|---|---|---|
| A. 1h NY textbook (1st NY hour, close break, stop mid, 2R, VWAP+RVOL) | 15.3 | 39% | +0.010 | +10.6 | 3/7 | +0.065 / −0.038 | −3.0R | −9.4R |
| A0. Same, no filters | 29.8 | 37% | −0.055 | −118.8 | 2/7 | −0.008 / −0.108 | −22.4R | −139R |
| B. 4h textbook (00-04 UTC range) | 5.3 | 44% | −0.015 | −5.7 | 2/7 | −0.070 / +0.042 | −2.5R | −25.8R |
| C. 4h London, long above EMA200, no target | 7.6 | 41% | +0.101 | +55.1 | 3/7 | +0.151 / +0.034 | −1.0R | −28.7R |
| D. 1h UTC0, long, VWAP+RVOL+narrow, no target (sweep pick) | 2.9 | 37% | +0.46 | +102.1 | 4/7 | +0.57 / +0.37 | +46.0R | −3.7R |

- Sweep (9,000 configs): of the 50 best IS configs, 16 (1h) and 18 (4h) stayed positive OOS, with a mean OOS of about 0.
  That's what noise looks like.
- A: positive 2021-23, negative 2024, 2025 and 2026. Its edge is gone.
- C and D make all their money from a few big trend days. Remove the top 10 winners and both lose.
  D was picked from 5,400 configs, so it's a lead to watch, not a result.
- Verdict: plain ORB on SOL 1h/4h has no durable edge after costs. Don't put it on a paper bot as-is.
  If anything, watch D.

Files: `final.json`, `final.txt`, `sweep-60.json`, `sweep-240.json`; `yearly.js` prints the yearly tables.

## Multi-coin test (BTC, ETH, XRP, plus ADA as an unseen coin), Nov 12 2026
1m for BTC/ETH/XRP built from data.binance.vision bulk files (`vision-1m.js`, 0 gaps; XRP has one real
14h exchange hole on 2022-04-02). Sweeps: `sweep-<COIN>-<tf>.json`. Cross-coin analysis: `cross.js`; deep tests: `deep.js` / `deep.json`.

- BTC: ORB fails almost everywhere (7% of 1h configs positive OOS, 12% on 4h).
- Pooled selection on 2020-23 across 4 coins: the 4h top-50 is negative OOS (2/50 positive). The 1h top-50 is flat (mean +0.004).
- Configs positive in both halves on all 4 coins: 2/5400 (1h) and 6/3600 (4h). That's below what chance alone
  would give if the coins were independent (they're correlated), so there's no broad ORB edge.
- **Best candidate, F**: 1h, range = first UTC hour (00-01), long only, candle close above the range, close above VWAP and EMA200,
  breakout candle volume ≥1.5× the 20-candle average, stop at the breakout candle's low, no target, exit at 00:00 UTC.
  | coin | trades/mo | win | avg R | +years | 2026 | max DD (1% risk) | w/o top 10 | avg R at 2× costs |
  |---|---|---|---|---|---|---|---|---|
  | SOL | 3.1 | 40% | +0.47 | 6/7 | +38R | 15% | +5.3R | +0.37 |
  | ETH | 3.3 | 36% | +0.53 | 7/7 | +54R | 17% | −17R | +0.36 |
  | BTC | 3.0 | 37% | +0.29 | 6/7 | +17R | 25% | −38R | +0.09 |
  | XRP | 2.6 | 29% | −0.10 | 3/7 | −11R | 29% | −86R | −0.20 |
  | ADA (unseen) | 3.1 | 28% | −0.03 | 4/7 | −1.6R | 28% | −67R | |
- Control test: drop the RVOL filter and F is negative on every coin. The volume spike (in an uptrend, above VWAP)
  carries the edge, not the opening-range breakout itself.
- Verdict: plain ORB doesn't work. F (really "volume-surge breakout in an uptrend, hold to end of day") works on SOL/ETH/BTC
  and fails on XRP/ADA. It's fat-tailed (most profit comes from a few trend days) and was mildly selected (rank 12 of 5,400
  on pooled IS). Paper-watch candidate only.

## The 5 bot coins (SOL, ADA, NEAR, GALA, ZEC), Nov 12 2026
1m for GALA/ZEC built from the bulk archive (ZEC's two 2022 archive holes filled from the API, 0 gaps). Results: `deep-bots.json`.
- Plain ORB (A 1h NY, B 4h UTC0): about 0 on every bot coin (−0.07 to +0.07R/trade), no edge.
- F (1h UTC0 long + volume spike): SOL +0.47R, NEAR +0.17R; fails on ADA −0.03, ZEC −0.06 and GALA −0.27. Not general.
- **G** (4h London candle range, long only, close break, above VWAP, RVOL ≥1.5, room to yesterday's high, stop mid, 3R target, exit at next London open):
  positive on all 5 bot coins (SOL +0.09, ADA +0.09, NEAR +0.05, GALA +0.17, ZEC +0.02), and on BTC/ETH/XRP.
  ADA/NEAR/GALA/ZEC played no part in choosing it. Portfolio, 5 bot coins: 981 trades (13.5/mo), win 45%, +0.083R, +81.8R,
  max DD 25.4R, years +8 +9 −1 +16 +25 +13 +12. At 2× costs it drops to +0.03R and 2022/2026 turn negative.
  Caveat: every coin enters on the same London candle, so up to 5 (or 8) positions open at once, all correlated.

## G vs the live bots (Nov 12 2026), `compare-bots.js` → `compare-bots.txt`
Same coins (SOL, NEAR, ADA, GALA; T-CORE also ETH), Oct 20 2020 to Nov 10 2026. Bot trades come from `../zec-replacement-2/trades-fill.json`
(4h engine, so not the same fill model as G's 1m fills).
- Total R: BB-CORE +461, I-CORE +454, T-CORE +633, G +77. Avg R/trade 0.45 / 0.79 / 1.04 / 0.10. Max DD 27 / 24 / 35 / 22R.
- G never catches up: it's 6-8× smaller than each bot, every year.
- Monthly correlation with TRI-CORE 0.18, but G doesn't rescue bad months: in TRI-CORE's 27 losing months G made −8.3R in total.
- Account mix (month-end): TRI-CORE 50/25/25 +502%, DD 15.0%. 40/20/20/20 with G: +417%, DD 11.1% (return/DD 33.5 → 37.7).
  TRI-CORE + G on top at 15%: +514%, DD 14.3%. A marginal gain, mostly from lower risk per sleeve.
