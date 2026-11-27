# More return AND smaller fall (written Nov 27, 2026 before running)
Owner's challenge: raise returns and lower the worst fall of the live TRI-CORE (BB-CORE v4 50%, I-CORE v3 25%, T-CORE v3 25%).
Bench: `h.js` on the causal engine (0 look-ahead), live rules, MEXC minimums, US$500 risk cap. `node h.js` prints the baseline.

## Six tests; a PASS on a test = higher growth per year AND smaller worst fall than live TRI-CORE
1 live US$600 full 2020-Nov 2026 (183.0%/yr, fall 43.7%) | 2 live fresh 2024 (396.8 / 49.1) | 3 flat 2020-23 (503.0 / 54.1)
4 flat 2024-26 (640.9 / 53.0) | 5 live double costs (179.3 / 44.2) | 6 live fills 1h late (177.3 / 49.2)
Size alone cannot pass: K=0.8..1.2 all score 0/6 (frontier printed by `node h.js`).

## Protocol (no fitting to the whole history)
- Each family pre-lists its grid at the top of its script before running. Every setting is reported.
- Choice inside a family uses test 3 (flat 2020-23) only. Tests 1, 2, 4, 5, 6 are the judge; test 4 is the unseen half.
- One scaling rule only: `fitK` sets K on test 3 so its fall = 52.1% (2 points under baseline). Allowed for the chosen setting
  of each family, never tuned further.
- WIN = 6/6. Survivors then: shuffle test, every 12-month start, each year, and an Opus review. Combine winners last.
- 2020-2026 has been used many times: a win is a lead to paper-test, not proof. Read-only: no bot, server, database.

## Families
F1 exits (per-bot `spec`): T-CORE trail, stale exit; I-CORE trail / lock; BB-CORE time exit, cool-down.
F2 signal quality: size up/down by facts known at the signal (ADX, quiet prior week, BTC trend, band distance).
F3 allocation: volatility targeting (up when calm, down when wild), per-bot equity-curve filter, quarterly weight tilt to recent winners.
F4 coins: per-bot coin lists chosen on 2020-23 only (add diversifiers, drop weak coins).
