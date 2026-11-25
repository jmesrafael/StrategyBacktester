# Replace the live bots with BB tweak / T-CORE trail 12? (Nov 25, 2026)

Priority: **lower drawdown first, profit second.** No bot, server or database was touched.
Pass mark and tests were written first (`PLAN.md`). Full tables: `RESULTS.md`. Study engine equals the project engine.

## Verdict
| Change | By the pass mark fixed beforehand | What it really does |
|---|---|---|
| BB tweak 1.00x | Not passed (profit) | Smaller drops in 80-100% of tests; a little less profit |
| BB tweak 1.05x | Not passed (profit) | Smaller drops in 70-100% of tests; about the same profit |
| T-CORE trail 12 | Not passed (drawdown) | More profit, but the drop including open trades is NOT smaller |

The BB tweak passed all three drawdown tests. It failed profit narrowly: in synthetic 30-day-block markets its median
profit was 89% (1.00x) and 94% (1.05x) of the live bot's, and 95% was required. In falling-only markets it earned
less in nearly every run (median +494 / +519R against +569R).

## Bot stats, history 2020 to Nov 24 2026 (R)
| Bot | Total | Drop closed | Drop open | 2024-26 total | Win | Profit factor | Total at 2x costs |
|---|---|---|---|---|---|---|---|
| BB-CORE live | +707 | 27.2 | 45.4 | +285 | 37% | 1.67 | +647 |
| BB tweak 1.00x | +677 | 25.3 | 31.4 | +291 | 38% | 1.78 | +626 |
| BB tweak 1.05x | +711 | 26.5 | 32.9 | +305 | 38% | 1.78 | +658 |
| I-CORE live | +806 | 27.6 | 89.4 | +383 | 32% | 2.49 | +783 |
| T-CORE live | +1105 | 30.9 | 148.2 | +754 | 37% | 2.57 | +1073 |
| T-CORE trail 12 | +1198 | 28.5 | 157.4 | +811 | 37% | 2.60 | +1164 |

## PHP 1,000 on TRI-CORE
Run as live: shared sizing, 50/25/25, quarterly rebalance, 2.5% risk, MEXC minimum orders at today's prices, PHP 58/USD.
ORIG = the 3 live bots. NEW = BB 1.05x + I-CORE + T trail 12. SAFE = BB 1.00x + I-CORE + T-CORE live.

| Account | Typical year ends | Bad year (1 in 20) | Years with profit | Typical deepest fall | Falls over 50% |
|---|---|---|---|---|---|
| History, random start + random frictions, 300 runs | | | | | |
| ORIG | 2,700 | 1,063 | 97% | 50% | 51% |
| NEW | 3,134 | 1,228 | 99% | 45% | 20% |
| SAFE | 2,764 | 1,122 | 98% | 45% | 22% |
| ORIG risk x0.7 (*) | 2,036 | 1,186 | 99% | 35% | 1% |
| SAFE risk x0.7 (*) | 2,040 | 1,199 | 100% | 33% | 0% |
| 100 synthetic markets | | | | | |
| ORIG | 1,781 | 529 | 70% | 58% | 79% |
| NEW | 2,023 | 549 | 75% | 53% | not measured |
| SAFE | 1,896 | 569 | 74% | 52% | 57% |
| ORIG risk x0.7 (*) | 1,575 | 614 | 73% | 43% | 23% |
| SAFE risk x0.7 (*) | 1,677 | 726 | 78% | 39% | 15% |

(*) Risk levels were added after seeing the other results.

Single run from Jan 2020 (compounded for 7 years, **not realistic as money**): ORIG 26.8M, deepest fall 48.9%;
NEW 35.3M, 47.9%; SAFE 25.1M, 52.7% (on this one path SAFE fell MORE than ORIG).

## Does it work whatever the market does?
No. Share of 100 synthetic 3-year markets with a profit:

| Market | BB live | BB 1.00x | I-CORE | T live | T trail 12 |
|---|---|---|---|---|---|
| Normal | 98% | 99% | 98% | 94% | 95% |
| Rising only | 100% | 100% | 100% | 100% | 100% |
| Falling only | 100% | 100% | 100% | 100% | 100% |
| No long-term drift | 100% | 100% | 91% | 95% | 95% |
| Mirrored | 100% | 100% | 92% | 94% | 94% |
| Sideways only | 75% | 86% | 67% | 32% | 37% |
| No trends at all | 31% | 38% | 40% | 38% | 37% |

## Coin toss (200 runs each, same exits)
The real entries beat every coin-toss run on every bot. With random entry times and direction the runs still made
money over 7 years in 94-100% of cases (exits plus trending crypto), but only 7-14% were green in all 7 years.

## Realism and limits
- With PHP 1,000 only about 79% of trades can be placed (calendar-year starts 2021-2025); ETH, ZEC and SOL minimums
  are the problem. From PHP 5,000 practically all are placed.
- Everything, including the synthetic markets, is built from past candles from the coins the bots already trade
  (chosen knowing this history). Expect live results to be weaker. Only paper trading gives new data.
- Synthetic markets break trends longer than one block, and are built from Oct 2021 onward.

## Recommendation
1. Keep T-CORE at trail 14. Trail 12 does not meet the drawdown goal.
2. BB tweak at **1.00x** is the candidate to paper test (smaller drop than 1.05x).
3. The biggest drawdown lever is risk size: x0.7 (2.5% to 1.75%) cuts the typical yearly fall from about 50% to 35%,
   for about a quarter less money in a typical year. Owner's decision; nothing was changed.
