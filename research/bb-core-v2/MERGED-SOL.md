# Merged bb-core + EMA 20/100 — SOL, binance 4h candles, real fees/slippage/funding, 2020–2026

R = profit in multiples of the amount risked per trade (×$5 for dollars at $5 risk). **Bold** = losing year. "two" runs both parents at 1R each (up to 2R at risk at once); "twoHalf" halves each; the single-slot merges risk 1R at a time like bb-core.

## 1. Every year

| strategy | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | **total R** | trades | win% | E per trade | max DD | R÷DD | +yrs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| bb-core (parent) | +6.0 | +26.7 | +12.9 | +32.9 | +8.5 | +8.1 | +10.2 | **+105.4** | 309 | 39% | +0.341 | 12.8 | 8.3 | 7/7 |
| EMA 20/100 (parent) | **-3.1** | +63.7 | +7.1 | **-3.6** | +100.4 | +2.6 | **-0.8** | **+166.2** | 119 | 30% | +1.397 | 18.3 | 9.1 | 4/7 |
| TWO slots side by side, 1R each | +2.9 | +90.4 | +20.0 | +29.4 | +108.9 | +10.7 | +9.4 | **+271.6** | 428 | 36% | +0.635 | 24.6 | 11.0 | 7/7 |
| TWO slots side by side, ½R each | +1.4 | +45.2 | +10.0 | +14.7 | +54.5 | +5.4 | +4.7 | **+135.8** | 428 | 36% | +0.317 | 12.3 | 11.0 | 7/7 |
| MERGED one slot (first trigger wins) | +1.3 | +24.6 | +10.0 | +27.6 | +3.5 | +14.7 | +7.2 | **+89.0** | 306 | 35% | +0.291 | 11.5 | 7.7 | 7/7 |
| MERGED + bb only with EMA regime | +0.4 | +23.8 | +1.9 | +22.8 | **-2.3** | +7.6 | +3.7 | **+58.0** | 258 | 34% | +0.225 | 18.3 | 3.2 | 6/7 |
| MERGED + ride (bb with regime → hold to flip) | **-5.5** | +111.6 | +8.7 | **-3.8** | +74.3 | +17.0 | +8.3 | **+210.5** | 214 | 31% | +0.984 | 13.6 | 15.4 | 5/7 |
| MERGED ride, skip bb against regime | **-2.7** | +116.4 | +2.8 | **-4.8** | +71.6 | +9.1 | **-0.0** | **+192.2** | 163 | 29% | +1.179 | 23.1 | 8.3 | 4/7 |

## 2. Which trigger made the money (inside each merged strategy)

| strategy | trigger | trades | win% | E per trade | total R | avg candles held |
|---|---|---|---|---|---|---|
| TWO slots side by side, 1R each | bb | 309 | 39% | +0.341 | +105.4 | 26 |
| TWO slots side by side, 1R each | ema | 119 | 30% | +1.397 | +166.2 | 68 |
| TWO slots side by side, ½R each | bb | 309 | 39% | +0.171 | +52.7 | 26 |
| TWO slots side by side, ½R each | ema | 119 | 30% | +0.698 | +83.1 | 68 |
| MERGED one slot (first trigger wins) | bb | 243 | 41% | +0.437 | +106.1 | 27 |
| MERGED one slot (first trigger wins) | ema | 63 | 13% | -0.272 | -17.1 | 46 |
| MERGED + bb only with EMA regime | bb | 166 | 37% | +0.287 | +47.6 | 27 |
| MERGED + bb only with EMA regime | ema | 92 | 27% | +0.114 | +10.4 | 61 |
| MERGED + ride (bb with regime → hold to flip) | bb | 74 | 50% | +0.639 | +47.3 | 32 |
| MERGED + ride (bb with regime → hold to flip) | bb-ride | 101 | 23% | +1.730 | +174.7 | 69 |
| MERGED + ride (bb with regime → hold to flip) | ema | 39 | 15% | -0.295 | -11.5 | 46 |
| MERGED ride, skip bb against regime | bb-ride | 95 | 27% | +1.939 | +184.2 | 76 |
| MERGED ride, skip bb against regime | ema | 68 | 32% | +0.118 | +8.0 | 61 |

## 3. Robustness

| strategy | E 2020–22 | E 2023+ | MEXC candles: total R / DD | 2× costs: total R | trades/yr | avg open positions |
|---|---|---|---|---|---|---|
| bb-core (parent) | +0.368 | +0.324 | +104.5 / 10.8 | +97.2 | 51 | 0.61 |
| EMA 20/100 (parent) | +1.716 | +1.241 | +173.5 / 18.3 | +162.1 | 20 | 0.61 |
| TWO slots side by side, 1R each | +0.696 | +0.598 | +278.0 / 20.7 | +259.3 | 71 | 1.22 |
| TWO slots side by side, ½R each | +0.348 | +0.299 | +139.0 / 10.3 | +129.7 | 71 | 1.22 |
| MERGED one slot (first trigger wins) | +0.294 | +0.289 | +88.6 / 11.6 | +80.9 | 51 | 0.72 |
| MERGED + bb only with EMA regime | +0.275 | +0.197 | +65.2 / 14.3 | +51.3 | 43 | 0.76 |
| MERGED + ride (bb with regime → hold to flip) | +1.463 | +0.709 | +207.8 / 13.7 | +203.9 | 36 | 0.84 |
| MERGED ride, skip bb against regime | +2.066 | +0.715 | +191.3 / 23.0 | +187.1 | 27 | 0.86 |

## 4. Checks

- Parity: mode bb = bb-core engine → IDENTICAL (309 trades); mode ema = EMA 20/100 engine → IDENTICAL (119 trades).
- "two" total +271.6R vs the two parents added at full size +271.6R → match.
- No look-ahead: 2808 truncation points across 8 modes → PASS (every truncated run equals the full run up to that point).
