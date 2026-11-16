# Event ledger and event study

Built 2026-11-16T05:48 UTC. Ledger rows: 13677 (price_shock 13585, scheduled 77, owner_tag 5, headline 10).
First event 2019-10-09 15:00, last 2026-11-15 03:00 UTC.

## What followed each kind of event

Returns in percent. "vs baseline" is the group mean minus the average of every hour, with a 95% interval.

| Group | Measured | Horizon | n | n no overlap | Mean | Median | 10% to 90% | Fell | vs baseline | Before 2024 | From 2024 | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BTC down shock, all | BTC | 1h | 279 | 279 | -0.01 | +0.09 | -1.03 to +0.89 | 45% | -0.02 (-0.13 to +0.10) | +0.01 (n 161) | -0.04 (n 118) | not different from baseline |
| BTC down shock, all | BTC | 24h | 279 | 279 | +0.01 | +0.02 | -3.72 to +3.98 | 49% | -0.11 (-0.56 to +0.33) | +0.04 (n 161) | -0.04 (n 118) | not different from baseline |
| BTC down shock, all | BTC | 72h | 279 | 236 | -0.08 | +0.26 | -7.33 to +5.53 | 47% | -0.44 (-1.07 to +0.19) | +0.24 (n 161) | -0.52 (n 118) | not different from baseline |
| BTC down shock, all | BTC | 7d | 277 | 172 | +0.18 | +0.82 | -10.18 to +9.43 | 44% | -0.68 (-1.73 to +0.35) | +0.45 (n 161) | -0.19 (n 116) | not different from baseline |
| BTC down shock, large (5x+) | BTC | 1h | 50 | 50 | +0.22 | +0.16 | -0.98 to +1.26 | 36% | +0.22 (-0.15 to +0.56) | +0.33 (n 30) | +0.07 (n 20) | not different from baseline |
| BTC down shock, large (5x+) | BTC | 24h | 50 | 50 | +0.39 | +0.07 | -2.79 to +5.33 | 48% | +0.27 (-0.77 to +1.21) | +0.07 (n 30) | +0.85 (n 20) | not different from baseline |
| BTC down shock, large (5x+) | BTC | 72h | 50 | 50 | +1.25 | +1.19 | -4.99 to +6.97 | 38% | +0.89 (-0.71 to +2.46) | +1.00 (n 30) | +1.62 (n 20) | not different from baseline |
| BTC down shock, large (5x+) | BTC | 7d | 50 | 44 | +1.09 | +0.82 | -8.99 to +9.71 | 42% | +0.23 (-1.65 to +2.45) | +0.78 (n 30) | +1.56 (n 20) | not different from baseline |
| BTC down shock, medium (3-5x) | BTC | 1h | 229 | 229 | -0.06 | +0.08 | -1.04 to +0.84 | 47% | -0.07 (-0.19 to +0.05) | -0.06 (n 131) | -0.06 (n 98) | not different from baseline |
| BTC down shock, medium (3-5x) | BTC | 24h | 229 | 229 | -0.08 | +0.02 | -3.89 to +3.84 | 49% | -0.20 (-0.70 to +0.27) | +0.04 (n 131) | -0.23 (n 98) | not different from baseline |
| BTC down shock, medium (3-5x) | BTC | 72h | 229 | 198 | -0.37 | +0.06 | -7.80 to +5.07 | 49% | -0.73 (-1.45 to -0.03) | +0.07 (n 131) | -0.96 (n 98) | differs from baseline, both periods agree |
| BTC down shock, medium (3-5x) | BTC | 7d | 227 | 154 | -0.02 | +0.78 | -10.39 to +8.93 | 45% | -0.88 (-2.03 to +0.26) | +0.37 (n 131) | -0.55 (n 96) | not different from baseline |
| BTC up shock, all | BTC | 1h | 263 | 263 | +0.09 | +0.08 | -0.93 to +1.39 | 47% | +0.08 (-0.07 to +0.22) | -0.04 (n 156) | +0.27 (n 107) | not different from baseline |
| BTC up shock, all | BTC | 24h | 263 | 263 | +0.54 | +0.53 | -2.93 to +4.51 | 41% | +0.42 (-0.06 to +0.90) | +0.44 (n 156) | +0.69 (n 107) | not different from baseline |
| BTC up shock, all | BTC | 72h | 263 | 217 | +0.89 | +0.66 | -4.56 to +7.69 | 47% | +0.53 (-0.22 to +1.25) | +0.68 (n 156) | +1.20 (n 107) | not different from baseline |
| BTC up shock, all | BTC | 7d | 263 | 157 | +1.86 | +1.61 | -6.93 to +12.62 | 41% | +1.00 (-0.09 to +2.04) | +1.71 (n 156) | +2.08 (n 107) | not different from baseline |
| BTC up shock, large (5x+) | BTC | 1h | 44 | 44 | -0.02 | +0.13 | -1.58 to +1.81 | 48% | -0.02 (-0.69 to +0.55) | -0.41 (n 29) | +0.74 (n 15) | not different from baseline |
| BTC up shock, large (5x+) | BTC | 24h | 44 | 44 | +0.43 | +0.69 | -3.54 to +5.40 | 41% | +0.31 (-1.03 to +1.52) | +0.05 (n 29) | +1.17 (n 15) | not different from baseline |
| BTC up shock, large (5x+) | BTC | 72h | 44 | 42 | +2.14 | +0.95 | -4.34 to +10.37 | 43% | +1.78 (-0.01 to +3.68) | +1.37 (n 29) | +3.63 (n 15) | not different from baseline |
| BTC up shock, large (5x+) | BTC | 7d | 44 | 40 | +3.16 | +0.91 | -5.00 to +15.01 | 43% | +2.30 (+0.04 to +4.87) | +2.81 (n 29) | +3.85 (n 15) | differs from baseline, periods disagree or too short |
| BTC up shock, medium (3-5x) | BTC | 1h | 219 | 219 | +0.11 | +0.08 | -0.80 to +0.99 | 47% | +0.11 (-0.01 to +0.22) | +0.05 (n 127) | +0.20 (n 92) | not different from baseline |
| BTC up shock, medium (3-5x) | BTC | 24h | 219 | 219 | +0.56 | +0.45 | -2.86 to +4.34 | 41% | +0.44 (-0.07 to +0.96) | +0.53 (n 127) | +0.61 (n 92) | not different from baseline |
| BTC up shock, medium (3-5x) | BTC | 72h | 219 | 185 | +0.64 | +0.40 | -4.57 to +6.88 | 48% | +0.28 (-0.55 to +1.10) | +0.52 (n 127) | +0.80 (n 92) | not different from baseline |
| BTC up shock, medium (3-5x) | BTC | 7d | 219 | 134 | +1.59 | +1.69 | -7.53 to +11.52 | 41% | +0.73 (-0.47 to +2.00) | +1.46 (n 127) | +1.79 (n 92) | not different from baseline |
| alt-coin down shock (own coin, pooled) | own coin | 1h | 2865 | 2865 | +0.09 | +0.23 | -1.68 to +1.86 | 41% | +0.09 (+0.01 to +0.16) | +0.17 (n 1432) | -0.00 (n 1433) | differs from baseline, periods disagree or too short (coins move together, so samples are not independent) |
| alt-coin down shock (own coin, pooled) | own coin | 24h | 2865 | 2865 | +0.64 | +0.72 | -5.89 to +6.70 | 43% | +0.45 (+0.22 to +0.69) | +0.64 (n 1432) | +0.26 (n 1433) | differs from baseline, both periods agree (coins move together, so samples are not independent) |
| alt-coin down shock (own coin, pooled) | own coin | 72h | 2853 | 2853 | +0.98 | +0.53 | -9.73 to +11.87 | 46% | +0.42 (+0.05 to +0.78) | +0.53 (n 1432) | +0.30 (n 1421) | differs from baseline, both periods agree (coins move together, so samples are not independent) |
| alt-coin down shock (own coin, pooled) | own coin | 7d | 2837 | 2837 | +1.27 | +0.14 | -13.76 to +16.48 | 49% | -0.15 (-0.70 to +0.42) | +0.02 (n 1432) | -0.34 (n 1405) | not different from baseline (coins move together, so samples are not independent) |
| alt-coin up shock (own coin, pooled) | own coin | 1h | 2534 | 2534 | +0.14 | +0.01 | -1.70 to +2.17 | 49% | +0.14 (+0.06 to +0.21) | +0.06 (n 1311) | +0.22 (n 1223) | differs from baseline, both periods agree (coins move together, so samples are not independent) |
| alt-coin up shock (own coin, pooled) | own coin | 24h | 2534 | 2534 | +0.88 | -0.05 | -6.03 to +8.01 | 50% | +0.68 (+0.30 to +1.18) | +1.03 (n 1311) | +0.32 (n 1223) | differs from baseline, both periods agree (coins move together, so samples are not independent) |
| alt-coin up shock (own coin, pooled) | own coin | 72h | 2532 | 2532 | +1.78 | +0.06 | -9.37 to +12.73 | 50% | +1.20 (+0.65 to +1.72) | +2.21 (n 1311) | +0.10 (n 1221) | differs from baseline, both periods agree (coins move together, so samples are not independent) |
| alt-coin up shock (own coin, pooled) | own coin | 7d | 2532 | 2532 | +2.89 | -0.05 | -13.59 to +19.75 | 50% | +1.42 (+0.64 to +2.21) | +3.18 (n 1311) | -0.46 (n 1221) | differs from baseline, periods disagree or too short (coins move together, so samples are not independent) |
| headline labelled bearish | BTC | 1h | 10 | 8 | -0.18 | -0.07 | -0.53 to +0.15 | 60% | -0.18 (-0.39 to +0.01) | - | -0.18 (n 10) | too few samples |
| headline labelled bearish | BTC | 24h | 10 | 2 | -0.19 | -0.12 | -1.07 to +1.09 | 70% | -0.31 (-0.88 to +0.27) | - | -0.19 (n 10) | too few samples |
| headline labelled bearish | BTC | 72h | 10 | 1 | -5.26 | -6.00 | -7.59 to -1.94 | 100% | -5.62 (-7.15 to -4.12) | - | -5.26 (n 10) | too few samples |
| headline labelled bearish | BTC | 7d | 3 | 1 | -14.11 | -14.11 | -14.11 to -14.11 | 100% | -14.97 (-14.97 to -14.97) | - | -14.11 (n 3) | too few samples |
| owner tags (all) | BTC | 1h | 5 | 5 | -0.87 | -0.87 | -1.94 to +0.08 | 80% | -0.88 (-1.68 to -0.15) | - | -0.87 (n 5) | too few samples |
| owner tags (all) | BTC | 24h | 5 | 4 | +0.08 | -0.12 | -3.18 to +3.37 | 60% | -0.04 (-3.08 to +2.55) | - | +0.08 (n 5) | too few samples |
| owner tags (all) | BTC | 72h | 5 | 3 | -4.02 | -3.76 | -6.63 to -1.56 | 100% | -4.38 (-6.35 to -2.41) | - | -4.02 (n 5) | too few samples |
| owner tags (all) | BTC | 7d | 3 | 2 | -8.04 | -5.54 | -12.39 to -4.68 | 100% | -8.90 (-14.97 to -5.33) | - | -8.04 (n 3) | too few samples |
| scheduled: CPI | BTC | 1h | 5 | 5 | +0.23 | -0.18 | -0.87 to +1.59 | 60% | +0.23 (-0.73 to +1.28) | - | +0.23 (n 5) | too few samples |
| scheduled: CPI | BTC | 24h | 5 | 5 | -0.28 | -0.68 | -2.25 to +1.98 | 60% | -0.39 (-2.05 to +1.64) | - | -0.28 (n 5) | too few samples |
| scheduled: CPI | BTC | 72h | 5 | 5 | -1.88 | -1.89 | -5.09 to +0.88 | 60% | -2.24 (-4.77 to -0.01) | - | -1.88 (n 5) | too few samples |
| scheduled: CPI | BTC | 7d | 4 | 4 | +1.85 | +0.88 | +0.16 to +4.31 | 0% | +0.99 (-0.63 to +3.66) | - | +1.85 (n 4) | too few samples |
| scheduled: FOMC | BTC | 1h | 11 | 11 | +0.39 | +0.29 | +0.10 to +0.74 | 9% | +0.38 (+0.17 to +0.68) | - | +0.39 (n 11) | too few samples |
| scheduled: FOMC | BTC | 24h | 11 | 11 | +0.99 | +0.93 | -2.03 to +5.15 | 36% | +0.87 (-0.76 to +2.58) | - | +0.99 (n 11) | too few samples |
| scheduled: FOMC | BTC | 72h | 11 | 10 | +1.95 | -0.06 | -2.43 to +7.50 | 55% | +1.60 (-1.05 to +4.84) | - | +1.95 (n 11) | too few samples |
| scheduled: FOMC | BTC | 7d | 11 | 9 | +3.74 | +1.28 | -0.55 to +11.26 | 27% | +2.88 (+0.26 to +6.16) | - | +3.74 (n 11) | too few samples |
| scheduled: GDP | BTC | 1h | 4 | 4 | +0.38 | +0.03 | -0.18 to +1.21 | 50% | +0.37 (-0.17 to +1.20) | - | +0.38 (n 4) | too few samples |
| scheduled: GDP | BTC | 24h | 4 | 4 | -0.93 | -0.77 | -2.89 to +0.89 | 75% | -1.05 (-2.73 to +0.51) | - | -0.93 (n 4) | too few samples |
| scheduled: GDP | BTC | 72h | 4 | 4 | -1.42 | -1.92 | -2.74 to +0.29 | 75% | -1.78 (-3.09 to +0.03) | - | -1.42 (n 4) | too few samples |
| scheduled: GDP | BTC | 7d | 4 | 4 | -0.57 | -0.24 | -1.56 to +0.16 | 75% | -1.43 (-2.50 to -0.69) | - | -0.57 (n 4) | too few samples |
| scheduled: NFP | BTC | 1h | 5 | 5 | -0.24 | +0.29 | -1.38 to +0.43 | 40% | -0.25 (-1.26 to +0.41) | - | -0.24 (n 5) | too few samples |
| scheduled: NFP | BTC | 24h | 5 | 5 | -0.64 | -0.19 | -2.00 to +0.61 | 80% | -0.76 (-1.76 to +0.24) | - | -0.64 (n 5) | too few samples |
| scheduled: NFP | BTC | 72h | 5 | 5 | -0.33 | -0.24 | -1.92 to +1.33 | 60% | -0.69 (-1.88 to +0.59) | - | -0.33 (n 5) | too few samples |
| scheduled: NFP | BTC | 7d | 5 | 5 | -3.76 | -3.68 | -7.46 to +0.07 | 80% | -4.63 (-7.26 to -1.23) | - | -3.76 (n 5) | too few samples |
| scheduled: PCE | BTC | 1h | 4 | 4 | +0.38 | +0.03 | -0.18 to +1.21 | 50% | +0.37 (-0.17 to +1.20) | - | +0.38 (n 4) | too few samples |
| scheduled: PCE | BTC | 24h | 4 | 4 | -0.93 | -0.77 | -2.89 to +0.89 | 75% | -1.05 (-2.73 to +0.51) | - | -0.93 (n 4) | too few samples |
| scheduled: PCE | BTC | 72h | 4 | 4 | -1.42 | -1.92 | -2.74 to +0.29 | 75% | -1.78 (-3.09 to +0.03) | - | -1.42 (n 4) | too few samples |
| scheduled: PCE | BTC | 7d | 4 | 4 | -0.57 | -0.24 | -1.56 to +0.16 | 75% | -1.43 (-2.50 to -0.69) | - | -0.57 (n 4) | too few samples |
| scheduled: PPI | BTC | 1h | 5 | 5 | -0.05 | +0.33 | -0.95 to +0.60 | 40% | -0.05 (-0.78 to +0.53) | - | -0.05 (n 5) | too few samples |
| scheduled: PPI | BTC | 24h | 5 | 5 | -0.78 | -0.98 | -2.33 to +0.93 | 80% | -0.90 (-2.33 to +0.72) | - | -0.78 (n 5) | too few samples |
| scheduled: PPI | BTC | 72h | 4 | 4 | -0.45 | -0.90 | -1.27 to +0.72 | 75% | -0.81 (-1.57 to +0.40) | - | -0.45 (n 4) | too few samples |
| scheduled: PPI | BTC | 7d | 4 | 4 | +3.61 | +1.45 | -0.95 to +9.90 | 25% | +2.75 (-1.69 to +9.35) | - | +3.61 (n 4) | too few samples |
| scheduled: other | BTC | 1h | 12 | 12 | +0.05 | +0.29 | -0.49 to +0.45 | 25% | +0.04 (-0.44 to +0.38) | - | +0.05 (n 12) | too few samples |
| scheduled: other | BTC | 24h | 12 | 11 | +0.41 | +0.23 | -2.01 to +2.48 | 50% | +0.29 (-0.79 to +1.38) | - | +0.41 (n 12) | too few samples |
| scheduled: other | BTC | 72h | 12 | 9 | +0.51 | +0.76 | -2.19 to +2.11 | 42% | +0.15 (-0.99 to +1.42) | - | +0.51 (n 12) | too few samples |
| scheduled: other | BTC | 7d | 12 | 6 | -1.24 | -0.03 | -5.03 to +2.29 | 50% | -2.10 (-4.18 to -0.17) | - | -1.24 (n 12) | too few samples |

## Owner-tagged events

| Event | First seen (UTC) | 72h before | 1h | 24h | 72h | 7d |
|---|---|---|---|---|---|---|
| Binance $6.3B hack | 2026-10-29 20:00 | +1.02 | -2.46 | -4.85 | -3.76 | -5.54 |
| US midterms, Democrats win | 2026-11-04 02:00 | -0.86 | -1.15 | +4.71 | -1.32 | -4.47 |
| Nvidia CEO scandal | 2026-11-09 02:39 | -1.26 | +0.15 | -0.12 | -1.94 | -14.11 |
| Hot US CPI | 2026-11-10 13:30 | -1.98 | -0.87 | -0.68 | -6.97 | - |
| Nvidia CEO resigns | 2026-11-10 19:40 | -3.05 | -0.02 | +1.36 | -6.12 | - |

## Latest BTC shock episode and its closest past matches

Latest: 2026-11-12 15:00 UTC, down, 3.162x normal, volume 9.047x. Compared with 276 earlier down episodes.

| Past episode (UTC) | Size | Volume | 72h before | 24h after | 72h after | 7d after | Distance |
|---|---|---|---|---|---|---|---|
| 2020-10-01 17:00 | 3.445x | 10.686x | -3.32 | +0.20 | +0.73 | +3.78 | 0.454 |
| 2022-10-13 13:00 | 3.218x | 9.58x | -5.32 | +7.69 | +4.06 | +4.07 | 0.466 |
| 2024-09-06 15:00 | 3.577x | 10.352x | -5.10 | -0.21 | +0.18 | +6.78 | 0.478 |
| 2020-06-27 20:00 | 3.297x | 7.022x | -3.97 | +1.98 | +2.24 | +2.22 | 0.537 |
| 2020-09-21 15:00 | 3.217x | 8.119x | -4.83 | +0.23 | -0.08 | +4.31 | 0.572 |
| 2023-02-24 16:00 | 3.937x | 7.728x | -4.96 | -1.46 | +0.90 | -4.34 | 0.605 |
| 2026-05-23 08:00 | 3.296x | 7.125x | -3.47 | +2.95 | +2.83 | -1.42 | 0.664 |
| 2023-02-09 20:00 | 4.059x | 8.723x | -4.34 | -1.20 | -0.20 | +12.95 | 0.712 |
| 2019-11-27 10:00 | 3.891x | 7.79x | -4.99 | +9.05 | +12.08 | +4.41 | 0.732 |
| 2024-04-17 15:00 | 3.32x | 7.112x | -4.13 | +4.11 | +4.31 | +6.45 | 0.736 |

After the 10 closest matches: 24h median +1.10%, 72h median +1.57%, 7d median +4.19% (fell in 20% of them). Ten cases is a description, not a forecast.

## Limits

- Shocks are back-filled from candles and are exact. Owner tags before Nov 16 2026 were written after the fact, with approximate hours.
- Headlines exist only from the first Pulse brief (Nov 11 2026). Scheduled releases come from the Pulse calendar history only.
- Samples of one coin group are not independent when coins fall together; treat pooled alt-coin rows as indicative.
