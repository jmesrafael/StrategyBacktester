# bb-core 1h, PAPER ONLY

A separate copy of the bb-core bot running the 1h version on simulated money. It is not connected to the live 4h bot in `../bb-core`.

- **Settings:** band 80, trend filter 800, time exit 192 candles, same 5 coins, MEXC candles, start balance $100, same risk steps as live.
- **Start / stop / see results:** `start-paper.cmd`, `stop-paper.cmd`, `status-paper.cmd`.
- **Files:** `state/bot.log` (log), `state/state.json` (positions, trades), `journal/` (every decision).
- **Cannot trade:** `liveAllowed()` always returns false and there are no API keys. Telegram and the ledger are not configured; on the VPS it can report to the dashboard as its own bot (`bb1h`, shown as BB-1h lab) when `/etc/lucidio-1h.env` has the dashboard address.
- **Paper costs (`"realisticPaper": true`, `realpaper.js`):** whole contracts like the live bot; a fill taken from MEXC's real order book at the moment of entry; the coin's own taker fee from MEXC's contract list (never below `minTakerFee`, 0.02%); stops use the 90th-percentile slippage measured by the data recorder (the live book when it is not there); real settled funding for every 8-hour settlement the trade was open through. A failed data call falls back to the fixed model (0.05% fee, 0.02% slippage, no funding) and is flagged on that trade. Set `"realisticPaper": false` for the old fixed model.
- **Runs only while this PC is on:** after a restart run `start-paper.cmd`. Signals missed while it was off are skipped, and open trades are checked against the candles it missed.

`apply-1h-patch.js` lists every change from the 4h files (already applied, do not run again). `parity-check.js` compares the bot with the backtest on MEXC's 1h history in `data/`: on Nov 5, 2026 all 1,454 entries matched, and 6 trades differed in R (time exits across MEXC candle holes: the bot counts clock time, the backtest counts candles).

To move it to the VPS, follow `VPS-1H-PAPER.md`. The bundle is `dist/lucidio-1h-paper.tar.gz`.

## About this copy in the StrategyBacktester repo

This folder is the code and instructions only. It does not hold the running paper record (state/, journal/), the candle data (data/) or the built bundle (dist/):
- the MEXC 1h candles that `parity-check.js` reads are in `research/indicator-top10/mexc1h/`; copy them into a `data/` folder here to run it;
- `bash build-bundle.sh` rebuilds `dist/lucidio-1h-paper.tar.gz`, and `archive-done/DONE-HOME-VPS-INSTRUCTIONS-1h.md` (moved, already installed) carries the bundle inside it;
- the bot that ran on the work PC from Nov 5, 2026 lives in `D:\testing\Strat\bb-core-1h`.
