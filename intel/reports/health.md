# Strategy health (information only)

As of 2026-11-16 05:00 UTC. Live bots against their own backtests.

## Alerts (3)

- bbcore: parity: 5 live-only entries, largest R difference 0.042
- icore: parity: 1 live-only entries, largest R difference 0.076
- tcore: parity: 2 live-only entries, largest R difference 0.012

## 1. Does the backtest make the same entries as the live bot?

| Bot | Live entries | Matched | Live only | Backtest only | Closed compared | Mean R difference | Largest R difference |
|---|---|---|---|---|---|---|---|
| bbcore | 22 | 17 | 5 | 2 | 12 | -0.018 | 0.042 |
| icore | 7 | 6 | 1 | 2 | 2 | -0.053 | 0.076 |
| tcore | 10 | 8 | 2 | 3 | 2 | -0.012 | 0.012 |

Backtest-only entries are signals the backtest took and the bot did not. The bot's own reason is in parity.csv (for example another position open on the coin, or a refused entry).

| Bot | Coin | Kind | Entry (UTC) | Side | Backtest R | Detail |
|---|---|---|---|---|---|---|
| bbcore | SOL | backtest_only | 2026-10-30 00:00 | SHORT | 1.086 | no skip recorded by the bot |
| bbcore | NEAR | backtest_only | 2026-11-02 08:00 | SHORT | 2.361 | bot skipped: skipped (entry_refused) |
| bbcore | SOL | live_only | 2026-10-24 16:00 | SHORT | - | the backtest has no entry on this candle |
| bbcore | NEAR | live_only | 2026-11-02 12:00 | SHORT | - | the backtest has no entry on this candle |
| bbcore | SOL | live_only | 2026-11-02 16:00 | SHORT | - | the backtest has no entry on this candle |
| bbcore | ZEC | live_only | 2026-11-14 04:00 | SHORT | - | the backtest has no entry on this candle |
| bbcore | ADA | live_only | 2026-11-14 04:00 | SHORT | - | the backtest has no entry on this candle |
| icore | ZEC | backtest_only | 2026-11-01 16:00 | SHORT | -1.037 | bot skipped: skipped (entry_refused) |
| icore | NEAR | backtest_only | 2026-10-29 04:00 | SHORT | - | no skip recorded by the bot |
| icore | ZEC | live_only | 2026-11-02 20:00 | SHORT | - | the backtest has no entry on this candle |
| tcore | SOL | backtest_only | 2026-11-09 00:00 | SHORT | - | bot skipped: skipped (blocked) |
| tcore | SUI | backtest_only | 2026-11-13 04:00 | SHORT | -1.029 | no skip recorded by the bot |
| tcore | SUI | backtest_only | 2026-11-14 04:00 | SHORT | - | no skip recorded by the bot |
| tcore | SUI | live_only | 2026-11-12 16:00 | SHORT | - | the backtest has no entry on this candle |
| tcore | GALA | live_only | 2026-11-14 16:00 | SHORT | - | the backtest has no entry on this candle |

## 2. Live result against backtest windows of the same length

| Bot | Window | Live trades | Live R (closed + open) | Live R (closed only) | Backtest median | Backtest 5% to 95% | Percentile | Alert |
|---|---|---|---|---|---|---|---|---|
| bbcore | 24 days | 22 | +3.93 | -2.14 | +3.24 | -11.11 to +38.26 | 51.5 | no |
| icore | 19 days | 7 | +14.20 | -3.19 | +0.41 | -7.16 to +38.79 | 87.6 | no |
| tcore | 9 days | 10 | +7.73 | -3.12 | -0.93 | -5.60 to +25.89 | 86.7 | no |
| ALL | 24 days | 39 | +25.86 | -8.45 | +6.59 | -24.31 to +147.89 | 68.1 | no |

Percentile = share of backtest windows (same length, since 2021) that did worse than the live result. Open trades are valued at today's price; they may still change.

## 3. Losing run

| Bot | Live losses in a row now | Backtest longest run |
|---|---|---|
| bbcore | 0 | 14 |
| icore | 3 | 17 |
| tcore | 3 | 15 |
| ALL | 1 | 31 |

## 4. Execution

| Bot | n | Median slippage R | Worst |
|---|---|---|---|
| bbcore | 22 | 0.0132 | -0.0313 |
| icore | 7 | 0.0086 | -0.0028 |
| tcore | 10 | 0.0128 | -0.0241 |

Full tables: reports/execution.md.

## Limits

- A few weeks of live trades cannot show a decay. Read the percentile as "not unusual yet" or "unusual", not as proof.
- Parity uses Binance candles; the bots trade on MEXC, so a small difference at a threshold can change a signal.
