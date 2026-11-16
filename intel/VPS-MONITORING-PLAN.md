# Plan: monitoring profit and loss catalysts on the VPS (do this when home)

Status: PLAN ONLY. Nothing is installed on the VPS. Written 2026-11-16. Overview and charts: admin report "Intelligence System" (`ledger/reports/intel-system.html`).

## Goal
Watch for catalysts all day (price shocks, scheduled releases, headlines, our own tags) and record what they do to our trades, without touching the bots.

## What the VPS can carry
| Item | VPS (project notes) | Full intel system, measured on the work PC |
|---|---|---|
| Memory | 1.6 GB, shared with the bots | 853 MB peak for `node run.js reports`; 327 MB for ingest |
| Disk | 15 GB, shared with the recorder | 20 MB data + 296 MB candles (1h, 4h, funding) + code |
| CPU | 1 vCPU | 10 s (reports), 17 s (all) |
| Packages | Node.js (the bots run on it) | none |

The full system is too heavy for the VPS next to the bots. It stays on the home PC.

## Options
| Option | What runs on the VPS | Risk | Advice |
|---|---|---|---|
| A. Record only | Nothing new. The recorder records. We pull its data home and run `node run.js all` there. | None | Do first |
| B. Light catalyst watcher | A new small service, hourly: fetch BTC 1h candles from the public Binance API (about 800 bars), run the shock detector (`detectShocks` in `engines/events/index.js`), append events to a JSON-lines file, write one daily line "what moved, what our bots did". About 150 MB memory cap, low priority, its own Linux user, no keys. | Low (separate service) | Next, if A works |
| C. Full system on the VPS | `node run.js all` | 853 MB peak on a 1.6 GB machine that runs the bots | Not advised |

Option B is NOT written yet. It needs: the detector extracted into a dependency-free file, a test, an installer that refuses code mentioning a key or a private endpoint (same pattern as `lucidio-recorder/deploy/install-recorder.sh`), and one install file with a checksum.

## Steps when home
1. Pull the recorder data to the home PC: `lucidio-recorder\pull-recorder-data.cmd YOUR-VPS`. Then `node run.js all` in `intel/`. The `recorder` step should turn ok. This also fills the order-book capacity numbers.
2. On the VPS run the recorder's `status.sh` and note free memory and disk.
3. Choose A or B. For B, Claude builds `vps-catalyst-watch` and tests it on the work PC first.
4. Install B with the same pattern as the other installs (install file, checksum, own user, memory cap, low CPU priority).
5. Verify: "live bots' start times unchanged: YES"; the service is active; the first event line appears; the home PC pulls the events file and `node run.js all` ingests it (a new ingest step is needed for this).
6. Rollback: stop and disable the service, delete its folder. Bots and recorder are not part of it.

## Safety rules for any VPS step
- No bot service, config or key file is touched.
- Public endpoints only. Read-only. No exchange keys, no database key.
- Each outward step needs the owner's go-ahead.
- Alerts are information only. They never change a trade. Where alerts go (a file, or a new Telegram bot) is the owner's choice.

## Also useful before the VPS step
- Create a read-only Supabase key (`INTEL_SUPABASE_URL`, `INTEL_SUPABASE_KEY`) so the trade record refreshes by itself.
- Commit `intel/` to git. Set `backupCopyTo` in `intel/config.json`.
