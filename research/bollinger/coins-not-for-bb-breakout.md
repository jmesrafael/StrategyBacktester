# Coins that do NOT suit BB Breakout 4h (1:4) — park these for other strategies

Frozen rules, nothing re-tuned: 4h close beyond Bollinger(20,2) with the 200 SMA, stop at the middle band, 1:4 target, 48-bar time exit.
Binance USDT-M futures, 0.04% commission + 0.02% slippage, no funding. Data to 20 Oct 2026. Script: `fetch4h-new.js` + scratchpad `newcoins.js`.
Reference (this strategy's best): SOL +0.37R/trade, ZEC +0.37R, BTC +0.19R. Rule of thumb used: need ≥ ~+0.15R/trade, mostly positive years, and 2023→ not worse than before.

## Rejected — loses or ~flat (try other strategies)

| Coin | Avg R | Why |
|---|---|---|
| ATOM | −0.01 | 4 of 7 years positive but nets nothing; DD 22R |
| APT | −0.02 | 2024 and 2026 negative; DD 25R |
| ONDO | −0.02 | only 1 of 3 years positive |
| FIL | +0.18 overall but **2023→ −0.02R** | all profit came from 2021–22; losing 2024-26 |
| LTC | negative (earlier run) | lost −21.6R in held-out |
| BCH | negative (earlier run) | lost −20.2R in held-out |

## Weak — positive but too thin / unstable (low priority)

| Coin | Avg R | Why |
|---|---|---|
| TAO | +0.04 | 2024 −9R; barely positive |
| HYPE | +0.10 | only 67 trades, 16 months of history — unproven |
| TIA | +0.10 | 2023 and 2024 negative |
| FET | +0.10 | swings −14R / +25R / −4R / +11R; DD 18R |
| 1000PEPE | +0.12 | 2026 negative, weak even though heavily watched |
| AAVE | +0.12 | 2025 −5R, 2026 flat, DD 19R |
| UNI | +0.13 | 6 of 7 years positive but small, 2024 negative |
| BNB | +0.10 | flat/negative 2023–24 |
| ETH | +0.20 but 2023→ +0.05R | edge faded; 2023 −16R, DD 28R |
| XRP | +0.17 but 2023→ +0.08R | DD 30R, edge faded |
| DOGE | +0.25 but 2023→ +0.07R | edge faded since 2023 |

## Not evaluable
- TON: Binance volume on the feed is ~0, so fills are not realistic — skip until liquidity is checked.

## Notes
- Heavy attention does not equal an edge: PEPE, TAO, HYPE, ONDO are widely watched and still do not fit this breakout.
- Coins that are only weak here may suit a mean-reversion or range strategy — worth testing with the FVG Pullback or v7 families.
