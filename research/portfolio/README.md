# Running BB-Core and I-Core together — capital split, risk per trade, what a month can look like

Research done on 2026-10-28/29 while the two live bots were topped up. It answers: how to split the capital between the bots, how much each
trade really risks, how a month (and November–December) can end, and what a losing start means. Every number comes from the scripts in this
folder, run on each bot's OWN backtest (the code that trades live), 5 coins (SOL ZEC NEAR ADA GALA), Binance 4h, 2020 → Oct 2026.

## The live setup this was done for (2026-10-28)

| | BB-Core | I-Core | Total |
|---|---|---|---|
| Capital on MEXC after the top-up | $201.23 | $49.98 | $251.21 |
| How it got there | $40.41 + $160 | $9.98 + $40 | $50.39 + $200 deposit |
| Risk setting | 2.5% of its own balance per trade, max $10/trade, max 1.5× from contract rounding | same | |
| Running build | Oct 26 (bf4efd); upgrade waits until flat | Oct 28 (e4eabaf) | |

Sizing (BB-Core `lucidio.js` / `live.js`): target = balance × riskPct (live MEXC equity, re-read every run) → whole contracts, rounded to
the nearest, never above 1.5× the target, skipped if one contract is more. Live proof: the ZEC long (Oct 27, balance ~$41) risked 1.9% =
1 contract, only possible at 2.5%; the SOL short (Oct 24, $52.31) risked 5.4% = 6 contracts, only possible at the older ~5% setting.
At ~$201 the next BB-Core trade targets ~$5.00 (real $2.50–7.50); I-Core at ~$50 targets ~$1.25. Above ~$400 a bot's balance the $10 cap binds.

## 1. The two edges (RESULTS-stats.md)

| | BB-Core | I-Core |
|---|---|---|
| Trades / total | 1,510 / +493R | 760 / +658R |
| Expectancy | +0.33R (t 6.8) | +0.87R (t 3.4) |
| Without the best 10 / 20 / 40 trades | +0.30 / +0.28 / +0.23R | +0.23 / **+0.04** / **−0.14R** |
| Best single trade | +4.1R | +128.2R |
| 2020–22 → 2023–26 avg | 0.41 → 0.28R | 0.92 → 0.83R |
| Monthly mean ÷ std dev | 0.62 | 0.36 |

BB-Core's edge is broad; I-Core's lives in a few giant trends. Monthly correlation 0.18 (blend5.js found 0.15). Best-ratio BB-Core share:
84% as tested, 95% if I-Core's edge is halved, ~100% if its giant winners do not repeat.

## 2. Capital split (RESULTS-split.md, RESULTS-stats.md)

**80 / 20 (BB-Core / I-Core).** It has the lowest drawdown at 0.5% risk and lowers drawdown whether or not I-Core's big trends repeat
(+5% return if they do, −6% if they don't, vs BB-Core alone). Below ~70% BB-Core the "no big winners" case gets clearly worse.
The $200 top-up was split $160 / $40 to reach it.

## 3. Risk per trade (RESULTS-split.md; bb-core MC: research/bb-core/audit/out/v2/7-mc-risk.txt)

| Risk | 80/20 max drop 2020–26 | 1-in-20 worst drop in a year | Chance of a 20%+ drop in a year |
|---|---|---|---|
| 0.5% | −11% | 8–9% | ~0% |
| 1% | −23% | 16–17% | 1–2% |
| **2.5% (chosen)** | **−54%** | **37–39%** | **72–81%** |

Recommendation was 0.5% (max 1%); the owner kept 2.5%. If BB-Core's edge shrinks to +0.12R/trade, 1% risk already gives a 1-in-20
47% drawdown (MC file above).

## 4. One month (RESULTS-month.md) — $251, 2.5%, ~30 trades a month across both bots

| Scenario | Month ends up | Typical end | Bad (1 in 20) | Good (1 in 20) |
|---|---|---|---|---|
| Any of 78 real months | 76% | $287 | $208 | $484 |
| Starts with 3 straight losses | 64% | $273 | $203 | $428 |
| Starts with 5 straight losses | 60% | $263 | $198 | $395 |
| Starts with 8 straight losses | 44% | $243 | $187 | $354 |
| Real months 2023–26 only | 73% | $285 | $208 | $484 |

Straight losses from $251 at 2.5%: 3 → −$18, 5 → −$30, 8 → −$46. A losing start is normal (61% / 68% of trades lose) and usually
does not decide the month; only a long streak (8+) makes a losing month more likely than not. Dips of 11–16% inside a month are typical.

## 5. November + December (RESULTS-novdec.md)

| Year | Nov | Dec | Nov+Dec on $251 |
|---|---|---|---|
| 2020 | +8% | +9% | $298 |
| 2021 | +25% | +26% | $381 |
| 2022 | −8% | +35% | $308 |
| 2023 | +15% | +93% | $603 |
| 2024 | +93% | +62% | $675 |
| 2025 | +136% | −22% | $483 |

Up 6 of 6 years (median $432), but only 6 samples, carried by a few huge I-Core trends (Nov 2025 +133R, Dec 2023 +71R, Dec 2024 +69R).
Any 2 consecutive months: up 84%, typical $330, bad 1-in-20 $228, good $603. Plan on the two-month baseline (~$330, bad case ~$228),
treat a big year-end trend as a bonus.

## Caveats

Backtests, not live results: real fills, fees, funding and a less trending market lower every number. Trades are treated in exit order;
open positions overlapping across bots are not modelled. The one-year odds in RESULTS-stats.md resample trades as independent, which is why
they show almost no losing years — the drawdown columns and the "bad" cases are the better guide.

## Reproduce / update

```
node research/portfolio/dump-trades.mjs   # both bots' backtests -> trades/ (needs ../🔴BB-Core and ../🔴I-Core next to this repo)
node research/portfolio/stats.mjs         # expectancy, robustness, best split, one-year odds
node research/portfolio/split.cjs         # capital split x risk (uses research/big-swings + research/bb-core-v2)
node research/portfolio/month.mjs         # one month, losing starts
node research/portfolio/novdec.mjs        # November / December by year
python report-index/rq.py update          # re-index after changing the RESULTS files
```
The starting balances ($201.23 / $49.98) are constants at the top of month.mjs and novdec.mjs (S0), and in stats.mjs / split.cjs (S).

Related: research/big-swings (I-Core research, RESULTS-blend5.md), research/bb-core (BB-Core research and Monte Carlo), the ledger reports
icore-vs-current-bot.html and icore-10k-report.html (LEDGER/reports), the 🧭 I-Core setups indicator (js/icx.js) for the trades on the chart.
