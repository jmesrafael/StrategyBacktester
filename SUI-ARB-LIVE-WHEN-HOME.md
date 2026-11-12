# SUI + ARB on the live bots: steps for home (prepared Nov 12, 2026)

**Decision (owner, Nov 12, 2026):** BB-CORE gets **ARB**, T-CORE gets **SUI + ARB**, I-CORE stays as it is. Live, same rules, same 2.5% risk per trade, no paper period first.
**Why:** ledger report `/reports/sui-arb-live.html` ("SUI and ARB Join the Live Bots"). On the TRI-CORE account from Jun 2023 to Nov 2026 the change lifts +277.6R to +319.7R with the same worst drop (20.5R to 20.3R). Study: `research/coin-walkforward/` (SUI-ARB.md, MONTHLY.md).

## Final line-up (owner, Nov 12, 2026): same 2.5% risk per trade for every coin, no special size for any coin

| Bot | Coins | Change |
|---|---|---|
| BB-CORE (`lucidio`) | SOL · NEAR · ADA · GALA · **ARB** | + ARB |
| I-CORE (`icore`) | SOL · NEAR · ADA · GALA | none, do not touch |
| T-CORE (`tcore`) | SOL · NEAR · ADA · GALA · ETH · **SUI** · **ARB** | + SUI + ARB |

Backtest of this line-up, 2020 → Nov 2026 (candle library): BB-CORE +476R → +511R (worst drop 26.5R both), T-CORE +722R → +807R (34.7R → 35.5R), TRI account +535R → +574R (16.5R → 17.1R), every year positive. 2026 alone: account +63R → +85R. Details: `research/long-history/SETUP-7Y.md`.

## What is already done (on the work PC, Nov 12; committed and pushed to `main`)

| Piece | State |
|---|---|
| BB-CORE code (`bb-core` repo) | ARB added to the allowlist, the defaults, `bot-config.json`, the dashboard schema copy, the contract specs (1 contract = 1 ARB), the shadow recorder; tests pass (the 2 `review-test` failures were already there before this change) |
| T-CORE code (`StrategyBacktester/bb-trail`) | SUI + ARB added to the allowlist; the live build (`apply-tcore-live-patch.js`) now ships coins SOL, NEAR, ADA, GALA, ETH, SUI, ARB; `npm test` passes; the paper lab's own coin list (`bot-config.json`, bbtr) is unchanged |
| Dashboard (`ledger` repo) | Already accepts SUI_USDT / ARB_USDT (commit `3016531`). New report "SUI and ARB Join the Live Bots" + index entry pushed (Vercel deploys it) |
| **Database** | **NOT done.** Production still refuses SUI_USDT / ARB_USDT in `bot_events` (checked Nov 12). Step 1 below |
| VPS | Nothing touched |

**Nothing is pushed yet.** The three repos are committed on the work PC only (Nov 12). Before the VPS steps, on the work PC: `git push` in `D:	estingStratb-core`, `D:	estingStratledger` and `D:	estingStratStrategyBacktester` (ask Claude to do it with your OK). The ledger push deploys the new report on the site. Skip the push and the VPS pull has nothing to pull.

**Timing (both live bots restart for a few seconds):** candles close at 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00 UTC (08:00, 12:00, 16:00, 20:00, 00:00, 04:00 in the Philippines). Do steps 2 and 3 between **15 minutes after a close and 10 minutes before the next one**, for example 04:15-07:50 UTC (12:15-15:50 PH). The BB-CORE menu refuses inside 5 minutes before / 12 minutes after a close. Do the two bots one after the other, not together, so there is never a moment with both down.

**Order at home: Step 1 (database) → Step 2 (BB-CORE) → Step 3 (T-CORE).** If step 1 is skipped, the bots still trade the new coins but the dashboard rejects their events (no trade shown, no stats).

MEXC (public data, Nov 12): SUI_USDT and ARB_USDT are open for API trading, 1 contract = 1 coin, minimum 1 contract. 24h volume SUI ≈ $37M, ARB ≈ $15M (GALA, already traded, ≈ $1M).

## Rules for the session

- Do the steps in order. Step 1 must be done before either bot can trade a new coin, or the dashboard will reject the new coins' trades.
- Never touch I-CORE (`icore`), the paper bots or the recorder.
- Before you start, note every bot's start time (step 0) and compare at the end.

## Step 0: read-only checks (VPS)

```bash
systemctl is-active lucidio icore tcore bbtrail
for s in lucidio icore tcore bbtrail lucidio-1h lucidio-recorder; do echo "$s $(systemctl show $s -p ActiveEnterTimestamp --value)"; done
sudo cat /opt/lucidio/bot-config.json | grep -A8 '"coins"'      # BB-CORE today: SOL, NEAR, ADA, GALA
sudo cat /opt/tcore/bot-config.json   | grep -A9 '"coins"'      # T-CORE today: SOL, NEAR, ADA, GALA, ETH (or still ZEC if the ETH build was never installed)
```
If a live bot is not `active`, stop and fix that first.

## Step 1: database (Supabase project "Backtester")

Run the file `ledger/supabase/migrations/20261212000000_bot_events_sui_arb.sql` (SQL editor, or ask Claude to apply it with your OK). It only widens the allowed-symbol check; nothing is deleted. Check:
```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'bot_events_symbol_check';
-- must list ... 'ETH_USDT', 'SUI_USDT', 'ARB_USDT'
```
Undo (only while no SUI/ARB row is stored): `ledger/supabase/rollback/20261212000000_rollback_bot_events_sui_arb.sql`.

## Step 2: BB-CORE + ARB

1. **PC:** the `bb-core` commit (`bf8cd79`, "ARB joins the traded coins") must be pushed to GitHub (see the top of this file).
2. **VPS:** back up and pull the update the usual way: `bb-core/VPS-UPDATE-GUIDE.md` §3c (backup), §3d (type `lucidio`, menu, **Pull changes from GitHub**, read the file list, answer `y`), §3e (health check). Expect these files in the list: `config.js`, `bot-config.json`, `dashboard/lib/schema.js`, `live-review.js`, `sidecar/shadow-recorder.js`, `deploy/lucidio-shadow.service` and the two test files. If the VPS has not pulled since Nov 12 05:54 it also brings the earlier ETH commits (`7de2c2a`, `77bb3d8`): that is fine, ETH stays off on BB-CORE. `lucidio-core.js` must NOT be in the list (the strategy file is untouched). The pull runs the safety tests and rolls back by itself if the bot does not come back. An update never overwrites the VPS's own `bot-config.json`, so ARB is still off until 2.3.
3. **VPS: switch ARB on** (the bot re-reads its settings every run, no restart needed):
   ```bash
   sudo -u lucidio node -e 'const c=require("/opt/lucidio/config.js");const v=c.validate({coins:["SOL","NEAR","ADA","GALA","ARB"]});if(!v.ok){console.error(v.errors);process.exit(1)}c.save(v.next);console.log("saved:",v.next.riskPct,v.next.coins.join())'
   ```
   It must print `saved: … SOL,NEAR,ADA,GALA,ARB`. An error that ARB is not allowed means the VPS still has the old code: redo 2.2. (ARB can also be ticked in the dashboard's Settings panel.)
4. **Shadow recorder** (if installed): copy the updated `deploy/lucidio-shadow.service` (it now records SOL, ETH, NEAR, ADA, GALA, ARB) and restart only that service, see the guide §4.
5. Check at the next 4h candle: `bb-core/VPS-UPDATE-GUIDE.md` §3f. The heartbeat on the dashboard should list ARB among the enabled coins.

## Step 3: T-CORE + SUI + ARB

1. **PC:** `git pull` in `StrategyBacktester` first (commit `e3fcfa6` has the change), then build the live bundle (Git Bash):
   ```bash
   cd StrategyBacktester/bb-trail && npm test && bash build-tcore-live.sh
   ```
   Note the printed SHA-256. `dist/` is not in git, so build it on the PC you deploy from.
2. **Copy and unpack** (same as `TCORE-LIVE-GO.md` step 2):
   ```bash
   scp dist/tcore-live.tar.gz dist/tcore-live.tar.gz.sha256 admin@193.181.221.91:/tmp/
   ssh admin@193.181.221.91
   cd /tmp && sha256sum -c tcore-live.tar.gz.sha256 && rm -rf /tmp/tcore && mkdir /tmp/tcore && tar -xzf tcore-live.tar.gz -C /tmp/tcore
   ```
3. **Compare the settings before installing** (the installer replaces `/opt/tcore/bot-config.json` with the bundle's):
   ```bash
   sudo diff /opt/tcore/bot-config.json /tmp/tcore/bot-config.json
   ```
   Only the coin lines may differ (`"SUI"`, `"ARB"` added; maybe `"ETH"` for `"ZEC"`). If risk, halt or cap lines differ, someone changed them on the VPS: stop and decide which values to keep first.
4. **Install** (keeps state, journal, keys; restarts T-CORE only if it was running):
   ```bash
   sudo bash /tmp/tcore/deploy-tcore/install-tcore-live.sh
   ```
   Expect: `was running: restarted on the new code`, `other bots' start times unchanged: YES`, and pre-flight rows `SUI contract` / `ARB contract` with `state 0 · API trading allowed`, plus `SUI sizing` / `ARB sizing` OK.
5. `sudo bash /opt/tcore/deploy-tcore/status.sh check`: account, hedge mode, balance, open positions as before, "LIVE enabled".

## Step 4: after both

- Compare the start times with step 0: only `tcore` restarted (and `lucidio` only if the pull guide says it does).
- Dashboard: hard refresh (R). BB-CORE's and T-CORE's heartbeats list the new coins. No "rejected" lines: `sudo journalctl -u tcore -n 80 --no-pager | grep -i reject` (and the same for `lucidio`).
- The first SUI/ARB trade may take days or weeks (about 2 trades a month per coin on T-CORE, about 4 a month for ARB on BB-CORE).

## What to watch, and when to switch a coin off

From the backtest, each coin alone (full detail on page 6 of the report):

| Coin on bot | Trades a month | Win rate | Worst drop | Longest losing streak | Look again if its own drop passes |
|---|---|---|---|---|---|
| SUI on T-CORE | 1.7 | 22% | 8.4R | 8 | 11R |
| ARB on T-CORE | 1.8 | 23% | 12.0R | 8 | 16R |
| ARB on BB-CORE | 3.7 | 36% | 17.5R | 12 | 22R |

Switching a coin off = take it out of `coins` (the commands below). It stays in the allowlist, so a trade already open is finished normally; no new entries.

## Rollback

- **BB-CORE without ARB:** `sudo -u lucidio node -e 'const c=require("/opt/lucidio/config.js");const v=c.validate({coins:["SOL","NEAR","ADA","GALA"]});if(!v.ok){console.error(v.errors);process.exit(1)}c.save(v.next);console.log("saved:",v.next.coins.join())'`
- **T-CORE without SUI and ARB** (its config is root-owned, it re-reads it every run): `sudo node -e 'const c=require("/opt/tcore/config.js");const v=c.validate({coins:["SOL","NEAR","ADA","GALA","ETH"]});if(!v.ok){console.error(v.errors);process.exit(1)}c.save(v.next);console.log("saved:",v.next.coins.join())'`

## Not needed any more?

The paper **coin lab** bots (`cbb` = BB-CORE on ARB, `ctc` = T-CORE on SUI + ARB, `coin-lab-bots/COIN-LAB-INSTALL.md`) were built the same day to test these coins on paper first. With the coins going live they would only repeat the live trades. Owner's call: skip their install, or run them anyway as a no-cost comparison.
