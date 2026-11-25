# BB-CORE tweaks: more profit with a smaller drawdown? (Nov 25, 2026)

**Yes, modestly, and not yet proven enough for the live bot.** No bot, server or database was touched.

## The tweak ("D1")
Everything stays as BB-CORE v3, plus:
1. **Shorts only when Intraday Intensity (21 candles) is below zero.** Longs unchanged.
2. **Half risk when ADX(14) is above 27** on the signal candle.

## How it was tested
- Candle-by-candle replay of all 6 coins together; orders fill at the next open; stop first; fees, slippage, funding.
  It equals the project engine on 28,385 trades, and cutting the data at 8 dates changes nothing earlier (no future sight).
- 132 tweaks were judged on **2020-2023 only**. 3 passed every check (all were the ADX rule). The best Intensity
  addition was then chosen on the same years and **locked** before 2024-2026 was opened.
- Then: unseen years, a yearly walk-forward, double costs, 2-minute-late fills on 1-minute prices, other coins, a luck test.

## Results
R = risk units. "Drop closed" = worst drawdown on closed trades; "drop open" = including open positions (what the account feels).

| Version | 2024-26 (unseen): R / drop closed / drop open | 2020-26: R / drop closed / drop open |
|---|---|---|
| BB-CORE today | +285 / 27.0 / 34.9 | +707 / 27.2 / 45.4 |
| Intensity filter alone | +288 / 25.5 / 34.9 | +689 / 25.5 / 34.9 |
| D1, risk never above today's (1.00x) | +291 / 25.3 / 31.4 | +677 / 25.3 / 31.4 |
| D1 at 1.05x (*) | +305 / 26.5 / 32.9 | +711 / 26.5 / 32.9 |
| D1 at 1.15x (the preset rescale) | +333 / 28.9 / 35.9 | +776 / 28.9 / 35.9 |

(*) 1.05x was chosen **after** seeing the results. It is a risk setting, not a finding: it is the level where all three
numbers beat today in both windows. 1.00x and 1.15x were fixed beforehand.

## Year by year (R / worst closed-trade drawdown)
| Year | Today | Intensity filter | D1 at 1.05x |
|---|---|---|---|
| 2020 | +38 / 10.1 | +24 / 10.1 | +24 / 10.0 |
| 2021 | +178 / 14.0 | +172 / 12.9 | +190 / 12.1 |
| 2022 | +85 / 27.2 | +85 / 18.5 | +77 / 18.5 |
| 2023 | +122 / 26.8 | +120 / 23.7 | +114 / 22.5 |
| 2024 | +95 / 27.0 | +68 / 25.5 | +84 / 21.9 |
| 2025 | +64 / 24.3 | +86 / 16.5 | +89 / 16.4 |
| 2026 (to Nov 24) | +126 / 26.5 | +134 / 25.4 | +132 / 26.5 |

At 1% risk per trade without compounding, 1R = 1% of the account. 2020-2023 were used to choose.
D1 at 1.05x: drawdown lower or equal every year (open-trade drawdown lower in 6 of 7), but **profit lower in 4 of 7 years**.

## Reasons for caution
1. **Walk-forward gain is small.** Re-choosing every 1 January from past data only (2022-26): R +507 against +489 (+4%),
   open drawdown 40.7 against 45.4 (-10%), closed drawdown 29.6 against 27.2 (9% worse). The rule also changed between years.
2. **The Intensity length is fragile.** On unseen years only length 21 clearly beats today; 14, 28 and 35 do not.
3. **The ADX rule** adds R at every threshold from 22 to 40 on unseen years, but alone it barely changes R / drawdown there (7.0 to 8.4 against 8.2).
4. Other coins (300 random baskets, 2024-26, 1.15x version): better R / drawdown in 66%; over all years only 51%.
5. 2024-26 was unseen by this selection, but earlier studies (including the book study today) have looked at it.

## In its favour
- Random trade picks with the same sizes reach both D1's profit and drawdown in only 0.1% of 20,000 draws (unseen
  years; the test ignores clustering, so it is optimistic). The two rules do find weaker trades.
- It holds with double costs (+306 R against +256, 1.15x) and 2-minute-late fills (+302 against +254, 1.15x).
- Removing any one coin keeps D ahead of today in profit.

## Recommendation
Do not change the live bot yet. Paper test D1 beside it for at least 6 months. Further tuning now would be fitted to
2024-26, so only new candles can test it further.

Files: `engine.js`, `select.js` (the selection rules), `check.js`, `pick.js`, `pick-ii.js` then `locked.json`,
`holdout.js` and `luck.js` then `RESULTS.md`. Run in that order. Note: `pick.js` overwrites the locked file.
