# Month-end clean-out against no interference (all three bots, live coins, v3 rules, to Nov 25 2026)

R = the amount risked on one trade. "Value" counts closed trades plus open trades marked at the last price.

## Every month end of 2025: clean out once, then leave the bots alone

| Month end | Month gain (value) | Open trades | Open profit at month end | Same trades, final result if left | Clean-out vs as is: +1 month | +2 months | +3 months | Whole history |
|---|---|---|---|---|---|---|---|---|
| 2025-01 | −31.0 | 9 | +7.8 | +37.2 | −11.8 | −11.8 | −11.8 | −11.8 |
| 2025-02 | +61.5 | 18 | +36.4 | +22.7 | +7.4 | +10.8 | +10.8 | +10.8 |
| 2025-03 | −8.7 | 18 | +34.3 | +31.5 | +6.4 | +6.2 | +6.2 | +6.2 |
| 2025-04 | −2.1 | 3 | +11.0 | +8.6 | +1.3 | +2.7 | +2.7 | +2.7 |
| 2025-05 | +26.0 | 14 | +39.3 | +33.9 | −6.7 | −6.3 | −6.3 | −6.3 |
| 2025-06 | −9.9 | 7 | +2.1 | −4.3 | +1.7 | +1.7 | +1.7 | +1.7 |
| 2025-07 | +42.9 | 9 | +37.4 | +46.0 | −3.9 | −3.3 | −3.3 | −3.3 |
| 2025-08 | −10.3 | 10 | +45.0 | +42.0 | +2.5 | +2.5 | +2.5 | +2.5 |
| 2025-09 | +23.3 | 12 | +33.4 | +385.2 | −251.4 | −310.4 | −310.4 | −310.4 |
| 2025-10 | +306.7 | 19 | +333.9 | +425.8 | −102.9 | −103.4 | −103.9 | −103.9 |
| 2025-11 | +124.6 | 11 | +32.3 | +30.2 | −23.0 | −6.1 | −6.1 | −6.1 |
| 2025-12 | −6.8 | 12 | +45.4 | +28.1 | +26.1 | +26.1 | +26.1 | +26.1 |
| **Total** | +516.1 | 142 | +658.2 | +1086.7 | −354.3 | −391.2 | −391.7 | −391.7 |

## Example: end of 2025-10

### The trades that were open

| Bot | Coin | Side | Opened | Closed at month end (R) | If left alone (R) | Left alone until | Difference |
|---|---|---|---|---|---|---|---|
| T-CORE | ZEC | long | 2025-09-06 | +193.9 | +239.3 | 2025-11-29 | −45.4 |
| I-CORE | ZEC | long | 2025-09-23 | +110.6 | +147.9 | 2025-11-25 | −37.4 |
| BB-CORE | ADA | short | 2025-10-29 | +1.6 | +5.3 | 2025-11-05 | −3.7 |
| BB-CORE | GALA | short | 2025-10-29 | +1.2 | +4.4 | 2025-11-05 | −3.1 |
| I-CORE | GALA | short | 2025-10-29 | +1.1 | +1.0 | 2025-11-07 | +0.1 |
| BB-CORE | SOL | short | 2025-10-29 | +0.7 | +5.0 | 2025-11-06 | −4.3 |
| BB-CORE | NEAR | short | 2025-10-30 | +0.5 | +2.0 | 2025-11-06 | −1.5 |
| I-CORE | NEAR | short | 2025-10-30 | +0.5 | +1.0 | 2025-11-07 | −0.5 |
| T-CORE | NEAR | short | 2025-10-30 | +0.4 | −1.0 | 2025-11-07 | +1.5 |
| I-CORE | ADA | short | 2025-10-30 | +0.6 | +1.0 | 2025-11-10 | −0.4 |
| BB-CORE | ARB | short | 2025-10-30 | +0.6 | +2.9 | 2025-11-06 | −2.3 |
| T-CORE | ARB | short | 2025-10-30 | +0.5 | +0.3 | 2025-11-07 | +0.2 |
| T-CORE | ADA | short | 2025-10-30 | +0.5 | +1.0 | 2025-11-11 | −0.4 |
| T-CORE | GALA | short | 2025-10-30 | +0.3 | −0.1 | 2025-11-07 | +0.3 |
| T-CORE | SUI | short | 2025-10-30 | +0.3 | +5.5 | 2026-01-03 | −5.2 |
| BB-CORE | ZEC | long | 2025-10-27 | +0.2 | +0.3 | 2025-11-03 | −0.2 |
| T-CORE | SOL | short | 2025-10-30 | −0.4 | +4.5 | 2026-01-06 | −4.9 |
| I-CORE | SOL | short | 2025-10-30 | −0.4 | +4.8 | 2025-11-28 | −5.2 |
| T-CORE | ETH | short | 2025-10-30 | −0.7 | +0.9 | 2025-11-10 | −1.6 |
| **Total** | 19 trades | — | — | **+311.9** | **+425.8** | — | **−113.9** |

Closing these trades: −113.9R. Later entries moved by the clean-out: +10.0R. Net over the whole history: −103.9R.

### Month by month afterwards (change in value)

| Month | As is | Clean-out | Difference | Running difference | Closed R booked: as is | Closed R booked: clean-out |
|---|---|---|---|---|---|---|
| 2025-10 (clean-out) | +306.7 | +284.7 | −22.0 | −22.0 | +6.2 | +318.1 |
| 2025-11 | +124.6 | +43.6 | −80.9 | −102.9 | +426.1 | +8.0 |
| 2025-12 | −6.8 | −7.3 | −0.5 | −103.4 | −19.4 | −14.6 |
| 2026-01 | +28.3 | +27.8 | −0.5 | −103.9 | +15.8 | +13.2 |
| 2026-02 | +19.7 | +19.7 | 0.0 | −103.9 | +52.7 | +52.7 |
| 2026-03 | −13.3 | −13.3 | 0.0 | −103.9 | −18.8 | −18.8 |
| 2026-04 | −24.3 | −24.3 | 0.0 | −103.9 | −6.2 | −6.2 |
| **Total (7 months)** | **+434.9** | **+331.0** | **−103.9** | **−103.9** | **+456.4** | **+352.5** |

### By bot, whole history

| Bot | As is | With this one clean-out | Difference |
|---|---|---|---|
| BB-CORE | +715.1 | +702.0 | −13.0 |
| T-CORE | +1136.5 | +1089.4 | −47.1 |
| I-CORE | +822.2 | +778.4 | −43.8 |
| **Total** | **+2673.7** | **+2569.8** | **−103.9** |

## Example: end of 2025-12

### The trades that were open

| Bot | Coin | Side | Opened | Closed at month end (R) | If left alone (R) | Left alone until | Difference |
|---|---|---|---|---|---|---|---|
| T-CORE | SUI | short | 2025-10-30 | +7.0 | +5.5 | 2026-01-03 | +1.5 |
| T-CORE | ADA | short | 2025-11-12 | +6.6 | +3.8 | 2026-01-06 | +2.8 |
| T-CORE | SOL | short | 2025-10-30 | +6.0 | +4.5 | 2026-01-06 | +1.4 |
| T-CORE | GALA | short | 2025-11-12 | +4.6 | +2.7 | 2026-01-04 | +1.8 |
| T-CORE | ARB | short | 2025-11-12 | +4.1 | +2.4 | 2026-01-05 | +1.7 |
| T-CORE | NEAR | short | 2025-11-16 | +3.8 | +2.2 | 2026-01-06 | +1.6 |
| I-CORE | ADA | short | 2025-12-12 | +3.4 | +1.5 | 2026-01-02 | +2.0 |
| I-CORE | ZEC | long | 2025-12-24 | +2.9 | +1.3 | 2026-01-08 | +1.6 |
| I-CORE | GALA | short | 2025-12-11 | +2.9 | +1.4 | 2026-01-02 | +1.5 |
| T-CORE | ZEC | long | 2025-12-27 | +1.6 | +1.1 | 2026-01-05 | +0.6 |
| I-CORE | NEAR | short | 2025-12-11 | +1.7 | +0.5 | 2026-01-01 | +1.2 |
| BB-CORE | ZEC | long | 2025-12-27 | +1.2 | +1.3 | 2026-01-03 | 0.0 |
| **Total** | 12 trades | — | — | **+45.7** | **+28.1** | — | **+17.6** |

Closing these trades: +17.6R. Later entries moved by the clean-out: +8.5R. Net over the whole history: +26.1R.

### Month by month afterwards (change in value)

| Month | As is | Clean-out | Difference | Running difference | Closed R booked: as is | Closed R booked: clean-out |
|---|---|---|---|---|---|---|
| 2025-12 (clean-out) | −6.8 | −6.0 | +0.8 | +0.8 | −19.4 | +26.3 |
| 2026-01 | +28.3 | +53.6 | +25.3 | +26.1 | +15.8 | −3.9 |
| 2026-02 | +19.7 | +19.7 | 0.0 | +26.1 | +52.7 | +52.7 |
| 2026-03 | −13.3 | −13.3 | 0.0 | +26.1 | −18.8 | −18.8 |
| 2026-04 | −24.3 | −24.3 | 0.0 | +26.1 | −6.2 | −6.2 |
| 2026-05 | +114.1 | +114.1 | 0.0 | +26.1 | +51.9 | +51.9 |
| 2026-06 | +37.3 | +37.3 | 0.0 | +26.1 | +73.8 | +73.8 |
| **Total (7 months)** | **+155.1** | **+181.2** | **+26.1** | **+26.1** | **+149.7** | **+175.8** |

### By bot, whole history

| Bot | As is | With this one clean-out | Difference |
|---|---|---|---|
| BB-CORE | +715.1 | +717.4 | +2.3 |
| T-CORE | +1136.5 | +1156.0 | +19.6 |
| I-CORE | +822.2 | +826.4 | +4.2 |
| **Total** | **+2673.7** | **+2699.8** | **+26.1** |

## All month ends since April 2020, one clean-out at a time

| Group | Month ends | Helped over the whole history | Hurt | Average effect, R | Best | Worst | Sum |
|---|---|---|---|---|---|---|---|
| Open profit under 10R | 14 | 7 | 7 | −3.4 | +10.9 | −31.9 | −47.4 |
| Open profit 10R to 30R | 29 | 15 | 14 | −1.7 | +20.1 | −34.7 | −50.7 |
| Open profit 30R or more | 37 | 20 | 17 | −17.2 | +64.0 | −310.4 | −635.7 |
| **Total** | 80 | 42 | 38 | −9.2 | +64.0 | −310.4 | −733.7 |

## As a standing habit, per year

| Year | As is | Clean out every month end | Only when open profit is 10R or more | Only when open profit is 30R or more |
|---|---|---|---|---|
| 2020 | +108.0 | +77.0 | +80.0 | +92.2 |
| 2021 | +636.6 | +459.7 | +457.2 | +518.7 |
| 2022 | +152.8 | +240.4 | +215.3 | +202.7 |
| 2023 | +299.3 | +303.7 | +315.8 | +351.7 |
| 2024 | +534.6 | +304.7 | +325.4 | +305.8 |
| 2025 | +489.3 | +167.8 | +178.6 | +159.0 |
| 2026 | +453.1 | +418.6 | +417.6 | +422.0 |
| **Total R** | **+2673.7** | **+1972.0** | **+1989.9** | **+2052.0** |
| Month ends cleaned out | 0 | 80 | 60 | 28 |
| Largest month-end drop in value, R | 92 | 78 | 80 | 74 |
| ₱1,000 compounded from Apr 2020 | ₱79.7M | ₱9.6M | ₱8.9M | ₱6.2M |
| Worst fall from a high (booked money) | 20% | 34% | 42% | 42% |
