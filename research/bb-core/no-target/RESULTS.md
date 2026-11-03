# BB-Core: fixed 1:4 target vs no target ("A"), study of Oct 29, 2026

**Question.** BB-Core exits every winner at +4R. Does letting winners run (no target; exit only on the stop or the 48-candle time limit) beat that, and does it
beat or complement I-Core (Ichimoku trailing-stop trend follower)?

**Setup.** Same entry (close outside Bollinger 20/2 + 200-SMA trend filter), same stop (20-SMA at the signal close), same costs (fees, slippage, real Binance funding),
5 traded coins (SOL, ZEC, NEAR, ADA, GALA), 4h candles 2020 to Oct 2026, fixed R per trade. "A" = `targetR: 0` in `bb-core/lucidio-core.js` (now the default).
The generic engine in `lib.js` reproduces the real engine exactly (1,331 trades, +600.81R): run `node validate.js`.

## 1. The exit change, year by year (5 coins)

| Year | trades 1:4 / A | win% 1:4 / A | expectancy R 1:4 / A | avg win R 1:4 / A | net $ at $5 risk 1:4 / A |
|---|---|---|---|---|---|
| 2020 | 100 / 83 | 36.0 / 36.1 | +0.42 / +0.55 | +2.80 / +3.18 | 212 / 228 |
| 2021 | 221 / 185 | 40.7 / 35.7 | +0.54 / +0.93 | +2.73 / +4.43 | 593 / 860 |
| 2022 | 231 / 215 | 42.9 / 39.5 | +0.30 / +0.38 | +1.97 / +2.45 | 340 / 406 |
| 2023 | 253 / 232 | 35.6 / 31.0 | +0.25 / +0.30 | +2.40 / +3.16 | 315 / 349 |
| 2024 | 253 / 218 | 38.3 / 37.6 | +0.31 / +0.32 | +2.33 / +2.47 | 395 / 349 |
| 2025 | 241 / 207 | 39.0 / 40.1 | +0.34 / +0.35 | +2.33 / +2.32 | 408 / 361 |
| 2026 (to Oct) | 212 / 191 | 37.7 / 35.6 | +0.22 / +0.47 | +2.20 / +3.12 | 228 / 450 |
| **All** | **1511 / 1331** | **38.8 / 36.5** | **+0.33 / +0.45** | **+2.35 / +2.94** | **2491 / 3004** |

Profit factor 1.57 to 1.72. Max drawdown 25R to 23R. Detail: `out-yearly-1to4-vs-A.txt`.

## 2. Is A really better? Mostly yes, with one honest caveat

- **Seven coins never used to design BB-Core** (AVAX, BNB, DOGE, ETH, LINK, LTC, XRP; no funding data): expectancy **+0.16R to +0.32R**, A ahead on **all 7**, net +379R to +689R. This is the strongest evidence.
- **Cost stress** (fees and slippage x1, x2, x3): A stays ahead by about +0.12R per trade at every level (`out-robust.txt`).
- **Without GALA**: +0.32R to +0.40R. Still ahead.
- **Caveat on the 5 traded coins alone:** A is ahead in only **19 of 34 coin-years**. A bootstrap says A > 1:4 in 90% of resamples (95% interval -0.06 to +0.33R per trade, so it includes zero).
  After dropping the **10 best trades** the two are equal (+0.30R vs +0.30R); after dropping the best 20, A is lower (+0.21R vs +0.28R). A's extra profit comes from a
  small number of large winners (best trades +17R to +66R). 1:4 has no trade above +4.1R, so its top 10 trades are only 8% of its profit, against 35% for A.
- **Read it as:** A has the higher expectancy and the evidence points the right way, but it is a fatter-tailed, lumpier version of the same strategy, and the improvement is not proven on the 5 coins alone.

## 3. Other exits tried (all worse than A or no better): `out-exit-variants.txt`
Trail the mid-band (+$1,607), trail SMA50 (+$2,265), chandelier 3/4/5 x ATR (+$1,235 / +$2,186 / +$2,487), break-even at 2R then chandelier (+$1,995),
8R target + trail (+$1,617), versus A +$3,004 and 1:4 +$2,491. Tight trails get shaken out of trends; wide trails only match 1:4 and depend on the same few giant trades.

## 4. A second indicator with the same exit: `out-compare.txt`
Donchian-20 breakout (same trend filter, stop at the channel midline, no target), Donchian-40 and Keltner 20/2:

| | expectancy R | net R | max DD R |
|---|---|---|---|
| BB 1:4 (current) | +0.327 | +493 | -26 |
| **BB-A** | **+0.451** | **+601** | -23 |
| Donchian-20, no target | +0.360 | +491 | -36 |
| Donchian-40, no target | +0.280 | +283 | -33 |
| Keltner 20/2, no target | +0.286 | +282 | -28 |
| I-Core (current) | +0.866 | +658 | -30 |

- The **no-target exit improves every signal** (Donchian-20 0.24 to 0.36, Keltner 0.25 to 0.29), which supports the idea in itself.
- But **none beats BB-A**, and Donchian-20 is **87% correlated with BB-A** (monthly R): it is the same bet, so it adds trades and drawdown but no diversification. Not recommended as a second bot.

## 5. Tandems with I-Core (equal R risked per trade, trades pooled): `out-compare.txt`
Monthly-R correlation with I-Core: BB 1:4 = 0.15, BB-A = 0.09 (very low: they win in different months).

| Combination | trades | expectancy R | net R | max DD R | net R / DD | profitable years |
|---|---|---|---|---|---|---|
| BB 1:4 + I-Core (what runs today) | 2270 | +0.507 | +1151 | -50 | 22.8 | 7/7 |
| **BB-A + I-Core** | 2091 | **+0.602** | **+1259** | -50 | **25.1** | 7/7 |
| BB-A + Donchian-20 | 2696 | +0.405 | +1092 | -58 | 19.0 | 7/7 |
| BB-A + Donchian-20 + I-Core | 3456 | +0.506 | +1750 | -83 | 21.1 | 7/7 |

- **BB-A + I-Core is the best tandem**: the same drawdown as today's pair, +108R more profit, expectancy +0.51R to +0.60R.
- I-Core alone has the highest expectancy (+0.87R) but is the most concentrated (top 10 trades = 74% of its profit; its README says the settings were tuned on this data). BB is the steadier leg; together they give more profit per drawdown than either alone.

## 6. Limits
- Backtest only. 2021 (a very strong trend year) contributes a lot of A's edge; 2026 is partial.
- I-Core uses its own engine and cost model (0.05% fee + 0.02% slippage + funding model); BB uses real funding. Pooled R assumes equal risk per trade on both bots.
- The seven-coin test has no funding data (applied equally to 1:4 and A).
- The live measurement window started Oct 26, 2026 on the 1:4 build; changing the exit starts a new sample (bb-core/RUN-LOG.md, Oct 29).

Scripts: `lib.js` (engines and signals), `validate.js`, `compare.js`, `robust.js`, `cmp.js` (yearly), `trend.js` (exit variants), `big-moves-per-year.js`. Run with `node <file>`; set `STRAT_ROOT` (forward slashes, e.g. `C:/Users/me/Strat`) to the folder that holds your clones (default: this PC) when running them elsewhere.

## 0. The admin report
`build-report.js` rebuilds the admin report `ledger/reports/bbcore-no-target-three-way.html` (and its `index.json` entry) from these numbers; `out-three-way.txt` has the same figures as text. It lives on the ledger branch `bb-core-no-target-dashboard` until that is merged to `main`.

## 7. Ranking at 2.5% risk, ₱10,000 per year (Oct 29, 2026): `rank.js`, `out-rank-2.5pct.txt`
Run `CAP=580 node rank.js` (580 = the bots' maxRiskUsd $10 at about ₱58/$; without CAP the compounding is unrealistic).
Rank: **1. BB no-target**, **2. I-Core**, 3. BB 1:4. Best tandem: **BB no-target + I-Core** (correlation 0.09). Sum of the yearly ₱10k results: no-target ₱236k (₱152k without 2021),
1:4 ₱193k (₱136k), I-Core ₱179k (₱120k); tandem no-target + I-Core ₱416k (₱272k without 2021) vs 1:4 + I-Core ₱373k (₱256k).

## 8. The three tandems on one combined ₱20,000 (Oct 29, 2026): `pairs.js`, `out-pairs.txt`
BB 1:4 + BB no-target scores highest on paper (sum ₱429k, ₱287k without 2021, worst year ₱40.7k) but takes the same entry on 83% of trades (correlation 0.80, worst month -34R vs -21R): it is one signal at double risk with half the position exiting at 4R. BB no-target + I-Core (₱416k, ₱272k, worst ₱29.9k, correlation 0.09, 12% shared entries) is the diversified choice.

## 9. No $10 cap, full compounding at 2.5% (Oct 29, 2026): `growth.js`, `out-growth-nocap.txt`
One ₱10,000 account 2020 -> Oct 2026: BB 1:4 ₱93M (drop 56%), BB no-target ₱178M (49%), I-Core ₱27.5M (53%). Not realistic past roughly ₱1-5M: a 2.5% risk needs a position of about 0.4x the balance ($70k per trade at ₱10M). Ranking unchanged.

## 10. Risk that steps down as the account grows (Oct 29, 2026): `tiers.js`, `out-tiers.txt`
2.5% below $500, 2.0% from $500, 1.5% from $1,000, no $ cap. BB no-target: ₱10k -> ₱16.9M by Oct 2026 with a 30% deepest drop (flat 2.5% no cap: ₱178M, 49%). Tiers on the peak balance give the same drawdown as tiers on the current balance and never raise risk during a drop.

## 11. Basis note (Oct 29, 2026): when profit is counted in a year
The admin report `bbcore-no-target-three-way.html` books profit **when a trade closes** (the house style of the other reports): the fresh-year account for year Y holds the trades that closed in Y, and a trade entered before 1 January is sized on the P10,000.
The earlier outputs in this folder (`out-rank-2.5pct.txt`, `out-pairs.txt`, `out-growth-nocap.txt`, `out-tiers.txt`) count a trade in the year it was **entered**. BB-Core barely changes between the two; **I-Core changes a lot** because its trades last weeks (capped, sum of seven fresh years P179k entry basis vs P184k closing basis; I-Core 2020 P29.7k vs P3.7k; no cap P190.6k vs P213.6k). The order of the three strategies and the best pair do not change. Prefer the closing basis (the report) when the two differ.
Detailed no-cap tables, month-by-month grids, calendar-month averages, best months and the market-move split: `nocap-section.js`, figures in `out-three-way.txt`.

## 12. Month by month: fixed 1:4 vs no target, all 5 coins merged (Oct 29, 2026): `monthly-tp-vs-notarget.js`, `out-monthly-tp-vs-notarget.txt`

Trades are booked in the month they **close** (same closing basis as section 11). $5 risk per trade. "Merged" is every coin's trades in that month added together; the coin columns (SOL/ZEC/NEAR/ADA/GALA) give the trade count per coin.

- Over 80 active months, **no target is better in 41, fixed 1:4 in 36, 3 tied.** No target has the higher total (+$3,004 on 1,331 trades against +$2,466 on 1,510), but it is not better every month.
- The biggest months come from no target's large trend trades: 2021-11 (+$303, +60.6R) and 2021-08 (+$273, +54.7R), both on the no-target side.
- Worst month, both versions: 2026-10 (fixed −$83, no target −$87).- Losing months per coin on no target: SOL 30 of 73 active months, ZEC 28 of 80, NEAR 29 of 72, ADA 35 of 80, GALA 23 of 61. Single-coin months are noisy; the merged line is the one to judge.

```
Month   | FIXED 1:4: trades  merged net   R     coin trades (S/Z/N/A/G)  | NO TARGET: trades  merged net   R     coin trades (S/Z/N/A/G)  | better
2020-03 |   7      +$24    +4.8R  0/3/0/4/0            |   6      +$35    +7.0R  0/2/0/4/0            | no target
2020-04 |   6      +$12    +2.4R  0/4/0/2/0            |   6      +$22    +4.3R  0/4/0/2/0            | no target
2020-05 |   8      +$32    +6.3R  0/4/0/4/0            |   6      -$15    -3.0R  0/3/0/3/0            | fixed
2020-06 |   8       -$6    -1.2R  0/5/0/3/0            |   7      +$20    +3.9R  0/4/0/3/0            | no target
2020-07 |   8      +$66   +13.3R  0/4/0/4/0            |   5      +$63   +12.6R  0/3/0/2/0            | fixed
2020-08 |  11      -$15    -3.0R  0/5/0/6/0            |   9      +$34    +6.7R  0/3/0/6/0            | no target
2020-09 |   6      +$38    +7.6R  0/4/0/2/0            |   5      +$37    +7.4R  0/3/0/2/0            | fixed
2020-10 |   8       +$1    +0.2R  1/4/0/3/0            |   8       +$8    +1.6R  1/4/0/3/0            | no target
2020-11 |  19      +$31    +6.2R  7/5/1/6/0            |  16      +$62   +12.3R  6/4/1/5/0            | no target
2020-12 |  19      +$25    +5.0R  4/4/8/3/0            |  15      -$37    -7.4R  3/3/6/3/0            | fixed
2021-01 |  20      +$59   +11.8R  6/5/5/4/0            |  16     +$115   +23.1R  4/4/5/3/0            | no target
2021-02 |  18     +$113   +22.6R  4/3/6/5/0            |  16     +$138   +27.6R  3/4/4/5/0            | no target
2021-03 |  16      -$21    -4.2R  3/3/6/4/0            |  14      -$33    -6.7R  2/3/5/4/0            | fixed
2021-04 |  16      +$84   +16.8R  3/2/5/6/0            |  14      +$22    +4.5R  3/2/4/5/0            | fixed
2021-05 |  22       +$3    +0.7R  6/5/6/5/0            |  20      -$29    -5.9R  6/3/6/5/0            | fixed
2021-06 |  16      +$30    +6.1R  5/3/3/5/0            |  12      +$29    +5.8R  4/2/2/4/0            | fixed
2021-07 |  10      +$30    +6.1R  3/4/1/2/0            |   8      +$42    +8.3R  2/3/1/2/0            | no target
2021-08 |  18     +$177   +35.4R  5/4/4/5/0            |  11     +$273   +54.7R  2/3/3/3/0            | no target
2021-09 |  19      +$28    +5.5R  5/4/6/4/0            |  17       -$9    -1.8R  5/3/5/4/0            | fixed
2021-10 |  21      +$17    +3.4R  4/5/3/6/3            |  18      +$20    +3.9R  4/4/3/4/3            | no target
2021-11 |  24      +$59   +11.8R  5/5/5/3/6            |  20     +$303   +60.6R  5/4/5/3/3            | no target
2021-12 |  21       +$8    +1.5R  5/3/5/3/5            |  19      -$11    -2.2R  5/2/4/3/5            | fixed
2022-01 |  20     +$127   +25.5R  4/5/3/4/4            |  16     +$186   +37.3R  3/5/3/3/2            | no target
2022-02 |  15       +$9    +1.8R  4/3/2/3/3            |  15       +$9    +1.8R  4/3/2/3/3            | tie
2022-03 |  19      +$46    +9.2R  5/3/4/2/5            |  19      +$26    +5.1R  4/3/5/2/5            | fixed
2022-04 |  18       +$2    +0.5R  3/5/3/4/3            |  18      +$19    +3.9R  4/5/2/4/3            | no target
2022-05 |  19      +$79   +15.7R  4/2/5/4/4            |  19      +$55   +10.9R  5/2/4/4/4            | fixed
2022-06 |  15      +$65   +13.0R  4/4/2/2/3            |  12     +$102   +20.3R  3/3/1/2/3            | no target
2022-07 |  20      -$72   -14.4R  5/5/3/3/4            |  20      -$72   -14.4R  5/5/3/3/4            | tie
2022-08 |  18      +$12    +2.4R  5/3/3/3/4            |  18      +$12    +2.4R  5/3/3/3/4            | tie
2022-09 |  21      -$22    -4.4R  4/5/3/5/4            |  20       -$6    -1.3R  4/4/3/5/4            | no target
2022-10 |  22      +$33    +6.7R  4/5/4/4/5            |  18      +$58   +11.6R  3/4/3/3/5            | no target
2022-11 |  29      -$14    -2.8R  7/7/5/4/6            |  28      -$25    -5.1R  6/7/5/4/6            | fixed
2022-12 |  15      +$71   +14.2R  5/2/3/2/3            |  12      +$43    +8.6R  4/2/3/2/1            | fixed
2023-01 |  24      +$26    +5.2R  5/5/4/5/5            |  22      +$84   +16.8R  4/5/4/4/5            | no target
2023-02 |  15      -$32    -6.3R  2/4/3/3/3            |  14      -$51   -10.3R  2/4/3/3/2            | fixed
2023-03 |  24      +$61   +12.2R  5/4/5/5/5            |  23      +$17    +3.4R  5/4/4/5/5            | fixed
2023-04 |  26      -$47    -9.3R  6/5/5/5/5            |  24      -$27    -5.5R  5/5/5/4/5            | no target
2023-05 |  19      +$55   +11.0R  4/4/4/3/4            |  17      +$54   +10.9R  4/4/4/3/2            | fixed
2023-06 |  19      +$49    +9.8R  4/2/3/5/5            |  18      +$52   +10.4R  4/2/3/5/4            | no target
2023-07 |  20      -$23    -4.5R  4/3/3/5/5            |  19      -$23    -4.6R  3/3/3/5/5            | fixed
2023-08 |  21      +$19    +3.7R  2/4/4/4/7            |  19      +$24    +4.7R  2/4/4/3/6            | no target
2023-09 |  17      -$13    -2.6R  4/4/3/3/3            |  17      -$33    -6.5R  4/4/3/3/3            | fixed
2023-10 |  23     +$104   +20.9R  4/6/4/4/5            |  21     +$117   +23.4R  2/5/4/5/5            | no target
2023-11 |  21       +$9    +1.8R  4/5/5/4/3            |  18      -$21    -4.3R  3/5/4/4/2            | fixed
2023-12 |  23      +$98   +19.6R  3/6/4/5/5            |  20     +$157   +31.4R  3/6/3/4/4            | no target
2024-01 |  25      -$18    -3.5R  7/4/6/4/4            |  20      -$14    -2.7R  6/4/4/3/3            | no target
2024-02 |  16      +$65   +13.0R  3/4/2/4/3            |  15      +$33    +6.5R  3/4/2/3/3            | fixed
2024-03 |  20      +$56   +11.1R  4/4/3/4/5            |  15      +$53   +10.5R  2/3/3/4/3            | fixed
2024-04 |  19      +$24    +4.8R  4/4/5/3/3            |  16      +$54   +10.9R  3/3/5/2/3            | no target
2024-05 |  21      -$30    -6.0R  4/4/3/4/6            |  20      -$30    -6.0R  3/4/3/4/6            | no target
2024-06 |  23      +$20    +3.9R  3/4/4/7/5            |  21       -$2    -0.5R  3/3/4/6/5            | fixed
2024-07 |  22      +$87   +17.4R  4/5/4/5/4            |  20      +$25    +5.0R  4/5/3/4/4            | fixed
2024-08 |  21      +$11    +2.2R  3/6/3/5/4            |  18      +$26    +5.1R  3/6/2/3/4            | no target
2024-09 |  22      +$16    +3.2R  5/4/4/5/4            |  22      +$26    +5.3R  5/4/4/5/4            | no target
2024-10 |  24      -$28    -5.6R  4/4/7/6/3            |  21      -$42    -8.5R  4/3/5/6/3            | fixed
2024-11 |  17     +$161   +32.2R  2/4/4/3/4            |  13     +$157   +31.4R  2/2/3/2/4            | fixed
2024-12 |  23      +$32    +6.4R  4/4/6/6/3            |  17      +$63   +12.7R  4/3/5/3/2            | no target
2025-01 |  22      +$23    +4.6R  5/4/7/4/2            |  18       -$9    -1.8R  3/3/6/4/2            | fixed
2025-02 |  15      +$98   +19.6R  3/3/3/4/2            |  11      +$78   +15.7R  4/2/2/2/1            | fixed
2025-03 |  18      -$24    -4.9R  3/4/5/4/2            |  17      -$44    -8.8R  2/4/5/4/2            | fixed
2025-04 |  19      +$46    +9.3R  3/5/3/3/5            |  18      +$15    +2.9R  3/5/3/3/4            | fixed
2025-05 |  26      +$61   +12.3R  5/4/6/5/6            |  21      +$64   +12.7R  4/3/5/5/4            | no target
2025-06 |  18      +$27    +5.4R  5/3/3/4/3            |  17      +$42    +8.3R  5/3/3/3/3            | no target
2025-07 |  20      +$36    +7.3R  5/4/5/4/2            |  17      +$57   +11.3R  4/4/4/3/2            | no target
2025-08 |  18      -$22    -4.3R  4/4/3/4/3            |  17      -$18    -3.7R  4/4/3/3/3            | no target
2025-09 |  21      +$46    +9.1R  4/4/4/5/4            |  18      +$14    +2.9R  4/2/4/4/4            | fixed
2025-10 |  22      +$53   +10.7R  5/5/5/3/4            |  18     +$112   +22.4R  4/4/5/2/3            | no target
2025-11 |  17      +$99   +19.8R  2/5/3/3/4            |  13      +$83   +16.5R  2/2/3/3/3            | fixed
2025-12 |  25      -$37    -7.4R  8/4/5/5/3            |  22      -$31    -6.2R  8/3/3/5/3            | no target
2026-01 |  20      +$50   +10.1R  4/3/6/4/3            |  17       -$8    -1.5R  3/3/4/4/3            | fixed
2026-02 |  23      +$26    +5.3R  4/5/3/5/6            |  22      +$41    +8.2R  4/5/3/5/5            | no target
2026-03 |  19      -$12    -2.5R  5/4/3/4/3            |  17       -$9    -1.8R  4/4/2/4/3            | no target
2026-04 |  23      -$28    -5.6R  6/3/4/6/4            |  23      -$30    -6.0R  6/3/4/6/4            | fixed
2026-05 |  21     +$126   +25.2R  4/3/6/4/4            |  14     +$181   +36.2R  3/2/3/3/3            | no target
2026-06 |  19      +$31    +6.1R  4/5/3/3/4            |  17      +$81   +16.3R  3/5/3/3/3            | no target
2026-07 |  21       +$3    +0.6R  2/5/6/5/3            |  20      -$16    -3.3R  2/5/6/5/2            | fixed
2026-08 |  24      +$76   +15.2R  8/5/4/4/3            |  21     +$219   +43.8R  7/4/4/3/3            | no target
2026-09 |  23      +$35    +7.1R  3/5/5/5/5            |  20      +$78   +15.6R  3/4/3/5/5            | no target
2026-10 |  19      -$83   -16.6R  3/5/4/4/3            |  20      -$87   -17.4R  3/5/5/4/3            | fixed
TOTAL: fixed 1510 trades +$2466 | no target 1331 trades +$3004
months won: {"fixed":36,"no target":41,"tie":3} of 80

Per-coin monthly-level check (no target): months with a loss, by coin:
  SOL: 73 active months, 30 losing
  ZEC: 80 active months, 28 losing
  NEAR: 72 active months, 29 losing
  ADA: 80 active months, 35 losing
  GALA: 61 active months, 23 losing
```

## 13. ₱10,000 a year, flat risk, no compounding (Oct 29, 2026): `flat-peso-per-year.js`, `out-flat-peso-per-year.txt`

Each year starts fresh at ₱10,000 and every trade risks a flat 2.5% (₱250). Trades are booked in the year they close (section 11 basis). The sum of years is a total of separate ₱10,000 years, not one account's balance.

```
₱10,000 each year, flat ₱250 per trade (2.5%), no compounding, by exit year
year   | BB 1:4: trades  profit   | BB no-target: trades  profit
2020   |   100   +₱10,421 |    83   +₱11,380
2021   |   221   +₱29,387 |   185   +₱43,000
2022   |   231   +₱16,852 |   215   +₱20,297
2023   |   252   +₱15,312 |   232   +₱17,474
2024   |   253   +₱19,782 |   218   +₱17,461
2025   |   241   +₱20,344 |   207   +₱18,073
2026   |   212   +₱11,208 |   191   +₱22,516
total  |       +₱123,305 |         +₱150,202
```

No target leads in total (+₱150,202 against +₱123,305), mainly in 2021 and 2026. 1:4 leads in 2024 and 2025.

## 14. ₱10,000 a year, compounding at 2.5% (Oct 29, 2026): `compound-peso-per-year.js`, `out-compound-peso-per-year.txt`

Same as section 13, but each trade risks 2.5% of the realized balance at its entry, with profit booked at exit. Part A is a fresh ₱10,000 each year, compounding inside that year. Part B is one ₱10,000 account from 2020 compounding through Oct 2026. Drawdown is the deepest drop from the peak. Part B matches section 9.

```
A) fresh ₱10,000 each year, 2.5% of realized balance per trade, compounding within the year (trades by exit year)
year   | BB 1:4 profit (dd)        | BB no-target profit (dd)
2020   |   +₱13,858 (22%)     |   +₱15,507 (20%)
2021   |  +₱106,058 (23%)     |  +₱145,342 (33%)
2022   |   +₱21,664 (56%)     |   +₱25,737 (49%)
2023   |   +₱17,451 (47%)     |   +₱14,203 (47%)
2024   |   +₱31,592 (34%)     |   +₱26,244 (33%)
2025   |   +₱37,070 (32%)     |   +₱27,953 (29%)
2026   |    +₱9,781 (46%)     |   +₱28,386 (45%)
sum    |  +₱237,475                |  +₱283,372

B) ONE ₱10,000 account from 2020, compounding through Oct 2026
BB 1:4         end +₱93,009,286  (max drop from peak 56.3%)
BB no-target   end +₱178,026,250  (max drop from peak 49.3%)
```

Compounding roughly doubles the flat totals (+₱237,475 against +₱123,305 for 1:4, +₱283,372 against +₱150,202 for no-target). The bot's $10 cap (₱580) does not bind at these balances, since 2.5% of ₱10,000 is ₱250 and the cap only binds above about ₱23,000. Balances past roughly ₱1–5M are not realistic (section 9).

## 15. One ₱10,000 account, compounding only at the start of each year (Oct 29, 2026): `yearstart-compound-peso.js`, `out-yearstart-compound-peso.txt`

One account from 2020. The risk is set once a year: every trade that enters in a year risks 2.5% of the balance on 1 January of that year, and the balance carries over. Trade PnL is booked at exit, and profit is grouped by exit year (section 11 basis). Max drop is the deepest fall from the peak up to that year. This replaces section 14 Part A, which reset the account each year and compounded inside the year.

```
ONE ₱10,000 account from 2020, risk = 2.5% of the balance on 1 January, fixed all year (compounds year to year)
year   | start balance | BB 1:4 profit  (trades, dd)   | BB no-target profit (trades, dd)
2020   |      +₱10,000 |      +₱10,421 (100, 14%) |      +₱11,380 ( 83, 11%)
2021   |      +₱20,421 |      +₱58,458 (221, 13%) |      +₱88,729 (185, 17%)
2022   |      +₱78,879 |     +₱124,409 (231, 25%) |     +₱201,138 (215, 20%)
2023   |     +₱203,288 |     +₱324,787 (252, 37%) |     +₱568,249 (232, 33%)
2024   |     +₱528,075 |   +₱1,031,910 (253, 37%) |   +₱1,500,593 (218, 32%)
2025   |   +₱1,559,984 |   +₱3,226,456 (241, 13%) |   +₱4,378,421 (207, 19%)
2026   |   +₱4,786,441 |   +₱5,348,113 (212, 35%) |  +₱15,194,534 (191, 39%)
BB 1:4         end balance +₱10,134,554
BB no-target   end balance +₱21,953,045
```

End balance from 2020: BB 1:4 about ₱10.13M, BB no-target about ₱21.95M. Balances this large are not realistic for the bot (section 9). Use the 2020–2022 rows, where the balance stays under about ₱80k, for a practical reading.
