# bb-core v2 — trying to beat the baseline on SOL (binance, costs x1)
Baseline bb-core: 309 trades, +105.4R, avg +0.341R, maxDD 12.8R, ≤2023 +78.6R (167 trades), ≥2024 +26.8R (142 trades)

## J. Greedy search on 2020–2023 ONLY, then judged on 2024+ (never used for choosing)
Each step adds the single change that raises the tuning-period total R the most (needs at least +3R and ≥ 60% of the baseline trades kept). Stops when nothing helps.

| step | change | tuning R | tuning trades | JUDGED R | judged trades | judged avg R |
|---|---|---|---|---|---|---|
| 0 | baseline | +78.6 | 167 | **+26.8** | 142 | +0.189 |
| 1 | +targetR:15 |  +108.5 | 147 | **+26.6** | 128 | +0.207 |
| 2 | +stopMode:frac stopFrac:0.5 |  +129.0 | 212 | **+31.4** | 169 | +0.186 |
| 3 | +bbMult:1.5 |  +174.1 | 283 | **+71.5** | 245 | +0.292 |
| 4 | +maxBars:96 |  +184.1 | 236 | **+63.1** | 203 | +0.311 |
| 5 | +maxBreakAtr:1 |  +203.5 | 230 | **+74.2** | 204 | +0.363 |
| 6 | +stagBars:18 stagR:0.5 |  +208.8 | 241 | **+76.2** | 206 | +0.370 |

Final config: targetR:15 stopMode:frac stopFrac:0.5 bbMult:1.5 maxBars:96 maxBreakAtr:1 stagBars:18 stagR:0.5
  tuning period: baseline +78.6R → tuned +208.8R
  JUDGED period: baseline +26.8R → tuned +76.2R   (142 → 206 trades)
  full history : baseline +105.4R → tuned +285.1R, maxDD 12.8R → 34.6R
