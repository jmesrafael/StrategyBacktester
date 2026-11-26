# Divergence study: refused entries, hand closes and a blocked coin (Nov 26 2026)

Shared engine, v3 rules, live coins, standard costs + funding, 2020 to Nov 25 2026, open trades marked at the last close. 500 random runs per scenario. Results in R (1R = the amount risked on one trade), not compounded. Cells: middle run (5th to 95th percentile).

## All three bots

| Year | Bot as is | Entry refused, 5% of entries | Entry refused, 20% of entries | Hand close at a random time, 10% of trades | Hand take-profit at +2R to +6R, 10% of trades | Hand take-profit at +2R to +6R, 25% of trades |
|---|---|---|---|---|---|---|
| 2020 | +108 | +107 (+95 to +112) | +102 (+86 to +116) | +105 (+83 to +117) | +108 (+84 to +119) | +104 (+77 to +123) |
| 2021 | +637 | +629 (+583 to +641) | +593 (+524 to +628) | +611 (+560 to +641) | +607 (+535 to +644) | +554 (+456 to +621) |
| 2022 | +153 | +151 (+141 to +158) | +142 (+124 to +159) | +154 (+138 to +170) | +157 (+142 to +170) | +161 (+141 to +181) |
| 2023 | +299 | +294 (+246 to +306) | +265 (+203 to +301) | +287 (+242 to +312) | +290 (+239 to +311) | +269 (+217 to +310) |
| 2024 | +535 | +529 (+498 to +542) | +491 (+437 to +532) | +510 (+441 to +544) | +517 (+453 to +547) | +479 (+390 to +539) |
| 2025 | +489 | +487 (+366 to +498) | +475 (+235 to +503) | +496 (+354 to +520) | +498 (+356 to +515) | +506 (+264 to +534) |
| 2026 (to Nov 25) | +453 | +450 (+424 to +467) | +430 (+378 to +463) | +437 (+404 to +459) | +438 (+400 to +457) | +413 (+365 to +449) |
| **Total** | **+2,674** | **+2,631 (+2,518 to +2,671)** | **+2,442 (+2,239 to +2,577)** | **+2,576 (+2,418 to +2,656)** | **+2,587 (+2,423 to +2,672)** | **+2,419 (+2,207 to +2,585)** |
| Change vs as is (middle run) | — | -2% | -9% | -4% | -3% | -10% |
| Runs that ended below as is | — | 96% | 100% | 99% | 96% | 100% |
| Largest closed drop, R | 63 | 62 (58 to 66) | 61 (54 to 69) | 63 (59 to 69) | 63 (59 to 67) | 62 (58 to 72) |
| Trades | 3686 | 3650 | 3522 | 3832 | 3764 | 3888 |

## BB-CORE

| Year | Bot as is | Entry refused, 5% of entries | Entry refused, 20% of entries | Hand close at a random time, 10% of trades | Hand take-profit at +2R to +6R, 10% of trades | Hand take-profit at +2R to +6R, 25% of trades |
|---|---|---|---|---|---|---|
| 2020 | +38 | +38 (+29 to +40) | +34 (+21 to +42) | +36 (+29 to +44) | +38 (+30 to +44) | +38 (+27 to +47) |
| 2021 | +178 | +174 (+153 to +181) | +156 (+125 to +175) | +173 (+150 to +183) | +175 (+141 to +184) | +165 (+124 to +185) |
| 2022 | +85 | +83 (+77 to +88) | +78 (+68 to +88) | +85 (+76 to +96) | +85 (+78 to +91) | +84 (+73 to +94) |
| 2023 | +122 | +119 (+105 to +126) | +109 (+85 to +126) | +118 (+99 to +131) | +120 (+103 to +131) | +115 (+89 to +131) |
| 2024 | +95 | +94 (+85 to +101) | +87 (+71 to +102) | +94 (+81 to +108) | +95 (+88 to +103) | +94 (+83 to +106) |
| 2025 | +64 | +63 (+56 to +71) | +63 (+48 to +77) | +66 (+55 to +84) | +66 (+60 to +74) | +70 (+59 to +81) |
| 2026 (to Nov 25) | +133 | +133 (+124 to +145) | +131 (+112 to +150) | +127 (+111 to +140) | +129 (+115 to +137) | +120 (+100 to +135) |
| **Total** | **+715** | **+702 (+672 to +723)** | **+655 (+604 to +695)** | **+697 (+659 to +734)** | **+703 (+667 to +728)** | **+679 (+626 to +721)** |
| Change vs as is (middle run) | — | -2% | -8% | -3% | -2% | -5% |
| Runs that ended below as is | — | 87% | 99% | 82% | 77% | 90% |
| Largest closed drop, R | 27 | 28 (27 to 32) | 30 (27 to 36) | 30 (27 to 35) | 28 (27 to 29) | 28 (27 to 31) |
| Trades | 1710 | 1696 | 1645 | 1761 | 1725 | 1748 |

## T-CORE

| Year | Bot as is | Entry refused, 5% of entries | Entry refused, 20% of entries | Hand close at a random time, 10% of trades | Hand take-profit at +2R to +6R, 10% of trades | Hand take-profit at +2R to +6R, 25% of trades |
|---|---|---|---|---|---|---|
| 2020 | +54 | +54 (+52 to +56) | +54 (+46 to +58) | +54 (+33 to +60) | +54 (+33 to +62) | +53 (+26 to +65) |
| 2021 | +256 | +256 (+249 to +261) | +254 (+229 to +265) | +250 (+208 to +263) | +250 (+205 to +263) | +225 (+168 to +262) |
| 2022 | +16 | +17 (+12 to +20) | +17 (+9 to +23) | +17 (+8 to +26) | +18 (+8 to +27) | +21 (+6 to +33) |
| 2023 | +25 | +24 (+17 to +29) | +21 (+9 to +32) | +25 (+13 to +37) | +24 (+14 to +35) | +25 (+9 to +41) |
| 2024 | +352 | +351 (+333 to +357) | +338 (+301 to +357) | +338 (+276 to +359) | +340 (+284 to +363) | +311 (+235 to +357) |
| 2025 | +259 | +259 (+249 to +263) | +258 (+138 to +268) | +263 (+145 to +275) | +263 (+149 to +275) | +269 (+125 to +288) |
| 2026 (to Nov 25) | +174 | +174 (+165 to +179) | +171 (+156 to +183) | +170 (+152 to +182) | +171 (+154 to +183) | +165 (+141 to +184) |
| **Total** | **+1,136** | **+1,132 (+1,087 to +1,145)** | **+1,103 (+970 to +1,141)** | **+1,100 (+976 to +1,148)** | **+1,106 (+996 to +1,152)** | **+1,041 (+884 to +1,130)** |
| Change vs as is (middle run) | — | 0% | -3% | -3% | -3% | -8% |
| Runs that ended below as is | — | 66% | 92% | 86% | 84% | 97% |
| Largest closed drop, R | 31 | 31 (29 to 35) | 33 (29 to 40) | 32 (29 to 38) | 31 (29 to 36) | 31 (27 to 37) |
| Trades | 1157 | 1150 | 1128 | 1221 | 1207 | 1290 |

## I-CORE

| Year | Bot as is | Entry refused, 5% of entries | Entry refused, 20% of entries | Hand close at a random time, 10% of trades | Hand take-profit at +2R to +6R, 10% of trades | Hand take-profit at +2R to +6R, 25% of trades |
|---|---|---|---|---|---|---|
| 2020 | +16 | +16 (+8 to +19) | +16 (+2 to +24) | +16 (+7 to +21) | +16 (+9 to +22) | +16 (+6 to +24) |
| 2021 | +202 | +201 (+177 to +207) | +190 (+127 to +207) | +199 (+157 to +206) | +201 (+139 to +208) | +171 (+99 to +209) |
| 2022 | +51 | +51 (+43 to +55) | +48 (+35 to +57) | +51 (+43 to +58) | +54 (+46 to +62) | +57 (+47 to +70) |
| 2023 | +153 | +152 (+104 to +158) | +142 (+82 to +161) | +148 (+104 to +158) | +150 (+103 to +159) | +137 (+81 to +159) |
| 2024 | +87 | +86 (+63 to +91) | +73 (+25 to +93) | +84 (+47 to +92) | +87 (+45 to +94) | +80 (+32 to +99) |
| 2025 | +167 | +166 (+154 to +171) | +159 (+4 to +171) | +168 (+26 to +174) | +169 (+25 to +176) | +172 (+25 to +184) |
| 2026 (to Nov 25) | +145 | +144 (+122 to +149) | +132 (+81 to +149) | +142 (+112 to +151) | +142 (+106 to +150) | +132 (+88 to +150) |
| **Total** | **+822** | **+805 (+731 to +829)** | **+712 (+543 to +799)** | **+791 (+664 to +827)** | **+788 (+646 to +835)** | **+719 (+558 to +814)** |
| Change vs as is (middle run) | — | -2% | -13% | -4% | -4% | -13% |
| Runs that ended below as is | — | 84% | 98% | 92% | 82% | 96% |
| Largest closed drop, R | 28 | 27 (25 to 30) | 26 (22 to 32) | 28 (25 to 30) | 28 (25 to 29) | 28 (24 to 30) |
| Trades | 819 | 803 | 748 | 849 | 831 | 849 |

## Money view: TRI-CORE 50/25/25, ₱1,000 from Apr 2020, compounded monthly

| Scenario | Middle run | Bad luck (5th pct) | Good luck (95th pct) | Middle run vs as is | Worst fall from a high (middle) |
|---|---|---|---|---|---|
| Bot as is | ₱79.7M | — | — | — | 20% |
| Entry refused, 5% of entries | ₱65.8M | ₱52.4M | ₱79.5M | -17% | 20% |
| Entry refused, 20% of entries | ₱37.8M | ₱24.4M | ₱55.6M | -53% | 21% |
| Hand close at a random time, 10% of trades | ₱57.5M | ₱41.7M | ₱76.3M | -28% | 20% |
| Hand take-profit at +2R to +6R, 10% of trades | ₱64.3M | ₱46.1M | ₱83.2M | -19% | 19% |
| Hand take-profit at +2R to +6R, 25% of trades | ₱46.5M | ₱28.3M | ₱70.4M | -42% | 18% |

## Biggest trades of 2025 (what the wide ranges depend on)

| Bot | Coin | Entry (UTC) | R | Share of that bot 2025 |
|---|---|---|---|---|
| BB-CORE | ARB | 2025-07-09 | +9.77 | 15% |
| BB-CORE | ZEC | 2025-01-27 | +7.57 | 12% |
| BB-CORE | NEAR | 2025-01-27 | +7.05 | 11% |
| T-CORE | ZEC | 2025-09-06 | +239.32 | 93% |
| T-CORE | ETH | 2025-07-08 | +21.59 | 8% |
| T-CORE | ARB | 2025-07-09 | +9.17 | 4% |
| I-CORE | ZEC | 2025-09-23 | +147.93 | 89% |
| I-CORE | ZEC | 2025-05-05 | +7.55 | 5% |
| I-CORE | SOL | 2025-07-06 | +6.23 | 4% |
| **Total** | — | 9 trades | **+456.18** | **93%** |

## One change at a time (every historical trade, changed alone)

"Own effect" = the changed trade itself. "Later entries" = what the moved entries afterwards added or removed.

### The entry is refused

| Bot | Changes tested | Own effect, avg R | Later entries, avg R | Later entries, 5th to 95th pct | No later entry moved | Days until back in step (middle / 90th pct) |
|---|---|---|---|---|---|---|
| BB-CORE | 1708 | −0.41 | +0.24 | −1.10 to +4.07 | 15% | 8 / 10 |
| T-CORE | 1150 | −0.96 | +0.77 | −1.09 to +5.53 | 19% | 8 / 44 |
| I-CORE | 816 | −0.99 | +0.24 | −2.04 to +4.28 | 45% | 11 / 27 |
| **Total** | 3674 | −0.71 | +0.41 | −1.12 to +4.49 | 23% | 8 / 20 |

| Year | BB-CORE own / later | T-CORE own / later | I-CORE own / later | All own / later |
|---|---|---|---|---|
| 2020 | −0.41 / +0.11 | −0.72 / +0.69 | −0.25 / +0.13 | −0.47 / +0.31 |
| 2021 | −0.86 / +0.27 | −2.14 / +2.09 | −1.87 / +0.96 | −1.46 / +0.94 |
| 2022 | −0.36 / +0.21 | −0.11 / +0.12 | −0.42 / +0.30 | −0.30 / +0.20 |
| 2023 | −0.41 / +0.19 | −0.12 / −0.10 | −1.15 / +0.25 | −0.48 / +0.11 |
| 2024 | −0.31 / +0.18 | −1.65 / +1.43 | −0.64 / −0.08 | −0.81 / +0.53 |
| 2025 | −0.22 / +0.22 | −1.27 / +0.73 | −1.18 / −0.11 | −0.77 / +0.31 |
| 2026 | −0.44 / +0.43 | −0.76 / +0.69 | −1.14 / +0.36 | −0.68 / +0.50 |
| **Total** | −0.41 / +0.24 | −0.96 / +0.77 | −0.99 / +0.24 | −0.71 / +0.41 |

### The trade is closed by hand at +3R (only trades that reached +3R)

| Bot | Changes tested | Own effect, avg R | Later entries, avg R | Later entries, 5th to 95th pct | No later entry moved | Days until back in step (middle / 90th pct) |
|---|---|---|---|---|---|---|
| BB-CORE | 318 | −0.77 | +0.22 | −1.07 to +2.75 | 15% | 10 / 15 |
| T-CORE | 265 | −2.91 | +1.33 | −4.16 to +11.25 | 6% | 32 / 78 |
| I-CORE | 236 | −2.18 | −0.02 | −2.05 to +3.78 | 45% | 22 / 39 |
| **Total** | 819 | −1.87 | +0.51 | −2.14 to +5.25 | 21% | 15 / 56 |

| Year | BB-CORE own / later | T-CORE own / later | I-CORE own / later | All own / later |
|---|---|---|---|---|
| 2020 | −0.46 / −0.02 | −2.29 / +2.18 | +0.46 / −0.46 | −0.64 / +0.43 |
| 2021 | −2.20 / +0.34 | −8.26 / +3.54 | −5.32 / +0.38 | −4.66 / +1.18 |
| 2022 | −0.62 / +0.33 | +0.43 / −0.51 | −0.21 / +0.52 | −0.17 / +0.14 |
| 2023 | −1.14 / +0.50 | +0.13 / +0.21 | −2.75 / −0.01 | −1.24 / +0.26 |
| 2024 | −0.42 / +0.03 | −4.67 / +1.18 | −1.33 / −0.50 | −2.27 / +0.34 |
| 2025 | +0.94 / −0.13 | −3.38 / +2.06 | −2.25 / −0.32 | −1.34 / +0.53 |
| 2026 | −2.10 / +0.56 | −1.88 / +1.22 | −3.11 / +0.21 | −2.29 / +0.72 |
| **Total** | −0.77 / +0.22 | −2.91 / +1.33 | −2.18 / −0.02 | −1.87 / +0.51 |

## T-CORE with SOL blocked

| Year | T-CORE as is | T-CORE without SOL | SOL part | SOL part per 30 days |
|---|---|---|---|---|
| 2020 | +54 | +56 | −2 | −0.99 |
| 2021 | +256 | +153 | +103 | +8.49 |
| 2022 | +16 | +15 | +2 | +0.16 |
| 2023 | +25 | +16 | +9 | +0.74 |
| 2024 | +352 | +252 | +100 | +8.18 |
| 2025 | +259 | +258 | +1 | +0.06 |
| 2026 | +174 | +147 | +28 | +2.53 |
| **Total** | **+1,136** | **+897** | **+240** | **+3.23** |

SOL trades a flat T-CORE would have taken since the first blocked signal:

| Signal candle (UTC) | Side | Result R | State |
|---|---|---|---|
| 2026-11-08T20:00 | short | +5.37 | still open, marked at last close |
| **Total** | 1 trade(s) | **+5.37** | — |
