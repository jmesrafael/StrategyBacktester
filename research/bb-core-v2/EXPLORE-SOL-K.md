# bb-core v2 — trying to beat the baseline on SOL (binance, costs x1)
Baseline bb-core: 309 trades, +105.4R, avg +0.341R, maxDD 12.8R, ≤2023 +78.6R (167 trades), ≥2024 +26.8R (142 trades)

## K. Pre-written combinations, stress-tested
R/DD = total R divided by max drawdown (return per unit of pain). "MEXC" = same rules on MEXC candles (a second, partly independent price history). Costs ×2 = fees and slippage doubled.

| config | trades | total R | maxDD R | R/DD | R ≤2023 | R ≥2024 | MEXC R (baseline-relative) | MEXC maxDD | costs ×2 R |
|---|---|---|---|---|---|---|---|---|---|
| baseline | 309 | **+105.4** | 12.8 | 8.3 | +78.6 | +26.8 | +104.5 (+0.0) | 10.8 | +97.2 |
| breakout ≥0.5 ATR | 171 | **+115.3** | 6.8 | 17.0 | +72.2 | +43.1 | +113.2 (+8.6) | 6.8 | +111.8 |
| maxBars 96 | 245 | **+132.2** | 10.2 | 12.9 | +86.8 | +45.5 | +127.9 (+23.3) | 10.2 | +125.9 |
| breakout ≥0.5 ATR + maxBars 96 | 149 | **+116.9** | 7.2 | 16.1 | +75.6 | +41.4 | +112.9 (+8.4) | 7.2 | +114.0 |
| breakout ≥0.25 ATR + maxBars 96 | 196 | **+112.4** | 12.1 | 9.3 | +79.1 | +33.3 | +106.9 (+2.3) | 12.1 | +107.9 |
| breakout ≥0.5 ATR + maxBars 96 + target 6R | 134 | **+102.8** | 7.4 | 14.0 | +76.6 | +26.1 | +84.2 (-20.3) | 7.3 | +99.9 |
| stop 2 ATR, target 4R | 309 | **+122.3** | 9.2 | 13.3 | +82.1 | +40.2 | +111.5 (+6.9) | 10.2 | +114.5 |
| stop 2 ATR, target 4R + maxBars 96 | 277 | **+127.9** | 10.2 | 12.5 | +82.9 | +45.0 | +110.9 (+6.4) | 11.3 | +121.1 |
| breakout ≥0.5 ATR + stop 2 ATR, target 4R + maxBars 96 | 181 | **+126.3** | 7.4 | 17.2 | +70.3 | +56.1 | +117.1 (+12.6) | 8.0 | +121.9 |

### Year by year (R)
| config | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| baseline | +6.0 | +26.7 | +12.9 | +32.9 | +8.5 | +8.1 | +10.2 |
| breakout ≥0.5 ATR | +1.1 | +29.0 | +12.8 | +29.4 | +14.8 | +15.3 | +13.0 |
| maxBars 96 | +10.8 | +23.2 | +22.0 | +30.8 | +15.7 | +17.3 | +12.4 |
| breakout ≥0.5 ATR + maxBars 96 | +5.2 | +27.4 | +16.5 | +26.5 | +17.5 | +13.0 | +10.9 |
| breakout ≥0.25 ATR + maxBars 96 | +7.9 | +30.5 | +11.6 | +29.1 | +14.9 | +8.4 | +10.0 |
| breakout ≥0.5 ATR + maxBars 96 + target 6R | +1.0 | +37.6 | +17.9 | +20.1 | +17.2 | -0.5 | +9.4 |
| stop 2 ATR, target 4R | +8.3 | +27.6 | +10.7 | +35.5 | +13.1 | +17.1 | +10.0 |
| stop 2 ATR, target 4R + maxBars 96 | +4.4 | +25.5 | +18.3 | +34.8 | +11.8 | +18.0 | +15.1 |
| breakout ≥0.5 ATR + stop 2 ATR, target 4R + maxBars 96 | -4.4 | +32.1 | +15.2 | +27.4 | +22.2 | +16.0 | +17.9 |
