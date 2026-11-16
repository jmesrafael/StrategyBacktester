# Combined exposure (alert-only)

As of 2026-11-16 05:00 UTC. Live bots only. Nothing here changes a trade.

## Now

17 open positions. Gross risk $70.68, net risk $-70.68 (0% long). **Effective independent bets: 1.28** (1 = one single bet, 17 = all independent). Open net R +34.31. Largest coin: GALA (20% of risk).

| Bot | Positions | Gross risk $ | Effective bets | Long share |
|---|---|---|---|---|
| icore | 4 | 6.11 | 1.23 | 0% |
| tcore | 7 | 22.21 | 1.27 | 0% |
| bbcore | 6 | 42.36 | 1.28 | 0% |

## Stress: what a BTC move would do to the open positions

| Scenario | Total R | Total USD | Worst position |
|---|---|---|---|
| BTC -10% | +38.76 | +148.27 | bbcore ARB +0.96R |
| BTC -5% | +19.39 | +74.16 | bbcore ARB +0.48R |
| BTC +5% | -19.39 | -74.16 | icore SOL -1.74R |
| BTC +10% | -38.76 | -148.27 | icore SOL -3.47R |

Each coin moves by its beta to BTC (from the last 168h). Loss in R = coin move / stop distance. A move that reaches a stop shows about -1R for that position.

## History of the alert thresholds

Alert points: 93 of 134. First: 2026-10-30 04:00.

| Time (UTC) | Open | Gross $ | Long share | Effective bets | Open net R | Alert |
|---|---|---|---|---|---|---|
| 2026-10-25 00:00 | 0 | 0 | - | - | +0.00 | - |
| 2026-10-26 00:00 | 0 | 0 | - | - | +0.00 | - |
| 2026-10-27 00:00 | 0 | 0 | - | - | +0.00 | - |
| 2026-10-28 00:00 | 0 | 0 | - | - | +0.00 | - |
| 2026-10-29 00:00 | 0 | 0 | - | - | +0.00 | - |
| 2026-10-30 00:00 | 1 | 1.45 | 0% | 1 | +1.15 | - |
| 2026-10-31 00:00 | 4 | 15.86 | 0% | 1.16 | -0.85 | effective bets 1.16 below 2 |
| 2026-11-01 00:00 | 2 | 6.18 | 0% | 1.05 | +1.01 | - |
| 2026-11-02 00:00 | 2 | 6.18 | 0% | 1.05 | +1.25 | - |
| 2026-11-03 00:00 | 7 | 26.14 | 0% | 1.25 | +4.55 | effective bets 1.25 below 2 |
| 2026-11-04 00:00 | 7 | 22.17 | 0% | 1.25 | +2.42 | effective bets 1.25 below 2 |
| 2026-11-05 00:00 | 4 | 11.7 | 8% | 1.6 | +1.25 | effective bets 1.6 below 2 |
| 2026-11-06 00:00 | 7 | 18.28 | 5% | 1.46 | +7.49 | effective bets 1.46 below 2 |
| 2026-11-07 00:00 | 7 | 18.28 | 5% | 1.43 | +5.79 | effective bets 1.43 below 2 |
| 2026-11-08 00:00 | 6 | 13.55 | 7% | 1.53 | +5.41 | effective bets 1.53 below 2 |
| 2026-11-09 00:00 | 7 | 15.96 | 6% | 1.45 | +8.79 | effective bets 1.45 below 2; open net R 8.8 beyond +-8 |
| 2026-11-10 00:00 | 10 | 30.64 | 0% | 1.24 | +10.04 | effective bets 1.24 below 2; open net R 10 beyond +-8 |
| 2026-11-11 00:00 | 9 | 26.08 | 0% | 1.25 | +14.59 | effective bets 1.25 below 2; open net R 14.6 beyond +-8 |
| 2026-11-12 00:00 | 9 | 26.08 | 0% | 1.29 | +18.11 | effective bets 1.29 below 2; open net R 18.1 beyond +-8 |
| 2026-11-13 00:00 | 11 | 34.45 | 0% | 1.31 | +19.69 | effective bets 1.31 below 2; open net R 19.7 beyond +-8 |
| 2026-11-14 00:00 | 11 | 27.56 | 0% | 1.26 | +18.32 | effective bets 1.26 below 2; open net R 18.3 beyond +-8 |
| 2026-11-15 00:00 | 17 | 70.68 | 0% | 1.32 | +43.96 | effective bets 1.32 below 2; open net R 44 beyond +-8 |
| 2026-11-16 00:00 | 17 | 70.68 | 0% | 1.28 | +31.13 | effective bets 1.28 below 2; open net R 31.1 beyond +-8 |

## Limits

- Correlation changes quickly in a sell-off, and this uses the last 7 days only.
- Thresholds are first guesses in config.json; the history shows how often each would have fired. They are not tuned.
