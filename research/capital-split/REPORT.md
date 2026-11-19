# Self-compounding vs rebalancing the three bots (Nov 19, 2026)
Run: `node research/capital-split/study.mjs` (all tables in `RESULTS.md`). Same trades, costs, 2.5% risk and 20% fee as the
/backtest-data page (`scripts/backtest-report-data-v2.mjs`). 17 ways to share the money were tested in four ways: full history, each half,
every start month (12 and 24-month holds), and 1,000 reshuffled 7-year histories (6-month blocks, all bots together).

## Verdict
**Rebalancing is worth doing, but mainly because it makes the bad falls smaller. The extra profit is real but small and unreliable.**

| Test | Rebalance every 2 months vs today (self-compounding) |
|---|---|
| Full history | +37% more money, deepest fall −48% instead of −55% |
| 2020-2022 alone | −9% money, fall −43% instead of −49% |
| 2023-Nov 2026 alone | +51% money |
| Every start month, 12-month hold | wins 54% of starts, median +1% |
| Every start month, 24-month hold | wins 53%, median +3% |
| 1,000 reshuffled histories | wins 52%, median +4%, range −65% to +66% |
| Histories with a 60%+ fall | **1% instead of 7%** |

- The profit gap comes almost entirely from T-CORE's 2024 run. Self-compounding had left T-CORE with 1-2% of the money by then.
- The deepest falls are smaller in every test, because BB-CORE is unrelated to the other two (correlation −0.07 and 0.14). I-CORE and T-CORE move together (0.67).
- At 1% risk per trade, rebalancing still makes 17-20% more, but the fall is the same (−22%). The drawdown benefit matters at 2.5% risk.

## Ranking of practical options
1. **One shared pool**: each bot sizes its trade from the whole pool x its weight. It is the best on every test: +56% full history, wins 59-68%, smallest falls.
   It needs a bot code change: the bots must read the pool total. Accounts still need a top-up when one runs low, because a sub-account cannot lose money it does not hold. **This is a future option.**
2. **Rebalance every 2-3 months at the fee date, realized cash only**: +37% to +47%, falls −48%. Every 1, 2 or 3 months score about the same; the differences are noise.
3. **The same with a 5-point band** (move money only if a bot is 5+ points off): almost the same result (+34%) with 31 transfers instead of 41.

**Not recommended:**
- Once a year: −2% on the real history.
- 10-15 point bands: they react too late.
- Fee-only rebalancing: −3%.
- Equal 1/3 weights: −19% self-compounding, +11% rebalanced, and worse in the reshuffles.
- 60/20/20: it looks good only because BB-CORE was the best bot in this history (hindsight).
- Inverse-volatility weights: no gain.

Keep 50/25/25.

## Caveats
- One real history; the reshuffles show that luck alone can swing the 7-year result by ±60% between methods.
- No cap on trade size.
- MEXC sub-account transfers are free, but only free cash (not margin in open trades) can be moved.
