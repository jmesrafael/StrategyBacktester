# Study notes: NEWS-TRADING-BY-infotrading.pdf

Written Nov 25, 2026. Text extracted with `pdftotext -layout` (about 740 lines). Chart pages (3-5, 7, 10, 14, 19, 23-25, 29-33, 36-37, 44-46) were rendered with pymupdf and viewed. See sections 8 and 9.

## 1. What the PDF is

| Item | Answer |
|---|---|
| Author | Aswath Damodaran (NYU Stern professor), lecture slides. Chapter "Information Trading", figures numbered 10.x |
| Length | 48 slides (slide numbers run 1 to 48) |
| Market | STOCKS only (US and some UK/France/Germany studies). No forex, no crypto, no futures |
| Style | Academic overview of research papers. It is NOT a trading manual |
| Macro news | None. No CPI, NFP, FOMC, GDP or any economic release is mentioned |

Honest verdict: the file name says "news trading", but the content is about company news (earnings, analyst revisions, mergers, splits, dividends, insider trades). It gives almost nothing for our macro Event History system. The useful parts are general principles (section 6).

## 2. Techniques (all stock based)

| # | Name | What to do | Timing | Events | Entry / exit / stop | Numbers claimed |
|---|---|---|---|---|---|---|
| 1 | Trade after news, slow-learning market | Buy after good news, sell after bad news; price keeps drifting the same way | After release, a few days to weeks | Any firm news | No exact rules. "Know when to sell" because the effect fades or reverses | "Drift is small" (slide 48) |
| 2 | Trade against news, overreaction | Buy after bad news, sell after good news | After release; then price reverses | Any firm news | None given | None |
| 3 | Insider-follow | Copy large trades by top executives | Days to 12 months | Insider buy/sell filings | None | Lakonishok and Lee 1998: insider-buying firms +22.2% in 12 months, insider-selling firms +14.4%; relationship mostly in small firms, almost none in large firms. 4 in 10 insider-buy stocks are still poor. Effect almost gone since 2002 |
| 4 | Pre-news volume watch | Look for a price run-up and volume surge before big news (sign of leaks) | Before release | Big company news | None | "Almost all major announcements are preceded by a run-up/drop" (claim, no number) |
| 5 | Earnings revision momentum | Buy stocks with the biggest upward analyst earnings revisions | Weeks to months | Analyst forecast revisions | None | +4.7% in 4 months (Givoly); top 20 revisions 14% a year vs index 7% (Hawkins 1983); +1.27% week before, +1.12% week after; UK +4.7%, France +2%, Germany +3.3% |
| 6 | Follow key analysts | Use revisions by "leader" analysts, not the consensus | At the revision | Analyst revisions | None | None |
| 7 | Analyst recommendation 4 steps | Pick influential analysts with real content, drop conflicted ones, trade at the time of the call, watch for changed minds | At call | Recommendations | None | None |
| 8 | Post-earnings drift | Buy large positive surprises and hope the drift continues | After release | Earnings | None | "Potential across all stocks is very small"; stronger in small illiquid firms; avoid high-accrual (low quality) beats |
| 9 | Trade before the surprise | Predict surprises with time-series models plus volume blips | Before release | Earnings | None | "Even if right only 55% of the time, high excess returns" (claim) |
| 10 | Takeover screens | Buy likely targets (small cap under $5B, low insider holding, low price/book, low ROE) | Before announcement | Mergers | None | None |
| 11 | Merger arbitrage | Trade the gap between the announcement price and the deal close price | After announcement until close | Mergers | None | None |
| 12 | Splits, dividend changes | Slides only show charts (images) | Around event | Splits, dividends | Not stated in text | Unknown |

## 3. Event ranking and surprise ideas

| Topic | What the PDF says |
|---|---|
| Event ranking | None for macro. Only a loose idea that bigger surprise means bigger reaction |
| Surprise definition | Reaction "should depend on how much the report exceeds or falls short of expectations" (slide 28). No formula, no thresholds, no z-score |
| Forecast quality | Analyst forecasts beat history-only models for 1-2 quarters ahead; time-series models were better April to August in a 1978 study; analysts are worse at 3-5 years |
| Forecast bias | "Analyst forecasts are often biased"; errors relate to macro conditions (chart only) |
| Revisions of previous value | Not covered (revisions here means analyst forecast revisions, not data revisions) |
| Conflicting sub-numbers | Only an equivalent: earnings quality. A beat from accounting tricks (high accruals) is weaker than a beat from real cash flow |
| Priced in | Covered as insider/leak run-up before big news, and efficient-market theory (price adjusts instantly, slide 3) |
| Other splits | Reaction by day of the week and by intraday time (charts only, numbers not readable) |

## 4. Warnings in the PDF

| Risk | Detail |
|---|---|
| Delay | Individuals get news 15-20 minutes late, and "the biggest price changes occur during these periods" |
| Slow execution | A fast feed is useless if it takes 20 minutes to trade |
| Costs | Fast execution means higher costs, which "can easily wipe out" any excess return |
| Fading effect | Price effect can fade or reverse, so you need an exit plan |
| Small edge | Drift is small; works only with quick reaction and low cost |
| Data quality | Earnings and analyst forecasts are the "weakest links" (accounting games, bias) |
| Fading edge over time | Insider effect disappeared after rules changed |
| Not covered | Spreads, whipsaws, fakeouts, stop hunting. No mention of any of these by name |

## 5. Mapping to our data

Our data: 845 US macro releases (Sep 2020 on), forecast/previous/actual, BTC and ETH 1m and 1h candles, 15m/1h/3h/6h scored moves, class, pattern. No ticks, no order book, no forex, no stock data.

| Technique | Testable? | What is missing |
|---|---|---|
| 1 Drift (follow) | Partly | Our 1h/3h/6h scores and "follow_through" / "delayed_move" patterns already measure this on macro news. Not for stocks |
| 2 Overreaction (fade) | Partly | Same: "reversal" and "faded" patterns, fade rule test is possible |
| 3 Insider-follow | No | No insider data. Crypto analogue (whale/exchange flows) not in our data |
| 4 Pre-news run-up | Partly | We have 1m candles before release: pre-release drift and volume (our idea: check 30-60 min before). No volume features stored yet in Event History |
| 5, 6, 7 Analyst revisions | No | No analyst or consensus revision history. Only one forecast per release |
| 8 Post-earnings drift | Partly (macro version) | Needs window beyond 6h (24h, 3 days) |
| 9 Predict the surprise | Partly | Needs past trend of the actuals and nowcast inputs (not stored) |
| 10, 11 M&A | No | Not relevant to perps |
| 12 Splits, dividends | No | Not relevant |
| Delay and cost rules | Yes (as a simulation) | Need honest fee/slippage assumptions; no tick data, so entry at the release-minute open is optimistic |

## 6. Top 5 ideas worth adding or testing

Most of the PDF is not usable. These come from its general principles; the first one is directly backed by the text.

1. **Entry-delay test (PDF slide 47-48, easy).** Measure how much of the 6h move is already done by minute 1, 5, 15. If most is gone at minute 1, a bot reacting after our delay has little left. Uses 1m candles we already have.
2. **Follow vs fade by event and class (PDF slide 48, easy).** For each family and surprise size, test "enter after 15m in the direction of the move, exit at 1h/3h/6h" against "fade it". Store win rate and average gain after fees. Pattern field already has follow_through and reversal.
3. **Pre-release run-up check (PDF slide 12, medium).** Add pre-release move (-60 to 0 min) and volume spike as fields, and see if they predict direction or "priced in" events. (our idea for the macro adaptation)
4. **Longer drift window (PDF slides 4, 30, medium).** Add 24h and 72h scores to see if any family keeps drifting after 6h. Needs only 1h candles.
5. **Surprise quality / sub-number check (PDF slide 34 earnings quality, harder).** Mark releases where the headline beats but a key sub-number (core, revisions to previous) disagrees; test if those fade more. (our idea; needs extra sub-number data)

## 7. Claims to be skeptical of

| Claim | Why |
|---|---|
| "Even at 55% right you should post high excess returns" (slide 35) | No evidence, ignores costs, and needs a way to predict the surprise, which is the hard part |
| Almost all big announcements preceded by a run-up | Hindsight bias; many run-ups with no news are not counted |
| Revision strategy returns (4.7%, 14% vs 7%) | Old (1980s-2000s) small stock samples; not net of costs; PDF itself says small and short-lived |
| Insider returns 22.2% vs 14.4% | 1998 study, mostly small firms; PDF itself says the effect almost vanished after 2002 |
| "Biggest price changes happen in the first 15-20 min" | Plausible for stocks in the 2000s; crypto reacts within seconds, so this needs our own test (idea 1) |
| Whole file | Stock research summaries, not a tested macro or crypto method. It gives no entry, stop or position size rules at all |

## 8. Charts and examples (all viewed as images, Nov 25)

Found with pymupdf: 17 pages hold chart images (7, 10, 14, 19, 23-25, 29-33, 36, 37, 44-46), plus pages 3-5 with simple theory curves (covered by their text). All charts are US stocks, daily or monthly data, from old academic studies. There are NO worked trades: no entry, stop or exit marks and no profit and loss example anywhere. Numbers below are read by eye from the charts, so treat them as about +/- 10%.

| Page | Event | Instrument / timeframe | What price did vs the release | Lesson | Detectable with our data? |
|---|---|---|---|---|---|
| 3 | Theory: efficient market | Stylised | Price jumps at once, then flat | No edge after the jump | Yes: it is our "normal" or "quiet" case (flat after 15m) |
| 4 | Theory: slow learning | Stylised | Jump, then keeps drifting same way | Follow after news | Yes: follow_through / delayed_move |
| 5 | Theory: overreaction | Stylised | Jump too far, then fades back | Fade after news | Yes: reversal / faded |
| 7 | Insider buying vs selling | Stocks, months 1-20 after the trade | Buy group climbs to about +38% by month 20, sell group about +10% | Insiders buying beats insiders selling, slowly | No (no insider data, horizon in months) |
| 10 | Insider trades, reporting date | Stocks, days -200 to +300 | Dips to -1% before the reporting date, rises to +2% around it, then flat | Most of the move comes around the report; price already moved before it | Partly: pre-release drift check on 1m candles (idea 3) |
| 14 | Analysts followed vs market cap | Stocks | Analyst count rises with firm size | Big firms are well covered, so less edge | No, not relevant |
| 19 | Analyst forecast error vs industrial production | Monthly, 1985-98 | Forecast error is largest in recessions and swings with growth | Forecasts are worse when the economy turns | Partly (our idea): compare surprise size in different regimes; we have forecast and actual |
| 23 | Recommendation mix, Nov 2011 | Stocks | About 45% hold/neutral, few sells | Sells are rare, so they carry more info | No |
| 24 | Added to Buy/Sell lists | Stocks, 3 days, 1m, 3m, 6m after | Added to Buy about +3% (3 days), +8% (1 month), +7.5% (3 months), +2.5% (6 months). Added to Sell about -4%, -4%, -6.5%, -9%. Bad news keeps drifting; good news fades after 3 months | Downside drift is stronger and longer than upside drift | Partly: check if our bearish classes drift longer than bullish ones (24h+) |
| 25 | Buy calls after IPO | Stocks, months -2 to +13 | Non-underwriter calls rise to about +14%, underwriter calls rise then drop below 0 by month 8 | Biased analysts mislead | No |
| 29 | Earnings surprise, 10 groups (UE1 to UE10) | Stocks 1988-2002, days -60 to +55 | Most positive group rises from 0 to about +10% by day 55, most negative falls to about -9%. Big part of the move is BEFORE day 0 (days -10 to 0 slope) with a jump at day 0, then slower drift | Size of surprise orders the outcome: bigger beat, bigger gain. Price starts moving before the release | Yes for ranking: our surprise vs 15m-6h score by size bucket. Pre-run-up part: partly |
| 30 | Same, after the release only | Days 0-55 | Most positive drifts about +3%, most negative about -2.2%; the groups stay in order. Roughly half of the drift appears in the first 15-20 days | Drift exists but is small and slow | Partly: our window ends at 6h; need 24h and longer |
| 31 | Earnings and dividend reports by weekday | Stocks | Monday-Thursday small positive (about +0.04 to +0.06), Friday negative (about -0.06) | Release day matters; Friday news is worse (axis units unclear) | Yes: weekday split exists in our data (our releases are mostly Tue-Fri) |
| 32 | Early vs delayed reporters | Stocks, days -30 to +30 | Early reporters (more than 6 days early) rise about +0.5% at day 0 and hold; delayed reporters (more than 6 days late) fall about -1% around day 0 and stay down | Late news is usually bad news | No direct match (our releases are scheduled). Close cousin: a delayed or revised release (not stored) |
| 33 | Price adjustment by hour after earnings | Stocks, hours 0-3 | One group completes about 25% of its adjustment at hour 0, 70% at hour 1, 86% at hour 2, 91% at hour 3; the other group about 9%, 54%, 63%, 76%. Legend colours are confusing; by bar order and outline colour the faster group is favorable news and the slower group unfavorable (re-checked on the rendered slide) | Most of the move is not instant; it takes hours. Bad news adjusts slower | Yes: this is the closest chart to our 15m/1h/3h/6h table. Test the same "percent of 6h move done" at each checkpoint |
| 36 | Takeover announcement | Target and bidder, days -20 to +20 | Target drifts up from 0 to about +8% before day 0, jumps to about +17% at day 0, then about +18.5% by day 20 (only a slight drift after). Bidder is flat to -1.5% | Leak run-up before the news; most gain happens at the jump | Partly: shape matches "priced in before release" check (idea 3) |
| 37 | Target premium by deal type | Stocks, 2 days | Tender 27% vs merger 22%; cash 29% vs stock 14%; hostile 28% vs friendly 22% | Type of news changes size of reaction | No (no equivalent in macro) |
| 44 | Stock splits | Month -30 to +30 | Excess return rises to about +32% by the split month, then flat | The run-up happens BEFORE the event; buying at the event is too late | Partly: same "already moved" idea, only at minutes/hours |
| 45 | Dividend cut / raise | Days -10 to +10 | Cut: about -3.5% drop at announcement day, small bounce, flat. Raise: about +0.9% jump, then flat | One-day jump, little after | Yes: looks like a normal jump-and-flat release |
| 46 | Dividend reaction over eras | 1962-74, 75-87, 88-2000 | Cuts: about -6%, -3.5%, -1.8%. Raises: about +0.8%, +0.6%, +0.2% | News effects shrink over time (more informed markets) | Yes: compare reaction size by year (2020 vs 2026) in our 845 releases |

What the visuals add (they change little): they show the same pattern again and again, a pre-release move, a jump at the release, then a slow drift that is stronger for bad news. The only time-of-day data is page 33 (hours 0-3).

## 9. Updates to sections 2, 6 and 7 after the visuals

- Section 2 add (technique 13): "Bad-news drift is longer than good-news drift" (pages 24 and 30). Trade or flag the downside side more patiently. Numbers: Added to Sell reaches about -9% at 6 months, Added to Buy fades to about +2.5% (about +8% at 1 month).
- Section 2 add (technique 14): "Surprise buckets" (page 29). Rank the surprise into 10 groups and expect the outcome to follow the order. No threshold given.
- Section 2 add (technique 15): "Hour-by-hour adjustment" (page 33). Expect only about 25% of the move in hour 0, about 70% by hour 1, and about 90% by hour 3 (for one group).
- Section 6 changes: idea 1 is now backed by page 33 (the move takes hours, not minutes, in stocks). Idea 2 gets a split: test bad-news drift separately from good-news drift (page 24). Idea 4 gets: add the surprise-bucket chart (page 29) as an output: average 24h move by surprise decile.
- Section 7 add: charts use averages over many stocks, so one trade can look very different. Page 31 shows ambiguous axis labels (#REF! errors), so that chart is not reliable; page 33's legend colours are confusing. All the numbers are from US stocks 1962-2002 and may not hold for crypto perps.
