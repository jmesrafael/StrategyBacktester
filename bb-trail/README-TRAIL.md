# BB-Trail paper lab

A paper-only bot that forward-tests **bb-trail P14**, the third bot suggested in the ledger report *Live Pair vs Three-Bot Mix* (Nov 6, 2026). Simulated money, real MEXC prices, real-world costs. It cannot send an order: live trading is locked off in the code, the config and the installer.

## The strategy

| | bb-core (live) | BB-Trail (this lab) |
|---|---|---|
| Entry | 4h close outside Bollinger(20, 2) with the SMA(200) trend, at least 0.3 ATR from the middle band | **the same** |
| Stop | the Bollinger middle band | 2 × ATR(14) from the entry |
| Exit | 48 candles (8 days) | a trailing stop 14 × ATR behind the best price; no target, no time limit (safety exit at 1,200 candles) |
| Coins | SOL, ZEC, NEAR, ADA, GALA | the same |

Backtest 2020 → Nov 2026 (Binance, real costs): 613 trades, +788R, 21% winners, +1.29R a trade, worst drop 29.7R, longest losing streak 26, about 7.7 trades a month. The median trade loses 1R; the result comes from a few long trend runs (the best was +217R).

**It will not take the same trades as bb-core.** The entry rule is shared, but each bot holds one position per coin and BB-Trail stays in a trade for weeks. While it is in a trade it skips signals that bb-core takes, and the other way round. Each bot is judged only against **its own** backtest on the same candles (`compare-live-vs-backtest.js`, run daily).

## What it records (for analysis)

- **Journal** (`/var/lib/bbtrail/journal/trades.jsonl`): every entry, exit and skipped signal, with the Bollinger numbers behind the decision, the fill from the real order book, contracts, fees, real settled funding, slippage source, and for each closed trade the **best and worst price reached (MFE / MAE in R)**, how much the trail gave back, the stop locked at exit, how often the stop moved, and the candles held.
- **Snapshots** (`journal/snapshots.jsonl`): balance and positions every run.
- **Runs** (`runs.jsonl`, `bot.log`): timing, MEXC latency, candle gaps, clock drift, errors.
- **Daily comparison** (`audit/compare-<date>.txt/.json`): every trade against this bot's own backtest on the same candles; the summary goes to the dashboard.
- **Lab report** (`lab-report.js`): results, trend capture and real costs next to the backtest's own numbers.

## Costs (realisticPaper)

Whole contracts as on MEXC (a coin whose one contract risks more than 1.5× the target is skipped), the entry walks MEXC's real order book, the coin's listed taker fee (never below 0.02%: ZEC's promotional 0% is not counted as free), real settled funding for every hour held, stop slippage from the data recorder's 90th percentile when it runs, the live book otherwise.

## Commands (on the VPS)

```
sudo bash /opt/bbtrail/deploy-trail/status.sh            service, balance, open trades, log, last comparison
sudo bash /opt/bbtrail/deploy-trail/status.sh report     research report vs the backtest
sudo bash /opt/bbtrail/deploy-trail/status.sh compare    every trade vs its own backtest, now
sudo bash /opt/bbtrail/deploy-trail/status.sh json       the report as JSON (to copy off the server)
sudo journalctl -u bbtrail -f                            live log
sudo touch /opt/bbtrail/STOP                             no new entries (open trades are still managed); rm to resume
```

## On this PC

```
npm test                         parity with the research engine (613 trades identical), end-to-end trade with realistic costs, the I-Core safety tests
node icore.js check              read-only pre-flight against MEXC (public data)
node icore.js replay             the whole history through the bot loop vs its backtest
```

Built from the I-Core bot by `apply-trail-patch.js` (24 checked edits) plus a new `icore-core.js`; the file names stay I-Core's so the proven machinery (journal, comparison, dashboard push, safety tests) runs unchanged. Settings: `bot-config.json` (paper, $100 start, the live bots' risk steps 2.5% → 2% at $500 → 1.5% at $1,000, halt at 45R below the best point).
