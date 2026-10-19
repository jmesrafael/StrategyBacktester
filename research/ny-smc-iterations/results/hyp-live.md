# Hypothesis round H1–H8, live-style simulation (setups filtered before execution) — SOL + ETH, Binance 15m, $1 risk

Cell = average R per trade (trades). Random control = same per-coin setup keep rate, re-simulated 1,000×.

| Rule | SOL 19–23 | SOL 23–26 | ETH 19–23 | ETH 23–26 | Cells better | Trades vs v7 | Pooled avg | Random percentile | Total R | **Pass** |
|---|---|---|---|---|---|---|---|---|---|---|
| v7 | −0.18 (70) | +0.41 (79) | −0.04 (96) | +0.57 (77) | — | 100% | +0.19 | — | 60.5 | — |
| H1 Weekday only (Mon–Fri ET) | −0.13 (49) | +0.33 (56) | −0.02 (75) | +0.51 (61) | 2/4 | 75% | +0.17 | 41.6 | 41.8 | ❌ |
| H2 With the daily trend (EMA20) | −0.18 (33) | +0.11 (47) | +0.13 (52) | +0.79 (37) | 2/4 | 52% | +0.21 | 67.5 | 35.3 | ❌ |
| H3 With the 4h trend (EMA50) | −0.07 (30) | +0.03 (41) | −0.12 (44) | +0.96 (28) | 2/4 | 44% | +0.15 | 35.7 | 20.9 | ❌ |
| H4 CHoCH volume ≥ 1.5× avg | −0.24 (52) | +0.51 (68) | −0.07 (83) | +0.56 (75) | 1/4 | 86% | +0.21 | 74.7 | 58.4 | ❌ |
| H5 Leg swept the overnight range | −0.28 (11) | +0.58 (23) | −0.21 (18) | +0.75 (20) | 2/4 | 22% | +0.30 | 77.0 | 21.6 | ❌ |
| H6 BTC 1h agrees (EMA50) | −0.28 (22) | +0.07 (40) | −0.05 (48) | +0.79 (34) | 1/4 | 45% | +0.15 | 33.1 | 21.0 | ❌ |
| H7 Regime switch: last 20 v7 trades > 0R | −0.32 (25) | +0.39 (70) | −0.09 (67) | +0.53 (70) | 0/4 | 72% | +0.22 | 68.1 | 50.4 | ❌ |
| H8 Daily volatility in top half of year | −0.23 (21) | −0.19 (11) | −0.22 (27) | +0.80 (19) | 1/4 | 24% | +0.03 | 14.5 | 2.4 | ❌ |
