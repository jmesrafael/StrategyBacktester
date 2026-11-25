# Should BB tweak 1.05x and T-CORE trail 12 replace the live bots? Rules fixed before running (Nov 25, 2026)

Research only. No bot, server or database is touched. Written before any result of this study was seen.

## Owner's priority
**Lower drawdown first. More profit is a bonus.**

## Versions
| Id | BB-CORE | I-CORE | T-CORE |
|---|---|---|---|
| ORIG | live v3 | live v3 | live v3 (trail 14) |
| NEW | tweak 1.05x | live | trail 12 |
| NEW-BB | tweak 1.05x | live | trail 14 |
| NEW-T | live | live | trail 12 |
| SAFE | tweak 1.00x | live | trail 14 |
| ORIG-LOW | live, all risk x0.85 | x0.85 | x0.85 |

ORIG-LOW is the honest benchmark for anyone who only wants less drawdown: it needs no new rules.

## Tests
1. History, complete stats per bot (same costs as before; the study engine must equal the project engine trade for trade).
2. PHP 1,000 account as it runs live: shared sizing, 50/25/25, quarterly rebalance, 2.5% / 2% / 1.5% risk steps, MEXC
   contract minimums at today's prices, isolated margin, PHP 58 per USD.
3. Randomness on that account: every start month (6, 12, 24 months); runs with 15% missed signals, random extra
   slippage up to 0.15% and random fee up to 2x.
4. Coin toss: (a) same entry times, direction by coin flip; (b) random entry times and direction. Same exits.
5. Synthetic markets built from real candles (all coins sampled at the same times): 30-day and 90-day blocks,
   rising-only, falling-only, sideways-only, no long-term drift, mirrored (up becomes down), and single-candle shuffle
   (a market with no trends: a trend bot should NOT make money there).

## Pass mark to say "replace the live bot"
For the changed bot against the live one:
- (a) worst drawdown including open trades is lower in history, AND
- (b) it is lower in at least 70% of synthetic 30-day-block markets, AND
- (c) it is lower in at least 70% of the randomized history runs, AND
- (d) profit is at least 95% of the live bot's in history and in the median synthetic market.
A pass means paper test first. A version that passes only on profit does not replace anything.
