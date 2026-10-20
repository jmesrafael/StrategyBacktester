# Bollinger strategy research (started 2026-10-20)

Goal: build a separate strategy around Bollinger Bands, not the v7 "Less risk" filter, and test it properly. Data: Binance USDT-M
futures (BTC, ETH, SOL 15m from 2019/2020, rebuilt to 4h/1h; 10 more coins native 4h from `fetch4h.js`). Costs 0.04% commission +
0.02% slippage per side, next-open fills, stop-first on ambiguous candles (the app's own rules). R = amount risked.

## Rules of the research (the v7 lesson)

v7 was picked from ~200 variants on one 3-year window and lost money before it. So here:
1. **Tune only on TRAIN** = entries before 2023-01-01, BTC / ETH / SOL only (`explore1-3.js`).
2. **Freeze** the settings, then run **once** on TEST (2023 → now) and on **10 coins never tuned on** (`test-frozen.js`).
3. Look for **plateaus** (neighbouring settings also work), not the single best cell.

## What was found

| Step | Result |
|---|---|
| `explore1.js` — 768 settings, two families, 15m / 1h / 4h | **Mean reversion fails**: 17 of 576 profitable, median −0.15R/trade. **Squeeze breakout works**: 117 of 192 profitable, 38 with all 3 coins positive. 4h is the best timeframe. |
| `explore2.js` — one-factor sweeps per timeframe | 4h: every variation stayed positive. 1h marginal (+0.01R), 2h mixed. A 200-SMA trend filter lifted avg R from +0.22 to +0.33. |
| `explore3.js` — control: squeeze vs no squeeze | **The squeeze adds nothing** (no squeeze +0.34R vs squeeze +0.27R mean over 48 settings). The edge is a momentum breakout: a 4h close beyond a band, with the trend. All 48 settings were profitable in train. |
| `test-frozen.js` — frozen settings on held-out data | Below. |

Frozen settings (primary "B"): 4h, Bollinger(20, 2), close beyond a band in the direction of the 200 SMA, stop at the middle band,
target 3R, exit after 48 bars.

## Held-out results (2023-01 → 2026-10)

| | Trades | Total R | Avg R / trade | t-stat | PF |
|---|---|---|---|---|---|
| BTC + ETH + SOL, train | 459 | +133.5 | +0.29 | 3.81 | 1.53 |
| BTC + ETH + SOL, **test** | 616 | +82.5 | +0.13 | 2.11 | 1.22 |
| 10 never-tuned coins, train | 1,459 | +317.4 | +0.22 | 5.12 | 1.37 |
| 10 never-tuned coins, **test** | 2,152 | +201.7 | +0.09 | 2.76 | 1.15 |
| All 13 coins, **test** | 2,768 | +284.2 | +0.10 | 3.43 | 1.17 |

- 8 of the 10 never-tuned coins were profitable in the test years; LTC (−21.6R) and BCH (−20.2R) lost, BNB was flat.
- ETH, a tuned coin, was close to flat in test (+4.6R over 200 trades); SOL held up best (+50R).
- **Costs matter**: ×2 costs → +0.07R/trade, ×3 costs → +0.03R (t 0.98). It is thin after costs.
- Longs (+0.13R) were better than shorts (+0.08R) in test.
- By year (13 coins pooled), avg R per trade: 2020 +0.28, 2021 +0.26, 2022 +0.18, 2023 +0.04, 2024 +0.15, 2025 +0.12, 2026 +0.10. It decays.
- The 13 coins move together, so the t-stats are overstated; treat them as an upper bound.
- Funding costs are not included.

## Files

- `lib.js` research engine (uses `js/indicators.js` verbatim) · `fam.js` the two families
- `explore1.js`, `explore2.js`, `explore3.js` (train only) → `results-explore*.{json,txt}`
- `fetch4h.js` extra coins → `data4h/` · `test-frozen.js` → `results-test-frozen.md`
- `validate-app.js` the app engine vs this engine, trade by trade: identical on 6 coins (+460.1R both)
- `monthly.js` → `results-monthly-5usd.md`
- App strategy: `strategies/bb-breakout-strategy.js` ("★ BB Breakout · 4h trend"). Use the 4h chart, Fill at: Next bar open, session filter off.

## Not done / ideas

- No second round of tuning after seeing the test results (that would contaminate it). A fair next step is a walk-forward
  (tune 2020–2024, check 2025–26) or paper trading.
- Limit-order entries to cut costs, a volatility-scaled target, and a coin-selection rule were not tried.
