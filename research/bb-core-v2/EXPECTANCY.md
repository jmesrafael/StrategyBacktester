# Expectancy of bb-core — binance candles, net of fees/slippage/funding, $5 risked per trade (1R = $5)

**Expectancy = win% × avg win − loss% × avg loss = average R per trade.** 95% interval = bootstrap (4,000 resamples of the trades). P(E>0) = share of resamples with a positive average.

## 1. Per coin and portfolio

| | trades | win% | avg win | avg loss | payoff (win÷loss) | break-even win% | **expectancy** | $ per trade | 95% interval | P(E>0) | t-stat | trades/yr | R per year |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SOL | 309 | 38.5% | +2.38R | −0.93R | 2.55 | 28.2% | **+0.341R** | +$1.71 | +0.14 to +0.56 | 99.9% | 3.2 | 52 | +17.6 |
| ZEC | 332 | 39.5% | +2.41R | −0.98R | 2.45 | 29.0% | **+0.356R** | +$1.78 | +0.15 to +0.57 | 100.0% | 3.4 | 50 | +17.9 |
| NEAR | 298 | 38.3% | +2.21R | −0.95R | 2.32 | 30.1% | **+0.258R** | +$1.29 | +0.06 to +0.48 | 99.6% | 2.5 | 50 | +13.0 |
| ADA | 328 | 38.1% | +2.37R | −0.94R | 2.53 | 28.4% | **+0.322R** | +$1.61 | +0.12 to +0.53 | 100.0% | 3.1 | 50 | +16.0 |
| GALA | 243 | 40.3% | +2.29R | −0.95R | 2.42 | 29.3% | **+0.358R** | +$1.79 | +0.13 to +0.58 | 100.0% | 3.0 | 49 | +17.4 |
| **ALL 5 pooled** | 1510 | 38.9% | +2.34R | −0.95R | 2.46 | 28.9% | **+0.327R** | +$1.63 | +0.23 to +0.42 | 100.0% | 6.8 | 228 | +74.5 |

## 2. Gross vs net — how much do costs take per trade?

Gross = no fees, slippage or funding (an upper bound). Cost drag = gross − net. "Costs ×2/×3" = fees and slippage doubled/tripled (funding unchanged).

| | gross | net (real) | cost drag | costs ×2 | costs ×3 | drag as % of gross |
|---|---|---|---|---|---|---|
| SOL | +0.392R | **+0.341R** | −0.051R | +0.315R | +0.289R | 13% |
| ZEC | +0.395R | **+0.356R** | −0.039R | +0.331R | +0.305R | 10% |
| NEAR | +0.293R | **+0.258R** | −0.035R | +0.236R | +0.214R | 12% |
| ADA | +0.367R | **+0.322R** | −0.045R | +0.293R | +0.265R | 12% |
| GALA | +0.389R | **+0.358R** | −0.031R | +0.333R | +0.309R | 8% |
| **ALL 5** | +0.367R | **+0.327R** | −0.041R | +0.301R | +0.276R | 11% |

## 3. Where the expectancy comes from (all 5 coins pooled)

| exit | trades | share | win% | avg R | contribution to total R |
|---|---|---|---|---|---|
| target | 242 | 16% | 100% | +3.933R | +951.8R (193%) |
| stop | 815 | 54% | 0% | -1.033R | -841.5R (-171%) |
| time | 453 | 30% | 76% | +0.845R | +382.9R (78%) |

| direction | trades | win% | expectancy | 95% interval |
|---|---|---|---|---|
| long | 752 | 35.8% | **+0.288R** | +0.15 to +0.42 |
| short | 758 | 42.0% | **+0.365R** | +0.24 to +0.50 |

## 4. Expectancy by year (pooled, 5 coins)

| year | trades | win% | expectancy | 95% interval |
|---|---|---|---|---|
| 2020 | 100 | 36% | **+0.417R** | +0.03 to +0.81 |
| 2021 | 221 | 41% | **+0.532R** | +0.27 to +0.80 |
| 2022 | 231 | 43% | **+0.292R** | +0.08 to +0.51 |
| 2023 | 252 | 36% | **+0.243R** | +0.02 to +0.48 |
| 2024 | 253 | 38% | **+0.313R** | +0.09 to +0.54 |
| 2025 | 241 | 39% | **+0.338R** | +0.10 to +0.58 |
| 2026 | 212 | 38% | **+0.211R** | -0.03 to +0.45 |

## 5. How much data to trust it?

Pooled: expectancy +0.327R, standard deviation of one trade 1.86R. Trades needed for a t-stat of 2 on the pooled number: about 130. We have 1510.
- SOL: 309 trades, needs about 119 for t=2 (t-stat now 3.2), P(expectancy > 0) = 99.9%
- ZEC: 332 trades, needs about 115 for t=2 (t-stat now 3.4), P(expectancy > 0) = 100.0%
- NEAR: 298 trades, needs about 197 for t=2 (t-stat now 2.5), P(expectancy > 0) = 99.6%
- ADA: 328 trades, needs about 136 for t=2 (t-stat now 3.1), P(expectancy > 0) = 100.0%
- GALA: 243 trades, needs about 108 for t=2 (t-stat now 3.0), P(expectancy > 0) = 100.0%

Losing-streak odds (pooled win rate 38.9%, independent trades): chance that a run of N losers occurs somewhere in the next 100 trades
- 5 losers in a row: 98%
- 8 losers in a row: 54%
- 10 losers in a row: 23%
- 12 losers in a row: 9%

## 6. Do the "improved" variants have a real expectancy difference? (SOL, then all 5 pooled)

If the 95% intervals overlap heavily, the difference could be luck.

| variant | coins | trades | expectancy | 95% interval | total R |
|---|---|---|---|---|---|
| bb-core | SOL | 309 | **+0.341R** | +0.14 to +0.56 | +105.4R |
| bb-core | all 5 | 1510 | **+0.327R** | +0.23 to +0.42 | +493.2R |
| hold 96 candles | SOL | 245 | **+0.540R** | +0.28 to +0.82 | +132.2R |
| hold 96 candles | all 5 | 1235 | **+0.417R** | +0.30 to +0.53 | +514.6R |
| breakout ≥0.5 ATR | SOL | 171 | **+0.674R** | +0.38 to +0.95 | +115.3R |
| breakout ≥0.5 ATR | all 5 | 861 | **+0.365R** | +0.24 to +0.48 | +314.0R |
| breakout ≥0.5 ATR + 2-ATR stop + 96 | SOL | 181 | **+0.698R** | +0.37 to +1.04 | +126.3R |
| breakout ≥0.5 ATR + 2-ATR stop + 96 | all 5 | 888 | **+0.429R** | +0.29 to +0.57 | +380.6R |
