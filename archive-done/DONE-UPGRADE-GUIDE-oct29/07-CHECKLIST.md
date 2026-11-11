# Checklist

Tick as you go. 🤖 = I tick it and tell you · 🧑 = you · ⛔ = needs your explicit "go". Details: `03-STEPS.md`.

## Parked items (do not forget)
- [x] ⛔ **Step 20b (DONE Oct 29: cherry-picked as `6cf9564` because the branch could not fast-forward): merge the `ledger` branch `bb-core-no-target-dashboard` to `main`** (after BB-Core's first clean candle and a matching compare; not before). Branch commit `9d3b0f8`.
- [ ] 🧑 In Vercel: Production Branch = `main` confirmed for the ledger project

## Before anything
- [x] 🧑 Read `00-START-HERE.md` and `01-WHO-DOES-WHAT.md`
- [x] 🧑 Answered `02-DECISIONS.md`: D1 yes, D2 A (both bots), D3 $500 (both), D4 Oct 29 11:00 UTC, D5 A, D6 leave

## Phase 1: PC
- [x] 🤖 Step 2: all tests pass (1117+), both replays IDENTICAL
- [x] 🧑 Step 3: read the summary of what will be pushed
- [x] ⛔ Step 4: committed and pushed on Oct 29 (`bb-core` c4192df, `i-core` fd9f232, `ledger` branch 9d3b0f8, `StrategyBacktester`). At home: pull them (see `00-START-HERE.md`)
- [x] 🤖 Step 5: both bundles built, secrets check 0 matches, checksums written

## Phase 2: look at the VPS
- [x] 🧑 Step 6: access given (or Option B chosen)
- [x] 🤖 Step 7: real state of both bots read and shown to you (I-Core's real risk: ______ )
- [x] 🧑 Step 8: MEXC app matches (both accounts, TP/SL present, no stray orders)
- [x] 🤝 Step 9: window chosen: 11:02 UTC BB-Core, 11:05 UTC I-Core, 12:16 UTC fix (19:02 / 19:05 / 20:16 PH)

## Phase 3: pin the risk
- [x] 🤖 Step 10: BB-Core config backed up, `riskTiers: []` pinned
- [x] 🤖 Step 11: I-Core config backed up, `riskTiers: []` pinned

## Phase 4: BB-Core
- [x] 🤖 Step 12: `upgrade-ready.sh --keep-open` says READY (keep open)
- [x] 🤖 Step 13: bundle copied, checksum OK
- [x] 🤖 Step 14: state backup done, preflight says GO
- [x] 🧑 Step 15: stops/targets in the MEXC app match the preflight
- [x] ⛔ Step 16: installed
- [x] 🤖 Step 17: service active, same open trades in `status`, no errors
- [x] 🧑 Step 18: MEXC app still shows TP/SL

## Phase 5: watch
- [x] 🤖 Step 19: first run after the next close is clean (`lagSec` small, `errors []`)
- [ ] 🤖 Step 20: next day's compare says match

- [x] ⛔ **Step 20b: merge the ledger branch to `main`** (done Oct 29, `6cf9564`) (see Parked items above)

## Phase 6: I-Core
- [x] 🤖 Steps 21-22: bundle copied, backup done, preflight GO
- [x] 🧑 Step 23: MEXC sub-account stops match
- [x] ⛔ Step 24: installed
- [x] 🤖 Step 25: checked now and after the next close

## Phase 7: new risk (⛔, a different day)
- [x] ⛔ Step 26: risk steps and cap applied as decided (DONE Oct 29 12:19 UTC: both bots 2.5/2/1.5% steps, $500 cap)
- [ ] 🤖 Step 27: first new trade sized correctly, Telegram says `Target none`

## Phase 8: dashboard
- [ ] ⛔ Step 28: only if step 20b was skipped: `ledger` branch merged to `main`
- [ ] 🤖🧑 Step 29: Vercel live, `/api/health` ok, dashboard looks right
- [ ] 🤖 Step 30: Supabase read-only check

## Phase 9: close out
- [x] 🤖 Step 31: `RUN-LOG.md` and `PENDING-UPGRADE.md` updated, new measurement window date written
- [ ] 🧑 Step 32: my SSH key and the sudo rule removed from the VPS
- [x] 🤖 Step 33: bundles and backups kept for one month

New measurement window starts on: Oct 29, 2026 (BB-Core installed 11:02 UTC)
