# News reaction study: rules fixed before running (Nov 25, 2026)

Source of the questions: `../news-lab/NEWS-TRADING-PDF-NOTES.md` (ideas from a stock-market lecture). Research only. No bot is changed.

## Data
- Releases: `ledger/lib/macro-history.json` (US high-impact releases, Sep 2020 on). Releases sharing a minute count **once**, under the most important family (lowest tier, then id).
- Prices: candle library 1m (Binance USDT-M) for BTC, ETH, SOL; real funding.
- Control: "normal days" = weekdays with no tracked release, same measurements at 8:30 New York time.
- Periods: IS = up to 2023, OOS = 2024 on.

## Questions
1. **Speed.** Move at 1, 5, 15, 60, 180 min against the move at 6 h: median |move now| / |move at 6 h|, and share with the same direction as at 6 h. Always beside normal days.
2. **Follow or fade.**
   - R1 "follow the first move": side = sign of the move over the first 15 minutes. Fill at the next 1m open (minute 15). Exit at 1 h, 3 h, 6 h. Fade = the opposite side.
   - R2 "first move, only if big": R1 only when the 15-minute move is classed not neutral by Event History (score >= 1.5 and >= 0.3%) on BTC.
   - R3 "trade the surprise": side = long if the release lean is good, short if bad (mixed / neutral skipped). Same fill and exits.
3. **Longer drift.** Enter 6 h after the release in the direction of the 6 h move, exit at 24 h and 72 h. Split by up and down moves (is bad news slower?).
4. **Surprise size.** Surprise = actual minus forecast on each lead number, signed so + is good for crypto, divided by the root mean square of that number's earlier surprises (at least 8 earlier ones), averaged. Groups: big bad (<= -1), small bad, in line (0), small good, big good (>= 1). Rank correlation with the move at 15 min, 1 h, 6 h, 24 h, IS and OOS.

## Costs
0.05% taker + 0.02% slippage per side (0.14% round trip), plus funding. Also shown at 2x fees and slippage.

## Pass mark for a trading rule (all must hold)
1. At least 30 trades in IS and 30 in OOS.
2. Average net result above 0 in IS **and** in OOS on BTC.
3. Above 0 overall at 2x costs.
4. Above 0 overall without the 10 best trades.
5. Above 0 in both periods on ETH and on SOL.
6. Better than the same rule on normal days.
7. Overall t-statistic at least 2.

R3 has no signal on a normal day, so its control (point 6) is the same long / short mix applied blindly to normal days. Funding is counted in all results.

Per-family cells need at least 15 trades in each period and are judged on points 2 to 5. Per-family cells are exploratory: with many cells, some pass by luck. The number passing is reported against the number tried. A pass is only a LEAD (paper test), never a live change.
