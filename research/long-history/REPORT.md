# Long-history coin screen: which coins are positive every year on TRI-CORE rules (Nov 12, 2026)

Code: `screen.js` -> `screen.json`, `screen.txt` (full 89-coin table). Data: the local candle library (`candles/`, Binance USDT-M perps, 4h + funding, 0 downloads while testing).
Rules: the three live bots via `../strat-hunt-nov6` (BB-CORE BBX, I-CORE P7, T-CORE P14), real fees 0.05% x2, slippage 0.02%, real funding.
TRI mix = 0.5 BB + 0.25 I + 0.25 T, R per bot at its own risk. Trades counted in the year they exit. Each coin run from its own listing; the first 205 candles are warm-up.
"All years positive" = positive in every calendar year the coin could trade, needing 5+ years (2020 counts only for coins tradable before Jul 2020; 2026 = to Nov 12).
89 coins: everything listed on Binance perps before 2022 (88) plus ICP/SUI for scale. Also checked: 2x fees and slippage, and total R without the top 10 trades.

## 9 of 89 coins are positive in every year
| Coin | Listed | Binance $M/day | Years positive | Total R | Max DD | R/DD | 2x cost | Without top 10 trades | Note |
|---|---|---|---|---|---|---|---|---|---|
| ADA* | 2020-01 | 108 | 7/7 | +137 | 10 | 14.1 | +130 | +33 | bot coin, longest record |
| SOL* | 2020-09 | 1171 | 6/6 | +143 | 11 | 12.7 | +137 | +45 | bot coin |
| GALA* | 2021-09 | 5 | 5/5 | +127 | 7 | 18.6 | +123 | +36 | bot coin |
| ENJ | 2020-09 | 3 | 6/6 | +117 | 12 | 9.7 | +111 | +9 | 2026 alone +49: one-year-heavy, thin |
| ONE | 2021-03 | 63 | 5/5 | +70 | 9 | 8.1 | +63 | +27 | the only new coin with a decent tail test and volume |
| GRT | 2020-12 | 2 | 6/6 | +82 | 20 | 4.1 | +77 | +32 | thin |
| KSM | 2020-10 | 1 | 6/6 | +65 | 16 | 4.1 | +59 | -3 | profit is the top 10 trades; thin |
| UNI | 2020-09 | 199 | 6/6 | +45 | 11 | 4.0 | +37 | -9 | liquid but weak; profit is the top 10 trades |
| ANKR | 2021-01 | 1 | 5/5 | +44 | 13 | 3.5 | +38 | -8 | very thin |
(* = a bot already trades it. NEAR is 5/6: 2025 -0.1.)

## Near misses (one losing year), the liquid ones
BTC 6/7 (2025 -5.6; +129 R, DD 13), ETH 6/7 (2023 -8.3), DOGE 5/6 (2023 -14.2; +172 R), AVAX 5/6 (2026 -4.8), ZEC 6/7 (2023 -12.3), BNB 6/7 (2020 -10.7), LINK 6/7 (2021 -7.5), VET 6/7 (2025 -2.2, but $4M/day), DOT 5/6 (2025 -2.2), RUNE 5/6 (2026 -1.1), XRP 6/7 (2023 -4.8, DD 29).
The long-history coins that fail: XMR, BEL, BAND, KNC, ARPA, SFP, KAVA (negative in total), TRX, BAT, ATOM, LTC, DASH, ONT (about zero with a 30-40R drawdown).

## What this says
- Only 3 bot coins pass, and 6 new ones. Of those, only UNI and ONE trade over $50M/day, and UNI's profit is its top 10 trades. ENJ, GRT, KSM, ANKR trade $1-3M/day on Binance: backtest fills would not be real.
- Without the top 10 trades only ADA, SOL, GALA, NEAR, ONE, GRT, ENJ (barely) stay clearly positive. Fat-tailed coins pass the "all years" test by luck of a few trades.
- The all-years test is looser than the walk-forward test: ONE and UNI were already tested as added coins (`../coin-walkforward/REPORT.md`) and hurt the bots out of sample. Passing this screen does not change that verdict.
- Biggest "year-after-year" scale: the bot coins ADA, SOL, GALA, NEAR, ETH remain the most consistent liquid set. Nothing new here beats them.
- Survivorship bias: delisted coins are not in the library, so this set is flattering.

## Verdict
No new coin recommended. Watch list for paper only, if wanted: ONE (the only new one that passes everything, but already rejected by walk-forward). Re-test with a walk-forward split (pick on 2020-2023, judge 2024-2026) before any slot.
