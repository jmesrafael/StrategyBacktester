# Validation Check A — v7 on pre-Oct-2023 history

Run 2026-10-19T03:30Z. v7 frozen (ie.js + V7 config), headline costs (maker 0.02%, taker 0.055% + 0.02% slippage on stop exits). $ = R × $10. Bybit linear perpetuals, 15m. Each coin is run as ONE continuous series (pre-2023 + in-sample) and trades are assigned to a period by fill time.

## 1. Session window in America/New_York (DST check)

- SOL: 1831 daily NY lines from 2021-10-15 to 2026-10-19; session start = 08:30 ET, NY line = 09:30 ET, order expiry = 16:00 ET on **1831 / 1831** days
- ETH: 2045 daily NY lines from 2021-03-15 to 2026-10-19; session start = 08:30 ET, NY line = 09:30 ET, order expiry = 16:00 ET on **2045 / 2045** days

| Date (weekday) | NY line UTC | NY line ET | Window start ET | Window end ET | US DST |
|---|---|---|---|---|---|
| 2021-03-12 | (before data) | | | | |
| 2021-03-15 (Mon) | 13:30 | 09:30 | 08:30 | 11:30 | yes (EDT) |
| 2021-11-05 (Fri) | 13:30 | 09:30 | 08:30 | 11:30 | yes (EDT) |
| 2021-11-08 (Mon) | 14:30 | 09:30 | 08:30 | 11:30 | no (EST) |
| 2022-03-11 (Fri) | 14:30 | 09:30 | 08:30 | 11:30 | no (EST) |
| 2022-03-14 (Mon) | 13:30 | 09:30 | 08:30 | 11:30 | yes (EDT) |
| 2022-11-04 (Fri) | 13:30 | 09:30 | 08:30 | 11:30 | yes (EDT) |
| 2022-11-07 (Mon) | 14:30 | 09:30 | 08:30 | 11:30 | no (EST) |
| 2023-03-10 (Fri) | 14:30 | 09:30 | 08:30 | 11:30 | no (EST) |
| 2023-03-13 (Mon) | 13:30 | 09:30 | 08:30 | 11:30 | yes (EDT) |

Window = CHoCH accepted 08:30–09:30 and 10:30–11:30 ET (09:30–10:30 skipped); pending orders expire 16:00 ET.

## 2. Results per coin-year

hit = 3R target · stop = full stop (≈ −1R) · tight = tightened stop after no follow-through (≈ −0.5R) · BE = breakeven exit (≈ 0R). Max DD = largest peak-to-trough fall of cumulative $ within the period. Cells under 15 trades = insufficient sample.

| Coin | Period | Trades | hit / stop / tight / BE | Profit $ | Profit R | PF | Max DD $ | Note |
|---|---|---|---|---|---|---|---|---|
| SOL | A3p Mar21–Oct21 (ETH only, partial: info only, not in verdict) | — | — | — | — | — | — | no data (history starts 2021-10-15) |
| SOL | A2 Oct21–Oct22 | 20 | 2 / 5 / 8 / 5 | −$40 | -4.0R | 0.60 | −$77 |  |
| SOL | A1 Oct22–Oct23 | 30 | 2 / 13 / 3 / 12 | −$105 | -10.5R | 0.36 | −$105 |  |
| SOL | IS Oct23–Oct26 (in-sample, reference) | 79 | 21 / 18 / 8 / 32 | +$367 | +36.7R | 2.43 | −$43 | (not in verdict) |
| **SOL** | **pooled A1+A2** | **50** | | **−$145** | **-14.5R** | **0.45** | −$145 | |
| ETH | A3p Mar21–Oct21 (ETH only, partial: info only, not in verdict) | 9 | 3 / 3 / 1 / 2 | +$51 | +5.1R | 2.30 | −$17 | **insufficient sample** (not in verdict) |
| ETH | A2 Oct21–Oct22 | 32 | 7 / 10 / 7 / 8 | +$50 | +5.0R | 1.32 | −$60 |  |
| ETH | A1 Oct22–Oct23 | 34 | 5 / 12 / 3 / 14 | −$29 | -2.9R | 0.84 | −$49 |  |
| ETH | IS Oct23–Oct26 (in-sample, reference) | 75 | 26 / 17 / 9 / 23 | +$509 | +50.9R | 2.95 | −$69 | (not in verdict) |
| **ETH** | **pooled A1+A2** | **66** | | **+$21** | **+2.1R** | **1.06** | −$60 | |

## 3. Verdict (pre-registered criteria, pooled A1 + A2)

| Coin | Net > $0 | PF ≥ 1.2 | ≥ 40 trades | No year < −$60 | **Check A** |
|---|---|---|---|---|---|
| SOL | ❌ −$145 | ❌ 0.45 | ✅ 50 | ❌ worst A2 −$40, A1 −$105 | **FAIL** |
| ETH | ✅ +$21 | ❌ 1.06 | ✅ 66 | ✅ worst A2 +$50, A1 −$29 | **FAIL** |

## 4. Integrity checks

- SOL: trades whose CHoCH is outside 08:30–09:30 / 10:30–11:30 ET: **0** of 129. In-sample reference from this continuous run: 79 trades, 36.71R (frozen headline: 79 trades, 36.71R).
- ETH: trades whose CHoCH is outside 08:30–09:30 / 10:30–11:30 ET: **0** of 150. In-sample reference from this continuous run: 75 trades, 50.85R (frozen headline: 75 trades, 50.85R).
