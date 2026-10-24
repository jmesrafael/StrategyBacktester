# Lucid'io run log

A plain, dated record of what the bot on the VPS has done and what we changed. Newest entry at the bottom. Times are written as "8:17pm"; **UTC** is the server's clock and the candles', **PH** is Philippine time (UTC+8).
This file is for people. The bot's own evidence is in `journal/trades.jsonl` on the VPS (append-only) and in `state/state.json`; the exact start time of the current run is the first `"type":"session"` line of the journal
(`sudo head -n 1 /opt/lucidio/journal/trades.jsonl`) or `sudo journalctl -u lucidio --since "2026-10-23" | head`.

## Key dates

| What | When |
|---|---|
| The bot started on the VPS, looking for its first trade | **Oct 23, 2026**, about 12:17pm UTC (8:17pm PH). Exact time: see the first journal `session` line. |
| First candles it judged | at start-up it looks at the newest closed candle (the 12:00pm UTC close on Oct 23, no signal), then every close after it, the first being the 4:00pm UTC close (12:00am PH, Oct 24). Earlier candles were not its to judge. |
| Mode seen on Oct 24, 2026 | **LIVE**, risk 0.5% of balance, equity $52.31, SOL and ZEC both flat. *The date it was switched to live is not recorded here: add it below when you know it.* |
| Audit target (from the audit: at least 120 days and at least 25 closed trades) | 120 days after the start = **Feb 20, 2027**. Expect about 8 trades a month for both coins together (backtest: `node trades-per-month.js`), so 25 trades is about 3 months. |

## Entries

### Oct 23, 2026 · bot started on the VPS
Installed with `deploy/package.sh` + `deploy/setup-vps.sh` (DEPLOY.md). Started in paper mode, both coins (SOL, ZEC), 4-hour candles on MEXC. Now waiting for the first signal.

### Oct 24, 2026 · 6:18pm PH (10:18am UTC) · first check: no trade yet, and none was due
Question: has the strategy had any trade since the start? Checked with the bot's own decision rules (`sidecar/shadow-recorder.js` `decide()`, proven equal to the backtest engine) on the latest MEXC 4-hour candles (public data only).

Result: **no signal on any candle that closed from Oct 23, 12:00am PH to now, for either coin.** Every close was inside the Bollinger bands. The backtest, run on the same candles, also takes **no trade** in that window and holds no open position.

| Candle closed (UTC / PH) | SOL: distance to the nearest band | ZEC: distance to the nearest band |
|---|---|---|
| Oct 22, 4:00pm / Oct 23, 12:00am | 1.57% | 11.37% |
| Oct 22, 8:00pm / Oct 23, 4:00am | 0.80% | 10.83% |
| Oct 23, 12:00am / Oct 23, 8:00am | 0.90% | 9.95% |
| Oct 23, 4:00am / Oct 23, 12:00pm | 1.42% | 9.28% |
| Oct 23, 8:00am / Oct 23, 4:00pm | 1.55% | 8.06% |
| Oct 23, 12:00pm / Oct 23, 8:00pm  (judged at start-up) | 1.85% | 7.83% |
| Oct 23, 4:00pm / Oct 24, 12:00am  (first close after the start) | 2.01% | 7.20% |
| Oct 23, 8:00pm / Oct 24, 4:00am | 0.92% | 4.62% |
| Oct 24, 12:00am / Oct 24, 8:00am | 0.62% | 1.30% |
| Oct 24, 4:00am / Oct 24, 12:00pm | 0.81% | 1.07% |
| Oct 24, 8:00am / Oct 24, 4:00pm | 0.49% | 1.39% |

- A signal needs a close **outside** a band (and the trend and ATR filters). SOL is closest at 0.49% from a band, ZEC at 1.07 to 1.39%. The next close is Oct 24, 12:00pm UTC (8:00pm PH).
- The only recent backtest trade near this window is a ZEC LONG entered Oct 21, 8:00pm UTC and closed Oct 24, 12:00am UTC. It was entered **before** the bot started, so the bot does not hold it and the bot's own results do not include it.
- Last completed backtest trades: SOL Oct 18 (8:00pm UTC) to Oct 19; ZEC Oct 18 to Oct 19, then the Oct 21 LONG above.

### How to add an entry
Date it ("Oct 25, 2026"), say what happened (first trade, a restart, an update, mode change, a problem) and where the proof is (journal line, log, Telegram message). Keep it short.
