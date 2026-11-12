# Portfolio mix & match: which strategies to run TOGETHER as separate sleeves (Nov 12, 2026)

Code: `mix.js` → `mix.json`. 12 sleeves, each a full strategy on the bot coins (SOL NEAR ADA GALA; T-CORE also ETH), Oct 20 2020 to Nov 10 2026:
BB-CORE, I-CORE, T-CORE (backtest trades, `../zec-replacement-2/trades-fill.json`), MTF core P14 / adx+vol P14 / core P7 (`../mtf-confluence`),
5 lower-TF Ichimoku-family sleeves (`../ichi-ltf`: E4/both/TM24, E2/ichi4/KJ, E4/ichi4/T2 Darvas, E1/none/P7, E2/d1/P14), ORB-G (`../orb-sol`).
Every subset of 2-5 sleeves with equal capital (1,573 subsets). Metric: return / max drawdown, trade by trade, in account R
(each sleeve risks 1% of its own capital). Picked on IS (trades closed before 2024), judged OOS (2024 to Nov 2026).

## Baselines (return/DD, total R / max DD)
| | IS 2020-23 | OOS 2024-26 | all |
|---|---|---|---|
| TRI-CORE 50/25/25 (live) | 18.6 (297R / 16.0R) | 10.0 (205R / 20.5R) | 24.5 (502R / 20.5R) |
| BB + I + T, equal | 18.4 | 10.3 | 24.4 |
| BB-CORE / I-CORE / T-CORE alone | 10.9 / 17.8 / 9.8 | 6.1 / 6.0 / 10.1 | 16.8 / 18.8 / 18.4 |

## Results
- IS vs OOS rank correlation over all 1,573 subsets: **0.19**. A good past mix barely predicts a good future mix.
- The IS top 12 all do **worse** OOS than the live TRI-CORE (OOS 4.0 to 8.8 vs 10.0). The IS #1 (TRI + 2 Ichimoku sleeves): IS 20.9 → OOS 6.1.
- 68 of 1,573 subsets beat TRI-CORE OOS, but they can't be picked from IS.
- One extra sleeve at 20% (TRI scaled to 80%):

| added sleeve | IS (TRI 18.6) | OOS (TRI 10.0) |
|---|---|---|
| MTF adx+vol P14 | 17.3 | 12.0 |
| ICHI E2/d1/P14 | 17.0 | 11.4 |
| ORB-G | 17.1 (DD 14.4R) | 10.9 (DD 15.7R) |
| MTF core P14 | 15.9 | 10.6 |
| ICHI E1/none/P7 | **20.4** | 7.3 |
| ICHI E4/both/TM24 | 19.3 | 8.8 |

  No sleeve improves both periods: the ones that help IS hurt OOS, and the reverse.

## Verdict
Keep the live TRI-CORE (BB 50 / I 25 / T 25). Equal 1/3 weights are a statistical tie (OOS 10.3 vs 10.0). No add-on sleeve or subset reliably
beats it. ORB-G is the only add-on that lowers drawdown in both periods, but it also lowers return, and on IS it does worse than simply
lowering TRI-CORE's risk.
