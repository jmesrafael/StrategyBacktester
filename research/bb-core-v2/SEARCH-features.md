# Which indicators separate good bb-core signals from bad ones? (5 coins pooled)

Baseline expectancy: TRAIN +0.400R (556 trades) · TEST +0.284R (954 trades)

Thirds are cut at TRAIN values. "spread" = expectancy of the best third minus the worst third. A feature is useful only if the SAME third is best in TRAIN and TEST and on most coins.

| feature | third (TRAIN cut) | TRAIN E | TEST E | TEST trades | coins where this third beats the opposite one |
|---|---|---|---|---|---|
| **breakAtr** | low < 0.217 | +0.527 | +0.279 | 344 | 3/5 low>high |
|  | mid 0.217…0.561 | +0.296 | +0.290 | 321 |  |
|  | high ≥ 0.561 | +0.377 | +0.283 | 289 | 2/5 high>low |
| **closePos** | low < 0.719 | +0.489 | +0.156 | 300 | 1/5 low>high |
|  | mid 0.719…0.875 | +0.353 | +0.313 | 329 |  |
|  | high ≥ 0.875 | +0.357 | +0.373 | 325 | 4/5 high>low |
| **bodyAtr** | low < 0.877 | +0.454 | +0.322 | 337 | 2/5 low>high |
|  | mid 0.877…1.412 | +0.340 | +0.153 | 303 |  |
|  | high ≥ 1.412 | +0.405 | +0.370 | 314 | 3/5 high>low |
| **rangeAtr** | low < 1.45 | +0.399 | +0.329 | 366 | 3/5 low>high |
|  | mid 1.45…2.015 | +0.418 | +0.288 | 293 |  |
|  | high ≥ 2.015 | +0.383 | +0.225 | 295 | 2/5 high>low |
| **volRatio** | low < 1.466 | +0.313 | +0.283 | 313 | 1/5 low>high |
|  | mid 1.466…2.164 | +0.514 | +0.336 | 288 |  |
|  | high ≥ 2.164 | +0.373 | +0.243 | 353 | 4/5 high>low |
| **bw** | low < 0.096 | +0.619 | +0.330 | 535 | 5/5 low>high |
|  | mid 0.096…0.159 | +0.439 | +0.336 | 247 |  |
|  | high ≥ 0.159 | +0.143 | +0.068 | 172 | 0/5 high>low |
| **sqRank** | low < 0.142 | +0.596 | +0.264 | 314 | 4/5 low>high |
|  | mid 0.142…0.5 | +0.336 | +0.352 | 344 |  |
|  | high ≥ 0.5 | +0.276 | +0.227 | 296 | 1/5 high>low |
| **slope** | low < 3.1e-3 | +0.272 | +0.384 | 390 | 4/5 low>high |
|  | mid 3.1e-3…0.028 | +0.553 | +0.322 | 369 |  |
|  | high ≥ 0.028 | +0.340 | +0.012 | 195 | 1/5 high>low |
| **ext** | low < 0.078 | +0.412 | +0.314 | 436 | 4/5 low>high |
|  | mid 0.078…0.204 | +0.550 | +0.412 | 315 |  |
|  | high ≥ 0.204 | +0.204 | +0.020 | 203 | 1/5 high>low |
| **fund** | low < 1.0e-4 | +0.393 | +0.276 | 440 | 2/5 low>high |
|  | mid 1.0e-4…1.0e-4 | NaN | NaN | 0 |  |
|  | high ≥ 1.0e-4 | +0.403 | +0.291 | 514 | 3/5 high>low |
| **adx** | low < 16.144 | +0.574 | +0.281 | 323 | 4/5 low>high |
|  | mid 16.144…26.554 | +0.499 | +0.252 | 320 |  |
|  | high ≥ 26.554 | +0.128 | +0.321 | 311 | 1/5 high>low |
| **diDir** | low < 12.629 | +0.524 | +0.211 | 341 | 4/5 low>high |
|  | mid 12.629…20.776 | +0.498 | +0.631 | 290 |  |
|  | high ≥ 20.776 | +0.179 | +0.050 | 323 | 1/5 high>low |
| **rsi** | low < 63.967 | +0.623 | +0.277 | 348 | 4/5 low>high |
|  | mid 63.967…69.436 | +0.353 | +0.438 | 272 |  |
|  | high ≥ 69.436 | +0.224 | +0.166 | 334 | 1/5 high>low |
| **er** | low < 0.215 | +0.388 | +0.374 | 348 | 5/5 low>high |
|  | mid 0.215…0.373 | +0.576 | +0.319 | 286 |  |
|  | high ≥ 0.373 | +0.237 | +0.155 | 320 | 0/5 high>low |
| **ret10** | low < 1.893 | +0.375 | +0.282 | 346 | 1/5 low>high |
|  | mid 1.893…2.87 | +0.416 | +0.229 | 282 |  |
|  | high ≥ 2.87 | +0.409 | +0.334 | 326 | 4/5 high>low |
| **ret3** | low < 1.469 | +0.553 | +0.240 | 367 | 3/5 low>high |
|  | mid 1.469…2.151 | +0.337 | +0.273 | 301 |  |
|  | high ≥ 2.151 | +0.309 | +0.352 | 286 | 2/5 high>low |
| **consec** | low < 2 | +0.472 | +0.211 | 204 | 3/5 low>high |
|  | mid 2…3 | +0.389 | +0.321 | 320 |  |
|  | high ≥ 3 | +0.375 | +0.291 | 430 | 2/5 high>low |
| **atrRank** | low < 0.258 | +0.475 | +0.297 | 303 | 3/5 low>high |
|  | mid 0.258…0.7 | +0.436 | +0.245 | 353 |  |
|  | high ≥ 0.7 | +0.294 | +0.317 | 298 | 2/5 high>low |
| **atrPct** | low < 0.03 | +0.500 | +0.367 | 572 | 5/5 low>high |
|  | mid 0.03…0.044 | +0.520 | +0.225 | 277 |  |
|  | high ≥ 0.044 | +0.181 | -0.014 | 105 | 0/5 high>low |
| **btc** | low < 0.027 | +0.585 | +0.417 | 414 | 4/5 low>high |
|  | mid 0.027…0.107 | +0.395 | +0.139 | 352 |  |
|  | high ≥ 0.107 | +0.221 | +0.264 | 188 | 1/5 high>low |

## Ranking (consistent = same direction in TRAIN and TEST and on ≥4 of 5 coins)

| feature | better side | consistent? | spread TRAIN | spread TEST |
|---|---|---|---|---|
| atrPct | low | **yes** | 0.319 | 0.381 |
| ext | low | **yes** | 0.208 | 0.293 |
| bw | low | **yes** | 0.475 | 0.262 |
| er | low | **yes** | 0.151 | 0.220 |
| diDir | low | **yes** | 0.345 | 0.161 |
| btc | low | **yes** | 0.364 | 0.152 |
| rsi | low | **yes** | 0.399 | 0.110 |
| ret10 | high | **yes** | 0.034 | 0.052 |
| sqRank | low | **yes** | 0.320 | 0.036 |
| rangeAtr | low | no | 0.015 | 0.104 |
| fund | high | no | 0.010 | 0.015 |
| breakAtr | low | no | 0.151 | 0.000 |
| closePos | low | no | 0.132 | 0.000 |
| bodyAtr | low | no | 0.050 | 0.000 |
| volRatio | high | no | 0.060 | 0.000 |
| slope | high | no | 0.067 | 0.000 |
| adx | low | no | 0.446 | 0.000 |
| ret3 | low | no | 0.244 | 0.000 |
| consec | low | no | 0.097 | 0.000 |
| atrRank | low | no | 0.181 | 0.000 |
