# Can the Bollinger book beat BB-CORE? (Nov 25, 2026)

**No.** Nothing in the book beat BB-CORE v3 on the pass mark fixed before the run. No bot, server or database was touched.

Setup: 4h Binance candles to Nov 24 2026, taker fee + slippage + real funding, trades from 2020. LIVE = SOL ZEC NEAR
ADA GALA ARB (decides); WIDE = 84 other coins (generality check). Rules in `PLAN.md`, book notes in `BOOK-NOTES.md`,
all tables in `RESULTS.md` and `ROUND2.md`. Checks: the study engine matches the project engine on 28,385 trades
(0 different); the cut-off (no look-ahead) audit passed on 129,609 trades.

## Result (LIVE coins; R/DD = total R divided by the worst drawdown, higher is better)
| Change from the book | Total R | Max drawdown | R/DD |
|---|---|---|---|
| **BB-CORE v3 today** | **+707** | **27** | **26.0** |
| Intraday Intensity must agree | +689 | 26 | 27.0 |
| BandWidth expanding | +696 | 28 | 24.8 |
| Accumulation/Distribution must agree | +671 | 28 | 24.0 |
| Bands on typical price | +682 | 34 | 20.1 |
| Opposite-band exit added | +632 | 45 | 14.0 |
| Method II entry (%b + MFI) | +453 | 24 | 18.9 |
| MFI divergence exit | +430 | 33 | 13.0 |
| RSI confirmation | +397 | 26 | 15.3 |
| Head fake only | +377 | 36 | 10.5 |
| MFI confirmation | +359 | 28 | 13.1 |
| Pullback entry | +344 | 59 | 5.8 |
| Stop and exit at the opposite band | +300 | 21 | 14.4 |
| Length 50, width 2.1 | +293 | 33 | 8.8 |
| Parabolic exit (4 versions) | +229 to +287 | 22 to 48 | 5.9 to 10.5 |
| Squeeze first | +142 | 27 | 5.3 |
| Method I exactly as written (2 exits) | +5 to +9 | 18 to 34 | 0.1 to 0.5 |
| Method II exactly as written (2 exits) | +62 to +140 | 23 to 25 | 2.5 to 6.3 |

- Closest: **Intraday Intensity** (27.0 against 26.0). It is noise: its neighbour lengths give 23.3 and 15.3, it fails the
  in-sample Sharpe test, and on the 84 other coins it does not raise R per trade.
- Using each confirmation to **size** trades (1.5x / 0.5x) instead of skipping them: all 7 give a lower R/DD (18.1 to 24.5).

## Second round (picked after seeing round 1, so weaker evidence)
| Sizing idea | Total R | Max drawdown | R/DD | Chance a random flag does as well |
|---|---|---|---|---|
| R1 double risk after a 6-month Squeeze | +755 | 32 | 23.8 | 60% |
| R2 half risk when RSI is already stretched | +800 | 36 | 22.4 | 30% |
| R3 half risk when MFI is already stretched | +710 | 32 | 22.1 | 50% |

All three earn more R at the same average risk but with a proportionally deeper drawdown. Rejected.

## What was learned
1. **BB-CORE already holds the part of the book that works** here: a close outside the band continues. The book is right
   that this is not a reversal signal.
2. **Its exits are much worse on 4h crypto.** Parabolic, opposite band and divergence exits give up 11% to 68% of the
   profit; most add drawdown too.
3. **Momentum confirmation points the wrong way.** On the 84 other coins, breakouts with RSI or MFI already stretched
   average less R than the rest in both periods (MFI: +0.03 / +0.05 against +0.17 / +0.14). On the live coins the gap is
   small or uneven, and trading on it did not help.
4. **A long Squeeze marks better breakouts, but it is rare.** After a 6-month BandWidth low, WIDE trades average +0.70R
   against +0.10R (still +0.45R without the best 1%; better on 56 of 84 coins). On the live coins there are only 66 such
   trades in 7 years (+1.15R against +0.38R), too few to improve R/DD. **Lead, not a rule.** The short (125-candle)
   Squeeze does not work on the live coins.

## Limits
- The book was written for daily stock charts; this tests it on 4h crypto perps only.
- "As written" needed choices the book leaves open (formation = 10 candles, Squeeze counted within 20 candles).
- 2024-26 has been used by many earlier studies, so it is not unseen data.

## Next step
No change to the bot. The Squeeze lead needs no new bot: it can be read from candles later, so re-run `round2.js`
after about 6 more months of data.
