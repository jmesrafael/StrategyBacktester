# Validation Check C — intrabar-ordering audit for v7

Run 2026-10-19T04:47Z · v7 frozen (ie.js sha256 6539c98f…) · Bybit perp, trades re-checked on 15m (current / pessimistic) and on 1-minute candles · $10 per R.

Modes: **current** = the engine behind every earlier number; **pessimistic** = worst-case ordering when one 15m candle touches an adverse and a favourable level, plus one extra tick on breakeven and tightened-stop exits (tick: SOL 0.001, ETH 0.01); **1m replay** = same trades, entries unchanged, exits re-simulated minute by minute; a 1m candle that still holds both levels falls back to the pessimistic rule.

## 0. Harness check

- SOL: the execution-mode simulator in 'current' mode reproduces ie.js trade-for-trade (129 trades: entry and exit candle, reason, R): **yes**; 1m replay could not be completed for 0 trades (these fall back to their 15m result).
- ETH: the execution-mode simulator in 'current' mode reproduces ie.js trade-for-trade (150 trades: entry and exit candle, reason, R): **yes**; 1m replay could not be completed for 0 trades (these fall back to their 15m result).

## 1. Exposure — trades with at least one ambiguous 15m candle

Ambiguous = one candle touched both an adverse and a favourable level, so the order is a guess: stop & target in the same candle ("stop+TP"), stop & the breakeven trigger ("stop+trigger"), or the breakeven trigger & the breakeven level (price reached +1R and came back to entry inside one candle: "trigger+BE level").

| Coin | Year | Trades | Ambiguous trades | Share | stop+TP | stop+trigger | trigger+BE level |
|---|---|---|---|---|---|---|---|
| SOL | A2 | 20 | 0 | 0% | 0 | 0 | 0 |
| SOL | A1 | 30 | 2 | 7% | 1 | 0 | 1 |
| SOL | Y1 | 25 | 0 | 0% | 0 | 0 | 0 |
| SOL | Y2 | 30 | 3 | 10% | 0 | 0 | 3 |
| SOL | Y3 | 24 | 1 | 4% | 0 | 0 | 1 |
| **SOL** | **all** | **129** | **6** | **5%** | 1 | 0 | 5 |
| ETH | A2 | 32 | 5 | 16% | 0 | 0 | 5 |
| ETH | A1 | 34 | 2 | 6% | 1 | 0 | 1 |
| ETH | Y1 | 22 | 1 | 5% | 0 | 0 | 1 |
| ETH | Y2 | 24 | 0 | 0% | 0 | 0 | 0 |
| ETH | Y3 | 29 | 2 | 7% | 1 | 0 | 1 |
| **ETH** | **all** | **150** | **10** | **7%** | 2 | 0 | 8 |

## 2. Profit under the three modes

| Coin | Period | Trades (cur / pess / 1m) | **Current** | **Pessimistic** | Pess ÷ current | **1m replay** | 1m vs current |
|---|---|---|---|---|---|---|---|
| SOL | A2 | 20 / 20 / 20 | −$40 | −$40 | — | −$35 | -12.6% |
| SOL | A1 | 30 / 30 / 30 | −$105 | −$106 | — | −$105 | 0.0% |
| SOL | A pooled (A2+A1) | 50 / 50 / 50 | −$145 | −$145 | — | −$140 | -3.5% |
| SOL | Y1 | 25 / 25 / 25 | +$118 | +$118 | 100% | +$118 | 0.0% |
| SOL | Y2 | 30 / 30 / 30 | +$132 | +$133 | 101% | +$133 | 0.8% |
| SOL | Y3 | 24 / 24 / 24 | +$117 | +$87 | 74% | +$117 | 0.0% |
| SOL | Oct23–Oct26 pooled | 79 / 79 / 79 | +$367 | +$338 | 92% | +$368 | 0.3% |
| ETH | A2 | 32 / 32 / 32 | +$50 | −$39 | -78% | +$54 | 8.1% |
| ETH | A1 | 34 / 34 / 34 | −$29 | −$59 | — | −$29 | 0.0% |
| ETH | A pooled (A2+A1) | 66 / 66 / 66 | +$21 | −$98 | -468% | +$25 | 19.3% |
| ETH | Y1 | 22 / 22 / 22 | +$136 | +$104 | 77% | +$131 | -3.7% |
| ETH | Y2 | 24 / 24 / 24 | +$197 | +$197 | 100% | +$192 | -2.5% |
| ETH | Y3 | 29 / 29 / 29 | +$176 | +$176 | 100% | +$181 | 2.8% |
| ETH | Oct23–Oct26 pooled | 75 / 75 / 75 | +$509 | +$477 | 94% | +$504 | -1.0% |

## 3. What actually changes

- SOL pessimistic: 1 of 129 matching trades change exit type; trades dropped from the sequence 0, added 0. SOL 1m replay: 1 of 129 trades change exit type; median |ΔR| 0.000, 90th percentile 0.00; trades that still had an ambiguous 1m candle: 0.
- ETH pessimistic: 5 of 150 matching trades change exit type; trades dropped from the sequence 0, added 0. ETH 1m replay: 1 of 150 trades change exit type; median |ΔR| 0.000, 90th percentile 0.00; trades that still had an ambiguous 1m candle: 0.

## 4. Verdict (pre-registered)

PASS per coin if: pessimistic profit ≥ 60% of current (Oct23–Oct26 pooled) **and** every coin-year Y1–Y3 stays ≥ $0 under pessimistic, **and** 1m replay within ±20% of current profit.

| Coin | Pessimistic ≥ 60% of current | Y1 / Y2 / Y3 pessimistic ≥ $0 | 1m replay within ±20% | **Check C** |
|---|---|---|---|---|
| SOL | ✅ +$338 / +$367 = 92% | ✅ +$118 / +$133 / +$87 | ✅ +$368 (0.3%) | **PASS** |
| ETH | ✅ +$477 / +$509 = 94% | ✅ +$104 / +$197 / +$176 | ✅ +$504 (-1.0%) | **PASS** |
