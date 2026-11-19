# Why TRI-CORE loses in streaks, and where it makes its money (Nov 19, 2026)
Run: `node analyze.js` (all tables in `RESULTS.md`, data in `results.json`). Live rules v3, each bot on its live coins, Binance 4h,
Jan 2020 to Nov 12 2026, fees + slippage + funding included. 3,699 trades. Diagnostic study: no bot was changed.

## Conclusions
1. **Losing streaks are sideways markets.** In half of all trades (51-54% for every bot), the coin moved less than 3 ATR in the 7 days after entry.
   Those trades lose on balance (BB-CORE -299R, T-CORE -216R). In the choppiest group (efficiency under 0.10), BB-CORE and T-CORE lose about -0.4R per trade.
   Most of the 14-loss streaks fall in windows where the coins' average efficiency was 0.07-0.12, against a normal 0.15
   (examples: Jan 2025, Feb-Mar 2026, Jun-Jul 2023, Oct 2026). Every trade in those streaks ended at its stop.
2. **The second cause is a sharp reversal, not chop.** 19-22% of trades see a 3+ ATR move against us within 7 days and almost never win.
   This explains streaks such as Oct-Nov 2022 (the FTX collapse), Dec 2024-Jan 2025 and Sep 2024.
3. **All the profit comes from about a quarter of the trades.** The 27% of trades where the coin then trended 3+ ATR our way win 76% of the time
   and earn more than the whole total (BB-CORE +1,415R, I-CORE +1,014R, T-CORE +1,634R). The best 5% of trades
   (185 of them) earn +952 weighted R, more than TRI-CORE's whole +874R. They are long holds (median 23 days, against 4.7 for all trades) in clean trends (efficiency 0.31, against 0.15).
4. **The edge sits in longs taken with BTC above its SMA200.** I-CORE and T-CORE shorts barely pay (+0.01 to +0.30R per trade). Longs pay +1.6 to +3.4R per trade.
5. **By month:** the choppiest fifth of months lose 50% of the time and make about 0R. The middle and trendier months lose only 6-18% of the time.
   ZEC, ADA and SOL carry the most. SUI adds almost nothing (+5.5R). ARB and ETH are small.
6. **The stop itself is fine.** The streaks come from the market regime. Any trend-following system bleeds small stops while it waits in a range. A 14-loss streak lasts about 2-4 weeks and costs about 14R per bot.

## Lead worth a proper test (not adopted)
BB-CORE entries made when the coin had ALREADY trended hard (ADX(14) above about 27, or efficiency over the previous 7 days above about 0.22)
make about 0R per trade, in both 2020-22 (+0.10/+0.11) and 2023-26 (+0.01/+0.08). Entries after a quiet week make +0.6 to +1.4R.
The cut points were chosen on the full history, so the next step is a walk-forward test of a "skip BB-CORE when ADX>27" gate.
It does NOT apply to I-CORE, which does better at high ADX, or clearly to T-CORE.
The Nov 16 general regime-label filter was rejected. This one is narrower (one bot, one measure) and has to pass the same test before any use.
