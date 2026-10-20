# Pullback FVG research (2026-10-20) — SOL / ZEC / DOGE on 5m, 15m, 1h, 4h

Idea: a fair value gap (FVG) forms with displacement; instead of entering straight away, wait for price to pull back into the gap and
enter there. Same protocol as the Bollinger work: settings chosen on TRAIN data (entries before 2023-01-01), frozen, run once on 2023 →
now. Costs 0.04% commission + 0.02% slippage per side, next-open fills for market orders; limit orders fill the way the app fills them
(at the limit on a touch, no slippage, only the stop counts on a mid-bar fill). R = amount risked.

FVG: bullish = candle 3's low above candle 1's high with a bullish middle candle (bearish mirrors it). Frozen settings: gap ≥ 0.5 ATR,
limit at the gap's near edge, stop at the impulse origin (extreme of candles 1–2), 3R target, cancel after 20 candles, longs above /
shorts below the 4h SMA200.

## What was found

| Step | Result |
|---|---|
| `explore-fvg.js` — 288 settings per timeframe, train only | 4h: 219/288 profitable on BTC/ETH/SOL, 281/288 on SOL/ZEC/DOGE. 1h: 33/288 and 73/288. 15m and 5m: 0 profitable. |
| `explore-fvg2.js` — one-factor sweeps + **controls** | Entering **directly** at the market beat the pullback: 1h +0.23R vs +0.06R (BTC/ETH/SOL), +0.18R vs +0.04R (SOL/ZEC/DOGE); on 4h about equal. Deeper pullbacks (50%, far edge) were worse. A limit needing 0.1–0.25 ATR trade-through to count as filled cut the 4h edge by a third to a half. |
| `explore-confirm.js` — wait for the pullback, then a market entry after a rejection candle | Same picture: 4h +0.21R train, 1h ~0, 15m negative. |
| `test-fvg.js` — frozen settings, held-out years | Below. |

## Held-out (2023-01 → 2026-10), SOL + ZEC + DOGE pooled, average R per trade

| Timeframe | Pullback (limit) | Pullback + confirmation | Direct (market) |
|---|---|---|---|
| 5m | −0.17R (14,415 trades) | −0.16R | −0.15R |
| 15m | −0.05R | −0.04R | −0.05R |
| 1h | +0.03R | +0.02R | +0.07R |
| **4h** | **+0.09R** (323 trades, t 0.9) | +0.05R (234) | **+0.21R** (246, t 1.8) |

- 4h costs ×3: pullback +0.05R, direct +0.17R. 1h at ×3: both ≤ 0.
- 4h on 11 other coins (BTC ETH BNB XRP ADA AVAX LINK LTC DOT TRX BCH): pullback −0.04R (2 of 11 profitable), confirmation −0.02R (5 of 11),
  direct +0.08R (8 of 11). BTC/ETH were used to pick settings; the others never were.
- By coin (4h, $5 risk, held-out total): direct SOL +$112, ZEC +$10, DOGE +$136; pullback SOL +$89, ZEC +$15, DOGE +$41. ZEC is flat.
- For comparison, the BB Breakout on the same three coins and period: +$639 ($5 risk), 620 trades, ≈ +$14/month, max DD $91
  (`results-monthly-focus-5usd.md`).

## Why the pullback does not help

- The strongest displacements never retrace, so a resting order misses them; the orders that do fill are the ones where price came back —
  adverse selection. The deeper the entry, the worse it got.
- A limit order that counts as filled when price merely touches it is optimistic; it is the app's rule, and the result is sensitive to it.
- On 5m and 15m the stops are small relative to costs (0.12% round trip), so even a flat edge loses.

## Files

- `fvg.js` strategy logic (`fvgpb`, `fvgConfirm`) · `lib.js` `runLO` = limit-order engine mirroring the app · `fetchtf.js` native klines → `datatf/` (not committed)
- `explore-fvg.js`, `explore-fvg2.js`, `explore-confirm.js` (train only) → `results-fvg-explore*.{json,txt}`
- `test-fvg.js` → `results-test-fvg.md` · `monthly-focus.js` → `results-monthly-focus-5usd.md` (monthly tables, $5 risk)
- `validate-fvg.js` — the app engine vs this engine, trade by trade: identical for all three entry modes (SOL/ZEC/DOGE 4h and 1h, DOGE 15m)
- App strategy: `strategies/fvg-pullback-strategy.js` ("★ FVG Pullback · 4h", Entry option: Pullback / Pullback + confirmation / Direct)

## Not done

5m was only run on SOL, ZEC and DOGE (no BTC/ETH 5m). No second tuning round after the held-out numbers. Funding not included.
