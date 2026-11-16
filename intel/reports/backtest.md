# Reference backtests of the live bots (unified engine)

Built 2026-11-16T05:48 UTC. 4h Binance candles, each bot on its live coins, whole history.

| Bot | Rules | Costs | Coins | Trades | Total R | R per trade | Win rate | Worst drop R | Longest losing run | Total without 10 best trades | Period |
|---|---|---|---|---|---|---|---|---|---|---|---|
| bbcore | v3 | standard | SOL ZEC NEAR ADA GALA ARB | 1701 | 694.6 | +0.408 | 36% | 27.2 | 14 | 483.6 | 2020-03-08 to 2026-11-13 |
| bbcore | v3 | native | SOL ZEC NEAR ADA GALA ARB | 1701 | 695.2 | +0.409 | 36% | 27.2 | 14 | 484.1 | 2020-03-08 to 2026-11-13 |
| bbcore | legacy | standard | SOL ZEC NEAR ADA GALA ARB | 1508 | 627.9 | +0.416 | 37% | 31.2 | 20 | 413.8 | 2020-03-08 to 2026-11-14 |
| bbcore | legacy | native | SOL ZEC NEAR ADA GALA ARB | 1508 | 628.1 | +0.417 | 37% | 31.2 | 20 | 414.1 | 2020-03-08 to 2026-11-14 |
| icore | v3 | standard | SOL ZEC NEAR ADA GALA | 813 | 788.1 | +0.969 | 32% | 27.6 | 17 | 233.9 | 2020-03-09 to 2026-11-09 |
| icore | v3 | native | SOL ZEC NEAR ADA GALA | 813 | 775.4 | +0.954 | 32% | 28.7 | 17 | 219 | 2020-03-09 to 2026-11-09 |
| icore | legacy | standard | SOL ZEC NEAR ADA GALA | 768 | 667.4 | +0.869 | 32% | 28 | 16 | 185.5 | 2020-03-09 to 2026-11-09 |
| icore | legacy | native | SOL ZEC NEAR ADA GALA | 765 | 652.9 | +0.853 | 32% | 30.2 | 16 | 168.3 | 2020-03-09 to 2026-11-09 |
| tcore | v3 | standard | SOL ZEC NEAR ADA GALA ETH SUI ARB | 1149 | 1104.2 | +0.961 | 37% | 30.9 | 15 | 390.5 | 2020-01-05 to 2026-11-13 |
| tcore | v3 | native | SOL ZEC NEAR ADA GALA ETH SUI ARB | 1148 | 1086.6 | +0.946 | 37% | 36 | 15 | 365.7 | 2020-01-05 to 2026-11-13 |
| tcore | legacy | standard | SOL ZEC NEAR ADA GALA ETH SUI ARB | 896 | 1034.4 | +1.154 | 22% | 40.7 | 28 | 371.8 | 2020-01-02 to 2026-11-09 |
| tcore | legacy | native | SOL ZEC NEAR ADA GALA ETH SUI ARB | 895 | 1008.2 | +1.127 | 22% | 51.1 | 28 | 339.2 | 2020-01-02 to 2026-11-09 |

## Cost models

- standard: 0.05% taker fee and 0.02% slippage on each side, real settled funding. Used for all new research so results are comparable.
- native: BB-CORE uses the same fees and slippage with real funding; I-CORE and T-CORE charge fee plus slippage twice and a flat 0.005% per candle for funding inside the R formula, not in the fill price. The gap between the two rows of a bot is the size of that difference.

test/backtest-parity.test.js proves the engine reproduces each bot's own backtest trade for trade under its native costs.
