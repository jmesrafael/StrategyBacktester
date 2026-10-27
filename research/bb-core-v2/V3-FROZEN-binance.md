# bb-core vs up to 2 positions per coin — binance candles, $5 per position

"bb-core ×2 risk" = the same bb-core trades with every trade sized double (R and drawdown exactly double): the honest benchmark, since two positions risk about twice as much.

| coin | | trades | total R | total $ | win rate | max drawdown | return ÷ drawdown | most open | R ≤2023 | R ≥2024 | yrs+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SOL | bb-core | 309 | **+105.4R** | **+$527** | 38.5% | 12.8R | 8.3 | 1 | +78.6 | +26.8 | 7/7 |
|  | bb-core ×2 risk | 309 | **+210.8R** | **+$1,054** | 38.5% | 25.5R | 8.3 | (1 at 2× size) | +157.3 | +53.6 | 7/7 |
|  | **2 positions** | 541 | **+212.4R** | **+$1,062** | 41.4% | 20.4R | 10.4 | 2 | +158.6 | +53.8 | 7/7 |
| ZEC | bb-core | 332 | **+118.3R** | **+$592** | 39.5% | 15.6R | 7.6 | 1 | +58.4 | +60.0 | 7/7 |
|  | bb-core ×2 risk | 332 | **+236.7R** | **+$1,183** | 39.5% | 31.1R | 7.6 | (1 at 2× size) | +116.7 | +119.9 | 7/7 |
|  | **2 positions** | 592 | **+198.3R** | **+$992** | 39.2% | 30.5R | 6.5 | 2 | +100.7 | +97.6 | 7/7 |
| NEAR | bb-core | 298 | **+76.9R** | **+$385** | 38.3% | 11.1R | 6.9 | 1 | +40.7 | +36.2 | 7/7 |
|  | bb-core ×2 risk | 298 | **+153.8R** | **+$769** | 38.3% | 22.2R | 6.9 | (1 at 2× size) | +81.5 | +72.3 | 7/7 |
|  | **2 positions** | 520 | **+132.7R** | **+$663** | 39.8% | 18.7R | 7.1 | 2 | +74.4 | +58.3 | 6/7 |
| ADA | bb-core | 328 | **+105.6R** | **+$528** | 38.1% | 12.7R | 8.3 | 1 | +74.3 | +31.3 | 7/7 |
|  | bb-core ×2 risk | 328 | **+211.3R** | **+$1,056** | 38.1% | 25.4R | 8.3 | (1 at 2× size) | +148.7 | +62.6 | 7/7 |
|  | **2 positions** | 592 | **+146.3R** | **+$732** | 37.2% | 22.7R | 6.4 | 2 | +103.6 | +42.7 | 7/7 |
| GALA | bb-core | 243 | **+86.9R** | **+$435** | 40.3% | 10.9R | 8.0 | 1 | +35.8 | +51.1 | 6/6 |
|  | bb-core ×2 risk | 243 | **+173.8R** | **+$869** | 40.3% | 21.8R | 8.0 | (1 at 2× size) | +71.6 | +102.2 | 6/6 |
|  | **2 positions** | 425 | **+159.6R** | **+$798** | 42.1% | 20.0R | 8.0 | 2 | +71.9 | +87.7 | 6/6 |
| **ALL 5** | bb-core | 1510 | **+493.2R** | **+$2,466** | 38.9% | 25.6R | 19.3 | 5 | +287.9 | +205.3 | 7/7 |
|  | bb-core ×2 risk | 1510 | **+986.4R** | **+$4,932** | 38.9% | 51.2R | 19.3 | (1 at 2× size) | +575.8 | +410.7 | 7/7 |
|  | **2 positions** | 2670 | **+849.2R** | **+$4,246** | 39.8% | 44.5R | 19.1 | 10 | +509.2 | +340.1 | 7/7 |

## Verdict per coin

| coin | extra R vs bb-core | extra R vs ×2 risk | drawdown vs ×2 risk | efficiency (R per 100 position-candles) | beats bb-core? | beats ×2 risk? |
|---|---|---|---|---|---|---|
| SOL | +107.0R | +1.6R | -5.1R | 1.30 → 1.43 | yes | yes |
| ZEC | +80.0R | -38.4R | -0.6R | 1.40 → 1.27 | yes | NO |
| NEAR | +55.8R | -21.2R | -3.5R | 0.98 → 0.91 | yes | NO |
| ADA | +40.7R | -65.0R | -2.7R | 1.18 → 0.89 | yes | NO |
| GALA | +72.6R | -14.3R | -1.8R | 1.29 → 1.30 | yes | NO |
| ALL | +356.0R | -137.2R | -6.7R | 1.23 → 1.15 | yes | NO |

More total R than bb-core on 5 of 5 coins; more than bb-core at double risk on 1 of 5 coins.

## All 5 coins, return per year, R (bb-core → bb-core ×2 → 2 positions)

| | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | total |
|---|---|---|---|---|---|---|---|---|
| R | +41.7 → +83.4 → +61.4 | +117.5 → +235.1 → +200.6 | +67.4 → +134.8 → +122.8 | +61.2 → +122.5 → +124.4 | +79.1 → +158.3 → +150.5 | +81.4 → +162.8 → +109.5 | +44.8 → +89.7 → +80.0 | **+493.2 → +986.4 → +849.2** |
