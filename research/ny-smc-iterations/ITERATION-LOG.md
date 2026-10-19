# NY-session SMC strategy: iteration log (15m, SOL + ETH)

Started 2026-10-19 from the **first** backtest (`orig-backtest.js`: CHoCH → first post-CHoCH FVG →
limit at FVG midpoint, stop 0.02% beyond the reversal swing, target = nearest swing, breakeven at
1R, NY session 09:30–16:00 ET). Structure comes from the 📐 SMC Toolkit (`js/smc.js` `analyze()`),
the same formula and cost model as that report.

## Ground rules

- **Data:** Bybit SOLUSDT and ETHUSDT perpetuals, 15m, 2023-10-18 → 2026-10-18 (no missing bars).
  The files are shared with `research/sol-ny-smc/data/`.
  - Y1 = Oct 2023–Oct 2024
  - Y2 = Oct 2024–Oct 2025
  - Y3 = Oct 2025–Oct 2026, the year of the original report
- **Tuning used only Y1 + Y2 (both coins).** Y3 was held back and run once at the end, for every
  version together.
- **Keep rule:** a change is kept only if pooled training R rises, neither coin gets clearly worse,
  and nearby settings also work (so it isn't one lucky number).
- **Costs (unchanged):**
  - maker 0.02% on entry and target
  - taker 0.055% + 0.02% slippage on stops and breakeven exits
  - 1% risk per trade, one trade at a time
  - funding not included
- **Regression check:** `ie.js` with default settings reproduces the original report exactly:
  67 trades, 74.6% win rate, PF 1.95, +$1,633, 3.3% max drawdown.
- **Terms:**
  - R = amount risked per trade.
  - PF = profit factor. Per-coin PF is in dollars (1% compounding); the pooled PF in the round
    tables is in R.
  - ddR = deepest fall in cumulative R.

139 configurations were run. Every one is in `results/log.jsonl`, and the full tables are in
`results/round1.txt` … `round5.txt` and `results/final.txt`.

---

## Starting point: v0 (original formula) on all three years

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| SOL | PF 0.73 · −9.2R | PF 0.96 · −1.0R | PF 1.95 · +15.4R |
| ETH | PF 0.64 · −13.5R | PF 0.95 · −1.2R | PF 1.39 · +9.8R |

Only the report year was profitable. Over three years the result is ~0R (PF 0.99, 442 trades).

---

## Round 1: each tweak alone vs v0 (training: v0 = −24.9R pooled)

| Change | Pooled training R | Verdict |
|---|---|---|
| **CHoCH only in the first 2h of NY (09:30–11:30)** | **+1.7** | ✅ best; only change that helped both coins |
| CHoCH in first 3h | −0.3 | ok |
| Entry at FVG far edge / near edge | −13.2 / −16.9 | mixed (one coin only) |
| 4h EMA200 trend | −2.8 | helps SOL, not ETH |
| Fib golden zone filter | −1.1 | fewer trades, roughly flat |
| FVG ≥ 0.3 ATR / CHoCH bar ≥ 1.5 ATR | −2.4 / −6.0 | mild help |
| Breakeven at 0.5R | −14.9 | mild help |
| Fixed 1R / 1.5R / 2R / 3R target | −23.5 / −35.2 / −29.1 / −21.2 | ❌ no help alone |
| Supply/demand · PDH/PDL · either | −9.6 · −4.7 · −12.0 | ❌ worse per trade than base |
| Trendline break | −20.5 | ❌ |
| London + NY · all hours | −30.5 · −44.3 | ❌ more hours = worse |
| Swing length 3 / 7 / 10 | −31.6 / −11.5 / −5.0 | mixed |
| Flatten at session end · max 1 trade/session | −22.8 · −25.8 | ❌ |

**Kept → v1:** CHoCH must form in the first 2 hours of the session.

## Round 2: on top of v1 (+1.7R)

| Change | Pooled training R | Verdict |
|---|---|---|
| **Start the session 1h earlier (08:30 ET), CHoCH 08:30–11:30, orders live to 16:00** | **+14.9** | ✅ both years positive |
| Entry at FVG near edge | +12.6 | ✅ good; re-tested later |
| Fixed 3R target | +15.4 | promising (19% win rate) |
| No breakeven | +7.7 | ok |
| 4h EMA200 trend | +7.3 | ok, but only 69 trades |
| Window 1.5h / 2.5h | −7.4 / +2.5 | window length matters |
| Location filter (S/D or PDH/PDL) | −6.6 | ❌ |

**Kept → v2:** session starts 08:30 ET; CHoCH accepted 08:30–11:30.

## Round 3: on top of v2 (+14.9R)

| Change | Pooled training R | Verdict |
|---|---|---|
| **Fixed 3R target (instead of nearest swing)** | **+40.8** | ✅ both coins PF > 1.2, both years positive |
| Entry near edge + CHoCH bar ≥ 1 ATR | +28.9 | good |
| No breakeven | +24.6 | good |
| CHoCH bar ≥ 1 ATR | +22.2 | good |
| Nearby session windows (08:00, 09:00, 07:30 starts; 2.5h / 3.5h) | +5 to +16 | ⚠️ all positive but weaker; 08:30 is a modest peak |

**Kept → v3:** target = entry + 3 × risk. The original swing target averaged only 0.79R of reward
for 1R of risk, and that was the main weakness.

## Round 4: on top of v3 (+40.8R)

| Change | Pooled training R | Verdict |
|---|---|---|
| **CHoCH candle range ≥ 1 ATR (displacement)** | **+51.4** | ✅ both coins up, R drawdown 19.5 → 14.4 |
| Target 2.5R / 3.5R | +29.5 / +36.2 | ✅ plateau, so 3R isn't a lucky pick |
| Target 2R / 4R / 5R | +14.1 / +20.1 / +23.6 | worse |
| No breakeven · BE at 1.5R · BE at 2R | +9.9 · +13.7 · +18.5 | ❌ keep BE at 1R |
| BE at 1R locking +0.2R | +37.7 | similar, smoother (55% "win" rate) |
| 4h EMA200 trend | +37.9 | higher PF (1.55), half the trades |
| Entry near edge | +26.6 | ❌ no longer helps with a 3R target |
| Back to original 09:30–16:00 window | −21.2 | ❌ the window is essential |

**Kept → v4:** CHoCH candle high-low ≥ ATR(14).

## Round 5: on top of v4 (+51.4R): diminishing returns, tuning stopped

| Change | Pooled training R | Verdict |
|---|---|---|
| CHoCH bar ≥ 1.25 / 1.5 ATR | +56.5 / +51.4 | plateau; keep 1.0 |
| 4h EMA200 trend | +47.1 (PF 1.83) | → variant **v5a** |
| FVG height ≥ 0.2 ATR | +53.2 (PF 1.56) | → variant **v5b** |
| Daily EMA50 trend | +39.9 | — |
| BE lock +0.1R / +0.2R | +50.3 / +50.1 | no change |
| Entry 25% into FVG · stop +0.25 ATR · Fib zone | +45.5 · +53.7 · +26.9 | no real gain |

Further gains were within ±5R, which is noise at ~300 trades, so I stopped here.

---

## Final exam: Y3 (held out, run once), plus all three years

| Version | Training Y1+Y2 | **Y3 holdout** | SOL Y3 | ETH Y3 | 3 years | 3-yr 90% CI (avg R/trade) |
|---|---|---|---|---|---|---|
| v0 original | PF 0.79 · −24.9R | PF 1.61 · +25.1R | 1.95 | 1.39 | PF 0.99 · +0.2R | −0.07 … +0.07 |
| v1 2h window | 1.02 · +1.7R | 1.79 · +17.8R | 2.16 | 1.54 | 1.24 · +19.5R | −0.02 … +0.18 |
| v2 08:30 start | 1.15 · +14.9R | 1.16 · +7.6R | 1.42 | 0.98 | 1.15 · +22.6R | −0.02 … +0.15 |
| v3 + 3R target | 1.24 · +40.8R | 1.14 · +12.8R | 1.28 | 1.00 | 1.20 · +53.6R | 0.00 … +0.23 |
| **v4 + displacement** | 1.36 · +51.4R | **1.18 · +15.4R** | 1.37 | 1.00 | **1.28 · +66.7R** | **+0.03 … +0.28** |
| v5a + 4h EMA200 | 1.90 · +47.1R | 1.01 · +1.1R | 1.06 | 0.94 | 1.44 · +48.2R | +0.04 … +0.39 |
| **v5b + FVG ≥ 0.2 ATR** | 1.58 · +53.2R | **1.27 · +17.9R** | 1.36 | 1.18 | **1.43 · +71.1R** | **+0.07 … +0.37** |

v4 per year (each coin):

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| SOL | PF 1.29 · +11.0R | PF 1.31 · +12.9R | PF 1.37 · +14.5R |
| ETH | PF 1.33 · +11.4R | PF 1.47 · +16.1R | PF 1.00 · +0.9R |

v5b is the only version positive in all six coin-years:

| | Y1 | Y2 | Y3 |
|---|---|---|---|
| SOL | +10.2R | +8.1R | +11.9R |
| ETH | +3.9R | +30.9R | +6.0R |

### Stress tests (pooled, 3 years)

| | v4 | v5a |
|---|---|---|
| As tested | PF 1.28 · +66.7R | PF 1.44 · +48.2R |
| Fees + slippage ×2 | 1.15 · +36.6R | 1.28 · +32.3R |
| Fees + slippage ×3 | 1.02 · +6.5R | 1.13 · +16.5R |
| Limit fills only if price trades 0.02% through | 1.23 · +49.2R | 1.43 · +42.5R |
| Limit fills only if price trades 0.05% through | 1.17 · +35.0R | 1.34 · +32.7R |
| Costs ×2 **and** 0.02% through | 1.08 · +19.6R | 1.24 · +27.0R |

(Y3 alone under costs ×2 + strict fills: v4 −4.9R, v5a −7.7R. The holdout edge is thin.)

## Conclusions

**What helped (in order of impact):**
1. **Trading the 08:30–11:30 ET window** instead of the whole NY session. More hours were always
   worse.
2. **A fixed 3R target** instead of the nearest swing. The swing target gave 0.79R average reward,
   too small to cover the losses.
3. **Requiring a displacement CHoCH candle** (range ≥ 1 ATR).
4. Keeping **breakeven at 1R**. With a 3R target it turns many would-be losers into scratches.

**What didn't help:** supply/demand, PDH/PDL, trendline break, Fibonacci zone (all hurt or added
nothing on training), more session hours, a session-end flatten, other swing lengths.

**Overfit warning:** the 4h EMA200 trend filter (v5a) had the best training PF (1.90) and collapsed
to 1.01 on the holdout year. Don't use it.

## Recommended system (candidate, not proven)

**v4** (or **v5b**, which adds FVG ≥ 0.2 ATR), on 15m:

1. **Session:** from 08:30 ET (1h before the toolkit's NY line). Only CHoCHs that close between
   08:30 and 11:30 ET count. Pending orders are cancelled at 16:00 ET.
2. **Setup:** a CHoCH (close-break, swing length 5) whose candle range is ≥ ATR(14). Then the
   first same-direction FVG within 10 bars (v5b: FVG height ≥ 0.2 × ATR).
3. **Entry:** limit at the FVG midpoint. Cancel on an opposite structure break, if price hits the
   target first, or at 16:00 ET.
4. **Stop:** 0.02% beyond the extreme of the leg that made the CHoCH.
5. **Target:** entry ± 3 × risk.
6. **Breakeven:** move the stop to entry once price reaches +1R.
7. **Sizing:** 1% risk, one position at a time.

**What to expect:**
- About 9–12 trades a month across SOL+ETH.
- Win rate ~22–24% (target hits). Many other trades are breakeven scratches.
- Losing streaks of 17–21 trades in a row (mostly small breakeven exits) and R drawdowns of 10–15R.
- Average result about +0.11 to +0.16R per trade on the held-out year.

**Why "candidate":**
- The Y3 confidence intervals still include zero.
- ETH was flat in Y3 on v4.
- 139 variants were tried on the training data, so some optimism remains.
- The edge roughly disappears at 3× costs.

The honest next step is forward-testing (paper or replay) for a few months, or confirming on
coins that were never used here, before trading real money.

## Files

| File | Purpose |
|---|---|
| `orig-backtest.js` | The first backtest, unchanged except that its output now goes to the temp folder |
| `ie.js` | Iteration engine. Defaults = original formula; each tweak is a config switch |
| `exp.js` | Runs one round on the training years and appends every result to `results/log.jsonl` |
| `r1.js` … `r5.js` | The experiments in each round |
| `final.js` | Holdout exam, bootstrap CIs and stress tests → `results/final.txt`, `results/final.json` |

Run from this folder with Node 18+: `node exp.js r4.js`, `node final.js`.

---

## Per-version, per-coin, per-year check (SOL and ETH side by side)

Each row is one coin in one version. The last column checks, for each year, whether **both** SOL and ETH made positive R in that year. Years are separate; nothing is pooled. Y3 was the held-out year. Regenerate with `node matrix.js`.

| Version | Coin | Y1 (Oct23–Oct24) | Y2 (Oct24–Oct25) | Y3 (Oct25–Oct26) | Years positive | SOL+ETH same-year both positive |
|---|---|---|---|---|---|---|
| **v0** original formula | SOL | -9.2R · PF 0.73 · n=80 | -1.0R · PF 0.96 · n=83 | +15.4R · PF 1.95 · n=67 | 1/3 | ❌ ❌ ✅ → 1/3 |
|  | ETH | -13.5R · PF 0.64 · n=82 | -1.2R · PF 0.95 · n=63 | +9.8R · PF 1.39 · n=67 | 1/3 |  |
| **v1** v0 + CHoCH 09:30-11:30 only | SOL | +1.4R · PF 1.09 · n=41 | -2.2R · PF 0.88 · n=45 | +10.5R · PF 2.16 · n=38 | 2/3 | ❌ ❌ ✅ → 1/3 |
|  | ETH | -4.1R · PF 0.75 · n=40 | +6.5R · PF 1.60 · n=32 | +7.2R · PF 1.54 · n=37 | 2/3 |  |
| **v2** session 08:30, CHoCH 08:30-11:30 | SOL | +14.4R · PF 1.73 · n=65 | -0.0R · PF 0.99 · n=63 | +7.9R · PF 1.42 · n=57 | 2/3 | ❌ ❌ ❌ → 0/3 |
|  | ETH | -8.3R · PF 0.69 · n=55 | +8.9R · PF 1.47 · n=55 | -0.3R · PF 0.98 · n=53 | 1/3 |  |
| **v3** v2 + fixed 3R target | SOL | +14.8R · PF 1.37 · n=85 | +5.2R · PF 1.09 · n=84 | +12.0R · PF 1.28 · n=73 | 3/3 | ✅ ✅ ✅ → 3/3 |
|  | ETH | +9.3R · PF 1.24 · n=68 | +11.6R · PF 1.29 · n=79 | +0.8R · PF 1.00 · n=68 | 3/3 |  |
| **v4** v3 + CHoCH bar >= 1 ATR | SOL | +11.0R · PF 1.29 · n=78 | +12.9R · PF 1.31 · n=76 | +14.5R · PF 1.37 · n=71 | 3/3 | ✅ ✅ ✅ → 3/3 |
|  | ETH | +11.4R · PF 1.33 · n=66 | +16.1R · PF 1.47 · n=74 | +0.9R · PF 1.00 · n=67 | 3/3 |  |
| **v5a** v4 + 4h EMA200 trend | SOL | +8.0R · PF 1.59 · n=37 | +18.9R · PF 2.33 · n=38 | +1.9R · PF 1.06 · n=40 | 3/3 | ✅ ✅ ❌ → 2/3 |
|  | ETH | +1.2R · PF 1.07 · n=29 | +19.0R · PF 2.20 · n=44 | -0.8R · PF 0.94 · n=31 | 2/3 |  |
| **v5b** v4 + FVG >= 0.2 ATR | SOL | +10.2R · PF 1.42 · n=52 | +8.1R · PF 1.27 · n=57 | +11.9R · PF 1.36 · n=57 | 3/3 | ✅ ✅ ✅ → 3/3 |
|  | ETH | +3.9R · PF 1.13 · n=50 | +30.9R · PF 2.70 · n=53 | +6.0R · PF 1.18 · n=53 | 3/3 |  |

**Reading it:** v3, v4 and v5b are the only versions where SOL and ETH are both positive in every year (3/3). v0, v1 and v2 are positive for both coins only in the report year (v2: never). ETH in v3/v4 is only +0.8R / +0.9R in Y3, which is flat; v5b's ETH Y3 is +6.0R.

---

## Unseen coins: BTC, DOGE, ZEC (v3, v4, v5b, no re-tuning)

Same frozen rules, coins never used while tuning. Regenerate with `node matrix2.js`.

| Version | Coin | Y1 (Oct23–Oct24) | Y2 (Oct24–Oct25) | Y3 (Oct25–Oct26) | Years positive | All 3 coins positive (Y1 Y2 Y3) |
|---|---|---|---|---|---|---|
| **v3** + fixed 3R target | BTC | -14.7R · PF 0.65 · n=68 | -8.9R · PF 0.82 · n=95 | +17.1R · PF 1.33 · n=81 | 1/3 | ❌ ❌ ✅ (1/3) |
|  | DOGE | +4.8R · PF 1.12 · n=64 | -12.2R · PF 0.75 · n=85 | +14.0R · PF 1.29 · n=76 | 2/3 |  |
|  | ZEC | +8.0R · PF 1.35 · n=55 | +16.9R · PF 1.51 · n=59 | +14.6R · PF 1.45 · n=58 | 3/3 |  |
| **v4** + CHoCH candle >= 1 ATR | BTC | -15.9R · PF 0.61 · n=64 | -9.7R · PF 0.80 · n=91 | +17.4R · PF 1.34 · n=80 | 1/3 | ❌ ❌ ✅ (1/3) |
|  | DOGE | +4.1R · PF 1.11 · n=59 | -12.0R · PF 0.74 · n=81 | +15.1R · PF 1.33 · n=73 | 2/3 |  |
|  | ZEC | +10.2R · PF 1.50 · n=50 | +16.1R · PF 1.53 · n=57 | +12.7R · PF 1.39 · n=56 | 3/3 |  |
| **v5b** v4 + FVG >= 0.2 ATR | BTC | -5.1R · PF 0.83 · n=51 | -12.5R · PF 0.67 · n=65 | +14.6R · PF 1.36 · n=65 | 1/3 | ❌ ❌ ✅ (1/3) |
|  | DOGE | +1.8R · PF 1.05 · n=44 | -4.5R · PF 0.85 · n=60 | +11.5R · PF 1.36 · n=55 | 2/3 |  |
|  | ZEC | +0.8R · PF 1.03 · n=39 | +14.1R · PF 1.74 · n=42 | +12.1R · PF 1.45 · n=47 | 3/3 |  |

POOLED BTC+DOGE+ZEC
v3 n=641 PF=1.11 sumR=39.7 avgR=0.062 ddR=32.2 byYear=-1.9 / -4.2 / +45.7
v4 n=611 PF=1.11 sumR=38.1 avgR=0.062 ddR=30.2 byYear=-1.6 / -5.6 / +45.2
v5b n=468 PF=1.13 sumR=32.7 avgR=0.070 ddR=30.3 byYear=-2.6 / -2.9 / +38.2

**Reading it:** only ZEC is positive in all 3 years. BTC and DOGE lose in Y1/Y2 (DOGE Y1 positive) and make money only in Y3, the same pattern as the original v0. Pooled across the three coins the first two years are about −2R to −6R and Y3 is +38R to +46R, so the edge does not transfer reliably; it looks tied to the last year (and to SOL/ETH, which were used for tuning).

---

## Round 6–7: candle diagnostics → refinements (SOL + ETH, 2026-10-19)

### What the candles showed (v3 trades; v4/v5b are subsets) — `node diag.js` → `results/diag.txt`

Only patterns that held in **both** the training years and Y3, and on both coins, were turned into rules.

| Observation | Training | Y3 | Rule |
|---|---|---|---|
| No follow-through: best move in the 4 candles after the fill < +0.25R | −47.5R (103 trades) | −27.7R | **FT**: at the close of fill+4, if it never reached +0.25R, move the stop to −0.5R |
| ≥ +1R within 4 candles | +51.8R | +15.0R | (these are the winners) |
| CHoCH at 09:30–10:30 ET (NY open hour) | −17.3R | −1.0R | **K1**: skip these CHoCHs; keep 08:30–09:30 and 10:30–11:30 |
| Fill 9+ candles after the FVG | −6.2R | −2.4R | **F8**: cancel unfilled orders after 8 candles (2h) |
| Stop 4–6 × ATR | −9.2R | −9.7R | **X4**: skip setups with stop > 4 ATR |
| Only 23–25% of fills reach +3R; 56% reach +1R | | | partial-profit tested → rejected (lower R everywhere) |

Not used (inconsistent between years or coins, or too few trades): weekday, long vs short, CHoCH body/close
location, FVG size buckets, impulse size, volatility regime, overnight/London liquidity sweep, Fib, S/D, PDH/PDL.

### Round 6 (each rule alone on v3 / v4 / v5b) — `results/round6.txt`
K1, FT (tighten version) and X4 improved all three bases with 6/6 coin-years positive. F8 helped v5b but made ETH Y3
negative on v3/v4. Hard exits on no follow-through, stricter thresholds (+0.5R) and partial profits were worse.

### Round 7 (combinations + neighbours) — `results/round7.txt`
K1 + FT + X4 together, and **every** nearby setting tested (skip window ±15 min, tighten −0.3/−0.7R, check at 3 or 6
candles, stop cap 3.5/5 ATR, target 2.5/3.5R): all 6/6 coin-years positive, training PF 1.8–2.9 → a plateau, not a
single lucky value. Adding F8 on top was now positive everywhere and best on both bases.

**New versions:**
- **v6** = v4 + K1 + FT + X4 + F8
- **v7** = v5b + K1 + FT + X4 + F8

## Per coin, per year

| Version | Coin | Y1 (Oct23–Oct24) | Y2 (Oct24–Oct25) | Y3 (Oct25–Oct26) | Years positive |
|---|---|---|---|---|---|
| **v3** | SOL | +14.8R · PF 1.37 · n=85 | +5.2R · PF 1.09 · n=84 | +12.0R · PF 1.28 · n=73 | 3/3 |
|  | ETH | +9.3R · PF 1.24 · n=68 | +11.6R · PF 1.29 · n=79 | +0.8R · PF 1.00 · n=68 | 3/3 |
| **v4** | SOL | +11.0R · PF 1.29 · n=78 | +12.9R · PF 1.31 · n=76 | +14.5R · PF 1.37 · n=71 | 3/3 |
|  | ETH | +11.4R · PF 1.33 · n=66 | +16.1R · PF 1.47 · n=74 | +0.9R · PF 1.00 · n=67 | 3/3 |
| **v5b** | SOL | +10.2R · PF 1.42 · n=52 | +8.1R · PF 1.27 · n=57 | +11.9R · PF 1.36 · n=57 | 3/3 |
|  | ETH | +3.9R · PF 1.13 · n=50 | +30.9R · PF 2.70 · n=53 | +6.0R · PF 1.18 · n=53 | 3/3 |
| **v6** | SOL | +11.9R · PF 1.94 · n=39 | +19.3R · PF 2.12 · n=42 | +13.7R · PF 1.97 · n=32 | 3/3 |
|  | ETH | +17.5R · PF 2.51 · n=32 | +15.2R · PF 2.31 · n=33 | +13.2R · PF 1.81 · n=35 | 3/3 |
| **v7** | SOL | +11.8R · PF 2.84 · n=25 | +13.2R · PF 2.21 · n=30 | +11.7R · PF 2.21 · n=24 | 3/3 |
|  | ETH | +13.6R · PF 2.86 · n=22 | +19.7R · PF 3.91 · n=24 | +17.6R · PF 2.50 · n=29 | 3/3 |

## Summary (SOL+ETH pooled, 3 years)

| Version | Trades (3 yr) | Per month | PF | Total R | Avg R/trade | 90% CI avg R | Max DD (R) | Max DD (1% risk) | Longest losing run | TP / SL / BE |
|---|---|---|---|---|---|---|---|---|---|---|
| v3 | 457 | 12.7 | 1.23 | +53.6 | +0.12 | 0.00 … 0.24 | 19.5 | 18.5% | 26 | 96 / 202 / 159 |
| v4 | 432 | 12.0 | 1.31 | +66.7 | +0.15 | 0.03 … 0.28 | 14.9 | 14.1% | 21 | 94 / 185 / 153 |
| v5b | 322 | 8.9 | 1.46 | +71.1 | +0.22 | 0.08 … 0.37 | 10.2 | 9.8% | 17 | 76 / 135 / 111 |
| v6 | 213 | 5.9 | 2.12 | +90.8 | +0.43 | 0.25 … 0.60 | 9.5 | 9.2% | 11 | 58 / 80 / 75 |
| v7 | 154 | 4.3 | 2.69 | +87.6 | +0.57 | 0.35 … 0.78 | 5.7 | 5.6% | 8 | 47 / 52 / 55 |

## Stress tests

| Stress (SOL+ETH pooled) | v4 3yr | v4 Y3 | v5b 3yr | v5b Y3 | **v6 3yr** | **v6 Y3** | **v7 3yr** | **v7 Y3** |
|---|---|---|---|---|---|---|---|---|
| As tested | PF 1.31 · +66.7R | PF 1.21 · +15.4R | PF 1.46 · +71.1R | PF 1.30 · +17.9R | PF 2.12 · +90.8R | PF 1.91 · +26.8R | PF 2.69 · +87.6R | PF 2.40 · +29.3R |
| Fees + slippage ×2 | PF 1.15 · +36.6R | PF 1.04 · +3.7R | PF 1.28 · +49.2R | PF 1.13 · +8.7R | PF 1.80 · +75.2R | PF 1.58 · +20.4R | PF 2.29 · +77.5R | PF 2.01 · +24.9R |
| Fees + slippage ×3 | PF 1.02 · +6.5R | PF 0.92 · -7.9R | PF 1.14 · +27.4R | PF 0.99 · -0.4R | PF 1.55 · +59.6R | PF 1.35 · +14.0R | PF 1.99 · +67.4R | PF 1.72 · +20.4R |
| Fill only if price trades 0.02% through | PF 1.23 · +49.2R | PF 1.09 · +6.5R | PF 1.37 · +56.6R | PF 1.15 · +9.0R | PF 2.04 · +83.1R | PF 1.77 · +22.0R | PF 2.59 · +81.8R | PF 2.12 · +23.4R |
| Fill only if price trades 0.05% through | PF 1.17 · +35.0R | PF 1.13 · +8.6R | PF 1.33 · +48.1R | PF 1.26 · +14.0R | PF 2.03 · +75.2R | PF 2.32 · +30.3R | PF 2.80 · +80.1R | PF 3.03 · +31.7R |
| Costs ×2 + 0.02% through | PF 1.08 · +19.6R | PF 0.94 · -4.9R | PF 1.20 · +35.3R | PF 1.00 · +0.0R | PF 1.73 · +67.8R | PF 1.46 · +15.7R | PF 2.20 · +72.0R | PF 1.78 · +19.1R |
| Costs ×2 + 0.05% through | PF 1.03 · +7.0R | PF 0.98 · -1.8R | PF 1.17 · +28.1R | PF 1.10 · +5.9R | PF 1.72 · +61.3R | PF 1.91 · +25.0R | PF 2.39 · +71.4R | PF 2.53 · +28.2R |
### Rules of v7 (v6 = the same without the FVG-size rule)

1. Session from 08:30 ET. A CHoCH (close-break, swing length 5) must close **08:30–09:30 or 10:30–11:30 ET**.
2. CHoCH candle high–low ≥ ATR(14). **v7 only:** FVG height ≥ 0.2 × ATR.
3. First same-direction FVG within 10 candles of the CHoCH. Limit order at its midpoint.
4. Stop 0.02% beyond the leg extreme. **Skip the setup if the stop is wider than 4 × ATR.**
5. Cancel the order if it isn't filled within **8 candles**, on an opposite structure break, if price hits the
   target first, or at 16:00 ET.
6. Target = entry ± 3R. Stop to breakeven at +1R.
7. **Follow-through check:** at the close of the 4th candle after the fill, if price never got to +0.25R, move the
   stop to −0.5R.
8. 1% risk, one position at a time.

### Caveats (read before trusting the numbers)
- **Y3 is no longer a clean holdout.** The diagnostics looked at Y3 when choosing which patterns to keep (only ones
  consistent in training *and* Y3 were kept), and Y3 was visible in every round-6/7 table. The jump from v4/v5b to
  v6/v7 is therefore partly in-sample on all three years.
- **Small samples.** v7 has 154 trades in 3 years (~22–30 per coin-year); v6 has 213.
- **Many trials.** ~200 configurations have now been tested on the same two coins.
- The remaining honest checks are coins not used here (BTC/DOGE/ZEC were flat-to-negative for v3–v5b) and
  forward/paper trading.

---

## Unseen coins for v4 / v5b / v6 / v7 (BTC, DOGE, ZEC, XRP; rules frozen) — `node matrix3.js`

XRP 15m was downloaded for this check (`research/sol-ny-smc/data/xrp15-all.json`, Bybit XRPUSDT perp, 105,216 bars, no gaps).

## Unseen coins, per coin per year

| Version | Coin | Y1 (Oct23–Oct24) | Y2 (Oct24–Oct25) | Y3 (Oct25–Oct26) | Years positive |
|---|---|---|---|---|---|
| **v4** | BTC | -15.9R · PF 0.61 · n=64 | -9.7R · PF 0.80 · n=91 | +17.4R · PF 1.34 · n=80 | 1/3 |
|  | DOGE | +4.1R · PF 1.11 · n=59 | -12.0R · PF 0.74 · n=81 | +15.1R · PF 1.33 · n=73 | 2/3 |
|  | ZEC | +10.2R · PF 1.50 · n=50 | +16.1R · PF 1.53 · n=57 | +12.7R · PF 1.39 · n=56 | 3/3 |
|  | XRP | -10.4R · PF 0.75 · n=71 | +10.6R · PF 1.44 · n=60 | -7.9R · PF 0.76 · n=63 | 1/3 |
| **v5b** | BTC | -5.1R · PF 0.83 · n=51 | -12.5R · PF 0.67 · n=65 | +14.6R · PF 1.36 · n=65 | 1/3 |
|  | DOGE | +1.8R · PF 1.05 · n=44 | -4.5R · PF 0.85 · n=60 | +11.5R · PF 1.36 · n=55 | 2/3 |
|  | ZEC | +0.8R · PF 1.03 · n=39 | +14.1R · PF 1.74 · n=42 | +12.1R · PF 1.45 · n=47 | 3/3 |
|  | XRP | -12.7R · PF 0.67 · n=62 | +12.5R · PF 1.69 · n=49 | +0.6R · PF 1.00 · n=55 | 2/3 |
| **v6** | BTC | -1.9R · PF 0.87 · n=31 | -9.5R · PF 0.60 · n=39 | +4.5R · PF 1.21 · n=33 | 1/3 |
|  | DOGE | +5.3R · PF 1.31 · n=31 | -4.3R · PF 0.79 · n=43 | +3.5R · PF 1.15 · n=36 | 2/3 |
|  | ZEC | +8.1R · PF 2.15 · n=21 | -7.2R · PF 0.43 · n=23 | +21.1R · PF 3.52 · n=25 | 2/3 |
|  | XRP | -13.9R · PF 0.30 · n=33 | -9.0R · PF 0.39 · n=24 | -3.2R · PF 0.77 · n=26 | 0/3 |
| **v7** | BTC | +4.4R · PF 1.31 · n=26 | -3.8R · PF 0.74 · n=28 | +11.2R · PF 1.85 · n=26 | 2/3 |
|  | DOGE | +3.2R · PF 1.26 · n=22 | -0.4R · PF 0.95 · n=25 | +7.9R · PF 1.59 · n=27 | 2/3 |
|  | ZEC | +4.6R · PF 2.00 · n=13 | -2.3R · PF 0.70 · n=17 | +20.3R · PF 4.25 · n=20 | 2/3 |
|  | XRP | -10.7R · PF 0.36 · n=27 | -5.9R · PF 0.48 · n=20 | -1.1R · PF 0.90 · n=23 | 0/3 |

## Pooled BTC + DOGE + ZEC + XRP

| Version | Trades | PF | Total R | Avg R | Max DD (R) | Y1 | Y2 | Y3 | Coin-years positive |
|---|---|---|---|---|---|---|---|---|---|
| v4 | 805 | 1.07 | +30.5 | +0.04 | 30.6 | -12.0R | +5.1R | +37.4R | 7/12 |
| v5b | 634 | 1.10 | +33.1 | +0.05 | 25.8 | -15.3R | +9.6R | +38.7R | 8/12 |
| v6 | 365 | 0.97 | -6.4 | -0.02 | 46.1 | -2.3R | -30.1R | +26.0R | 5/12 |
| v7 | 274 | 1.20 | +27.5 | +0.10 | 35.4 | +1.6R | -12.4R | +38.3R | 6/12 |
**Reading it:** the round 6–7 refinements did **not** carry over. v6 loses on these coins (PF 0.97), v7 is PF 1.20 but only 6/12 coin-years positive (XRP 0/3), no better than v5b (8/12). Most of v6/v7's improvement on SOL/ETH is therefore likely fitted to SOL/ETH. Treat v7 as a SOL/ETH-specific candidate and forward-test it before use.

---

## v7 added to the app (Strategy mode)

- **File:** `strategies/ny-smc-v7-strategy.js`, registered as **★ NY SMC v7 · CHoCH → FVG** (`special: true` →
  shown in green in the strategy picker). It detects swings / CHoCH / FVG exactly like `js/smc.js`, and switches on
  the SMC Toolkit's 15m layers while it runs.
- **Engine additions** (`js/strategy.js`, `js/trade-sim.js`): `limitPrice` orders that rest until price trades
  through them (no slippage), a `'cancel'` signal, and `account.limitOrder`. On a mid-candle limit fill only the stop
  is checked on that candle. Existing strategies give identical trades before and after (checked on SOL 15m).
- **Check against the research engine** (`node validate-app.js`, zero costs):
  - SOL: 79 / 79 trades identical (same entry and exit candles, +40.9R both).
  - ETH: all 75 research trades identical. The app takes 2 extra trades, both losers. On those candles an opposite
    structure break closed on the same candle that touched the limit price. The research engine had cancelled the
    order using that candle's close; the app fills first, which is what would happen live.
- **App defaults to use:** 15m chart, Fill at = Next bar open, session filter off. The strategy sizes itself to
  `riskPct` (1%). App commission is one rate on both sides; with 0.04% commission + 0.02% slippage the app shows
  SOL +41.3% (PF 2.29) and ETH +57.5% (PF 2.58) over the 3 years.

---

## v7 validation rules (pre-registered 2026-10-19, before any validation run — do not edit this section)

Context: v7 was tuned on SOL and ETH for Oct23–Oct26, so all of that data is in-sample. We are only trading SOL and
ETH. Three checks decide whether v7 has a real edge or is fit to those years. v7's entry and exit logic is not changed
anywhere in this task.

### GROUND RULES
- v7 stays frozen. No parameter changes, no new filters. Any bug fix to the harness must be logged separately and the results re-run.
- Use the exact same fee and slippage settings as the v7 headline result unless a check says otherwise.
- Handle the session window in America/New_York time, including DST, for all years. Verify this on a few known dates before trusting pre-2023 results.
- Log every run in ITERATION-LOG.md, including failures. Never delete or rewrite earlier entries.
- Always show trade count next to R. Cells under 15 trades are "insufficient sample".
- Stop after each check and give me a short summary before starting the next.

### CHECK A: Pre-2023 history (never used for tuning)
- Run v7 unchanged on SOL and ETH perps for every year before Oct 2023 that has clean data: Oct22-Oct23 (A1), Oct21-Oct22 (A2), Oct20-Oct21 (A3, if available). Use the earliest start date that has complete 5m (or whatever timeframe v7 uses) candles, and tell me where each coin's history actually begins.
- Data quality checks first: no gaps larger than 1 candle, no duplicate timestamps, consistent volume. List any gaps found and how you handled them.
- PASS per coin if ALL hold, pooled across the pre-2023 years: net profit > 0 after costs, profit factor >= 1.2, and at least 40 trades pooled. Also no single year worse than -$60 (that is 6R at $10 risk).
- Under 40 trades pooled for a coin = INCONCLUSIVE for that coin, not a pass.
- Report per coin-year: trades, hit/stop/tightened/breakeven counts, profit in $ and R, profit factor, max drawdown. Save to results/validation_A.md.

### CHECK B: Random-entry control
- Keep v7's exits, session window, risk sizing, fees and slippage. Replace only the entry trigger: for each coin, generate random entries within the same 08:30-11:30 window, random direction, with the same number of trades per year as v7 actually took.
- Place the stop for random entries by sampling from v7's actual distribution of stop distances (in ATR) for that coin, so the risk geometry matches. Read the code and document exactly how you did this.
- Run 1,000 random seeds per coin on Oct23-Oct26 and also on the Check A years.
- Report the distribution of total profit per coin (mean, median, 5th and 95th percentile) and where the actual v7 result falls as a percentile.
- PASS per coin if: v7's actual total is above the 95th percentile of the random distribution, AND the random mean is no higher than +$30 per year per coin. A random mean clearly above zero means the backtest has a structural bias (likely intrabar ordering or the exit design), regardless of v7's percentile. Flag that as BIAS DETECTED.
- Save to results/validation_B.md with a histogram if easy.

### CHECK C: Intrabar audit
- Add an execution-mode flag to the simulator with three modes:
  1. current: the existing behavior (baseline)
  2. pessimistic: whenever a single candle touches both an adverse level (stop, entry-after-breakeven, tightened stop) and a favorable level (target, breakeven trigger, tighten trigger), assume the adverse one was hit first. Breakeven and tightened stops also get one extra tick of slippage.
  3. 1m replay: re-simulate the same trades using 1-minute candles for exit ordering (entries stay as v7 decided them). If a 1m candle still contains both, fall back to the pessimistic rule.
- First count and report how many v7 trades have any ambiguous candle, per coin-year. This number is the exposure.
- Run all three modes on SOL and ETH for Oct23-Oct26 and the Check A years.
- PASS per coin if: pessimistic mode keeps >= 60% of baseline profit and every coin-year in Oct23-Oct26 stays >= 0, AND 1m replay is within 20% of baseline profit.
- Save to results/validation_C.md.

### DECISION TABLE
- A pass + B pass + C pass: v7 is a candidate for forward paper trading at 0.25-0.5% risk. Still not proven.
- B fails (BIAS DETECTED): stop. The simulator or exit design is producing profit without a signal. Fix the harness and re-run v3-v7 before trusting any of the earlier results.
- C fails but B passes: the signal may be real but the exit logic is over-credited. Switch to pessimistic mode as the default and redo any headline numbers.
- A fails or is inconclusive on both coins: the edge may depend on the 2023-26 regime. Do not scale up. Say so plainly.
- Mixed results per coin: treat each coin separately. A coin that fails any check is not traded.

### FINAL DELIVERABLE
After Check C, append a summary to ITERATION-LOG.md with:
1. A PASS / FAIL / INCONCLUSIVE table: rows = SOL, ETH; columns = Check A, B, C.
2. The headline v7 numbers re-stated under pessimistic mode.
3. The ambiguous-candle exposure per coin-year.
4. The decision from the decision table.
5. A list of what remains unvalidated (forward paper trading, live slippage on breakeven stops, funding costs if not modeled).

## v7 freeze fingerprint (recorded with the rules above; not part of them)

- Engine `ie.js` sha256 `6539c98f897b072aa6577088d84bc0cdd092983a5f586bb72e6578ad3a0a9807`; toolkit `js/smc.js` sha256
  `1c5b3cd43a13a477e6ebf3765f780cc022a673806462cba464d4bff9bbc554fe`.
- v7 config (on top of `ie.js` BASE): `{ sessOffsetH: -1, chochWindowH: 3, sessionHours: 7.5, tpMode: 'R', tpR: 3,
  minDispATR: 1, minFvgATR: 0.2, chochSkip: [1, 2], ftBars: 4, ftMinR: 0.25, ftMode: 'tighten', ftTightR: 0.5,
  maxStopATR: 4, maxFillBars: 8 }`, swing length 5, FVG window 10 candles.
- Costs (headline): maker 0.02% on entry and target, taker 0.055% + 0.02% slippage on stop / breakeven / tightened
  exits, costMult 1, funding not modelled. Leverage cap 10×.
- Headline (Oct23–Oct26, 15m): SOL 79 trades +36.71R (+$367); ETH 75 trades +50.85R (+$509) at $10 per R.
- In-sample data sha256: sol15-oos `bf0ad8d4…6f162d`, sol15 `558ed3bc…230d67`, eth15-all `177e2876…bef9f2`.
- Interpretation notes: v7 runs on **15m** candles, so "5m (or whatever timeframe v7 uses)" means 15m. "$" means
  R × $10 (fixed $10 risk, no compounding).

---

## Validation run log

### 2026-10-19 · Check A run 1 (pre-Oct-2023 history) — result: SOL FAIL, ETH FAIL

**Harness and data (no v7 change; `ie.js` sha256 still `6539c98f…0a9807`)**
- New scripts: `fetchq.js` (Bybit v5 linear klines; keeps every raw row so duplicates can be counted), `dataq.js`
  (data-quality audit), `checkA.js` (the run). Candles in `research/ny-smc-iterations/data/` (git-ignored).
- Where history begins on Bybit's API (15m): **SOLUSDT perp 2021-10-15**, **ETHUSDT perp 2021-03-15**. So A1 and A2
  are complete for both coins. A3 (Oct20–Oct21) does not exist for SOL. For ETH it only covers 2021-03-15 → 2021-10-18.
- **Decided before seeing results:** ETH's partial A3 is run and shown for information only and is excluded from the
  pooled verdict, because the rule asks for years with complete data.
- Data quality, both coins:
  - 0 gaps, 0 duplicate timestamps (raw = unique rows), 0 out-of-order timestamps, 0 broken OHLC.
  - The pre-2023 files join contiguously onto the in-sample files (last close = first open).
  - Zero-volume candles: SOL 1, ETH 2, all flat (O=H=L=C) during a Bybit maintenance window on 2022-04-06
    08:30–09:00 UTC (04:30 ET). **Left as is:** outside v7's window, price unchanged, and a flat candle cannot become
    a swing pivot (the pivot test is strict).
  - Volume grows steadily over time (SOL monthly median 3.4k → 212k SOL from Dec 2021 to Jan 2023). No month is more
    than 4× off its neighbours.
- Session / DST: on **every** day of both series (SOL 1,831, ETH 2,045), the session start is 08:30 ET, the NY line
  09:30 ET and order expiry 16:00 ET. Spot dates on both sides of each DST change, 2021–2023, show the NY line moving
  13:30 ↔ 14:30 UTC correctly. All 279 v7 trades have their CHoCH inside 08:30–09:30 / 10:30–11:30 ET.
- Method: each coin runs as one continuous series (pre-2023 + in-sample) and trades are assigned by fill time. The
  in-sample part reproduces the frozen headline exactly (SOL 79 trades / +36.71R, ETH 75 / +50.85R).

**Results ($10 per R, headline costs)** — full table in `results/validation_A.md`

| Coin | Period | Trades | hit / stop / tight / BE | Profit | PF | Max DD |
|---|---|---|---|---|---|---|
| SOL | A2 Oct21–Oct22 | 20 | 2 / 5 / 8 / 5 | −$40 (−4.0R) | 0.60 | −$77 |
| SOL | A1 Oct22–Oct23 | 30 | 2 / 13 / 3 / 12 | −$105 (−10.5R) | 0.36 | −$105 |
| **SOL** | **pooled** | **50** | | **−$145 (−14.5R)** | **0.45** | −$145 |
| ETH | A3p Mar21–Oct21 (info only) | 9 — insufficient sample | 3 / 3 / 1 / 2 | +$51 (+5.1R) | 2.30 | −$17 |
| ETH | A2 Oct21–Oct22 | 32 | 7 / 10 / 7 / 8 | +$50 (+5.0R) | 1.32 | −$60 |
| ETH | A1 Oct22–Oct23 | 34 | 5 / 12 / 3 / 14 | −$29 (−2.9R) | 0.84 | −$49 |
| **ETH** | **pooled** | **66** | | **+$21 (+2.1R)** | **1.06** | −$60 |
| ref | SOL in-sample Oct23–Oct26 | 79 | 21 / 18 / 8 / 32 | +$367 (+36.7R) | 2.43 | −$43 |
| ref | ETH in-sample Oct23–Oct26 | 75 | 26 / 17 / 9 / 23 | +$509 (+50.9R) | 2.95 | −$69 |

**Verdict against the pre-registered criteria**
- **SOL: FAIL.** Net −$145, PF 0.45, and A1 −$105 is worse than the −$60 limit (50 trades, so not inconclusive).
- **ETH: FAIL.** Net +$21 and no year below −$60, but PF 1.06 < 1.2 (66 trades).
- Under the decision table ("A fails … on both coins"), the edge may depend on the 2023–26 regime. **Do not scale up.**
  Checks B and C are still to run, as specified; they can explain *why*, but cannot turn A into a pass.
- Biggest difference from in-sample: the 3R target hit rate. SOL hit 2 of 20 and 2 of 30 trades pre-2023, against 21
  of 79 in-sample. ETH hit 7 of 32 and 5 of 34, against 26 of 75.

### 2026-10-19 · MEXC data + monthly comparison of target 1:3 vs 1:2 (v7 otherwise frozen; `ie.js` unchanged)

Not one of the pre-registered checks A–C: it is an in-sample comparison on the 2023–26 data that v7 was tuned on, so
it says nothing about whether the edge is real (Check A, pre-2023, failed for both coins — see above). Check B and C
have not been run yet.

- **MEXC data (`fetchMexc.js`, the endpoint the app's `js/mexc.js` uses):** 15m candles exist only from
  **2025-10-23**. Earlier 15m requests return empty. 1m and 5m are also empty for 2024–25; 30m and 1h go back years but
  15m cannot be rebuilt from them. So MEXC covers only the last year (34,479 candles each for SOL_USDT and ETH_USDT;
  0 gaps, 0 broken candles, 2 flat zero-volume candles each). Against the Bybit candles for the same 15-minute slots,
  closes differ by 0.013% (SOL) / 0.008% (ETH) on average and candle ranges by about 5%.
- **Results, same $10/R and costs, target 1:3 vs 1:2** (`node monthly-rr.js mexc|bybit`, tables in
  `results/monthly-rr-mexc.md` and `results/monthly-rr-bybit.md`):

| Data | Target | Trades | Target hits | Profit SOL / ETH / both | PF (both) | Avg per month (both) | Profitable months (both) | Max DD (both) |
|---|---|---|---|---|---|---|---|---|
| MEXC, 23 Oct 25 – 17 Oct 26 | 1:3 | 54 | 31% | +$147 / +$143 / **+$290** | 2.37 | +$22 | 8 of 13 | −$61 |
| MEXC, 23 Oct 25 – 17 Oct 26 | 1:2 | 51 | 37% | +$118 / +$55 / **+$174** | 1.88 | +$13 | 8 of 13 | −$61 |
| Bybit, 18 Oct 23 – 17 Oct 26 | 1:3 | 154 | 31% | +$367 / +$509 / **+$876** | 2.69 | +$24 | 26 of 37 | −$57 |
| Bybit, 18 Oct 23 – 17 Oct 26 | 1:2 | 150 | 37% | +$270 / +$312 / **+$582** | 2.17 | +$16 | 26 of 37 | −$44 |

- 1:3 (Bybit) reproduces the frozen headline exactly (SOL +$367, ETH +$509).
- The MEXC year earns +$290 vs +$293 on Bybit for the same year at 1:3 — the data source makes little difference.
- 1:2 hits the target more often (37% vs 31%) but earns about a third less. The same ranking appeared in the tuning
  rounds (round 4: 2R was worse than 3R).

### 2026-10-19 · Breakeven trigger +1R vs +0.5R (target 1:3; v7 otherwise frozen) — in-sample, not a validation check

Only `beR` changed (1 → 0.5); the follow-through tightening (stop to −0.5R if +0.25R is not reached within 4 candles of
the fill) is a separate rule and was left as is. `node monthly-be.js mexc|bybit`; tables in `results/monthly-be-*.md`.

| Data | Breakeven | Trades | Target hits | Profit SOL / ETH / both | PF (both) | Avg / month | Profitable months | Max DD |
|---|---|---|---|---|---|---|---|---|
| MEXC, 23 Oct 25 – 17 Oct 26 | +1R | 54 | 31% | +$147 / +$143 / **+$290** | 2.37 | +$22 | 8 of 13 | −$61 |
| MEXC, 23 Oct 25 – 17 Oct 26 | +0.5R | 55 | 25% | +$146 / +$92 / **+$238** | 2.35 | +$18 | 7 of 13 | −$51 |
| Bybit, 18 Oct 23 – 17 Oct 26 | +1R | 154 | 31% | +$367 / +$509 / **+$876** | 2.69 | +$24 | 26 of 37 | −$57 |
| Bybit, 18 Oct 23 – 17 Oct 26 | +0.5R | 156 | 23% | +$264 / +$401 / **+$665** | 2.66 | +$18 | 24 of 37 | −$48 |

- Per coin-year profit (SOL / ETH, Bybit data), +1R → +0.5R: Y1 118/136 → 80/115, Y2 132/197 → 56/162, Y3 117/176 → 127/124.
  Only SOL Y3 improved; the other five coin-years got worse.
- Why: 11 trades that hit the 3R target at +1R breakeven were stopped at breakeven instead (−$337), while 15 trades
  that would have been full stops became breakeven (+$131). Net −$206 from those 26 trades; the rest of the −$211
  total difference comes from knock-on effects on the sequence of trades (one position at a time).
- Result: the earlier breakeven cuts max drawdown only slightly (−$57 → −$48 over 3 years) for about 24% less profit.
  Matches the tuning round 1 observation that BE at 0.5R helps only when targets are close. +1R stays.

### 2026-10-19 · Breakeven trigger / profit-lock sweep (target 1:3, v7 otherwise frozen) — in-sample, not a validation check

`node be-sweep.js` → `results/be-sweep.md`. $10 per R, fees + slippage included. 'lock +X' = on the trigger the stop moves to entry +X·R instead of entry. Profit ÷ DD = 3-year profit / max drawdown (both coins). 'Coin-years ≥ v7' counts how many of the 6 SOL/ETH years (Bybit data) are at least as good as v7's +1R breakeven.

| Breakeven | 3-yr profit (both) | PF | Max DD | Profit ÷ DD | Worst month | Coin-years ≥ v7 | SOL Y1/Y2/Y3 | ETH Y1/Y2/Y3 | MEXC yr profit | MEXC DD | Exits TP / BE / SL |
|---|---|---|---|---|---|---|---|---|---|---|---|
| no BE | +767 | 1.86 | −$78 | 9.9 | −54 | 2/6 | 165/149/53 | 111/163/126 | +203 | −$91 | 56 / 0 / 93 |
| 0.5R | +665 | 2.66 | −$48 | 13.9 | −34 | 1/6 | 80/56/127 | 115/162/124 | +238 | −$51 | 36 / 82 / 38 |
| 0.75R | +703 | 2.46 | −$57 | 12.4 | −44 | 1/6 | 103/91/127 | 105/137/140 | +253 | −$56 | 40 / 67 / 48 |
| 1.0R (v7) | +876 | 2.69 | −$57 | 15.4 | −44 | 6/6 | 118/132/117 | 136/197/176 | +290 | −$61 | 47 / 55 / 52 |
| 1.25R | +732 | 2.16 | −$67 | 11.0 | −44 | 0/6 | 83/123/68 | 116/177/166 | +221 | −$81 | 46 / 43 / 64 |
| 1.5R | +744 | 2.00 | −$74 | 10.1 | −51 | 2/6 | 134/143/48 | 106/162/151 | +192 | −$81 | 50 / 25 / 76 |
| 2.0R | +801 | 2.00 | −$74 | 10.8 | −51 | 2/6 | 144/169/38 | 126/173/151 | +203 | −$91 | 54 / 13 / 83 |
| 2.5R | +781 | 1.92 | −$74 | 10.6 | −54 | 2/6 | 165/149/28 | 126/173/141 | +183 | −$91 | 55 / 7 / 88 |
| 0.75R lock +0.1R | +680 | 2.53 | −$53 | 12.9 | −43 | 0/6 | 89/106/107 | 113/147/119 | +215 | −$55 | 37 / 70 / 48 |
| 1.0R lock +0.1R | +870 | 2.79 | −$53 | 16.5 | −43 | 4/6 | 101/143/125 | 143/205/154 | +276 | −$58 | 45 / 57 / 52 |
| 1.0R lock +0.2R | +898 | 2.86 | −$49 | 18.4 | −42 | 3/6 | 114/154/133 | 150/185/163 | +293 | −$55 | 44 / 59 / 52 |
| 1.0R lock +0.3R | +816 | 2.69 | −$45 | 18.2 | −41 | 2/6 | 127/110/141 | 102/166/171 | +282 | −$55 | 39 / 64 / 52 |
| 1.5R lock +0.3R | +653 | 1.90 | −$74 | 8.8 | −51 | 1/6 | 149/104/60 | 62/119/160 | +216 | −$78 | 44 / 31 / 76 |
| 1.5R lock +0.5R | +536 | 1.74 | −$89 | 6.0 | −51 | 1/6 | 159/92/17 | 48/80/140 | +181 | −$76 | 37 / 38 / 76 |
| 2.0R lock +0.5R | +661 | 1.83 | −$96 | 6.9 | −51 | 1/6 | 154/128/2 | 110/127/140 | +177 | −$98 | 46 / 21 / 83 |
| 2.0R lock +1.0R | +600 | 1.76 | −$88 | 6.8 | −51 | 0/6 | 103/87/27 | 104/121/157 | +212 | −$93 | 38 / 29 / 83 |

**Reading it:** +1R is a sharp local peak (+0.75R and +1.25R are both 15–20% worse); every later trigger lets too many winners turn into full stops (profit factor falls from 2.7 to ~2.0). A small lock on top of +1R is the only change that trades profit for lower drawdown without losing profit: +0.2R lock → +$898 vs +$876, max DD −$49 vs −$57, but only 3 of 6 coin-years beat plain +1R, so the gain is within noise. Recommendation: keep the +1R trigger; a +0.2R lock is optional and unproven.

### 2026-10-19 · Check B design notes (written BEFORE any Check B run; the pre-registered rules above are unchanged)

v7 frozen as at the Step 0 fingerprint (target 1:3, breakeven +1R, no lock; `ie.js` sha256 `6539c98f…`). The rules left
these points open; I fix them here so the verdict cannot be shaped by the results.
1. **What a "random entry" is.** v7 places a limit order after a CHoCH + FVG: price pulls back to the FVG midpoint.
   To keep the entry mechanics identical, a random setup is a random *signal candle* + random direction, with a limit
   order, a stop and a 3R target built from a **randomly drawn (limit offset, stop distance) pair taken from one of
   that coin's actual v7 trades**, both measured in ATR(14) at the signal candle: offset = distance from the signal
   candle's close to the limit price, stop = distance from the limit price to the stop. Drawing the pair together keeps
   their correlation. (The rule only names the stop distance; the offset is added so the limit-fill behaviour matches.)
   Everything after placement is the unchanged v7 engine (`execute()` in `ie.js`): fill when price touches the limit
   (8-candle expiry, cancelled on an opposite structure break, target-first or 16:00 ET), +1R breakeven, follow-through
   tightening, one position at a time, same fees and slippage. The only things that differ are *when* and *which way*.
2. **Window.** Primary control: signal candles drawn uniformly from the windows v7 actually trades in, i.e. 08:30–09:30
   and 10:30–11:30 ET (v7 skips the 09:30–10:30 open hour). Sensitivity run: the literal 08:30–11:30 ET window. The
   verdict uses the primary control; both are reported.
3. **Trade counts.** For each year, a pool of 8× v7's trade count of random signals is drawn, run chronologically through
   the engine (some do not fill or overlap an open trade), and v7's exact yearly trade count is then drawn at random from
   the executed ones. If fewer executed, all are used and the shortfall is reported.
4. **Geometry source.** For Oct23–Oct26 the pairs come from that coin's v7 trades in that period; for the Check A
   years from that coin's v7 trades in A1+A2.
5. **Verdict per coin.** PASS needs v7's actual Oct23–Oct26 total above the 95th percentile of the 1,000 random totals
   AND random mean ≤ +$30 per year (≤ +$90 over the 3 years). BIAS DETECTED if the random mean exceeds +$30 per year in
   *any* tested period. The Check A years are also run; there v7's actual total is shown against the random distribution
   as an out-of-sample information line, but Check A itself already decided that question and B does not re-decide it.
6. Seeds 1…1000 (mulberry32), $10 per R, same data files as Check A (continuous Bybit series, pre-2023 + in-sample).

### 2026-10-19 · Check B run 1 (random-entry control, 1,000 seeds per coin per period) — result: SOL PASS, ETH PASS, no structural bias

`node checkB.js 1000` (13 s); full tables, per-year ranges and histograms in `results/validation_B.md`. Design as logged
before the run; v7 frozen (`ie.js` hash check passes inside the script). No seed fell short of v7's trade count.

Primary control (random signal candles in v7's own windows), $ at $10 per R:

| Coin | Period | v7 trades | **v7 actual** | Random mean | 5th – 95th pct | 99th pct | v7 percentile | Random mean / year |
|---|---|---|---|---|---|---|---|---|
| SOL | Oct23–Oct26 | 79 | **+$367** | −$25 | −$222 … +$179 | +$271 | **99.9%** | −$8 |
| ETH | Oct23–Oct26 | 75 | **+$509** | −$30 | −$228 … +$175 | +$308 | **100.0%** | −$10 |
| SOL | Oct21–Oct23 (A2+A1) | 50 | −$145 | −$9 | −$168 … +$158 | +$234 | 8.5% | −$4 |
| ETH | Oct21–Oct23 (A2+A1) | 66 | +$21 | −$55 | −$229 … +$144 | +$222 | 76.2% | −$28 |

Sensitivity (literal 08:30–11:30 ET window): same picture (v7 at the 99.8th / 100th percentile in-sample; random means
−$3 to −$29 per year).

- **Pass criteria:** v7 is above the 95th percentile in-sample for both coins (SOL +$367 vs +$179, ETH +$509 vs +$175),
  and the random mean is at or below zero everywhere (worst −$3 per year, limit +$30), so **no BIAS DETECTED**. The
  engine's exits (breakeven, tightening, 3R target) do not manufacture profit from random entries; random entries pay
  slightly negative after costs, as they should.
- **Year by year:** v7 beats the random 95th percentile in all six in-sample coin-years, but SOL only narrowly (Y1 +$118
  vs +$114, Y3 +$117 vs +$112).
- **Pre-2023 (information only):** v7 is *below* random for SOL (8.5th percentile) and at the 76th percentile for ETH
  — nothing there separates v7's signal from a random entry. This agrees with Check A.
- **What B does not settle:** the percentile is for one pre-specified strategy. v7 was chosen from ~200 configurations
  on this same data, so a fair bar after that selection is higher than the 95th percentile; B shows the in-sample profit
  is not an engine artefact, not that the signal generalises. Random outcomes are very wide (a single random
  3-year run is anywhere from −$220 to +$180), so even +$367 over 79 trades leaves large uncertainty.

### 2026-10-19 · Check C run (intrabar-ordering audit) — result: SOL PASS, ETH PASS

Scripts: `trades-windows.js`, `fetch1m.js` + `extend1m.js` (Bybit 1m candles for the trade windows: SOL 92,980, ETH 99,305; 0 missing
minutes), `execC.js` (execution-mode simulator, a separate file so `ie.js` stays frozen), `checkC.js`. Full tables in
`results/validation_C.md`.
- **Harness check:** `execC` in 'current' mode reproduces `ie.js` trade-for-trade (SOL 129, ETH 150 trades across Oct21–Oct26).
- **Modes.** current = unchanged engine. pessimistic = the same engine plus (a) a candle that reaches the +1R breakeven
  trigger and also comes back to the entry level is stopped at breakeven that candle (current mode arms breakeven at
  the end of the candle and lets the trade continue) and (b) one extra tick (SOL 0.001, ETH 0.01) on breakeven and
  tightened-stop exits. Stop-before-target on one candle was already the rule in current mode. 1m replay = the same trades with
  exits re-simulated on 1m candles; entries unchanged.
- **Interpretation choice (made before reading the numbers):** the rule says to assume "the adverse one was hit first".
  For the breakeven trigger vs the breakeven level, the worst case for the trade is trigger first, then the return to
  entry, so that is what the pessimistic mode assumes.
- **A finding that is not an ambiguity:** the 15m engine ignores price movement inside the fill candle after the limit fills.
  The 1m replay shows that in a few trades price bounced right after the fill, so the follow-through tightening would
  not have triggered. The first pass of the replay dropped these 3 trades because they ran past the downloaded window;
  the window was extended and all 279 trades now complete.

**Exposure — trades with at least one ambiguous 15m candle**

| Coin | A2 | A1 | Y1 | Y2 | Y3 | All |
|---|---|---|---|---|---|---|
| SOL | 0 of 20 | 2 of 30 | 0 of 25 | 3 of 30 | 1 of 24 | **6 of 129 (5%)** |
| ETH | 5 of 32 | 2 of 34 | 1 of 22 | 0 of 24 | 2 of 29 | **10 of 150 (7%)** |

Almost all are "price reached +1R and returned to entry inside one candle" (SOL 5, ETH 8); the rest are stop-and-target
in one candle (SOL 1, ETH 2).

**Profit under the three modes ($10 per R)**

| Coin | Period | Current | Pessimistic | Pess ÷ current | 1m replay |
|---|---|---|---|---|---|
| SOL | Y1 / Y2 / Y3 | +$118 / +$132 / +$117 | +$118 / +$133 / +$87 | 100% / 101% / 74% | +$118 / +$133 / +$117 |
| SOL | Oct23–Oct26 | **+$367** | **+$338** | 92% | +$368 (+0.3%) |
| SOL | Oct21–Oct23 | −$145 | −$145 | — | −$140 |
| ETH | Y1 / Y2 / Y3 | +$136 / +$197 / +$176 | +$104 / +$197 / +$176 | 77% / 100% / 100% | +$131 / +$192 / +$181 |
| ETH | Oct23–Oct26 | **+$509** | **+$477** | 94% | +$504 (−1.0%) |
| ETH | Oct21–Oct23 | +$21 | −$98 | — | +$25 |

Verdict: SOL PASS (92% ≥ 60%, all years ≥ $0, 1m within 0.3%); ETH PASS (94%, all years ≥ $0, 1m within 1.0%). Exit
ordering does not explain v7's profit. The pessimistic mode is the more cautious headline and costs about 8% of it.

---

## Validation summary (Checks A–C), 2026-10-19

**1. Result table**

| | Check A (pre-2023, A1+A2) | Check B (random entries) | Check C (intrabar) |
|---|---|---|---|
| SOL | **FAIL** — −$145, PF 0.45, 50 trades | **PASS** — +$367 vs random 95th pct +$179 (99.9th pct) | **PASS** — pessimistic 92%, 1m within 0.3% |
| ETH | **FAIL** — +$21, PF 1.06 < 1.2, 66 trades | **PASS** — +$509 vs random 95th pct +$175 (100th pct) | **PASS** — pessimistic 94%, 1m within 1.0% |

**2. Headline v7 under pessimistic mode (Oct23–Oct26, $10 per R, 1:3 target, breakeven +1R):** SOL **+$338** (79 trades; years
+$118 / +$133 / +$87), ETH **+$477** (75 trades; +$104 / +$197 / +$176), both **+$815** (about +$22 per month; current mode
+$876, +$24 per month).

**3. Ambiguous-candle exposure:** see the table above (5% of SOL trades, 7% of ETH trades; 0–16% per coin-year).

**4. Decision (decision table):** the checks split. B and C pass, so v7's in-sample profit is not an engine artefact and not an
exit-ordering artefact. A fails on both coins, so "the edge may depend on the 2023–26 regime. Do not scale up", and "a coin
that fails any check is not traded". **Neither coin is cleared for real-money trading.** The sensible next step is forward
paper trading (or replay in the app) at zero risk, using pessimistic-mode numbers as the expectation.

**5. Still unvalidated**
- Forward performance: every number so far is on data v7 was tuned on, or on pre-2023 data where it failed.
- Live slippage and fills: limit orders filled when price merely touches the level; live fills may need the market to trade
  through. Breakeven stops may slip more than one tick in fast markets.
- Funding costs are not modelled (a trade held several hours pays or receives funding at the 8-hour marks).
- One position at a time across *each coin*, but SOL and ETH positions overlap (25 trades); combined margin and correlation are untested.
- v7 was chosen from ~200 variants on the same data; random-entry percentiles do not correct for that selection.
- The mechanism behind the 2023–26 versus pre-2023 difference has not been identified (market regime, volatility, a change
  in how crypto trades around the US open).

### 2026-10-19 · Month-by-month view of Checks B and C (no new rule changes; v7 frozen) — `node monthly-BC.js`

Tables in `results/monthly-B.md` and `results/monthly-C.md` (37 calendar months, Oct 2023 – Oct 2026, SOL + ETH, $10 per R).
- **B (v7 vs random entries):** v7 +$876 (+$24 per month, 26 of 37 months profitable, worst −$44). The average random run: −$55
  (−$1 per month, about 15 profitable months). v7 beat the random average in 29 of 37 months, was above the random 95th percentile in
  6 months (Feb 2024, Aug 2025, Sep 2025, Nov 2025, Jan 2026, Mar 2026; chance alone gives about 2) and never below the 5th.
  A single month is too noisy to judge on its own (random months range about −$40 to +$50).
- **C (exit ordering):** current +$876, pessimistic +$815, 1m replay +$872. Only 3–4 of 37 months differ (Nov 2023, Feb 2024, Nov 2024,
  Feb 2026, and rounding in Oct 2025 / Nov 2025); the largest gap is Feb 2024 (−$31) and Feb 2026 (−$31) under pessimistic. Best/worst
  month and the −$44 maximum monthly drawdown are the same in all three.
