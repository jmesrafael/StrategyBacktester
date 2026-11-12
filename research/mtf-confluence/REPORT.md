# Multi-timeframe confluence ("Triple Screen") vs the live bots (Nov 12, 2026)

Code: `mtf.js` (strategy), `audit.js` (no-look-ahead), `sweep.js` → `sweep.json` (24 variants × 14 coins), `deep.js` → `deep.json`.
Engine: `../strat-hunt-nov6/engine.js` (the bots' validated trade loop; 1h candles, stop checked first inside a candle,
0.05% fee + 0.02% slippage per side, real funding). Data: `candles/` (Binance USDT-M 1h + 4h, 14 coins).

## Rules (fixed before testing; textbook settings, nothing tuned)
- **Screen 1, daily trend (required):** last finished UTC day: close > EMA50 and EMA20 > EMA50 (mirror for shorts).
- **Screen 2, 4h setup:** last closed 4h bar on the trend side of the SMA200 (required). Optional: ADX(14) > 20 in the trend's direction (`adx`);
  4h RSI(14) dipped below 45 in the last 6 bars, a pullback (`pull`).
- **Screen 3, 1h trigger (required):** close above the highest high of the previous 6 hours and above EMA20. Optional: volume ≥ 1.5× its 20-bar average (`vol`).
- **Exits (4h ATR):** P7 = 2 ATR stop + 7 ATR trail; P14 = 2 + 14; SW7 = stop under the last 12 hours' low + 7 ATR trail.
- No look-ahead: `audit.js` makes 45 random cut-offs, and flags and finished trades are identical. PASS.

## Results
- Sweep (14 coins): every variant is positive. P14 [core] +1.02R/trade, IS 1.00 / OOS 0.99, positive OOS on 14/14 coins, +0.96R at 2× costs.
  The optional confluences (`adx`, `pull`, `vol`) don't improve it reliably; `adx+pull` makes it worse OOS. **The exit carries it, not the confluences.**
- 4 bot coins (SOL NEAR ADA GALA), Oct 2020 to Nov 2026:

| | trades/mo | win | avg R | total R | max DD | +years | 2025 | without top 5% |
|---|---|---|---|---|---|---|---|---|
| MTF core P14 | 5.5 | 22% | +0.86 | +353 | 49.8R | 4/7 | −42 | −98R |
| MTF adx+vol P14 | 4.3 | 24% | +1.12 | +358 | 44.4R | 4/7 | −43 | −32R |
| MTF core P7 | 9.4 | 29% | +0.46 | +317 | 48.4R | 5/7 | −16 | −152R |
| BB-CORE / I-CORE / T-CORE | | | | +461 / +454 / +633 | 27 / 24 / 35R | 6/7 each | | |

- Against the bots: MTF P14's monthly correlation with T-CORE is **0.93**, and **89-96%** of its trades overlap a same-side T-CORE trade.
  MTF P7's correlation with I-CORE is 0.81. In TRI-CORE's 27 losing months MTF lost too (−53 to −80R).
- Account (month-end): TRI-CORE alone +502%, DD 15.0%; 80% TRI + 20% MTF P14 +472%, DD 13.6%. No real gain.
- Fat tails: 83-91% of gross wins come from the top 10% of trades; the long side carries it (P14 longs +1.7-2.1R, shorts +0.1-0.4R).

## Verdict: REJECTED as a new bot
It's a re-discovery of the trend + wide-ATR-trail family the bots already run (T-CORE with P14, I-CORE with P7), with lower returns and deeper drawdowns
on the bot coins. Stacking confluences and timeframes didn't create a new edge, it only filtered the same trend trades.
Lesson for the registry: **a new strategy must have low trade overlap and low monthly correlation with TRI-CORE before it's worth anything.**
