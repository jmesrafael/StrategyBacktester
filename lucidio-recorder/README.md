# Lucid'io data recorder

Writes down what the market and the order book look like, all day, from MEXC's **public** data. No key, no account, no orders: it cannot trade. Research then uses what the bots actually saw (candles with no holes, real funding, real order-book slippage) instead of guesses.

Install and everyday use: see `VPS-LAB-INSTALL.md` (in `../vps-lab`). This file is about the data.

## What it records

| Every | What |
|---|---|
| 5 minutes | 1m candles of SOL, ZEC, NEAR, ADA, GALA · an order-book snapshot per coin (spread, depth near the price, and the adverse slippage of a market buy and sell of $100, $500, $1,000, $5,000 and $20,000, in basis points against the mid price) · the funding rate at that moment · a small heartbeat to the dashboard |
| hour | 1h and 4h candles · MEXC's settled funding rates · the regime of every coin and of the market · the slippage summary the 1h paper bot reads |
| day | gzip every finished month / day · the optional copy off the server |

Gaps close themselves: after any downtime the next cycle fetches everything missing (MEXC keeps the history), and `status.sh verify` lists any hole it could not fill.

## Where it is

`/var/lib/lucidio-recorder` (or `RECORDER_DIR`). Plain JSON lines, readable by anything; `.gz` files are plain gzip.

```
candles/<SYMBOL>/<1m|1h|4h>/YYYY-MM.jsonl[.gz]   [time, open, high, low, close, volume]     (the same layout as research/indicator-top10/mexc1h)
funding/<SYMBOL>.jsonl                           [settleTime ms, rate, cycle hours]           what MEXC really charged
book/<SYMBOL>/YYYY-MM-DD.jsonl[.gz]              {t, bid, ask, mid, sp, buy:{size:bp}, sell:{size:bp}, ask_d01, bid_d01, ask_d05, bid_d05, fr}
regime/hourly.jsonl                              the regime of every coin and of the market, once an hour
summary/slippage.json                            7-day median and 90th percentile slippage per coin, side and size (read by the 1h paper bot)
summary/regime.json, summary/status.json         the latest regime and the recorder's own health
```

Reading it in research code (Node): split the file on newlines and `JSON.parse` each line; for `.gz` run it through `zlib.gunzipSync` first. A torn last line (a crash mid-write) is possible and should be skipped.

## The regime

`regime.js` says what kind of market a coin is in, from its 1h candles: **trending up / trending down** (the price is going somewhere: efficiency ratio over 48 h of 0.30 or more), **volatile** (band width in the widest fifth of 90 days), **quiet** (the narrowest fifth: a squeeze, where breakouts start), **ranging** (the rest). The market is called trending, choppy or mixed from how many coins agree, and the average correlation of the coins shows how much of a day's trades are really one bet.

`regime-history.js` runs the 1h BB-Core backtest over MEXC's candles since 2020 and groups its trades by the regime the coin was in at the signal. Its output, `LEDGER/bot-dashboard/regime-history.json`, is what the dashboard shows beside the current regime. Re-run it whenever the strategy or the candle files change:

```
node regime-history.js ../research/indicator-top10/mexc1h ../LEDGER/bot-dashboard/regime-history.json
```

The differences between regimes are small next to the swing of single trades. Read it as context, not as a trading rule.

## Commands

```
node recorder.js run        the service (loops forever)
node recorder.js once       one full cycle, then exit (the installer's first run)
node recorder.js status     what it has recorded, the market now, measured slippage
node recorder.js verify     holes in the stored candles
node --test test/recorder-test.js
```

Settings are environment variables (the service reads `/etc/lucidio-recorder.env`): `RECORDER_DIR`, `DASHBOARD_URL`, `DASHBOARD_PUSH_SECRET`, `RECORDER_SYNC_CMD` (a command that copies the data folder somewhere safe, once a day).

## Safety

Public endpoints only (checked by the installer: it refuses code that mentions a key or a private endpoint). Runs as its own user with a memory cap, 20% of one CPU at most, idle disk priority, and a read-only system except its own data folder. A failing task is logged and counted, never fatal. If the disk gets below 1.5 GB free it stops writing 1m candles and order books and says so on the dashboard.
