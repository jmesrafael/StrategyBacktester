# BB Breakout — fine-tuned for the 2h chart, per coin

MEXC fees (SOL 0.05%, DOGE / ZEC 0%) + 0.02% slippage per side, Binance 2h candles, $1 risk per trade (so $ = R). **TRAIN** 2021–2023 was used to choose; **TEST** 2024 → Oct 20 2026 was not. 3072 settings tried (49 s). Funding not included.

- **Baseline** (the 4h settings as-is): BB 20/2, trend 200, target 3R, exit 48, stop middle band
- **Tuned, one setting for all three coins** (best plateau where the WORST coin is still good): BB 20/2.5, trend 400, target 5R, exit 48, stop middle band
- **Tuned for SOL only**: BB 30/1.5, trend 100, target 4R, exit 48, stop 2.5×ATR
- **Tuned for DOGE only**: BB 14/1.5, trend 200, target 5R, exit 48, stop middle band
- **Tuned for ZEC only**: BB 20/2.5, trend 400, target 5R, exit 48, stop middle band

## SOL

| Version | Train trades | Train $ | Train max DD | **Test trades** | **Test $** | **Test max DD** | Test avg R | Test win % |
|---|---|---|---|---|---|---|---|---|
| 2h baseline (4h settings on 2h) | 330 | +$69.27 | −$16.56 | 308 | **+$14.53** | **−$23.48** | +0.05 | 34% |
| 2h tuned — shared setting | 179 | +$71.58 | −$12.75 | 167 | **+$2.74** | **−$15.88** | +0.02 | 33% |
| 2h tuned for SOL only | 342 | +$122.11 | −$9.70 | 329 | **+$1.86** | **−$21.72** | +0.01 | 35% |
| **4h as you have it now** (reference) | 166 | +$64.51 | −$10.90 | 147 | **+$22.88** | **−$12.38** | +0.16 | 37% |

**SOL year by year** ($1 risk; max drawdown inside the year in brackets)

| Year | 2h baseline | 2h tuned — shared | 2h tuned for SOL | 4h now |
|---|---|---|---|---|
| 2021 (train) | +$19.26 (−$11.0) | +$16.23 (−$8.9) | +$33.38 (−$9.7) | +$25.60 (−$8.2) |
| 2022 (train) | +$13.24 (−$16.6) | +$8.98 (−$11.3) | +$30.96 (−$6.4) | +$12.70 (−$10.9) |
| 2023 (train) | +$36.77 (−$8.9) | +$46.38 (−$4.1) | +$57.77 (−$9.2) | +$26.21 (−$7.2) |
| 2024 (test) | +$6.24 (−$7.9) | +$1.24 (−$10.3) | −$2.30 (−$11.1) | +$10.05 (−$6.6) |
| 2025 (test) | +$12.42 (−$12.2) | +$4.19 (−$11.2) | +$2.20 (−$14.1) | +$9.18 (−$8.3) |
| 2026 (test) | −$4.12 (−$23.5) | −$2.68 (−$15.9) | +$1.95 (−$21.7) | +$3.65 (−$9.5) |

## DOGE

| Version | Train trades | Train $ | Train max DD | **Test trades** | **Test $** | **Test max DD** | Test avg R | Test win % |
|---|---|---|---|---|---|---|---|---|
| 2h baseline (4h settings on 2h) | 344 | +$92.04 | −$15.36 | 335 | **+$26.01** | **−$31.15** | +0.08 | 34% |
| 2h tuned — shared setting | 202 | +$61.34 | −$14.05 | 169 | **+$26.66** | **−$12.25** | +0.16 | 37% |
| 2h tuned for DOGE only | 465 | +$154.82 | −$17.97 | 442 | **+$74.13** | **−$56.41** | +0.17 | 28% |
| **4h as you have it now** (reference) | 183 | +$34.49 | −$14.03 | 152 | **+$35.57** | **−$10.59** | +0.23 | 41% |

**DOGE year by year** ($1 risk; max drawdown inside the year in brackets)

| Year | 2h baseline | 2h tuned — shared | 2h tuned for DOGE | 4h now |
|---|---|---|---|---|
| 2021 (train) | +$57.72 (−$6.3) | +$54.52 (−$8.9) | +$76.03 (−$12.5) | +$33.22 (−$6.5) |
| 2022 (train) | +$32.12 (−$8.4) | +$0.24 (−$9.0) | +$47.43 (−$18.0) | +$8.23 (−$14.0) |
| 2023 (train) | +$2.20 (−$15.4) | +$6.58 (−$12.1) | +$31.36 (−$10.9) | −$6.96 (−$11.9) |
| 2024 (test) | +$31.47 (−$10.6) | +$11.02 (−$10.5) | +$68.48 (−$9.6) | +$16.74 (−$5.8) |
| 2025 (test) | +$2.43 (−$11.2) | +$12.93 (−$7.9) | +$30.73 (−$12.8) | +$18.64 (−$6.0) |
| 2026 (test) | −$7.89 (−$31.1) | +$2.72 (−$8.4) | −$25.08 (−$56.4) | +$0.19 (−$10.6) |

## ZEC

| Version | Train trades | Train $ | Train max DD | **Test trades** | **Test $** | **Test max DD** | Test avg R | Test win % |
|---|---|---|---|---|---|---|---|---|
| 2h baseline (4h settings on 2h) | 334 | +$33.10 | −$33.86 | 319 | **+$42.44** | **−$9.54** | +0.13 | 36% |
| 2h tuned — shared setting | 166 | +$50.92 | −$12.00 | 172 | **+$48.06** | **−$9.21** | +0.28 | 42% |
| 2h tuned for ZEC only | 166 | +$50.92 | −$12.00 | 172 | **+$48.06** | **−$9.21** | +0.28 | 42% |
| **4h as you have it now** (reference) | 161 | +$40.67 | −$14.09 | 151 | **+$48.67** | **−$8.76** | +0.32 | 42% |

**ZEC year by year** ($1 risk; max drawdown inside the year in brackets)

| Year | 2h baseline | 2h tuned — shared | 2h tuned for ZEC | 4h now |
|---|---|---|---|---|
| 2021 (train) | +$41.57 (−$5.2) | +$32.87 (−$5.3) | +$32.87 (−$5.3) | +$23.50 (−$3.0) |
| 2022 (train) | +$20.61 (−$7.3) | +$18.79 (−$7.0) | +$18.79 (−$7.0) | +$9.07 (−$6.7) |
| 2023 (train) | −$29.08 (−$31.3) | −$0.74 (−$12.0) | −$0.74 (−$12.0) | +$8.10 (−$7.4) |
| 2024 (test) | +$13.13 (−$8.2) | +$20.46 (−$7.1) | +$20.46 (−$7.1) | +$17.17 (−$6.0) |
| 2025 (test) | +$18.00 (−$9.3) | +$25.12 (−$9.2) | +$25.12 (−$9.2) | +$23.15 (−$5.8) |
| 2026 (test) | +$11.30 (−$9.5) | +$2.48 (−$6.0) | +$2.48 (−$6.0) | +$8.35 (−$8.8) |

## Is the shared setting a plateau? Its neighbours (one step on any axis) on the TEST years

| Coin | Neighbours positive on test | Median neighbour test $ | Shared setting test $ |
|---|---|---|---|
| SOL | 9 of 9 | +$12.80 | +$2.74 |
| DOGE | 9 of 9 | +$25.75 | +$26.66 |
| ZEC | 9 of 9 | +$53.86 | +$48.06 |

## How many of all 3072 settings were profitable on TEST, per coin

- SOL: 2829 of 3072 profitable on test; median +$20.05
- DOGE: 2850 of 3072 profitable on test; median +$34.58
- ZEC: 3041 of 3072 profitable on test; median +$46.96

## SNDK (SanDisk stock perpetual) — not used for tuning

Binance SNDKUSDT 15m data only exists from 2026-04-07, so after the indicator warm-up there are about 5–6 months of trades. MEXC fees for SNDKSTOCK_USDT: 0.04% taker / 0.01% maker (0.04% used on both sides) + 0.02% slippage. **Far too little history to judge** — read this as a first look only. Note: the underlying stock only trades in US market hours, so the perpetual can gap at the US open and drift on weekends.

| Version | Trades | $ ($1 risk) | Max DD | Avg R | Win % | First trade |
|---|---|---|---|---|---|---|
| 2h baseline (4h settings on 2h) | 55 | **+$15.11** | −$6.90 | +0.27 | 42% | 2026-04-24 |
| 2h tuned — shared setting | 27 | **+$18.82** | −$3.20 | +0.70 | 48% | 2026-05-17 |
| 4h as you have it now | 23 | **+$11.57** | −$3.45 | +0.50 | 43% | 2026-05-21 |

**SNDK month by month** ($1 risk; trades in brackets)

| Month | 2h baseline | 2h tuned — shared | 4h now |
|---|---|---|---|
| 2026-04 | +$2.95 (1) | · | · |
| 2026-05 | −$1.40 (9) | +$3.73 (4) | +$0.97 (2) |
| 2026-06 | −$1.54 (12) | −$0.04 (5) | −$1.11 (5) |
| 2026-07 | +$8.20 (7) | +$11.15 (5) | +$5.26 (4) |
| 2026-08 | +$1.68 (11) | +$0.83 (6) | +$2.19 (3) |
| 2026-09 | +$1.78 (10) | +$0.46 (4) | +$0.88 (3) |
| 2026-10 | +$3.43 (5) | +$2.70 (3) | +$3.37 (6) |
