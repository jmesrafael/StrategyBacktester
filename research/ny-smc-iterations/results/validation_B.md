# Validation Check B — random-entry control for v7

Run 2026-10-19T03:53Z · 1000 seeds per coin per period · $10 per R · v7 frozen (ie.js sha256 6539c98f…). Design and interpretation choices were logged in ITERATION-LOG.md before this run. A random setup = random signal candle + random direction + limit offset / stop distance drawn as a pair from one of that coin's real v7 trades (in ATR); all exits, costs and sizing are the unchanged v7 engine.

## Primary control — signal candles in v7's own windows (08:30–09:30 and 10:30–11:30 ET)

| Coin | Period | v7 trades | **v7 actual** | Random mean | Random median | 5th pct | 95th pct | 99th pct | v7 percentile | Random mean per year | Seeds short of v7 count |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SOL | Oct23–Oct26 | 79 | **+$367** | −$25 | −$28 | −$222 | +$179 | +$271 | **99.9%** | −$8 | 0/1000 |
| SOL | Oct21–Oct23 (A2+A1) | 50 | **−$145** | −$9 | −$11 | −$168 | +$158 | +$234 | **8.5%** | −$4 | 0/1000 |
| ETH | Oct23–Oct26 | 75 | **+$509** | −$30 | −$37 | −$228 | +$175 | +$308 | **100.0%** | −$10 | 0/1000 |
| ETH | Oct21–Oct23 (A2+A1) | 66 | **+$21** | −$55 | −$57 | −$229 | +$144 | +$222 | **76.2%** | −$28 | 0/1000 |

Per year (random mean · 5th–95th percentile range vs v7 actual):

| Coin | Year | v7 actual | Random mean | 5th – 95th |
|---|---|---|---|---|
| SOL | Y1 | +$118 | −$6 | −$109 … +$114 |
| SOL | Y2 | +$132 | −$10 | −$128 … +$118 |
| SOL | Y3 | +$117 | −$9 | −$109 … +$112 |
| SOL | A2 | −$40 | +$1 | −$105 … +$113 |
| SOL | A1 | −$105 | −$9 | −$130 … +$121 |
| ETH | Y1 | +$136 | −$10 | −$110 … +$105 |
| ETH | Y2 | +$197 | −$12 | −$117 … +$107 |
| ETH | Y3 | +$176 | −$9 | −$131 … +$128 |
| ETH | A2 | +$50 | −$15 | −$137 … +$109 |
| ETH | A1 | −$29 | −$40 | −$169 … +$107 |

Histogram — SOL, Oct23–Oct26, 1000 random runs (total $ profit):

```
 −$393  1
 −$358 ██ 5
 −$322 ███ 9
 −$287 █████ 15
 −$251 █████████ 27
 −$216 ███████████ 36
 −$181 █████████████████████ 68
 −$145 ██████████████████████████ 81
 −$110 █████████████████████████████ 93
  −$74 ████████████████████████████████████████ 127
  −$39 ██████████████████████████████████ 107
   −$4 ██████████████████████████████████████ 120
  +$32 ████████████████████████████████ 101
  +$67 ███████████████████████ 74
 +$103 ██████████████ 44
 +$138 ███████████ 34
 +$173 █████████ 30
 +$209 ███ 9
 +$244 ████ 13
 +$279 █ 4
 +$315  0
 +$350  1  ◀ v7 actual
 +$386  0
 +$421  1
```

Histogram — ETH, Oct23–Oct26, 1000 random runs (total $ profit):

```
 −$376 █ 4
 −$340 ███ 9
 −$303 █████ 16
 −$266 ██████ 20
 −$229 ████████████ 39
 −$192 ███████████████████████ 75
 −$155 █████████████████████████ 81
 −$118 ███████████████████████████████ 99
  −$81 ████████████████████████████████████████ 128
  −$45 ████████████████████████████████████ 114
   −$8 ██████████████████████████████ 95
  +$29 █████████████████████████████████ 106
  +$66 ████████████████████████ 78
 +$103 ███████████████ 49
 +$140 ████████████ 38
 +$177 █████ 17
 +$214 ████ 13
 +$250 ██ 7
 +$287 █ 3
 +$324 ██ 6
 +$361 █ 3
 +$398  0
 +$435  0
 +$472  0  ◀ v7 actual
```

## Sensitivity — literal 08:30–11:30 ET window (includes the 09:30–10:30 open hour v7 skips)

| Coin | Period | v7 trades | **v7 actual** | Random mean | Random median | 5th pct | 95th pct | 99th pct | v7 percentile | Random mean per year | Seeds short of v7 count |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SOL | Oct23–Oct26 | 79 | **+$367** | −$21 | −$27 | −$209 | +$187 | +$291 | **99.8%** | −$7 | 0/1000 |
| SOL | Oct21–Oct23 (A2+A1) | 50 | **−$145** | −$5 | −$7 | −$163 | +$160 | +$256 | **7.0%** | −$3 | 0/1000 |
| ETH | Oct23–Oct26 | 75 | **+$509** | −$31 | −$34 | −$215 | +$169 | +$263 | **100.0%** | −$10 | 0/1000 |
| ETH | Oct21–Oct23 (A2+A1) | 66 | **+$21** | −$59 | −$62 | −$239 | +$127 | +$210 | **76.0%** | −$29 | 0/1000 |

Per year (random mean · 5th–95th percentile range vs v7 actual):

| Coin | Year | v7 actual | Random mean | 5th – 95th |
|---|---|---|---|---|
| SOL | Y1 | +$118 | −$10 | −$108 … +$105 |
| SOL | Y2 | +$132 | −$7 | −$120 … +$123 |
| SOL | Y3 | +$117 | −$4 | −$118 … +$111 |
| SOL | A2 | −$40 | +$4 | −$91 … +$116 |
| SOL | A1 | −$105 | −$9 | −$138 … +$125 |
| ETH | Y1 | +$136 | −$13 | −$111 … +$94 |
| ETH | Y2 | +$197 | −$5 | −$114 … +$123 |
| ETH | Y3 | +$176 | −$13 | −$133 … +$118 |
| ETH | A2 | +$50 | −$14 | −$135 … +$119 |
| ETH | A1 | −$29 | −$45 | −$168 … +$91 |

## Verdict (pre-registered criteria + the interpretation notes logged before the run)

| Coin | v7 above 95th pct (Oct23–Oct26) | Random mean ≤ +$30/yr (all periods, both windows) | **Check B** |
|---|---|---|---|
| SOL | ✅ v7 +$367 vs p95 +$179 (percentile 99.9) | ✅ worst random mean −$3/yr | **PASS** |
| ETH | ✅ v7 +$509 vs p95 +$175 (percentile 100.0) | ✅ worst random mean −$10/yr | **PASS** |
