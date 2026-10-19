# Is the NY SMC v7 strategy any good? Plain-language report

*SOL + ETH, 15m, $10 risk per trade, 18 Oct 2023 – 17 Oct 2026 (154 trades). Run 2026-10-19.*

## Verdict: GOOD in 2023–26, UNPROVEN as a future money-maker

| Question | Answer | Grade |
|---|---|---|
| Is the backtest engine honest? | Yes. Random entries lose money; v7 beat them. Exit-order guesses change profit by under 7%. | ✅ Good |
| Does it break if I change the settings a little? | No. 24 nudges of ±20% (12 settings): all 24 still made money (+$579 to +$912; baseline +$876). | ✅ Good |
| Does it break if limit fills are harder? | No. If price must trade 0.1% *through* the entry: +$660. 0.2% through: +$503. | ✅ Good |
| Does it break if fees/slippage are higher? | No. Costs ×3: +$674. | ✅ Good |
| Is it just a few lucky trades? | Mostly no. Drop the best 10 of 154 trades: still +$577. Resampling the trades gives a 5th–95th range of +$546 to +$1,214, and loss odds of about 0.01%. | ✅ Good |
| Does it work outside 2023–26? | No. Oct 2021 – Oct 2023: −$124 (SOL lost, ETH flat). Every ±20% variant also lost money there (−$22 to −$170). | ❌ Bad |
| Is it proven on other coins? | No. BTC, DOGE, ZEC were mixed; XRP lost every year. | ❌ / ⚠️ |
| Has it been tested live? | No. | ⚠️ Not yet |

## What this means in plain words
- **The rules are not fragile.** Nudging any setting, or making fills/costs worse, never turns it into a loser. This is not a "lucky setting" result. The most sensitive settings were entry depth (entryFrac) and CHoCH window (chochWindowH 2.4 h), which cost 24–34% when changed. That is a drop, not a collapse.
- **The problem is time, not settings.** In 2021–23 the same rules lost money under every variant. So the pattern appears tied to the 2023–26 market (the cause is not identified; one guess is how SOL/ETH trade around the U.S. open). If that behaviour fades, the edge may fade.
- **Your point that it only works on ETH and SOL fits the data.** BTC/DOGE/ZEC/XRP did not hold up. That means the edge is coin-specific, which is also a reason to be careful: coin-specific edges can be real, or they can be what a search of ~200 variants finds by chance. This test cannot tell those apart.
- **The "~200 variants" caveat remains.** v7 was picked from about 200 variants on this same data. The robustness tests show it sits on a plateau, not a spike. They do not correct for the selection.

## Realistic expectation
| Scenario | Per month ($10 risk) |
|---|---|
| Backtest as-is | +$24 |
| Harder fills + 1.5× costs | +$19 (+$701 over 37 months) |
| Winners 25% smaller (stand-in for edge decay) | +$14 (+$527 over 37 months) |
| 2021–23-like regime returns | about −$5 |

A reasonable plan is to expect roughly +$10–20 a month on $10 risk in a good regime, with losing months (as bad as −$44) and no profit at all if the regime has changed.

## What to do next
1. Paper trade it (the app's ★ NY SMC v7 replay or live) for 40+ trades. Compare every trade against the backtest.
2. **Kill rule:** if after 40 trades the result is below about −5R, or fills differ a lot from the backtest, stop.
3. If it holds, start at 0.25–0.5% risk, not 1%.
4. Watch for a quiet regime. If SOL/ETH volatility around the U.S. open drops a lot, expect fewer and worse trades.

Files: `sensitivity.js` → `results/sensitivity.md|json`; `luck.js` (printed output); earlier checks in `results/validation_A|B|C.md`.
