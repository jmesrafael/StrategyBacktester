# bb-core v2 — research only (nothing here touches bb-core or the bot)

Question: can break-even at 1R, or a limit entry (midpoint of the signal candle / 25% pullback from the close), beat the current bb-core rules?

- `v2-core.js` — fork of `bb-core/lucidio-core.js` with opt-in break-even, partial, trailing and limit-entry options. All options off = bb-core.
- `verify-parity.js` — proves that: 5,902 trades (5 coins × 2 venues × 2 cost levels) identical to bb-core (`PASS`). Reads bb-core, never writes it.
- `run.js` — experiments. `node run.js all [--coins SOL] [--venue mexc] [--costs 2]`; sections A (break-even), B (BE × target), C (partial/trail), D/D4 (limit entries, with market fallback), E (combos), F (target × time exit).
- `data/` — copy of bb-core/data (Oct 27, 2026). `RESULTS-binance.md`, `RESULTS-mexc.md`, `RESULTS-SOL.md` — full tables.

## Fill assumptions (all pessimistic where the candle order is unknown)
- Break-even / partial / trailing take effect from the candle AFTER the trigger; the original stop stays live in the trigger candle.
- A limit order fills only if price trades 0.05% THROUGH the level (maker fee, no slippage); if the next open is already past the level it fills at the open as a taker.
- In the candle where a limit order fills only the stop is checked. The order is cancelled if the 4R level is reached first.

## Beating the baseline on one coin (SOL) — `explore.js`
`node explore.js H0|G|H|I|J|K [--coins SOL] [--venue mexc] [--costs 2]`; outputs saved as `EXPLORE-SOL-*.md`.
H0 = which signal features separate winners from losers, G = strategy parameters, H = signal filters, I = stops/targets/time exit, J = greedy search tuned on 2020–2023 and judged on 2024+ (`--reverse` swaps them), K = pre-written combinations stress-tested on MEXC candles, 2× costs and per year.
Rule used throughout: a change only counts if it helps in BOTH periods. SOL has ~300 trades, so a total-R difference under ~30R is inside the noise; confirm any lead on the other four coins before trusting it.
