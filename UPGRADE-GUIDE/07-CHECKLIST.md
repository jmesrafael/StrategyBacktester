# Checklist

Tick as you go. 🤖 = I tick it and tell you · 🧑 = you · ⛔ = needs your explicit "go". Details: `03-STEPS.md`.

## Before anything
- [ ] 🧑 Read `00-START-HERE.md` and `01-WHO-DOES-WHAT.md`
- [ ] 🧑 Answered `02-DECISIONS.md`: D1 ___ D2 ___ D3 ___ D4 ___ D5 ___ D6 ___

## Phase 1: PC
- [ ] 🤖 Step 2: all tests pass (1117+), both replays IDENTICAL
- [ ] 🧑 Step 3: read the summary of what will be pushed
- [x] ⛔ Step 4: committed and pushed on Oct 29 (`bb-core` c4192df, `i-core` fd9f232, `ledger` branch 461cb59, `StrategyBacktester`). At home: pull them (see `00-START-HERE.md`)
- [ ] 🤖 Step 5: both bundles built, secrets check 0 matches, checksums written

## Phase 2: look at the VPS
- [ ] 🧑 Step 6: access given (or Option B chosen)
- [ ] 🤖 Step 7: real state of both bots read and shown to you (I-Core's real risk: ______ )
- [ ] 🧑 Step 8: MEXC app matches (both accounts, TP/SL present, no stray orders)
- [ ] 🤝 Step 9: window chosen: ____________ (UTC) / ____________ (PH)

## Phase 3: pin the risk
- [ ] 🤖 Step 10: BB-Core config backed up, `riskTiers: []` pinned
- [ ] 🤖 Step 11: I-Core config backed up, `riskTiers: []` pinned

## Phase 4: BB-Core
- [ ] 🤖 Step 12: `upgrade-ready.sh --keep-open` says READY (keep open)
- [ ] 🤖 Step 13: bundle copied, checksum OK
- [ ] 🤖 Step 14: state backup done, preflight says GO
- [ ] 🧑 Step 15: stops/targets in the MEXC app match the preflight
- [ ] ⛔ Step 16: installed
- [ ] 🤖 Step 17: service active, same open trades in `status`, no errors
- [ ] 🧑 Step 18: MEXC app still shows TP/SL

## Phase 5: watch
- [ ] 🤖 Step 19: first run after the next close is clean (`lagSec` small, `errors []`)
- [ ] 🤖 Step 20: next day's compare says match

## Phase 6: I-Core
- [ ] 🤖 Steps 21-22: bundle copied, backup done, preflight GO
- [ ] 🧑 Step 23: MEXC sub-account stops match
- [ ] ⛔ Step 24: installed
- [ ] 🤖 Step 25: checked now and after the next close

## Phase 7: new risk (⛔, a different day)
- [ ] ⛔ Step 26: risk steps and cap applied as decided (BB-Core ___ I-Core ___)
- [ ] 🤖 Step 27: first new trade sized correctly, Telegram says `Target none`

## Phase 8: dashboard
- [ ] ⛔ Step 28: `ledger` pushed
- [ ] 🤖🧑 Step 29: Vercel live, `/api/health` ok, dashboard looks right
- [ ] 🤖 Step 30: Supabase read-only check

## Phase 9: close out
- [ ] 🤖 Step 31: `RUN-LOG.md` and `PENDING-UPGRADE.md` updated, new measurement window date written
- [ ] 🧑 Step 32: my SSH key and the sudo rule removed from the VPS
- [ ] 🤖 Step 33: bundles and backups kept for one month

New measurement window starts on: ______________
