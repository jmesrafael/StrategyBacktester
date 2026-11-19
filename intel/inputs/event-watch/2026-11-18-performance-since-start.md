# Pool performance since start (Oct 23 to Nov 17 23:50 UTC, 2026)

Source: ledger Supabase (nav_snapshots, pool_equity, wallet_snapshots, closed_trades, capital_events). Read-only. "True value" = pool equity including open trades; "book" = open trades kept out until they close.

## Headline

| Item | USDT |
|---|---|
| Money put in (5 groups of deposits) | 612.99 |
| Pool true value now | 648.68 |
| **Profit including open trades** | **+35.69 (+5.8% of money in)** |
| Book value (closed trades only) | 602.53 |
| Realized so far | about -10.5 |
| Open (unrealized) trades | +46.6 |
| Unit price now | 1.0339 (+3.4% from the first unit at 1.000) |
| Peak unit price | 1.1463 on Nov 14 (now 9.8% below it) |
| Low unit price | about 0.910 (Nov 7) |

## Capital added

| Date | Deposited | Pool capital after |
|---|---|---|
| Oct 23 | 52.31 | 52.31 |
| Oct 28 | 200.00 | 252.31 |
| Nov 7 | 158.03 (66.40 + 91.63) | 410.34 |
| Nov 14 | 202.65 (15.59 + 187.06) | 612.99 |

## By month (true value, deposits removed)

| Period | Start value | Deposits | End value | Profit | Unit price move |
|---|---|---|---|---|---|
| Oct 23-31 | 0 | 252.31 | 234.70 | -17.61 | 1.000 to 0.918 (-8.2%) |
| Nov 1-17 | 234.70 | 360.68 | 648.68 | +53.30 | 0.918 to 1.034 (+12.6%) |
| Total | | 612.99 | 648.68 | +35.69 | 1.000 to 1.034 (+3.4%) |

## Unit price path

| Date | Unit price | True value |
|---|---|---|
| Oct 28 | 0.981 | 250.72 |
| Oct 31 | 0.918 | 234.70 |
| Nov 7 | 0.910 | 391.60 |
| Nov 9 | 0.912 | 392.41 |
| Nov 12 | 1.009 | 433.95 |
| Nov 13 | 0.982 | 422.31 |
| Nov 14 | 1.146 | 719.27 |
| Nov 15 | 1.094 | 686.18 |
| Nov 17 | 1.034 | 648.68 |

## Per bot (closed trades in the ledger, plus wallet now)

| Bot | Live since | Closed | Wins | Net realized | Sum R | Open now | Unrealized | Wallet equity |
|---|---|---|---|---|---|---|---|---|
| BB-Core | Oct 28 | 18 | 6 | -0.85 | +0.38 | 4 | +0.5 | 323.08 |
| I-Core | Oct 28 | 3 | 0 | -3.10 | -3.19 | 3 | +13.2 | 156.75 |
| T-CORE | Nov 7 | 3 | 0 | -8.57 | -3.12 | 8 | +32.9 | 168.85 |

Notes:
- T-CORE's wallet holds one position that is not its own (the I-Core SOL short from Oct 29, about +$10.8). See 2026-11-18-manual-actions-log.md.
- BB-Core SOL close of Nov 17 (+18.02) was a manual close.
- Wallet equity moved by transfers and deposits, so per-bot profit cannot be read from equity alone; the pool numbers above are the deposit-adjusted ones.
- Wallet equity total (649.0) matches the pool true value (648.7).

## Read

- Realized results are still slightly negative; the whole gain sits in open trades, so it is not locked in.
- Pattern: low win rate (6 of 24 closed), but winners are 3-4R and losers about -1R (stops).
- Large swings come from the daily marks of a short-only book: +12.6% in Nov 1-14 peak, then -9.8% off the peak with the Nov 15-17 bounce.
