# bb-core 1h, PAPER ONLY

A separate copy of the bb-core bot running the 1h version on simulated money. It is not connected to the live 4h bot in `../bb-core`.

- **Settings:** band 80, trend filter 800, time exit 192 candles, same 5 coins, MEXC candles, start balance $250, same risk steps as live.
- **Start / stop / see results:** `start-paper.cmd`, `stop-paper.cmd`, `status-paper.cmd`.
- **Files:** `state/bot.log` (log), `state/state.json` (positions, trades), `journal/` (every decision).
- **Cannot trade:** `liveAllowed()` always returns false, there are no API keys, and Telegram, ledger and dashboard are not configured.
- **Paper fills:** at the price when the bot wakes, about 2 seconds after the candle closes. No funding is charged, so results run slightly high.
- **Runs only while this PC is on:** after a restart run `start-paper.cmd`. Signals missed while it was off are skipped, and open trades are checked against the candles it missed.

`apply-1h-patch.js` lists every change from the 4h files (already applied, do not run again). `parity-check.js` compares the bot with the backtest on MEXC's 1h history in `data/`: on Nov 5, 2026 all 1,454 entries matched, and 6 trades differed in R (time exits across MEXC candle holes: the bot counts clock time, the backtest counts candles).

To move it to the VPS, follow `VPS-1H-PAPER.md`. The bundle is `dist/lucidio-1h-paper.tar.gz`.

## About this copy in the StrategyBacktester repo

This folder is the code and instructions only. It does not hold the running paper record (state/, journal/), the candle data (data/) or the built bundle (dist/):
- the MEXC 1h candles that `parity-check.js` reads are in `research/indicator-top10/mexc1h/`; copy them into a `data/` folder here to run it;
- `bash build-bundle.sh` rebuilds `dist/lucidio-1h-paper.tar.gz`, and `HOME-VPS-INSTRUCTIONS.md` already carries the bundle inside it;
- the bot that ran on the work PC from Nov 5, 2026 lives in `D:\testing\Strat\bb-core-1h`.
