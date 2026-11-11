# News-layer backtest — TRI-CORE (BB-CORE, I-CORE, T-CORE)

Generated 2026-11-11T07:16 UTC. Trades: saved backtests in research/strat-hunt-nov6 (Oct 2020 → Nov 2026). Events: 3796 USD high-impact releases (ForexFactory). Fear & Greed: alternative.me. Hacks: DeFiLlama. In-sample < 2024 ≤ out-of-sample.

**p** = share of 3,000 random skips of the same number of trades that kept at least as much total R (low p = the rule removes worse-than-random trades). **helps** = higher R per trade in both halves and no deeper drawdown.

Caveat: a skipped trade is just removed; a real bot might take a different trade instead. The news paper bots measure that.

## BB-CORE (bb-core|BBX|4h)

Baseline: 1341 trades, 594.2R, 0.443R/trade, win 36.4%, max DD -25R · before 2024 371.1R · 2024+ 223.1R

| variant | skipped | skipped R | R/trade kept | ΔR total | ΔR <2024 | ΔR 2024+ | ΔDD | p | helps |
|---|---|---|---|---|---|---|---|---|---|
| CHOSEN: blackout 8h before + coin-chain hack | 64 | -14.8 | 0.477 | +14.8 | +8.1 | +6.7 | +2.7 | 0.01 | ✅ |
| blackout ±4h | 67 | +49.3 | 0.428 | -49.3 | -35.5 | -13.7 | -10.9 | 0.818 |  |
| blackout ±2h | 23 | +16.6 | 0.438 | -16.6 | -3.1 | -13.5 | 0 | 0.747 |  |
| blackout 8h before | 53 | -11 | 0.47 | +10.9 | +7.3 | +3.7 | +2.7 | 0.025 | ✅ |
| blackout 8h after | 102 | +99.9 | 0.399 | -99.9 | -73.4 | -26.5 | -14.5 | 0.936 |  |
| F&G contrarian 20/80 | 162 | +55.7 | 0.457 | -55.7 | -63.1 | +7.5 | 0 | 0.347 |  |
| F&G contrarian 25/75 | 306 | +170.9 | 0.409 | -171 | -142.7 | -28.2 | -0.1 | 0.767 |  |
| F&G with-trend 20/80 | 58 | +13.5 | 0.453 | -13.5 | +3.7 | -17.2 | -4.9 | 0.309 |  |
| BTC crash guard 5% | 7 | +11.2 | 0.437 | -11.2 | -14.3 | +3.1 | 0 | 0.887 |  |
| BTC crash guard 8% | 3 | +4.8 | 0.44 | -4.8 | -4.8 | 0 | 0 | 0.826 |  |
| BTC 5% move: half size | 0 | 0 | 0.439 | -5.6 | -7.2 | +1.5 | 0 | – |  |
| hack guard (coin + $100M market) | 36 | -10.4 | 0.463 | +10.4 | +9.5 | +0.9 | +1.7 | 0.034 | ✅ |
| hack guard: coin chain only | 12 | -4.9 | 0.451 | +4.9 | +1.8 | +3.1 | +1 | 0.114 | ✅ |
| hack guard: $100M market only | 25 | -6.6 | 0.456 | +6.5 | +7.6 | -1.1 | +1.7 | 0.074 | ✅ |
| blackout ±4h + hack | 97 | +41.4 | 0.444 | -41.4 | -28.6 | -12.8 | -6.8 | 0.527 |  |
| blackout ±4h + hack + crash 5% | 104 | +52.6 | 0.438 | -52.6 | -42.9 | -9.7 | -6.8 | 0.638 |  |
| all four (contrarian F&G) | 256 | +95.3 | 0.46 | -95.3 | -89.5 | -5.8 | -3.3 | 0.369 |  |

## I-CORE (i-core|P7|4h)

Baseline: 767 trades, 668.1R, 0.871R/trade, win 32.2%, max DD -28R · before 2024 376.2R · 2024+ 291.8R

| variant | skipped | skipped R | R/trade kept | ΔR total | ΔR <2024 | ΔR 2024+ | ΔDD | p | helps |
|---|---|---|---|---|---|---|---|---|---|
| CHOSEN: blackout 8h before + coin-chain hack | 32 | -9.4 | 0.922 | +9.4 | +4.7 | +4.8 | +2.1 | 0.053 | ✅ |
| blackout ±4h | 47 | -6.8 | 0.937 | +6.8 | -2.3 | +9.3 | -2 | 0.068 |  |
| blackout ±2h | 19 | -8.7 | 0.905 | +8.7 | +5.1 | +3.6 | +2.2 | 0.056 | ✅ |
| blackout 8h before | 24 | -6.9 | 0.908 | +6.9 | +2.9 | +4 | +2.1 | 0.091 | ✅ |
| blackout 8h after | 62 | +28.4 | 0.907 | -28.4 | -17 | -11.3 | -3.2 | 0.385 |  |
| F&G contrarian 20/80 | 89 | +61.9 | 0.894 | -61.9 | -77.1 | +15.4 | 0 | 0.494 |  |
| F&G contrarian 25/75 | 168 | +92.7 | 0.961 | -92.7 | -87.1 | -5.5 | 0 | 0.288 |  |
| F&G with-trend 20/80 | 33 | +7.4 | 0.9 | -7.4 | -8.6 | +1.3 | 0 | 0.346 | ✅ |
| BTC crash guard 5% | 21 | +5 | 0.889 | -5 | +3.5 | -8.4 | -1.7 | 0.393 |  |
| BTC crash guard 8% | 7 | -1.2 | 0.881 | +1.2 | +1.3 | 0 | +1 | 0.339 |  |
| BTC 5% move: half size | 0 | 0 | 0.868 | -2.5 | +1.8 | -4.2 | -0.3 | – |  |
| hack guard (coin + $100M market) | 20 | -9.7 | 0.907 | +9.7 | +7.3 | +2.5 | 0 | 0.041 | ✅ |
| hack guard: coin chain only | 8 | -2.5 | 0.884 | +2.5 | +1.8 | +0.8 | 0 | 0.247 | ✅ |
| hack guard: $100M market only | 12 | -7.2 | 0.894 | +7.2 | +5.5 | +1.8 | 0 | 0.059 | ✅ |
| blackout ±4h + hack | 66 | -15.8 | 0.976 | +15.8 | +4.1 | +11.8 | -3.2 | 0.014 |  |
| blackout ±4h + hack + crash 5% | 87 | -10.8 | 0.998 | +10.8 | +7.6 | +3.3 | -2.2 | 0.022 |  |
| all four (contrarian F&G) | 171 | +49.8 | 1.037 | -49.9 | -71.2 | +21.5 | -3.2 | 0.088 |  |

## T-CORE (bb-trail|P14|4h)

Baseline: 613 trades, 788.3R, 1.286R/trade, win 21%, max DD -29.7R · before 2024 432.5R · 2024+ 355.8R

| variant | skipped | skipped R | R/trade kept | ΔR total | ΔR <2024 | ΔR 2024+ | ΔDD | p | helps |
|---|---|---|---|---|---|---|---|---|---|
| CHOSEN: blackout 8h before + coin-chain hack | 31 | -23.9 | 1.396 | +24 | +18.1 | +5.8 | +3 | 0.012 | ✅ |
| blackout ±4h | 39 | +1.2 | 1.371 | -1.2 | -10.7 | +9.6 | +2 | 0.196 | ✅ |
| blackout ±2h | 15 | -11.6 | 1.338 | +11.6 | +9.7 | +1.9 | +1.9 | 0.071 | ✅ |
| blackout 8h before | 27 | -19.7 | 1.379 | +19.8 | +15 | +4.8 | +3 | 0.021 | ✅ |
| blackout 8h after | 40 | +34.2 | 1.316 | -34.2 | -45 | +10.8 | -1.5 | 0.513 |  |
| F&G contrarian 20/80 | 46 | +116.7 | 1.184 | -116.7 | -125.9 | +9.2 | -0.4 | 0.848 |  |
| F&G contrarian 25/75 | 89 | +132.6 | 1.251 | -132.5 | -132.8 | +0.2 | 0 | 0.669 |  |
| F&G with-trend 20/80 | 35 | +36.3 | 1.301 | -36.3 | -40.5 | +4.3 | 0 | 0.589 |  |
| BTC crash guard 5% | 0 | 0 | 1.286 | 0 | 0 | 0 | 0 | – |  |
| BTC crash guard 8% | 0 | 0 | 1.286 | 0 | 0 | 0 | 0 | – |  |
| BTC 5% move: half size | 0 | 0 | 1.286 | 0 | 0 | 0 | 0 | – |  |
| hack guard (coin + $100M market) | 19 | +3.2 | 1.322 | -3.2 | +12.5 | -15.7 | +3 | 0.386 |  |
| hack guard: coin chain only | 4 | -4.2 | 1.301 | +4.2 | +3.1 | +1.1 | +1.1 | 0.064 | ✅ |
| hack guard: $100M market only | 16 | +6.4 | 1.31 | -6.3 | +10.4 | -16.8 | +2.5 | 0.495 |  |
| blackout ±4h + hack | 53 | +9.7 | 1.39 | -9.7 | -3.5 | -6.2 | +4 | 0.203 | ✅ |
| blackout ±4h + hack + crash 5% | 53 | +9.7 | 1.39 | -9.7 | -3.5 | -6.2 | +4 | 0.203 | ✅ |
| all four (contrarian F&G) | 93 | +131.1 | 1.264 | -131.1 | -133.1 | +2 | +0.4 | 0.644 |  |
