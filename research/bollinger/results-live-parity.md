# BB Breakout — is the backtest the same as live execution?

## 1. Truncation test (no future data, no repainting)

The app engine is run on the candles **up to a random cut only** (as if that candle had just closed and nothing after it exists), and every order it decided up to the cut is compared with the full-history run.

| Coin | Cuts tested | Orders compared | Mismatches |
|---|---|---|---|
| SOL | 150 | 51,403 | **0** |
| DOGE | 150 | 56,227 | **0** |
| ZEC | 150 | 52,403 | **0** |

## 2. Bot replay vs the backtest (same costs as the backtest, no funding)

An independent bot written from scratch: it gets one closed 4h candle at a time, recomputes the indicators only from candles it has already seen, decides at the close, and its orders fill on the next candle. Compared with the app's backtest trade by trade.

| Coin | Backtest trades | Bot trades | Same entry candle | Same exit candle | Backtest R | Bot R |
|---|---|---|---|---|---|---|
| SOL | 325 | 325 | 325 | 325 | +90.95 | +90.95 |
| ↳ SOL candles where stop AND target were both touched | 0 (counted as a stop — the worse case) | | | | | |
| DOGE | 358 | 357 | 357 | 357 | +79.41 | +80.24 |
| ↳ DOGE candles where stop AND target were both touched | 0 (counted as a stop — the worse case) | | | | | |
| ZEC | 357 | 357 | 357 | 357 | +100.04 | +100.04 |
| ↳ ZEC candles where stop AND target were both touched | 0 (counted as a stop — the worse case) | | | | | |

## 3. Re-run with Binance's real cost structure ($5 risk per trade, SOL + DOGE + ZEC, by year the trade closes)

Market entry, stop and time exit = taker fee + 0.02% slippage; take-profit = resting limit (maker fee, no slippage). Funding = actual Binance history.

| Case | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Total | Years + |
|---|---|---|---|---|---|---|---|---|---|
| Backtest assumption (0.04% + 0.02% every side, no funding) | +$164 | +$382 | +$181 | +$94 | +$226 | +$249 | +$59 | **+$1356** | 7 of 7 |
| Binance base tier: taker 0.05%, maker 0.02%, + funding | +$154 | +$356 | +$173 | +$88 | +$216 | +$248 | +$55 | **+$1292** | 7 of 7 |
| …and the target only fills if price trades 0.05% through it | +$154 | +$336 | +$176 | +$83 | +$216 | +$253 | +$55 | **+$1274** | 7 of 7 |
| …and 0.05% slippage on market orders / stops (thin books) | +$148 | +$329 | +$167 | +$70 | +$207 | +$245 | +$46 | **+$1212** | 7 of 7 |
