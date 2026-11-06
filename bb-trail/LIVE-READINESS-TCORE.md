# T-CORE: path from paper to live (plan only, nothing here enables live)

Written Nov 6, 2026. T-CORE is the third bot of TRI-CORE (BB-CORE + I-CORE + T-CORE, 50/25/25). It is built from this folder (`bb-trail/`, bot tag `bbtr`). **Today it is paper only and live trading is locked off in four places.** This file lists what must be true before that changes. Following it does not by itself send an order.

## Where it stands

| Item | State (Nov 6, 2026) |
|---|---|
| Bot code, paper lab | built, `npm test` 41 passed, 0 failed |
| Dashboard support (`ledger/`, bot `bbtr`) | edited, **uncommitted**, not deployed |
| VPS install (`VPS-TRAIL-INSTALL.md`) | built; install not confirmed (see HANDOFF-HOME.md) |
| Paper results | none yet |

## The strategy in numbers (own backtest, 2020 to Nov 2026, real costs)

613 trades, +788R, 21% winners, +1.29R a trade, worst drop 29.7R, longest losing streak 26, about 7.7 trades a month. The median trade loses 1R; the profit comes from a few long runs (best +217R).

## Why live needs a real review, not just a switch

1. **Drawdown is past the review line.** The live review line used for BB-CORE is -26R. T-CORE's own backtest drop is 29.7R. At TRI-CORE's 25% share the portfolio drop is smaller (the mix is -28.0% against -30.6% for the live pair), but T-CORE alone will feel worse than BB-CORE.
2. **Few trades.** About 7.7 trades a month. 100 trades (the usual "trust it" mark) takes about 13 months of paper. The 4 December review will have roughly 8 trades, which cannot confirm profit. It can only confirm that the machinery works.
3. **A long losing streak is normal.** 26 in a row happened in the backtest. 79% of trades lose. If this surprises you live, you will switch it off at the worst time.
4. **The mix was picked after seeing the data** (the blind test chose a different bot). Paper is the only clean evidence.

## Gates before live (proposed: you decide the numbers)

| # | Gate | How to check |
|---|---|---|
| 1 | Paper machinery clean | no errors in `status.sh`, daily comparison matches its own backtest trade for trade (`status.sh compare`), dashboard shows the lab |
| 2 | Costs are real | lab report: fills, fees, funding and slippage match the backtest's assumptions or are worse by a known amount, and the result still holds with the worse costs |
| 3 | Trend capture behaves | dashboard Research page: how many trades reach +3R, +5R, +10R and how much the trail gives back, against the backtest's rates |
| 4 | Enough trades | proposal: at least 30 closed paper trades (about 4 months) for a first small live size; 100 for full size |
| 5 | Risk review done | decide the starting risk and the halt rule for T-CORE alone (config has halt at 45R below the best point), given the 29.7R backtest drop |
| 6 | Own account | T-CORE should have its own MEXC account and API key (the same reason BB-CORE and I-CORE are separate: positions, margin and the halt rule must not mix). New key: trade permission only, no withdrawal, IP-restricted to the VPS |
| 7 | Tests | `npm test` in `bb-trail/` and in `ledger/` pass |

## What changes in code at go-live (do it only after the gates, as a separate task)

The bot is generated from `../i-core` by `apply-trail-patch.js`, so the live code path is I-CORE's, already proven. The lock is deliberately in four places:

1. `apply-trail-patch.js` line 13: replaces `liveAllowed` with `() => false`. Live version: keep I-CORE's original line (`--allow-live` or `ICORE_ALLOW_LIVE=1`).
2. `build-trail-bundle.sh` line 15 and `deploy-trail/install-trail-paper.sh` line 32: both refuse a build without the lock. A live installer is a new script, not an edit of the paper one.
3. `test/ops-test.js` (line 47-48) and `test/trail-lab-test.js` (line 16): assert that live is locked. They must be rewritten for the live build.
4. `bot-config.json`: `"mode": "paper"` becomes `"live"`, plus a key file, which the paper installer refuses.

Safest route: keep the paper lab running as it is, and build a separate live copy (own user, own `/opt` folder, own state and key) so the paper record is never disturbed. The live bot must report to the dashboard as its own mode, and the first live trades should be at the smallest risk step.

## Order of work

1. Now: deploy the dashboard, install the paper lab (HANDOFF-HOME.md). Needs your yes for each outward step.
2. Dec 4 review: machinery, costs, first trend-capture numbers.
3. About 30 trades: decide on a small live size or keep waiting.
4. Live copy built, tested, installed with a fresh key, at the smallest risk step.
5. Review again at 100 trades before moving to the normal 25% share.
