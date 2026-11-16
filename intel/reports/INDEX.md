# Last run

Run 2026-11-16T05:48 UTC.

| Step | Result | Seconds | Detail |
|---|---|---|---|
| candles | ok | 6.4 | faulty series excluded from use: KNC/1h |
| trades | ok | 0.0 | no read-only database key configured: built from the newest export file (see intel/README.md, "Trade exporter key") |
| headlines | ok | 0.0 | 0 new rows appended |
| recorder | blocked | 0.0 | recorder data pulled: folder not found: D:\testing\Strat\recorder-data\lucidio-recorder. Run lucidio-recorder\pull-recorder-data.cmd YOUR-VPS (needs the VPS ssh login), then run this job again. |
| events | ok | 3.3 | diff_mean = group mean minus the baseline mean (every hour of that coin). The interval is a 95% bootstrap interval (1,000 resamples, fixed seed). |
| reference backtests | ok | 0.9 | R is after costs. cost=standard: 0.05% fee and 0.02% slippage per side, real settled funding. cost=native: the bot's own model. |
| regime | ok | 2.4 | validation: 0 of 6 bot x label tests passed on data from 2024 on |
| correlation | ok | 0.6 | 1h log returns, close over previous close; pair-hours with a missing bar are skipped |
| journal | ok | 0.1 | open trades are valued from Binance prices with the first stop as 1R; the bots trade on MEXC, so open R is an estimate |
| truth check | ok | 0.0 | 4 item(s) need review: see reports/truth-check.md |
| execution | ok | 0.1 | order-book capacity is waiting for the recorder pull |
| exposure | ok | 1.1 | observation and alerts only: no output of this engine is read by any bot |
| strategy health | ok | 0.2 | information only: no output of this engine is read by any bot |
| integrity | ok | 0.4 | 28 checks, 1 blocked: see reports/integrity.md |

## Reports

- [backtest.md](backtest.md)
- [correlation.md](correlation.md)
- [events.md](events.md)
- [execution.md](execution.md)
- [exposure.md](exposure.md)
- [health.md](health.md)
- [integrity.md](integrity.md)
- [journal.md](journal.md)
- [regime.md](regime.md)
- [truth-check.md](truth-check.md)
- [validation/](validation/) (one report per strategy checked by the gatekeeper)
