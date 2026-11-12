# Coin lab bots (BB-CORE on ARB, T-CORE on SUI + ARB), PAPER ONLY

Why: `research/coin-walkforward/SUI-ARB.md`. The best split was BB-CORE + ARB, T-CORE + SUI + ARB, I-CORE unchanged
(TRI-CORE return/drawdown 13.6 → 15.8 since Jun 2023), but it was picked in hindsight, so it's watched on paper first.
Each lab trades ONLY the new coins, so the dashboard shows exactly what SUI and ARB add.

| bot | built from | patch | coins | tag | service |
|---|---|---|---|---|---|
| coin-bb | `D:\testing\Strat\bb-core` (4h) + `bb-core-1h/realpaper.js` | `patches/coin-bb.js` | ARB | `cbb` | `coinbb` |
| coin-tc | `StrategyBacktester/bb-trail` (T-CORE paper lab) | `patches/coin-tc.js` | SUI, ARB | `ctc` | `cointc` |

Both get `patches/lab.js`: SUI_USDT and ARB_USDT added to the copy's allowlist, the dashboard tag, Telegram disabled in the code,
and a paper config ($100 start, the bot's own risk steps, realistic paper costs, nothing sent to the ledger).
The strategy code is unchanged. The originals are only read.

## Checks (Nov 12, 2026)
- Replay parity: coin-bb ARB 161 trades +36.27R, coin-tc SUI 68 trades +44.05R and ARB 77 trades +49.04R. IDENTICAL trade-for-trade with the backtest.
- `node coin-lab-bots/test/run-original-suites.js`: every failure that happens only in the lab copies is by design. The allowlist is wider
  (coins-test, one selftest check), live is locked off (ops-test), Telegram is off (telegram-test), and the tag is new (dashboard-test, dashboard-tag-test).
  The news lab copies show the same failures for the same reasons.

## Commands
```
node coin-lab-bots/build.js                      # regenerate out/coin-bb, out/coin-tc from fresh copies
node coin-lab-bots/test/run-original-suites.js   # each original's own tests vs a temp copy of the original
node coin-lab-bots/make-deploy.js                # (re)derive the two .service files from the news lab's
bash coin-lab-bots/build-coin-lab.sh             # build + parity + dist/coinlab.tar.gz + COIN-LAB-INSTALL.md
```
Edit `patches/`, never `out/` (generated). Install on the VPS: `COIN-LAB-INSTALL.md`, after the ledger is deployed with
tags cbb/ctc and the database migration `20261212000000_bot_events_sui_arb.sql` (SUI_USDT, ARB_USDT) has been applied.
