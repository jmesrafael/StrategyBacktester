# Manual actions log, Nov 17-18, 2026 (for records)

Purpose: mark which live results are NOT the pure system, so strategy numbers are read correctly later. Times UTC (Manila = UTC+8). Written Nov 17 23:50 UTC from the ledger (project vkfetsmnlylcsbwxcord) and the owner's statements.

## 1. BB-Core time-exit extensions (owner, via dashboard commands)

| When | Action | Trades | Source |
|---|---|---|---|
| Nov 17 08:26-08:28 | `extend_hold` add 2 days | SOL, ADA, ZEC, NEAR, GALA | bot_events `cmd_done` |
| Nov 17 08:28 | `extend_hold` add 1 day | ARB | bot_events `cmd_done` |
| Nov 17 23:38 | `extend_hold` set 0 (cleared) | ADA, NEAR, GALA, ARB | bot_events `cmd_done`; rows were inserted by Claude straight into bot_events (same format as the dashboard button) on the owner's instruction |

Original time exits (restored): ADA Sat Nov 21 08:00, NEAR and GALA Sat Nov 21 20:00, ARB Sun Nov 22 00:00. Confirmed in the 23:39 heartbeat (`extra_bars: 0`, `limit_bars: 42`). Stops were never touched.
Effect of the extensions on outcomes: none, except that SOL (extended from Thu Nov 19 to Mon Nov 23) was then closed by hand (section 2). ZEC's exit record carries `ext_bars: 12` but it was stopped out normally.

## 2. Manually closed or stopped BB-Core trades

| Trade | Closed (UTC) | How | Result | Ledger row |
|---|---|---|---|---|
| SOL short, entry 86.48, exit 75.14 | Nov 17 23:28 | **Closed by hand on MEXC (owner)**, before its extended exit (Nov 23) and original exit (Nov 19). Bot logged `exchange_tp_or_manual` | +$18.0163, +3.55R (fees -0.13, funding +0.01) | closed_trades id 24 |
| ZEC short, entry 903.84, exit 971.13 | Nov 17 23:12 | NOT manual: normal stop, closed by the MEXC trigger (`mexc_trigger`) | -$6.14, -1.03R | closed_trades id 23 |

Read SOL as a discretionary result, not a system result. Everything BB-Core after Nov 17 23:38 is the pure system again.

## 3. I-Core SOL short left in the T-Core MEXC account

- Owner's account of events: I-Core was moved to a new MEXC account and the T-Core bot took over the old I-Core account; an I-Core position stayed open there.
- Ledger evidence: I-Core wallet equity fell 50 -> 0.09 on Nov 2 ~11:20 (new account); T-Core's first report (Nov 7 03:31) already had 1 open position at +3.86 unrealized. Best match: the I-Core SOL short from Oct 29 (entry 99.79, 4 contracts = 0.4 SOL, SL 103.41), about +$10.8 unrealized at SOL 72.8. Not ZEC.
- T-Core wallet shows 8 open positions while the T-Core bot owns only 7 (NEAR, ZEC, SUI, ADA, ETH, GALA, ARB), so T-Core live unrealized and equity include this trade.
- Owner thinks it is already sold (statement, Nov 18). **Not confirmed in the ledger:** the T-Core snapshot at Nov 17 23:45 UTC still shows 8 open. Check the next snapshots: if the count drops to 7 and T-Core equity steps up by about the position's profit, that confirms it. Any close of this trade belongs to I-Core's old SOL trade, not to T-Core.
- The event-watch table (2026-11-17-fomc-anthropic-week.md) lists I-CORE as SOL/ADA/GALA; the I-Core wallet's three open positions are actually ZEC short (1209.76), ADA and GALA.

## 4. Other facts for the record

- Nov 17 23:42: ledger confirmed all four clear commands collected; BB-Core open after the day: ADA, NEAR, GALA, ARB (4), T-CORE 8, I-CORE 3.
- Open unrealized at 23:30 UTC: BB-Core about +$0.8, T-CORE about +$33, I-Core about +$13.
