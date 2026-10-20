# BB Breakout 4h on SOL / DOGE / ZEC — with real funding, year by year

Frozen settings (4h, Bollinger 20/2, close beyond a band in the direction of the 200 SMA, stop at the middle band, 3R target, exit after 48 bars). $5 risk per trade, 0.04% commission + 0.02% slippage, **plus actual Binance funding** for every funding event a trade was open through. Trades counted in the year they close. 2026 is to Oct 20.

## All three coins, with and without funding

| Year | Without funding | Funding paid/received | **With funding** | Trades | Positive? |
|---|---|---|---|---|---|
| 2020 (partial) | +$164 | −$10 | **+$154** | 80 | yes |
| 2021 | +$382 | −$26 | **+$356** | 168 | yes |
| 2022 | +$181 | −$7 | **+$174** | 169 | yes |
| 2023 | +$94 | −$4 | **+$90** | 171 | yes |
| 2024 | +$231 | −$9 | **+$222** | 157 | yes |
| 2025 | +$244 | +$1 | **+$244** | 156 | yes |
| 2026 (to Oct) | +$55 | −$2 | **+$53** | 139 | yes |
| **Total** | +$1352 | −$58 | **+$1294** | 1040 | 7 of 7 years |

## Each coin separately, with funding (profit; trades)

| Year | SOL | DOGE | ZEC |
|---|---|---|---|
| 2020 | +$11 (12) | +$74 (23) | +$69 (45) |
| 2021 | +$113 (55) | +$145 (61) | +$98 (52) |
| 2022 | +$72 (59) | +$50 (59) | +$52 (51) |
| 2023 | +$127 (51) | −$50 (63) | +$13 (57) |
| 2024 | +$46 (49) | +$76 (55) | +$100 (53) |
| 2025 | +$46 (53) | +$94 (51) | +$104 (52) |
| 2026 | +$18 (46) | −$10 (46) | +$45 (47) |
| **Total** | **+$432** | **+$381** | **+$481** |
| Years positive | 7 of 7 | 5 of 7 | 7 of 7 |

Funding paid per coin over the whole history ($5 risk): SOL −$23, DOGE −$16, ZEC −$19. Average funding is small because trades are short and funding can be received on the short side.

## Stress: costs ×2 / ×3 on top of funding (all three coins)

| Case | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Years positive |
|---|---|---|---|---|---|---|---|---|---|
| Base costs + funding | +$154 | +$356 | +$174 | +$90 | +$222 | +$244 | +$53 | +$1294 | 7 of 7 |
| Costs ×2 + funding | +$142 | +$343 | +$155 | +$61 | +$204 | +$227 | +$32 | +$1163 | 7 of 7 |
| Costs ×3 + funding | +$129 | +$329 | +$136 | +$32 | +$186 | +$210 | +$11 | +$1034 | 7 of 7 |

## Robustness: nudge every setting (243 variants, funding included)

Grid: Bollinger length 14/20/30 × σ 1.5/2/2.5 × trend SMA 100/200/300 × target 2/3/4R × time exit 24/48/none. Pooled SOL + DOGE + ZEC.

- Profitable in total: **243 of 243**
- Positive in all 7 years: **150 of 243** (62%)
- Positive in at least 6 of 7 years: **223 of 243** (92%)
- The frozen setting: 7 of 7 years positive, +$1294 total
- Median total across variants: +$892; worst variant: +$376; best: +$2022

Years-positive histogram: 7/7: 150 · 6/7: 73 · 5/7: 20 · 4/7: 0 · 3/7: 0 · 2/7: 0 · 1/7: 0 · 0/7: 0

| Setting | Variants positive in all 7 years / median total |
|---|---|
| n=14 | 41/81 all-years-positive, median +$976 |
| n=20 | 49/81 all-years-positive, median +$859 |
| n=30 | 60/81 all-years-positive, median +$874 |
| k=1.5 | 44/81 all-years-positive, median +$1163 |
| k=2 | 55/81 all-years-positive, median +$1001 |
| k=2.5 | 51/81 all-years-positive, median +$708 |
| trendN=100 | 59/81 all-years-positive, median +$913 |
| trendN=200 | 51/81 all-years-positive, median +$941 |
| trendN=300 | 40/81 all-years-positive, median +$830 |
| tp=2 | 39/81 all-years-positive, median +$804 |
| tp=3 | 63/81 all-years-positive, median +$934 |
| tp=4 | 48/81 all-years-positive, median +$1012 |
| maxBars=24 | 51/81 all-years-positive, median +$1019 |
| maxBars=48 | 65/81 all-years-positive, median +$1130 |
| maxBars=0 | 34/81 all-years-positive, median +$587 |

### Variants that failed at least one year (worst 8 by years positive)

| Setting (n, σ, trend, target, time exit) | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total |
|---|---|---|---|---|---|---|---|---|
| 30, 2, 300, 4R, none | +$30 | +$231 | +$29 | −$41 | −$3 | +$43 | +$86 | +$376 |
| 20, 2, 300, 2R, none | +$35 | +$146 | +$86 | −$3 | +$38 | +$157 | −$4 | +$456 |
| 14, 2.5, 200, 4R, none | −$9 | +$335 | +$68 | −$33 | +$62 | +$41 | +$4 | +$469 |
| 14, 2.5, 200, 3R, none | +$86 | +$247 | +$86 | −$43 | +$73 | +$75 | −$2 | +$523 |
| 14, 2.5, 300, 3R, none | +$77 | +$247 | +$103 | −$47 | +$93 | +$64 | −$2 | +$535 |
| 20, 1.5, 300, 4R, none | −$24 | +$271 | +$106 | −$44 | +$25 | +$157 | +$46 | +$535 |
| 30, 2.5, 200, 4R, none | −$5 | +$279 | +$24 | −$18 | +$127 | +$82 | +$55 | +$542 |
| 14, 2, 300, 2R, none | +$60 | +$136 | +$153 | −$53 | +$142 | +$151 | −$36 | +$553 |
