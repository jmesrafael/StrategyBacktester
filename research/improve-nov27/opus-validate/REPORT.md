# Independent check of the crowded-side rule (Opus, Nov 27, 2026)

**Verdict: UNPROVEN. Paper / shadow log only, not GO.** The rule does pick out weaker trades, but "more money AND a
smaller worst fall" does not hold in a strict no-future test of the live setup. No bot, server or database was touched.

Rule tested: a bot's new trade is 3/4, 1/2, 1/4 size when it already holds 3, 4, 5+ trades the same way; base risk x1.05 / x1.11.

Who did what: an Opus agent designed the tests and judged them; Sonnet helpers wrote and ran `walkforward.js` and
`stress.js`, and Opus re-ran every number from them that affects the verdict.

## Method
- Own engine (`causal.js`): one clock moving hour by hour; each bot sees only bars that have closed. Orders fill at the next
  1h open with fees and slippage; stops checked hourly and gap-aware; funding charged when paid; time / stale exits at the
  next open; a trade refused for minimum order or margin leaves the coin free.
- Rules taken from the live bot code. The BB-CORE v4 bot code is not on this PC; its filters were checked only against the
  research code and install note.

## No-look-ahead / no-repaint proof (data cut at random times, later data removed or junked)
| Engine | Checks | Mismatches |
|---|---|---|
| Validator's engine (240 runs) | 11,402,632 | 0 |
| `replace-nov25/sim.js` signals | 310,338 | 0 |
| `sim.js` closed trades | 53,230 | 0 |
| `sim.js` shared account | 260,246 | 0 |
| `improve-nov27/engine.js` account | 1,041,026 | **24,001 (24 of 40 runs)** |

Parity: same 3,789 trades as the research sim (per trade within 0.14R, +0.19R net). All 39 live journal trades show the same
signal on the same candle; 24 match as whole trades (others: different bot start dates, one manual SOL short); live R about
0.02-0.08R worse.

## Current vs rule (Jan 2020 to Nov 24 2026)
| Version | Live config: US$600 start, US$500 risk cap | PHP 1,000, no cap | Flat 2.5%: 2020-23 / 2024-26 (growth per year, worst fall) |
|---|---|---|---|
| TRI-CORE today | US$783k, 183.0%/yr, fall 43.7% | PHP 46.7M, 47.0% | 503%, 54.1% / 641%, 53.0% |
| Rule x1.00 | US$725k, 179.8%, 40.9% | PHP 26.3M, 45.7% | 453%, 47.6% / 580%, 46.0% |
| Rule x1.05 | US$750k, 181.2%, 40.5% | PHP 38.4M, 45.6% | 484%, 49.5% / 621%, 47.3% |
| Rule x1.11 | US$780k, 182.8%, 41.9% | PHP 54.7M, 48.3% | 524%, 51.7% / 673%, 48.9% |

- Live config, fresh start 2024: today 396.8%/yr, fall 49.1%; x1.11 407.2%/yr, 39.7%.
- Live config, 71 rolling 12-month runs, x1.11: higher return 76%, smaller fall 80%, both 59%. x1.00: smaller fall 100%,
  higher return 22.5%.
- PHP 1,000 path is chaotic: start PHP 950-1,100 gives TRI-CORE 41.8M-57.0M, falls 46.6-50.0%. Over 48 start balances and
  months x1.11 makes more money in 98% but has a smaller fall in 65%; x1.05 never makes more money.

## Walk-forward (2022 to Nov 2026, each choice made only on earlier data)
It never picked the tested rule (ranked 11th-12th of 35). It picked size 1/(1+0.9N) with risk x2.35-2.47 (about 5.9% base
risk, above the bots' 5% hard cap, so it cannot run live).

| Version | Flat (growth/yr, fall) | Live cap (growth/yr, fall) |
|---|---|---|
| No rule | 543.9%, 54.1% | 268.8%, 43.8% |
| Walk-forward picks | 910.6%, 56.6% | 290.0%, 40.8% |
| Fixed x1.11 (hindsight) | 561.1%, 51.7% | 266.6%, 39.4% |
| Fixed x1.05 (hindsight) | 520.0%, 49.5% | 260.2%, 37.7% |

## Search luck and controls
- 40 shuffled worlds: the real pick's 2024-26 growth beats all of them (crowding signal is real). Only 2.5% of shuffled
  picks beat no-rule on both growth and fall; the real pick's fall in that test was 3.3 points worse.
- Even risk cut at the same worst fall: flat account, rule wins by 60-138 points a year in every period. Live cap, full
  period: -0.2 (x1.00) and +1.6 (x1.11), nearly nothing; 2024-26 +119 to +125.
- Same cuts dealt to random trades do as well: 0% (full), 8.5% (2020-23), 1% (2024-26).

## Stress (x1.11)
- Holds on the flat account: fees x2 / x3, slippage +0.1%, 1-2 hour fill delay, 10% missed signals, coin order, dropping
  the best 10 or 25 trades.
- Fails on the live-cap account, full period: 1h delay (fall 51.2 vs 49.2%), 2h delay (51.8 vs 49.9%), fees x3
  (45.4 vs 45.2%), without ZEC (37.8 vs 36.0%). Without GALA the fall is also worse on the flat account.
- Neighbour settings better on both: 3-5 of 6 at x1.11, 0-3 of 6 at x1.05. 3-month block bootstrap better on both:
  81% (x1.11), 32% (x1.05).
- Candles after Nov 24: only 30 hours; both versions open the same two BB shorts. Proves nothing.
- The bots' halt levels (39 / 35 / 45R) were not reached (R drawdowns 25.6 / 30.4 / 31.0R).

## Bugs and biases found
1. `engine.js`: trades still open when data ends are dropped for their whole life (look-ahead; changes equity up to ~90 days
   before the end; 12 trades open on Nov 24).
2. `engine.js` openR floor `Math.max(v, x.R)` uses the final result inside the stop candle (look-ahead; no reported fall
   changes, sizing unaffected).
3. Trades computed before the account runs: a skipped trade still blocks its coin (x1.11: PHP 56.6M vs 54.7M).
4. **The live US$500 per-trade risk cap was not modelled.** PHP 43M-61M is not reachable; with the cap the full-period gain
   is about zero. The earlier studies on the same account basis share this.
5. One chaotic compounding path decides the PHP headline.
6. Rounds 2 and 3 were designed after seeing 2024-26.
7. Small cost conventions (stale exits at the decision close, funding past the stop): net about zero.
8. Coin choice and base rules were picked with full hindsight (same for both versions; not testable).
9. The validator's own engine had a pending-exit bug under fill delay plus stop; found and fixed.

## Earlier claims
| Claim | Result |
|---|---|
| Flat 2024-26 better on both | held |
| Random-cut control | held |
| Equal average cut control | held only without the cap |
| Block reshuffle 71% / 98% | roughly held (81% / 100%) |
| Rolling 12 months 87% / 63% | roughly held (76% / 80%) |
| x1.05 same money, smaller fall | **failed** (38.4M vs 46.7M, no cap) |
| x1.11 tie on worst fall | **failed** (48.3% vs 47.0%, no cap) |
| 8 of 12 neighbours | weaker |
| 81 other coins, 200 random sets | not re-tested |

## Live-code notes
- In `bb-trail/icore.js` coins run one after another; the same-side count can be read from `state.coins[*].pos` just before
  `riskFor(acct)` (line 204). Apply the rule before `maxRiskUsd`, or at large balances it becomes a pure cut.
- Minimum orders skip a few more trades (101 vs 91 at PHP 1,000); with BB's ADX half size, risk can fall to x0.125.
- Shared sizing unaffected. BB-CORE (lucidio) live code not checked.

## Not tested
Other-coin study, 1-minute stop timing, MEXC candles, BB v4 live source.

## Files
`causal.js`, `parity.js`, `journal2.js`, `decompose.js`, `lookahead.js` (+ `la-child.js`, `la-debug.js`), `floor-test.js`,
`measure.js`, `control.js`, `walkforward.js`, `stress.js`, with their `.out` / `.json` results.
