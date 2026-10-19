# Hypothesis round H1–H8 on v7 — SOL + ETH, Binance 15m ($1 risk = 1R)

Protocol and thresholds fixed in ITERATION-LOG.md before this run. Cell = average R per trade (trades kept / trades).

| Rule | SOL 19–23 | SOL 23–26 | ETH 19–23 | ETH 23–26 | Cells better | Kept | Pooled avg | Random-subset percentile | Total R (v7 60.5) | **Pass** |
|---|---|---|---|---|---|---|---|---|---|---|
| v7 (all trades) | −0.18 (70) | +0.41 (79) | −0.04 (96) | +0.57 (77) | — | 100% | +0.19 | — | 60.5 | — |
| H1 Weekday only (Mon–Fri ET) | −0.13 (49/70) | +0.33 (56/79) | −0.02 (75/96) | +0.51 (61/77) | 2/4 | 75% | +0.17 | 34.0 | 41.8 | ❌ |
| H2 With the daily trend (EMA20) | −0.18 (33/70) | +0.12 (45/79) | +0.16 (51/96) | +0.81 (36/77) | 2/4 | 51% | +0.22 | 66.7 | 36.9 | ❌ |
| H3 With the 4h trend (EMA50) | −0.07 (30/70) | +0.04 (40/79) | −0.10 (43/96) | +1.00 (27/77) | 2/4 | 43% | +0.16 | 42.0 | 22.3 | ❌ |
| H4 CHoCH volume ≥ 1.5× avg | −0.24 (52/70) | +0.51 (68/79) | −0.07 (83/96) | +0.56 (75/77) | 1/4 | 86% | +0.21 | 48.2 | 58.4 | ❌ |
| H5 Leg swept the overnight range | −0.28 (11/70) | +0.64 (22/79) | −0.21 (18/96) | +0.75 (20/77) | 2/4 | 22% | +0.31 | 66.2 | 22.2 | ❌ |
| H6 BTC 1h agrees (EMA50) | −0.28 (22/70) | +0.09 (39/79) | −0.03 (47/96) | +0.82 (33/77) | 2/4 | 44% | +0.16 | 30.9 | 22.9 | ❌ |
| H7 Regime switch: last 20 v7 trades > 0R | −0.32 (25/70) | +0.39 (70/79) | −0.09 (67/96) | +0.53 (70/77) | 0/4 | 72% | +0.22 | 12.4 | 50.4 | ❌ |
| H8 Daily volatility in top half of year | −0.23 (21/70) | −0.19 (11/79) | −0.22 (27/96) | +0.80 (19/77) | 1/4 | 24% | +0.03 | 22.0 | 2.4 | ❌ |


