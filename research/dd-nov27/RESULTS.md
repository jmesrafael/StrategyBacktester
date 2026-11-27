# Smaller fall, still profitable when shuffled (Nov 27, 2026)
Baseline TRI-CORE 50/25/25 live: US$782,730, worst fall 43.7%. 44 settings in 3 families (pre-listed grids, `PLAN.md`).
- A fall throttle (16): none passes; T10 x0.75 fall 37.3% but end 85% and fresh-2024 growth 74%.
- B portfolio heat (14): **S8 passes rules 1-4** (end 88.4%, fall 40.0%, fresh 2024 fall 36.7%, 71/71 windows smaller fall). R6 misses rule 2.
- C streak/day (14): none passes.
- Rule 5 shuffle (`shuf.js`, `shuffle-results.md`): all 100% profit; S8 median fall 13.5% vs 16.1%, p95 20.6% vs 26.1% (S8 sizes kept static).
- Opus review (`opus/REVIEW.md`): reproduced; no look-ahead; not a bot-order artefact; halves 42% of trades; a flat x0.85 cut gives the
  same end with a similar fall, so S8's edge over plain smaller size is the fresh-2024 fall only. S8 + throttle fails. Verdict: weak lead,
  shadow-test log-only; live needs open long/short counts shared between bots.
Caveat: replay in mc.js/shuf.js is closed-trade, shallower than engine falls (19% end gap vs engine); compare relative only.
