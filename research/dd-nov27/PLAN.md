# Smaller fall, still profitable when trades are shuffled (written Nov 27, 2026 before running)

Goal (owner): reduce TRI-CORE's worst fall, even a little, and keep a profit when the same trades arrive in a random order.
Baseline = TRI-CORE 50/25/25, risk x1.0, live account US$600, US$500 risk cap, MEXC minimums, 2020 to Nov 2026, causal engine
(`../improve-nov27/opus-validate/causal.js`): ends US$782,730, worst fall 43.7%, 3,791 trades.
Only change allowed: engine run options (sizeFn/rule/weights/cap). The engine's ctx now also passes `equity` to sizeFn (additive).
Entries, stops and exits of the bots do not change. Read-only: no bot, server or database touched.

## Families (one agent each)
A. Fall throttle: size x factor while equity is below its own peak (several depths/factors, with recovery rule).
B. Portfolio heat: cap total open risk / number of open trades across all three bots, and/or the same-side crowd (RULE exists; try
   total-heat variants).
C. Streak / day limits: cut size after N consecutive losing trades (portfolio-wide), pause after a loss > X% in 24h, then restore.

## Pass rules (all, vs baseline)
1. Live full period: worst fall smaller by at least 1 point AND end at least 85% of baseline.
2. Fresh start 2024 (live): fall smaller AND growth per year at least 85% of baseline.
3. Double fees and slippage: still ends above start, fall smaller.
4. 12-month starts (live, 71 of them): smaller fall in more than half, and profit positive in at least as many as baseline.
5. SHUFFLE TEST (mc.js): 2,000 random orders of the setting's own trades (full shuffle and 5-trade blocks), compounding from US$600:
   profit in 100% of orders AND median worst fall AND 95th-percentile worst fall both smaller than baseline's under the same shuffle.
No fitting of parameters after seeing results: list every setting tried; a setting is chosen from a pre-listed grid only.
Limits: 2020-2026 has been used many times, so a pass is a lead to shadow-test, not proof.
