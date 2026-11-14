# How often should the Ledger settle? (Nov 15 2026)

`node freq.js` writes freq.json. The pool is the 3 live bots (rules v3, live coins), each compounding on its own third, Binance 4h, Jan 2020 to Nov 2026.
The fee is 20% with a high-water mark. Every start month is tried, for 12, 24 and 36 months in the fund. Each investor leaves with a final settlement.
The fee moves units to the manager inside the pool, so the pool grows the same at any frequency. Only the split between investor and manager changes.

Investor end value compared with settling every 2 months (median of all start months, 12 / 24 / 36 months in the fund):

| Settle every | 0.5% risk | 1% risk | 2.5% risk (live setting, backtest returns) |
|---|---|---|---|
| 1 month | −0.2 / −0.4 / −0.5% | −0.4 / −1.3 / −1.7% | −1.8 / −4.2 / −6.2% |
| 2 months | 0 | 0 | 0 |
| 3 months | +0.1 / +0.5 / +0.6% | +0.5 / +1.4 / +1.9% | +1.1 / +4.9 / +6.3% |
| 6 months | +0.7 / +1.5 / +2.4% | +1.6 / +4.5 / +7.3% | +6.2 / +14.8 / +24.4% |
| 12 months | +1.0 / +3.0 / +5.0% | +3.0 / +8.3 / +14.6% | +10.0 / +25.4 / +45.3% |

The manager's side is roughly the mirror image. Monthly gives the manager +1.4 to +5.3% compared with 2-monthly; yearly gives −8 to −29%.

Why more often costs the investor:
1. The fee leaves their units sooner, so that part compounds for the manager instead of for them. This effect grows with the return and with time.
2. A fee is taken on a rise that later falls back. A high-water mark never pays it back. The pool fell in about 30% of months.

Conclusion: monthly against 2-monthly is a small difference at realistic returns. The bigger gaps are against 6 and 12 months.
The gaps scale with returns, so live results below the backtest bring every column toward the 0.5% one.
