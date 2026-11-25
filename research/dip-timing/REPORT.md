# Is it better to add money when the equity curve is down? (Nov 25, 2026)

Run: `node research/dip-timing/run.mjs`. Three-bot backtest (BB/I/T-CORE 50/25/25, v3 rules, 2.5% risk, before fee, closed trades only),
Jan 2020 to Nov 25 2026, sampled daily. Drop = distance below the highest value so far.

## Next 30 days

| Curve when money is added | Days sampled | Separate periods (approx) | Higher 30 days later | Median change | Median further fall |
|---|---|---|---|---|---|
| 0-5% below high | 789 | 45 | 65% | +10% | -4% |
| 5-15% below | 698 | 48 | 64% | +8% | -7% |
| 15-30% below | 619 | 41 | 58% | +4% | -9% |
| Over 30% below | 385 | 22 | 76% | +18% | -10% |
| **Total (any day)** | 2491 | 81 | 65% | +9% | -7% |

## Verdict
No reliable rule. A moderate drop did not improve the odds. Drops over 30% did better, on about 22 separate periods (5-10 at 90-180 days).
15-30% bucket by half: 42% higher (2020-22) vs 63% (2023-26). Overlapping windows; rules were chosen on this history (in-sample, rising curve).
