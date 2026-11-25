# Independent validation of "New" TRI-CORE (Opus, Nov 25, 2026)

Written by the main session from the validator's final message (the validator could not write report files itself).
Scripts and raw tables: the `.js` and `.out` files in this folder.

## Verdict
**NO-GO for "New" as proposed** (BB tweak 1.05x + T-CORE trail 12).
**GO WITH CONDITIONS for the BB-CORE rules alone, at 1.00x.**

## Conditions
1. Keep T-CORE trail 14. Trail 12 fails the drawdown-first rule: open drop 157.4 vs 148.2 (T-CORE), 68.0 vs 65.7 (account).
2. Run the BB rules at 1.00x, as a drawdown reducer rather than a profit gain.
3. Switch on with `tweakFrom` at a future candle; run the `replay --tweak` parity first; make sure MEXC returns volume.
4. Shadow-log Intensity and ADX for 3+ months on candles after Nov 24.

## Findings
**Reproduction** (own indicator, portfolio and drawdown code; hand-written T-CORE loop equals the engine on all trades)
- Headline numbers match: +856.5 vs +831.5 R; closed drop 21.0 vs 21.9; open drop 66.1 vs 65.7. No look-ahead found.
- Of the +25 R, trail 12 gives +23.1 and the BB tweak +1.9, only because of 1.05x. At 1.00x BB-CORE alone is 677 vs 707 R.
- 1.05x is pure leverage: BB profit / open drop is 21.60 at 1.00x, 1.05x and 1.15x.
- Account level, each BB rule alone: short filter -12 R with open drop 64.0; ADX half +0.4 R with closed drop 19.9.

**Selection bias**
- About 300 variants were tried on the same 2020-26 candles.
- Chosen after seeing the evaluation window: 1.05x, trail 12 (sell-too-soon study), Intensity length 21 (book study).
- No Intensity variant qualified in the locked 2020-23 selection (`locked.json` iiBest null); `pick-ii.js` added it later on
  request, without the qualifying checks.
- 192 neighbouring settings: 91% beat today on profit / open drop in 2020-23, only 30% in 2024-26 (median 0.93). The chosen
  one ranks 11 of 192. Intensity lengths 14, 28, 35 lose to "no filter" on 2024-26. ADX alone scores 1.01-1.03 there.
- Fair haircut: the BB profit edge is about 0 to +20 R over 7 years.

**Further robustness**
- Paired 90-day block bootstrap (4,000), New vs Current: more R 89%, smaller open drop 67%, median drop change -1.6 R.
- Trail 12 alone: more R 99%, smaller drop 41%.
- Same exposure: BB risk x0.87 with no rule gives account closed / open drop 20.2 / 64.4; the tweak 20.0 / 63.4, plus 31 R.
- Coins: the BB tweak loses R on ZEC, NEAR, ADA, GALA; SOL (+25) carries it. Trail 12 gains on all 8 coins.
- Trail 12 takes +51 of its +93 R from 2024; its open drop is worse in 2025.

**Live feasibility**
- 500-candle window: ADX, Intensity, ATR equal full history on 1,841 signal candles, 0 decision changes.
- Venue risk (Binance research vs MEXC live): ADX>27 differs on 1.8% of signals; Intensity sign differs on 128 of 906
  shorts (14.1%). With MEXC-based Intensity the result is about the same (+680 R, open drop 30.3).
- Volume was dropped by the committed `bb-core/mexc.js`; the parallel edit adds it and skips a signal if missing.
- Sizing: risk is multiplied before `sizeOrder`, so the 1.5x cap applies to the half target (correct). At about $394 equity
  0 of 134 half-risk trades skipped; at PHP 1,000, 37% skipped.
- Changing the T-CORE trail on open trades (300 random switch dates, 1,607 open trades): 3.4% close within 2 candles, 10.6%
  end worse, average +2.0 R per date (in-sample), 23 dates cost 3 R or more, worst -10.9 R.
- `bb-trail/deploy-tcore/install-tcore-live.sh:69` refuses to install unless `icore-core.js` contains `kTrail: 14`.

**Earlier study code**
- No bug changes a number. Two reading flaws: the BB drawdown pass was never compared with simply cutting BB risk; the
  "95% of profit in history" check is met only through the post-hoc 1.05x.
- Minor: funding booked one extra candle after a BB time exit; contract value at today's price for all history; synthetic
  markets copy raw volume across block joins.

## Not checked
MEXC candles after Oct 2026 and any MEXC data for ARB; today's live equity (Nov 10 figures used); the VPS copy of the
T-CORE code; the earlier synthetic-market and PHP-account results.
