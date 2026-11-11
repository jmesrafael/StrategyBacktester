# After the upgrade: what to watch, and what "good" looks like

## The new measurement window

It starts on the day the BB-Core upgrade is installed (write the date in `bb-core/RUN-LOG.md`, I do it in Phase 9). The old window (Oct 26, 1:4 build) is closed.

| | BB-Core (no target) | I-Core |
|---|---|---|
| Average per trade | about **+0.35R** (backtest since 2022, real fees and funding) | about **+0.87R** (research, 760 trades) |
| Win rate | about **36%** | about **32%** |
| Trades per month | about **18** | about **9** |
| Worst drop in the backtest | about **23R** | about **30R** |
| Longest losing streak | about 20 | about 16 |
| Where the profit comes from | many medium wins; the top 10 trades are 35% | a few giant trends; the top 10 trades are 74% |

**Two months prove nothing.** Single trades swing from -1R to +20R or more, and I-Core can go many weeks flat. Do not judge before about **150 trades**: that is roughly 8 months for BB-Core and over a year for I-Core. Judge *execution* (are the trades what the backtest would have done) every day; judge *profit* only at the end.

## Daily (2 minutes, you)

- Telegram: a trade message arrives as `[CORE 1]` (BB-Core) or `[CORE 2]` (I-Core). BB-Core's entry shows `Target none`.
- The dashboard `/bot-dashboard/` Status tab: both bots online.
- 00:40 UTC (08:40 PH) BB-Core and 00:50 UTC (08:50 PH) I-Core: the live-vs-backtest compare. It should say `match`.

## Weekly (I do it when you ask, or you run the one command)

- `lucidio.js status` and `icore.js status`: positions, realized R, distance from the best point.
- `perf-watch.js --print`: the stop-and-review checks (also sent to Telegram only when one changes, plus a Monday digest).
- Look that the total of both accounts on the dashboard equals the MEXC app.

## Stop and review (do not ignore these)

A rule that trips is a reason to **look**, never an automatic action. Tell me and I investigate.

1. **Drawdown**: BB-Core 18R = watch, 26R = stop and review. I-Core 22R = watch, 30R = stop and review (the backtest worst was 23R and 30R).
2. A **compare mismatch that repeats**: a live entry the backtest did not take, or the reverse.
3. **Execution**: average slippage clearly above 0.02% of price, or `lagSec` regularly large.
4. A **losing streak** of 20 trades (BB-Core) or 16 (I-Core).
5. The bot **not running** (`Bot is stopped` in red, or the watchdog message).
6. Any message mentioning **stop / target missing**: check the MEXC app that the trade has its stop; the bot re-places it, but you confirm.

## Things that behave differently now (so they do not surprise you)

- **BB-Core has no target.** Winners run until the stop or the 8-day limit, so you will see +4R, +10R and occasionally +30R or more; and fewer, larger wins. The "Target-hit rate" check no longer exists.
- **Risk moves with the account (if you switched the steps on).** The risk percentage drops from 2.5% to 2.0% at $500 and to 1.5% at $1,000, by the *highest* balance so far; it never goes back up during a losing stretch.
- **Deposits raise that peak; withdrawals do not lower it.** A big deposit can move you down a step sooner. That is intended.
- **No small cap.** Trade size now follows the account. Past about $20,000 to $30,000 per position the backtest fills on GALA and ZEC are no longer trustworthy; look at slippage then.
- **Pool money (joins, payouts) still needs both accounts flat.** Use the kill switch first, then act at the first flat window (now longer, because winners run longer).
- **Drops of about a third of the account are normal** at these risk levels (backtest worst case 30-37%).

## One-month review (I prepare it, you read it)

- Trades taken vs trades the backtest took for the same candles (should be the same set).
- Average slippage and delay.
- R so far against the expected band.
- Anything in the log that needed attention.
Then decide whether to leave D2/D3 as they are.
