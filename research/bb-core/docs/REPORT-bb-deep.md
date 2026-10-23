# BB Breakout (4h) on SOL, ZEC and BTC — six-year analysis

*October 2026. Every number here comes from [`bb-deep.js`](bb-deep.js) → [`results-bb-deep.md`](results-bb-deep.md). That file has the complete month-by-month tables for each coin, with trades, wins/losses, win rate, net, average trade, profit factor, max drawdown, losing streak and start/end equity per month, plus yearly subtotals. The drawdown reshuffle test is in [`bb-deep-risk.js`](bb-deep-risk.js).*

Each statement below is tagged:
- **[DATA]** — measured directly in the backtest.
- **[TESTED]** — an idea that was run through a train/held-out split.
- **[HYPOTHESIS]** — plausible but not yet tested; needs work before relying on it.

---

## 1. Bottom line

| | SOL | ZEC | BTC | All three |
|---|---|---|---|---|
| Trades | 308 | 332 | 368 | 1,008 |
| Win rate | 39% | 39% | 35% | 37% |
| Net at $5 risk | **+$532** | **+$592** | **+$312** | **+$1,436** |
| Profit factor | 1.60 | 1.60 | 1.26 | 1.47 |
| Average trade | +0.35R | +0.36R | +0.17R | +0.28R |
| Average win / loss | +2.38R / −0.93R | +2.41R / −0.98R | +2.35R / −0.98R | |
| Max drawdown | −$64 | −$78 | −$85 | −$93 |
| Longest losing streak | 8 | 9 | 10 | 18 (combined sequence) |
| Profitable months | 45 of 74 | 55 of 81 | 46 of 86 | |
| Profitable years | 7 of 7 | 7 of 7 | 5 of 8 (2019 flat) | 7 of 8 (2019 flat) |
| Held-out 2023→ (never tuned on) | +$304 | +$304 | +$178 | +$786 |

- **[DATA]** The strategy made money on all three coins. Of 22 coin-years, 20 were positive or flat; the two losing years were both BTC (2021 −$29, 2025 −$53).
- **[DATA]** SOL and ZEC are about twice as good as BTC per trade (+0.35R vs +0.17R). ZEC was never used for tuning, so its result is the cleanest evidence.
- **[DATA]** The edge has not visibly decayed in this setup: average +0.30R per trade before 2023 and +0.27R from 2023 on.
- **[DATA]** The win rate is low (35–39%). All of the profit comes from a few large winners: 16% of trades hit the 4R target, and the 48-candle time exit averages +0.9R. Losses are kept to about −1R each.
- **[DATA]** It is not adaptive. It does well when a coin makes a big, clean move in either direction and loses steadily when price goes sideways. It survives regime changes because sideways losses are small and capped, not because it detects them.

---

## 2. How it was tested (no look-ahead)

**Rules (frozen):**
- **Long:** a 4h close above the upper Bollinger band (20, 2σ), with price above the 200-candle SMA.
- **Short:** a 4h close below the lower band, with price below the SMA.
- **Stop:** the middle band at the signal close.
- **Target:** 4× the stop distance.
- **Time exit:** close at the next open after 48 candles (8 days).
- One trade at a time per coin.

These settings were picked on 2019–22 BTC/ETH/SOL. The 4R target was chosen after looking at all years, so it is mildly in-sample.

**Execution realism [DATA]:**
- **Bot design:** an independent bot gets one *closed* candle at a time. It recomputes Bollinger, SMA and ATR only from candles already seen, decides at the close and fills at the next open.
- **Costs:**
  - entry, stop and time exit: Binance taker 0.05% + 0.02% slippage;
  - target: maker 0.02%, filled only if price trades 0.05% *through* it;
  - funding: real Binance funding on every 8-hour event a trade was open through.
- **Same-candle ambiguity:** if one candle touches both stop and target, it counts as a stop. This never happened on these coins.

**Checks run in this analysis [DATA]:**
- **Truncation test:** the app engine was re-run on data cut at 100 random points per coin, and every decision up to each cut was compared with the full-history run. 103,000 orders, **0 mismatches**. Any use of future candles would have caused differences.
- **Bot vs app:** the bot matched the app engine trade for trade: 308/308, 332/332, 368/368 identical entry and exit candles.
- **Doubled costs:** still +$1,258. BTC is the most cost-sensitive (+$312 → +$217), because its stops are tighter, so fees are a larger share of each trade.

Accounting: fixed $5 risk per trade, no compounding, on a notional $1,000 account per coin. Profit is booked in the month a trade closes.

---

## 3. Year by year: market regime and why it worked or didn't

Regime terms used in the table:
- **Trend efficiency** = |net move| ÷ total distance travelled by weekly closes (1 = straight line, near 0 = round trip).
- **SMA crosses** = how many times price flipped sides of the 200-candle SMA during the year (whipsaw).

| Year | SOL | ZEC | BTC | All | Regime (coin move · trend efficiency · SMA crosses) |
|---|---|---|---|---|---|
| 2019 (BTC from Sep) | — | — | $0 | $0 | BTC −30%, mostly below SMA; too short to judge |
| 2020 | +$30 (from Sep) | +$80 | +$121 | +$231 | BTC +303%, eff 0.51 (cleanest trend in the sample); ZEC −3% but 109% volatility |
| 2021 | +$134 | **+$190** | **−$29** | +$295 | Mania with crashes. SOL +11,200%, ZEC +129%, BTC +60% but eff 0.09 (two tops, May crash) |
| 2022 | +$65 | +$17 | +$41 | +$124 | Bear market (LUNA in May, FTX in Nov). SOL −94%, ZEC −75%, BTC −64% |
| 2023 | **+$165** | +$4 | +$105 | +$274 | Recovery. SOL +921%, BTC +156% at low volatility (eff 0.38); ZEC −28% with 100 SMA crosses, the choppiest coin-year |
| 2024 | +$42 | +$128 | +$51 | +$221 | Up but with a long mid-year range. SOL +86% at eff 0.13; ZEC +109% at eff 0.24 |
| 2025 | +$41 | +$127 | **−$53** | +$115 | ZEC +810% (eff 0.34); BTC −6% at eff 0.05 (sideways all year); SOL −34% at eff 0.12 |
| 2026 (to Oct) | +$56 | +$45 | +$74 | +$176 | All three ranging/declining with low efficiency (0.06–0.17), yet all positive |

### SOL [DATA]
- **Best year, 2023 (+$165, +0.70R):** the recovery from the FTX low was one of the cleanest large trends in the data. The long side made +$153.
- **2021 (+$134):** a huge trend, but interrupted. Feb, Apr and Aug 2021 were +$45 to +$73 each, while May–Jun 2021 (the crash and its aftermath) lost money.
- **2022 (+$65):** made almost entirely by shorts (+$113 vs longs −$48). The trend filter flipped the strategy short, which is how it is designed to work.
- **2024–26 (+$41 to +$56 a year, +0.16 to +0.27R):** a market making big ranges but going nowhere week to week (efficiency 0.04–0.13). The worst months are all choppy: Dec 2025 −$41 (8 trades, 0 wins), Jan 2024 −$28, Apr 2026 −$21.
- **Deepest drawdown:** −$64, Jun → Dec 2022, recovered Mar 2023 (40 trades, 270 days). Second: −$43, Nov 2025 → Jan 2026, recovered Jun 2026.
- **Losing streaks:** 11 streaks of 5+ losses; longest 8 (twice).

### ZEC [DATA]
- **Best years:** 2021 (+$190, +0.82R, win rate 48%), then 2024–25 (+$128 and +$127). In 2025 the rally ran +810%, and Oct 2025 alone was +444% for the coin.
- **Worst year, 2023 (+$4):** quiet volatility (68% vs its usual ~100%) and 100 SMA crosses. It had the 9-loss streak (Dec 2022 → Feb 2023) and the deepest drawdown: −$78, Oct 2022 → Feb 2023, recovered Jul 2023.
- **Consistency:** 55 of 81 months profitable, the best of the three, and never more than 2 losing months in a row.
- **Now (Oct 2026):** ZEC is in a live 7-loss streak (23 Sep → 19 Oct 2026, −$36). That is inside its historical range, but relevant if you start live now.

### BTC [DATA]
- **Good years:** 2020 (+$121; the COVID crash short in Mar 2020 made +$43, then the Q4 trend) and 2023 (+$105, a steady low-volatility uptrend).
- **2021 (−$29):** BTC's two-top year. Four losing months in a row to Apr 2021; drawdown from Dec 2020 to Jan 2022.
- **2025 (−$53):** a sideways year (efficiency 0.05). Win rate 25%, a 10-loss streak (3 Jun → 9 Jul 2025) and the deepest drawdown of any coin: −$85 from Nov 2024 to Jul 2025. It took **560 days** to recover (Jun 2026).
- **Bear years:** shorts carried 2022 (+$93 vs longs −$52).

---

## 4. Which conditions help or hurt — evidence

### 4a. Measured after the fact (explains results, but can't be traded directly) [DATA]
All three coins pooled, months with at least one closed trade:

| Month's condition | Avg trade | Months positive | Net |
|---|---|---|---|
| Trend efficiency < 0.15 (choppy) | **−0.14R** | 42% | −$287 |
| Trend efficiency 0.15–0.30 | +0.31R | 66% | +$536 |
| Trend efficiency 0.30–0.50 | +0.84R | 79% | +$880 |
| Trend efficiency ≥ 0.50 | **+1.14R** | 100% | +$307 |
| Coin moved < 5% in the month | **−0.31R** | 32% | −$279 |
| Coin moved ≥ 30% | **+0.91R** | 82% | +$1,133 |
| Month down > 10% | +0.53R | 76% | +$738 |
| Month within ±10% | **−0.23R** | 37% | −$415 |
| Month up > 10% | +0.62R | 72% | +$1,113 |
| Price never crossed SMA200 | **+1.20R** | 98% | +$1,040 |
| 9+ SMA200 crosses | −0.14R | 38% | −$187 |
| Volatility quiet (< 0.75× coin median) | +0.01R | 53% | +$13 |
| Volatility high (> 1.3×) | +0.56R | 63% | +$663 |

These are the clearest findings in the study:
- **Profitable:** months with a large move in one direction (up or down roughly equally), a clean path and price staying on one side of the SMA.
- **Unprofitable:** months that end within ±10% or keep crossing the SMA.
- **Quiet months** break even. High volatility helps, but less than direction and cleanness do.

### 4b. Measured at entry (could be traded) — train/test split [DATA]
For each trade, five facts known at the signal close were recorded. Cut-points were set on trades before 2023 and then applied unchanged to 2023 onward.

| Condition at entry | Before 2023 (low / mid / high third) | 2023→ (low / mid / high) | Same pattern in both halves? |
|---|---|---|---|
| Trend efficiency of the last 10 days | +0.44 / +0.40 / **+0.06R** | +0.53 / +0.16 / **+0.12R** | **Yes:** breakouts after a quiet, directionless stretch beat breakouts after the move has already run |
| ATR% rank vs 90 days | **+0.44** / +0.26 / +0.20R | **+0.58** / +0.02 / +0.24R | Partly: low volatility before entry is best in both halves |
| SMA200 slope | +0.25 / +0.39 / +0.22R | +0.47 / +0.14 / +0.15R | No |
| Stretch from SMA200 | +0.22 / +0.39 / +0.28R | +0.38 / +0.28 / +0.16R | No |
| Band width | +0.40 / +0.39 / +0.11R | +0.28 / +0.21 / +0.38R | No |

Both consistent findings point the same way. The best trades are breakouts that start *from compression*, after the market went nowhere for about 10 days, rather than chasing a move that is already underway.

Caveat: five features were tried and one passed fully. With that many tries, one success could be partly luck.

### 4c. Where the money comes from [DATA]

| | Target exits | Stop exits | Time exits (48 candles) |
|---|---|---|---|
| Share of trades | 14–17% | 53–58% | 26–31% |
| Average | +3.9R | −1.03R | **+0.9R** |
| Total (3 coins) | +$3,094 | −$2,956 | +$1,297 |

- **Time exits are profitable on average** (+0.9R). Trades that neither stop out nor reach 4R within 8 days are usually still moving the right way.
- **Stopped trades:** 24–30% had first reached +1R, but only 5–9% had reached +2R. Winners dip −0.4R on average before working, which is why break-even stops hurt (see 6a).

---

## 5. Comparing SOL, ZEC and BTC [DATA]

| | SOL | ZEC | BTC |
|---|---|---|---|
| Typical monthly volatility | 96% | 102% | **49%** |
| Band half-width at entry (≈ stop distance) | 6.5% | 6.3% | **3.1%** |
| Win rate / target-hit rate | 39% / 16% | 39% / 17% | **35% / 14%** |
| Average trade | +0.35R | +0.36R | **+0.17R** |
| Cost sensitivity (net lost when costs double) | −8% | −7% | **−30%** |
| Long / short average | +0.39 / +0.30R | +0.42 / +0.29R | +0.16 / +0.18R |
| Funding over 6 years | −$22 | −$21 | −$29 |

**What explains the gap [DATA]:**
- The average win and average loss are almost identical on all three coins (+2.4R / −1.0R). The whole difference is **how often** a breakout follows through: 39% vs 35% wins, 16–17% vs 14% target hits.
- BTC's stops are half as wide, so fees take a bigger bite.
- BTC's losing years (2021, 2025) were its lowest-efficiency years (0.09, 0.05). SOL's and ZEC's low-efficiency years were also its weakest, but those coins still had enough large swings to stay positive.

**[HYPOTHESIS]** BTC is a deeper, more arbitraged market, so 4h band breaks on it more often revert than run. That would explain the lower follow-through. Not tested directly.

**Diversification [DATA]:** monthly results are almost uncorrelated (SOL–ZEC 0.02, SOL–BTC 0.24, ZEC–BTC 0.11). Running all three, the worst drawdown was −$93, versus −$227 if each coin's worst had landed at the same time. Their bad years rarely coincide: 2023 was ZEC's worst and SOL's best, and 2025 was BTC's worst and ZEC's best. This is the strongest argument for trading more than one coin.

---

## 6. Can it adapt? Improvements and risk management

**Verdict [DATA]:** the strategy does not adapt; it *tolerates*:
- **Sideways markets:** it bleeds slowly, about −0.1 to −0.3R per trade in those months, with streaks of 8–10 losses.
- **Big moves:** each one, in either direction, pays for months of chop.
- **Bull vs bear:** the SMA200 filter makes it symmetric. It made money in the 2022 bear market mainly from shorts.

The long-run risk is a long low-efficiency period on every coin at once. BTC 2025 is the template: one losing year and a 560-day recovery.

### 6a. Ideas that were tested [TESTED]
All three coins, with thresholds from pre-2023 data. The fair test is 2023 onward:

| Idea | Before 2023 avg / net | 2023→ avg / net | 2023→ max DD | Verdict |
|---|---|---|---|---|
| **Baseline** | +0.30R / +$634 | +0.27R / **+$802** | −$93 | — |
| Skip if the last 10 days already trended hard (top third) | +0.39R / +$577 | +0.34R / +$708 | −$88 | Better per trade in **both** halves, but less total profit. A "fewer, better trades" option, not a profit booster. Helps BTC slightly, costs SOL most |
| Skip if price crossed the SMA ≥ 4× in the last 30 days | +0.28R / +$295 | +0.09R / +$130 | −$80 | **Rejected.** Past whipsaw does not predict future whipsaw; it removes good trades (BTC turns negative) |
| Only trade when ATR is in its bottom third (90 days) | +0.29R / +$249 | +0.47R / +$544 | **−$67** | Helped only in the held-out half, not the training half. Unproven: needs forward data |
| Break-even stop at +1R | +0.21R / +$476 | +0.18R / +$580 | −$86 | **Rejected:** worse in both halves |
| Break-even stop at +2R | +0.26R / +$563 | +0.24R / +$706 | −$99 | **Rejected:** worse in both halves |
| Halve risk after 5 losses in a row (sizing only) | — | +$735 | −$80 | Mixed: lower recent drawdown, but a higher all-years drawdown (−$103) and less profit. Not worth it |
| 1:3 target instead of 1:4 | | | | 1:4 is better on SOL (+$532 vs +$417) and ZEC (+$592 vs +$474), about the same on BTC |

**What the tests say:** none of the filters beat the plain strategy on total profit. The chop that hurts it (section 4a) is only visible *after* the month is over. The trailing proxies either cut good trades along with bad ones, or (whipsaw) fail outright. The honest default is to keep the rules frozen.

### 6b. Ideas that need more testing [HYPOTHESIS]
1. **Use a "fewer, better trades" mode when risk budget is tight.** The 10-day trend-efficiency skip passed both halves for quality. Paper-trade it alongside the baseline rather than replacing it.
2. **Let winners run longer.** Time exits average +0.9R, so trades still open after 8 days are often still trending. A longer time exit or a trailing stop after candle 48 might help. Risk: this is exactly the kind of tweak that overfits; test it on unseen coins first.
3. **Add more uncorrelated coins rather than more filters.** Diversification is the one improvement with strong support (correlations 0.02–0.24). The risk is that other coins were weaker (DOGE, ETH, XRP held out at +$47 to +$81 per coin since 2023).
4. **Portfolio-level brake.** For example, reduce size if the rolling 50-trade result across all coins falls below the historical worst (−13.8R). This is untested as a rule; for now it is better used as a stop-and-review trigger (below).
5. **BTC-specific caution.** Consider smaller size on BTC, or treat it as a diversifier only. It has the weakest edge and the highest cost sensitivity.

### 6c. Risk planning for live trading [DATA]
Shuffling the 1,008 trades in random order (2,000 runs, in R) shows what drawdowns *could* look like with the same trades in a different sequence:

| | Historical max DD | Median reshuffled DD | 95th percentile | 99th percentile | Worst 30-trade stretch |
|---|---|---|---|---|---|
| SOL | 12.8R | 13.8R | 21.4R | 26.0R | −12.8R |
| ZEC | 15.6R | 14.4R | 22.9R | 27.6R | −13.9R |
| BTC | 17.0R | 20.9R | 33.0R | 40.0R | −12.1R |
| All three | 18.5R | 21.3R | **32.2R** | 38.7R | −16.9R |

- **History was on the lucky side.** Realised drawdowns are at or below the reshuffled median, so plan for the 95th percentile: about 32R across all three coins. That is **$32 at your $1 risk**, $160 at $5.
- **Expected pace:** about 150 trades a year across the three coins (about 12 a month). On the 2023→ result, that is about +41R a year, so about +$3–4 a month at $1 risk.
- **Suggested stop-and-review triggers** (from the table, not tuned):
  - drawdown beyond 39R (the 99th percentile);
  - a rolling 50-trade result below −14R;
  - the target-hit rate over 60+ trades falling below about 10% (it has been 14–17%).

---

## 7. What is proven and what isn't

**Supported by the backtest [DATA]:**
- Profitable on SOL, ZEC and BTC over six years, after realistic costs and funding, with no look-ahead.
- Profitable on ZEC, which was never used for tuning, and in 2023–26, which was never tuned on.
- The edge comes from large, clean moves in either direction; flat and choppy months lose.
- SOL and ZEC have about twice BTC's edge per trade; BTC is weaker and more cost-sensitive.
- The three coins' results are nearly uncorrelated, so combining them roughly halves the drawdown.
- Break-even stops and a trailing-whipsaw filter make it worse.

**Not proven [HYPOTHESIS]:**
- That the edge will continue. Six years and about 1,000 trades is decent, but the 4R target was picked with hindsight, and markets change.
- That any filter improves it in the future. The best candidates (10-day trend efficiency, low ATR rank) each have one or two halves of support, not out-of-sample confirmation.
- The reasons behind BTC's weaker follow-through, and whether extending winners helps.

**Recommended next step:** run the frozen rules unchanged: SOL + ZEC (+ BTC at smaller size), 1:4, $1 risk. Log every trade against this report's numbers, and review at the triggers in 6c. Re-test the hypotheses in 6b only on data that arrives *after* today.
