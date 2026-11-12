# Lower-TF Ichimoku / EMA cross / Darvas box inside a 4h Ichimoku trend (Nov 12, 2026)

Code: `strat.js` (rules + the bots' trade loop with a resting target), `audit.js` (no look-ahead: 45 random cut-offs, PASS),
`eval.js` → `eval.json`. Data: `candles/` (Binance USDT-M 1h + 4h, 14 coins). Costs: 0.05% fee + 0.02% slippage per side, real funding.
Bot comparison: `../zec-replacement-2/trades-fill.json` (SOL NEAR ADA GALA; T-CORE also ETH), Oct 2020 to Nov 2026.

## Design goal
The MTF study showed that trend entries + a wide ATR trail re-create T-CORE / I-CORE. This one trades 1h entries with SHORT holding
(2R target or a Kijun-close exit, capped at 2-4 days), so it would differ from the bots.

## Rules (fixed before testing, textbook settings)
- 4h filter (all entries): last closed 4h bar above the 4h cloud with Tenkan > Kijun (mirror for shorts).
- E1 Ichimoku 1h: Tenkan crosses above Kijun, close above the 1h cloud, Chikou free. E2 = E1 + RSI 50-70 + MACD hist > 0.
- E3: EMA9/21 cross + RSI > 50 + MACD hist > 0. E4: classic Darvas box (3-bar confirmations) breakout + volume ≥ 1.5× average.
- Exits: T2 = stop at the 1h Kijun (Darvas: box bottom), 2R target, 48h cap. KJ = same stop, exit on a 1h close back through the Kijun, 96h cap.
  P7 = 2 ATR(4h) stop + 7 ATR trail (I-CORE's exit, reference).

## Results (avg R per trade, 14 coins; bot coins = SOL NEAR ADA GALA)
| variant | 14 coins | IS / OOS | 2× costs | coins OOS+ | bot coins total | corr with TRI / I-CORE |
|---|---|---|---|---|---|---|
| E1 T2 | −0.05 | −0.05 / −0.06 | −0.18 | 5/14 | +15R | 0.11 / 0.11 |
| E1 KJ | +0.11 | +0.19 / +0.01 | −0.04 | 6/14 | +171R (DD 108R) | 0.34 / 0.23 |
| E2 KJ | +0.12 | +0.20 / +0.03 | −0.02 | 7/14 | +180R (DD 88R) | 0.24 / 0.12 |
| E3 T2 | −0.19 | −0.17 / −0.21 | −0.38 | 1/14 | −213R | 0.17 / 0.17 |
| E4 T2 (Darvas) | +0.03 | +0.05 / +0.01 | 0.00 | 7/14 | +66R (DD 29R) | 0.24 / −0.02 |
| E4 KJ (Darvas) | +0.04 | +0.05 / +0.03 | +0.01 | 9/14 | +46R | 0.17 / −0.07 |
| E1/E2/E4 P7 | +0.38 | +0.58 / +0.14 | +0.35 | 10-11/14 | +284 to +347R | 0.53-0.58 / **0.64-0.81** |

## Verdict: REJECTED
- Short holding: low correlation with the bots (as designed) but no edge. About zero per trade, OOS near zero, negative at 2× costs.
  On 1h with tight Kijun stops, fees and slippage eat what little edge there is.
- Long holding (P7): positive, but it's I-CORE again (monthly correlation up to 0.81), and it lost in TRI-CORE's losing months (−70 to −111R).
- Darvas box breakouts are flat (+0.03R).
- Lesson: on these coins the edge is "trend + let profits run". Make it short-term and the edge disappears; make it long and it copies the bots.

## Mix & match + tuning (`mix.js` → `mix.json`)
Blocks: 5 entries (E1-E4 + E5 = the 1h 6-hour-high breakout from the MTF study) × 4 trend filters (4h Ichimoku, daily EMA20/50, both, none)
× 6 exits (2R/48h, 3R/96h, Kijun close, 24h time exit, 2+7 ATR, 2+14 ATR) = 120 combinations × 14 coins.
Tuning objective, IS only (trades closed before 2024): gain in return/drawdown of the account when the candidate takes a 20% sleeve next to
TRI-CORE (BB 50 / I 25 / T 25), measured trade by trade. Gate: positive at 2× costs on 14 coins (IS). 69 of 120 pass.
- TRI-CORE alone: IS return/DD 18.6 (297R / 16.0R), OOS 10.0 (205R / 20.5R).
- **Rank correlation of IS gain vs OOS gain: −0.27.** Tuning on the past picks combinations that do worse later.
- Improve the account IS: 9; OOS: 14; **both: 0.**
- The IS top 5 are all I-CORE-like (2+7 ATR exit, corr 0.55-0.60 with TRI). Their ensemble as a 20% sleeve: IS gain +2.24, **OOS gain −1.62**
  (169R / DD 20.2R vs TRI alone 205R / 20.5R).
- The best OOS combination (E2/d1/P14) ranked 38th of 69 on IS. Nobody could have picked it in advance.

## Verdict
No sustainable combination exists in these blocks. Tuning toward a "nice outcome" only fits noise. TRI-CORE alone is the better account.
