# Tested strategies: registry (read before testing anything new)

One line per idea already tested, with its verdict and where the evidence lives. **Before testing a strategy,
search this file.** If it's here, don't re-test it unless the new test changes something stated in "what would
justify a re-test". After every study, add or update its row (newest first inside each section).

Status: **LIVE** (real money) · **PAPER** (forward test running) · **LEAD** (positive but unproven, watch only) ·
**REJECTED** (tested, no durable edge) · **INFO** (a finding, not a strategy).
R = risk units (1R = stop distance). IS/OOS = in-sample/out-of-sample. Costs are realistic unless noted.

## Running strategies
| Strategy | Rules (short) | TF / coins | Status | Evidence |
|---|---|---|---|---|
| BB-CORE | Bollinger(20,2) close-through, trade with 200-SMA, stop at middle band, 48-candle time exit | 4h; SOL NEAR ADA GALA | LIVE (`bbcore`) | `strat-hunt-nov6/REPORT.md` (+594R, 7/7 years), `bb-core/` audit |
| I-CORE | Ichimoku cloud break with 200-SMA, 2 ATR stop, 7 ATR trail | 4h; same coins | LIVE (`icore`) | `strat-hunt-nov6/REPORT.md` |
| T-CORE (BB-Trail P14) | BB-CORE entry, 2 ATR stop, 14 ATR trail | 4h; same + ETH (Nov 12) | LIVE (`tcore`) + PAPER (`bbtr`) | `strat-hunt-nov6/REPORT.md` #3, `bb-trail/`, `eth-yearly/REPORT.md` |
| BB-CORE 1h | BB-CORE on 1h (band 80, trend 800, time exit 192) | 1h | PAPER (`bb1h`) | `bb-core-1h/`; backtest DD −31R is past the −26R line |
| News gate | No entries in the 8h before CPI/NFP/FOMC/PCE/PPI; no longs within 72h of a $1M+ hack on the coin's chain | overlay on all 3 bots | PAPER (`bbn/icn/tcn`) | `news-lab/REPORT.md` (+15/+9/+24R) |
| Coin lab: SUI / ARB | BB-CORE rules on ARB only; T-CORE rules on SUI + ARB only (I-CORE no new coin) | 4h | PAPER (`cbb`, `ctc`; built Nov 12 2026, VPS install pending) | `coin-walkforward/SUI-ARB.md`, `../coin-lab-bots/README.md` |

## Tested: rejected or info only
| Date | Idea | Verdict | Key numbers | Evidence | What would justify a re-test |
|---|---|---|---|---|---|
| 2026-11-12 | **Long-history coin screen** (89 Binance perps listed before 2022, TRI-CORE rules, year by year 2020-2026, 2x cost, ex-top-10) | INFO: no new coin | 9 coins positive every year: ADA SOL GALA (bots), ENJ ONE GRT KSM UNI ANKR (new). Only UNI, ONE liquid; KSM/UNI/ANKR negative without their top 10 trades; ONE/UNI already failed walk-forward. BTC/ETH/DOGE/AVAX/ZEC miss by one year | `long-history/REPORT.md`, `screen.txt` | A walk-forward split on the new 9 (pick 2020-2023, judge 2024-26) |
| 2026-11-12 | **Long-history replacement for SUI/ARB** (85 Binance perps listed before Dec 2021, each ADDED to BB-CORE or T-CORE; picked on 2022-23, judged 2024-Nov 2026 and 2026; MEXC volume live) | REJECTED (keep SUI/ARB) | BB-CORE: 40 coins help 2022-23, 6 still help after, only ZEC tradable (retired). T-CORE: 26 help, 2 hold (1000SHIB −9R in 2026 with DD +11.5R; VET thin). In 2026 the bot + SUI + ARB beats every alternative (T-CORE +35.6R, DD −1.0R; BB-CORE + ARB +26.2R). Also: ENJ/GRT/KSM/ANKR are listed on MEXC but trade $0.1-0.2M/day. Among the six (ENJ ONE GRT KSM UNI ANKR): BB-CORE best = GRT (2024-26 R÷DD +1.45 vs ARB +1.24, DD +4.6 vs +1.0); ENJ is only its Apr 2026 pump; no pair of the six beats SUI+ARB on T-CORE (DD ~53R vs 35R) | `long-history/REPLACE-SUI-ARB.md`, `CONTENDERS-2026.md`, `VS-SUI-ARB.md`, `SIX-PAIRS.md`, `SIX-2026.md` | VET on T-CORE if its MEXC volume grows; UNI on I-CORE (best liquid I-CORE add) |
| 2026-11-12 | **Recent-years coin screen** (2024 / 2025 / 2026, 68 coins, all 3 bots, TRI mix) | LEAD: SUI, ARB (paper candidates) | 23 coins positive all 3 years, 14 liquid. SUI +19/+12/+9 (DD 7.4R), ARB +8/+12/+19 (DD 8.6R), DOGE +36/+8/+8 (but failed walk-forward). Hindsight pick | `coin-walkforward/REPORT.md` (recent section), `recent3.txt` | Re-check SUI/ARB with a walk-forward split once they have ~4 years |
| 2026-11-12 | **Walk-forward coin pick**: add one coin to BB-CORE / I-CORE (SOL NEAR ADA GALA) or a 6th to T-CORE (+ETH); chosen on Oct 2021-2023, judged 2024-2026; 22-23 liquid crypto with pre-2021 history | REJECTED (no new coin) | 0 coins improve any bot in both periods; IS picks (AVAX, DOT, ONE, BTC, CRV, ETC) all hurt OOS; rank corr −0.39 to +0.05. ETH on T-CORE passes walk-forward | `coin-walkforward/REPORT.md` | New coins with 3+ years of perp history and MEXC ≥ $1M/day (SUI from mid-2026) |
| 2026-11-12 | **Portfolio mix & match**: 12 full strategies as separate sleeves (BB/I/T-CORE, 3 MTF, 5 Ichimoku-family, ORB-G), every subset of 2-5 with equal capital (1,573) | INFO: keep TRI-CORE | IS/OOS rank corr 0.19; the IS top 12 all lose to TRI-CORE OOS (4.0-8.8 vs 10.0 return/DD); no single add-on improves both periods; equal BB/I/T weights tie with 50/25/25 | `portfolio-mix/REPORT.md` | A sleeve with a pre-stated reason to win in TRI-CORE's losing months |
| 2026-11-12 | **Mix & match + tuning** of the blocks above (5 entries × 4 trend filters × 6 exits = 120, 14 coins), tuned IS for the best 20% sleeve next to TRI-CORE | REJECTED | IS-vs-OOS rank correlation −0.27; 0/120 improve the account in both periods; the tuned top-5 ensemble lowers OOS return/DD 10.0 → 8.4 | `ichi-ltf/REPORT.md` (mix section), `mix.json` | – |
| 2026-11-12 | **Lower-TF Ichimoku / EMA9-21 cross / Darvas box inside a 4h Ichimoku trend** (1h TK cross + cloud + Chikou; +RSI 50-70 + MACD; EMA cross + RSI + MACD; Darvas 3-bar box + volume); short exits (2R target / Kijun close, 2-4 day cap) and an I-CORE exit | REJECTED | Short-hold: −0.19 to +0.12R/trade, OOS ≈0, negative at 2× costs (corr with bots 0.1-0.3, as designed). P7 exit: +0.38R but corr 0.64-0.81 with I-CORE. Darvas +0.03R | `ichi-ltf/REPORT.md` | – |
| 2026-11-12 | **Multi-timeframe confluence (Triple Screen)**: daily EMA20/50 trend + 4h SMA200 (+ADX>20, +RSI pullback) + 1h 6-hour-high breakout (+RVOL); exits 2 ATR stop + 7 or 14 ATR trail, or swing stop | REJECTED (duplicate of T-CORE/I-CORE) | 14 coins: P14 core +1.02R/trade, OOS +0.99, 14/14 coins positive. But on the bot coins: +353R vs T-CORE +633R, monthly corr with T-CORE 0.93, 89% of trades overlap T-CORE, 2025 −42R. Confluences add nothing; the exit carries it | `mtf-confluence/REPORT.md` | Only if built to be uncorrelated with TRI-CORE (different holding time or market regime) |
| 2026-11-12 | **ORB, opening range breakout**, textbook (range = 1st candle of the NY / UTC / London session, close break, stop mid / far side / breakout candle, 1-3R or end of day; VWAP, RVOL, narrow-range, PDH/PDL and EMA200 filters; retest entries) | REJECTED | 9,000 configs × 8 coins. 1h NY textbook +0.01R/trade, negative 2024-26; 4h UTC0 ≈0; BTC worst. Positive on all 4 coins in both halves: fewer configs than chance | `orb-sol/REPORT.md` | A sub-hour range (5-15m candles) on index-like hours; not covered here |
| 2026-11-12 | ORB "G": 4h London candle, long, VWAP+RVOL≥1.5+room to PDH, stop mid, 3R, exit next London open | LEAD (weak) | Positive on all 8 coins; 5 bot coins +0.083R/trade, 13.5/mo, DD 25R; +0.03R at 2× costs; total +77R vs bots +450-630R (same coins/years); doesn't help bots' losing months | `orb-sol/REPORT.md`, `compare-bots.txt` | Only as a paper bot; not worth a live slot |
| 2026-11-12 | ORB "F": 1h, 1st UTC hour, long, VWAP+RVOL+EMA200, stop = breakout candle low, exit 00 UTC | REJECTED (coin-specific) | SOL +0.47, ETH +0.53, BTC +0.29, NEAR +0.17; ADA, XRP, ZEC, GALA negative. The edge comes from RVOL, not the breakout | `orb-sol/REPORT.md` | – |
| 2026-11-12 | 5th coin for BB-CORE / I-CORE (121 markets incl. MEXC tradfi perps: gold, oil, indices, stocks) | REJECTED | No coin passes the stability rule; DOT/BNB raise drawdown trade by trade; every tradfi perp fails | `zec-replacement-2/REPORT.md`, `PERBOT.md` | New listings with 3+ years of history |
| 2026-11-11 | ZEC replacement screen (43 coins, 7 years) | INFO | ETH added to T-CORE only; weak on BB-CORE (2023 −14.8R) and I-CORE | `zec-replacement/REPORT.md`, `eth-yearly/REPORT.md` | – |
| 2026-11-11 | News filters: Fear & Greed extremes, BTC-crash rule | REJECTED | Hurt the bots in backtest | `news-lab/REPORT.md` | – |
| 2026-11-06 | 27 indicator strategies, 118 variants (RSI, StochRSI, CCI, AO, Elder, Fisher, TS-momentum, KST, Heikin-Ashi, EMA ribbon, TK cross, rolling VWAP, OBV, Donchian+vol, efficiency/choppiness breakouts, fractal, momentum candle, BB+volume/ADX/squeeze) | INFO | With an ATR trail, 32/57 beat BB-CORE on total R but are fragile: 66-88% of profit from the top 10 trades, no plateau. **The exit matters more than the entry.** Pairing BB-CORE + a wide trail improves return/DD in 21/22 pairs | `strat-hunt-nov6/REPORT.md`, `REPORT-FULL-TABLES.md` | – |
| 2026-11-06 | Mean reversion: z-score dip, Bollinger fade, RSI(2) | REJECTED | About −0.02R/trade after costs, 4h and 1h (z-score = BB fade, same rule) | `strat-hunt-nov6/REPORT.md` | – |
| 2026-11-05 | First 10 trend MAs (SMA, EMA, WMA, VWMA, SMMA, HMA, DEMA, TEMA, KAMA, ALMA), 4h BTC ETH SOL ADA | INFO | The champion wins in 2021/2024 trends, the bots in the other years → tandem idea | `indicator-top10/REPORT.md` | – |
| 2026-10-27 | bb-core v2 / v3 contenders (EMA, merged, reverse, filters) | INFO | Some beat bb-core per coin, but not vs simply doubling risk | `bb-core-v2/V3-FROZEN-binance.md`, `CONTENDERS-REPORT.md` | – |
| 2026-10-27 | Big swings: frozen swing strategies, bb-core + Ichimoku blends | INFO | Led to the BB-CORE + I-CORE pairing | `big-swings/RESULTS-*.md` | – |
| 2026-10-19 | SOL NY-session SMC: CHoCH → FVG midpoint limit (15m, 1m) | REJECTED | 15m positive only in the development year; 1m loses even at zero cost | `sol-ny-smc/README.md` | – |
| 2026-10-19 | NY SMC iterations up to v7 (SOL, ETH) | LEAD | 2023-26 t=4.3; 2021-23 fails; regime-dependent. Stop rule: 3R hit rate <17% after 40 trades | `ny-smc-iterations/results/REPORT-v7-deep-stats.md` | – |
| 2026-10 | Bollinger research: BB breakout deep dive, FVG pullback, SNDK live check | INFO | BB breakout edge not decaying (+0.30R before 2023, +0.27R after) → BB-CORE | `bollinger/REPORT-bb-deep.md`, `README-fvg-pullback.md` | – |

## Lessons (mistakes not to repeat)
- **`bb-core/audit/cache-1m` is SPARSE** (only windows around the audit's trades). Never use it as continuous 1m data:
  it produced fake 20R wins in the first ORB run. Continuous 1m: `orb-universe/data/<COIN>-1m.json` (check gaps first).
- **Drawdowns measured at month-end hide dips** that recover inside a month (`zec-replacement-2` correction). Measure trade by trade.
- **Selection bias:** the best of thousands of configs always looks good. Pick on IS (≤2023), judge on OOS (2024+),
  and check that the IS top-50 survive OOS as a group. If they don't, it's noise.
- **Fat tails:** always report the result without the top 10 winners and the share of profit from the top 10% of trades.
- **Cross-coin:** test on coins the rule wasn't picked on (leave-one-coin-out). A rule that works on 2 of 5 coins isn't general.
- **Control test:** remove one condition at a time to find which one carries the edge (ORB: RVOL, not the breakout).
- **Costs:** every candidate must survive 2× fees and slippage.
- **Overlap with the bots first:** trend entries + an ATR trail on these coins re-create T-CORE / I-CORE (MTF study: corr 0.93, 89% same trades).
  Check monthly correlation and trade overlap with TRI-CORE early; a new strategy is only useful if both are low.
- **Short holding on 1h doesn't pay costs** (Ichimoku/EMA/Darvas study): tight stops + 0.14% round-trip costs erase the edge.
  On these coins the edge is "trend + let profits run": short-term versions lose, long versions copy the bots.
- **Tuning to improve TRI-CORE does not carry forward** (mix & match study: IS/OOS rank correlation −0.27). Don't re-run
  "tune until it looks nice" on indicator blocks; any new sleeve needs a reason to work in TRI-CORE's losing months, chosen before testing.

## Standard test checklist (use for every new strategy)
1. Causal indicators, closed candles only, fill at the next open, stop-first if a candle hits both. Truncation audit (random cut-offs give identical earlier trades).
2. Realistic costs (0.05% taker, 0.02% slippage, real funding) and a 2× cost run.
3. IS ≤ 2023 / OOS ≥ 2024; per year, per month, per coin; leave-one-coin-out.
4. Without the top 10 winners; share of profit from the top 10%.
5. Against the live bots: monthly correlation, overlap of trades, what it does in their losing months, combined account. Do this EARLY: high overlap = stop.
6. Add a row here.
