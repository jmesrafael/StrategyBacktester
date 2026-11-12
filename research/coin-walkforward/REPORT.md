# Walk-forward coin pick for the bots (Nov 12, 2026)

Code: `wf.js` → `wf.json` (add one coin), `swap.js` (ETH check + drop one current coin). Bots = the live rules via `../strat-hunt-nov6`
(BBX / P7 / P14), real fees, slippage, funding, 4h. Data and liquidity from `../zec-replacement` and `../zec-replacement-2/ticker.json`.
Why: `zec-replacement-2` picked coins using the whole history (selection bias), and never tested a 6th coin for T-CORE on top of ETH.
Test: a coin must improve the bot's coin set (trade-by-trade return/max drawdown, coin added at the same risk) on **Oct 18 2021 - 2023**,
and is then judged on **2024 - Nov 11 2026**. Candidates: crypto with 4h data before 2021 and MEXC futures ≥ $1M/day (22-23 coins).

## Add one coin
| bot (base coins) | base IS / OOS return/DD | IS-vs-OOS rank corr | improve IS / OOS / both | IS picks still helping OOS |
|---|---|---|---|---|
| BB-CORE (SOL NEAR ADA GALA) | 7.61 / 6.12 | −0.31 | 7 / 5 / **0** | 0 of 6 (AVAX, DOT, ONE, CRV, BTC, ETC) |
| I-CORE (same) | 11.90 / 5.68 | −0.39 | 2 / 6 / **0** | 0 of 2 (ONE, AVAX) |
| T-CORE (+ ETH) | 2.41 / 10.13 | 0.05 | 5 / 4 / **0** | 0 of 5 (DOT, BTC, ONE, AVAX, ETC) |

Every added coin raises total R but raises drawdown more. No coin improves any bot in both periods.

## Checks on the current coins (`swap.js`)
- **ETH on T-CORE passes walk-forward:** IS 1.83 → 2.41, OOS 8.95 → 10.13. Keep it.
- Drop one coin (return/DD IS / OOS): BB-CORE without ADA 8.17 / 8.66 (vs 7.61 / 6.12) but −15% to −20% total R; without SOL 8.71 / 7.36 (−23% / −15% R).
  I-CORE: every removal hurts OOS. Keep all four. T-CORE without ADA 2.74 / 10.42 (vs 2.41 / 10.13), a small effect.
  Observation only: with 4-5 coins this is a small sample, and dropping a coin always cuts return.

## Verdict
No new coin for any bot. The current sets (BB-CORE and I-CORE on SOL NEAR ADA GALA, T-CORE + ETH) stand. Re-test when new coins reach 3+ years of
perp history with MEXC liquidity (e.g. SUI from mid-2026, APT/ARB later), using this same walk-forward test.

## Recent-years screen: 2024, 2025, 2026 (`recent3.js` → `recent3.txt`, `recent3.json`)
68 coins with full 2024-2026 history, run on all three bots. TRI mix = 0.5 BB + 0.25 I + 0.25 T. **This picks on recent results (hindsight)**:
use it to choose paper candidates, not as proof.
- Positive on the TRI mix in all of 2024, 2025 and 2026: 23 coins; 14 of them have MEXC ≥ $1M/day.
- Best new liquid candidates (TRI mix 2024 / 2025 / 2026, max DD, +months of 35):
  SUI +19.1 / +11.8 / +9.0 (DD 7.4R, 21) · ARB +7.7 / +12.2 / +19.1 (DD 8.6R, 23) · DOGE +35.9 / +8.0 / +8.0 (DD 9.6R, 21).
  Current coins for scale: SOL +52, ETH +48, NEAR +47, GALA +45, ADA +40 total.
- Weaker: XRP and BNB (DD 18R), FET (≈0 in 2025-26), LINK, UNI, ONE, SEI (smaller). ZEC is the strongest but is being delisted.
- DOGE failed the walk-forward test above (adding it on 2021-2023 didn't help any bot). SUI and ARB are too young for that test.
- Note: GALA, a current coin, shows only $0.7M/day on MEXC in the Nov 11-12 snapshot.

## SUI and ARB in detail (`sui-arb.js` → `SUI-ARB.md`)
From launch (ARB 2023-03-23, SUI 2023-05-03), per bot and year, a comparison with the current coins, and the merge into each bot and TRI-CORE (Jun 10 2023 - Nov 11 2026).
TRI-CORE return/DD: current 13.57; +SUI 12.92; +ARB 14.83; +both 13.98; per-bot assignment BB+ARB, I unchanged, T+SUI+ARB 15.77 (DD 20.3R, +42R; picked in hindsight).
I-CORE gets worse with either coin (11.35 -> 9.05 / 8.34). Paper-trade first.
