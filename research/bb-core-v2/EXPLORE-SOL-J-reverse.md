# bb-core v2 — trying to beat the baseline on SOL (binance, costs x1)
Baseline bb-core: 309 trades, +105.4R, avg +0.341R, maxDD 12.8R, ≤2023 +78.6R (167 trades), ≥2024 +26.8R (142 trades)

## J. Greedy search on 2024+ ONLY, then judged on 2020–2023 (never used for choosing)
Each step adds the single change that raises the tuning-period total R the most (needs at least +3R and ≥ 60% of the baseline trades kept). Stops when nothing helps.

| step | change | tuning R | tuning trades | JUDGED R | judged trades | judged avg R |
|---|---|---|---|---|---|---|
| 0 | baseline | +26.8 | 142 | **+78.6** | 167 | +0.471 |
| 1 | +maxBars:96 |  +45.5 | 112 | **+86.8** | 133 | +0.652 |
| 2 | +maxExt:0.2 |  +52.8 | 96 | **+49.1** | 88 | +0.558 |
| 3 | +maxRangeAtr:3 |  +56.0 | 95 | **+53.1** | 89 | +0.597 |

stopped after 3 change(s): nothing adds ≥ +3R on the tuning period

Final config: maxBars:96 maxExt:0.2 maxRangeAtr:3
  tuning period: baseline +26.8R → tuned +56.0R
  JUDGED period: baseline +78.6R → tuned +53.1R   (167 → 89 trades)
  full history : baseline +105.4R → tuned +109.0R, maxDD 12.8R → 8.2R
