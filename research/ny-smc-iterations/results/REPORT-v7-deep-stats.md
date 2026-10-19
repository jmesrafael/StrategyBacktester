# NY SMC v7: deep statistics (5 years, $1 risk per trade)

*Bybit 15m, SOL + ETH, 18 Oct 2021 – 17 Oct 2026, 270 trades, fees included, rules frozen. `node deep.js` → `results/deep-stats.json`. Run 2026-10-19.*

## 1. Data source check: MEXC vs Bybit
MEXC has 15m candles only from 23 Oct 2025, so it can only check the last year.

| Coin | MEXC trades / P&L | Bybit trades / P&L | Same trade on both | Same outcome |
|---|---|---|---|---|
| SOL | 26 / +$14.68 | 24 / +$11.72 | 22 | 22 |
| ETH | 28 / +$14.33 | 29 / +$17.58 | 24 | 23 |
| Both | 54 / **+$29.01** | 53 / **+$29.30** | 46 | 45 |

The data source makes almost no difference. The 5-year analysis uses Bybit.

## 2. Core numbers (1R = $1)

| Period | Coin | Trades | Total | Avg per trade | 95% range of avg | t-stat | PF | 3R target hit | Max DD | Worst run |
|---|---|---|---|---|---|---|---|---|---|---|
| 2021–23 | SOL | 50 | −$14.48 | −0.29R | −0.57 … +0.03 | −1.93 | 0.45 | 8% | 14.5R | 18 |
| 2021–23 | ETH | 66 | +$2.10 | +0.03R | −0.30 … +0.38 | 0.18 | 1.06 | 18% | 6.0R | 9 |
| 2021–23 | Both | 116 | −$12.38 | −0.11R | −0.34 … +0.14 | −0.88 | 0.79 | 14% | 14.5R | 15 |
| 2023–26 | SOL | 79 | +$36.71 | +0.47R | +0.12 … +0.82 | 2.63 | 2.43 | 27% | 4.3R | 8 |
| 2023–26 | ETH | 75 | +$50.85 | +0.68R | +0.30 … +1.07 | 3.42 | 2.95 | 35% | 6.9R | 9 |
| 2023–26 | Both | 154 | +$87.56 | +0.57R | +0.32 … +0.83 | 4.30 | 2.69 | 31% | 5.7R | 8 |
| 5 years | SOL | 129 | +$22.23 | +0.17R | −0.06 … +0.43 | 1.36 | 1.43 | 19% | 14.5R | 18 |
| 5 years | ETH | 141 | +$52.95 | +0.38R | +0.11 … +0.64 | 2.74 | 1.89 | 27% | 6.9R | 9 |
| 5 years | Both | 270 | +$75.18 | +0.28R | +0.10 … +0.46 | 2.97 | 1.67 | 23% | 15.6R | 15 |

## 3. What decides profit: how often the 3R target is hit
The size of each outcome is the same in both periods. Only how often each one happens changes.

| Outcome | Size | Share 2021–23 | Share 2023–26 |
|---|---|---|---|
| 3R target | +2.96R | 14% | **31%** |
| Breakeven | −0.06R | 28% | 34% |
| Cut at −0.5R | −0.53R | 24% | 12% |
| Full stop | −1.10R | 34% | 23% |

- Break-even target-hit rate: about **15–17%**.
- 2021–23 was at 14%, just below it. 2023–26 was at 31%, about double.
- **This is the number to watch when paper trading.**

## 4. What does NOT explain the 2021–23 failure
- **Volatility.** Median ATR at entry was 0.64% before vs 0.60% after. Every volatility band did worse in 2021–23.
- **Direction.** Longs and shorts both lost before 2023 and both won after (post: long +0.63R/trade, short +0.50R/trade).
- **Time window.** Both windows work after 2023. Before, 08:30–09:30 was flat and 10:30–11:30 lost (−0.25R/trade).
- **Day of week.** Mixed and small samples. Don't filter on it.
- **Chance.** A permutation test says the before/after difference is not noise (p < 0.001). The market behaved differently for this setup.

## 5. Recent trend
The rolling 12-month P&L has been positive every month since Feb 2024. It peaked at +$48.8 (to Jun 2026) and has since fallen to +$26.1 (to Sep 2026), after a weak Jul–Sep 2026 (−$2.09, +$1.69, −$1.76). That is still positive and within normal noise, but worth watching.

## 6. Next 12 months, simulated ($1 risk, ~54 trades)

| If the future looks like | Worst 5% | Median | Best 5% | Chance of a losing year | Typical DD | Bad-case DD (95th) |
|---|---|---|---|---|---|---|
| 2023–26 | +$11 | +$31 | +$50 | 0.3% | 4.5R | 8.4R |
| The full 5 years (good + bad) | −$3 | +$15 | +$35 | 9% | 6.4R | 12.7R |
| 2021–23 | about −$6 per year (from the actual record) | | | | | |

## 7. Bottom line
- **2023–26 is statistically strong** (t = 4.3, 95% range of the average fully above zero). It still holds even after a rough allowance for choosing v7 out of about 200 variants.
- **All 5 years together are still positive** (t ≈ 3.0), mostly thanks to ETH. On its own, SOL over 5 years is not clearly positive.
- **It depends on the market regime.** The edge shows up as a high 3R target-hit rate, and in 2021–23 that rate was too low. The cause is not volatility, direction or time of day, and is still not identified.
- **Monitoring rule:**
  - After 40 paper or live trades, a 3R target-hit rate of **25–35%** is consistent with the backtest.
  - **Under 17%** means the 2021–23 behaviour is back. Stop.
