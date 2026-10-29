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
