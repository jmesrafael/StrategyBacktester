# Backup and restore

Code: `backup\backup.js`. Tests: `test\backup.test.js`. Short folder guide: [backup\README.md](backup/README.md).

## What a snapshot contains

A snapshot is a complete folder `backups\<UTC time>\`, for example `backups\2026-11-16T05-06-47Z\`. It has a file `SNAPSHOT.json` that lists every file with its SHA-256 and size.

| Included | Path inside the snapshot |
|---|---|
| Code folders `lib`, `ingest`, `integrity`, `backup`, `engines`, `test`, `strategies` (a folder that does not exist is skipped) | `intel\<folder>\...` |
| Top-level files of `intel` ending in `.md`, `.json`, `.js`, `.csv` (this includes `run.js` and `config.json`) | `intel\<file>` |
| Inputs: database exports, owner tags | `intel\inputs\...` |
| Every dataset | `intel\data\...` |
| Reports | `intel\reports\...` |
| Candle library helper files: `candles.js`, `update.js`, `coins.json`, `README.md` | `candles\...` |

Only with a flag:

| Flag | Adds |
|---|---|
| `--with-candles` | the 1h, 4h and funding candle files (`candles\binance-futures\1h`, `4h`, `funding`) |
| `--with-recorder` | the recorder data folder (config key `recorderData`), if it exists |

`SNAPSHOT.json` keys: `id`, `created_at`, `previous`, `with_candles`, `with_recorder`, `file_count`, `bytes`, `linked_from_previous`, `copied`, `files`.

## What is deliberately not backed up

- `secrets.local.json`. Never copied. Keep your keys somewhere safe yourself.
- The `backups` folder itself.
- The 1m candles. They are never included, even with `--with-candles`.
- The candle library (about 300 MB) unless you pass `--with-candles`. It can be downloaded again from Binance with `candles\update.js`. See `..\candles\README.md`.
- The recorder data, unless you pass `--with-recorder`. It lives on the VPS and is pulled by `lucidio-recorder\pull-recorder-data.cmd`. It is a separate copy.
- The `crypto-news` repo. The headline archive (`data\headlines`) keeps what was read from it, and is backed up.

## Commands

Run in the `intel` folder.

| Command | What it does |
|---|---|
| `node run.js snapshot` | make a snapshot |
| `node run.js snapshot --with-candles --with-recorder` | make a snapshot with the optional parts |
| `node backup\backup.js snapshot [--with-candles] [--with-recorder]` | same, direct |
| `node backup\backup.js list` | list snapshots, oldest first (`no snapshots yet` if none) |
| `node backup\backup.js verify <snapshot folder>` | re-hash every file against `SNAPSHOT.json`. Exit code 1 if any file is missing or changed. |
| `node backup\backup.js restore <snapshot folder> <target folder>` | copy a snapshot into an empty folder and verify it |

The snapshot command prints: id, file count, size, how many files were copied and how many were linked.

## Incremental behaviour (hard links)

- The new snapshot is compared with the previous one (the last in `list`).
- A file with the same SHA-256 is hard-linked, not copied. A hard link is a second name for the same bytes on disk.
- A changed or new file is copied.
- If a hard link is not possible (another disk, or a file system without links), the file is copied.
- Each snapshot is still a complete folder. You can delete an old snapshot without damaging a newer one.
- Daily snapshots cost almost no disk. Mostly the `data` and `reports` files that changed are new.

## Optional second copy

Set `backupCopyTo` in `config.json` to a folder, for example a cloud-synced folder or an external drive. The path is relative to `intel` or absolute. After each snapshot, the whole snapshot folder is copied to `<backupCopyTo>\<id>\`. The copy is a full copy (no links). The default is `null` (no second copy). The snapshot message says `no second copy configured (config.backupCopyTo)` when it is off.

## Restore on a different computer

You need only Node.js 20 or newer. No npm packages. The snapshot carries its own code.

1. Install Node.js 20 or newer.
2. Copy one snapshot folder to the new computer (from the second copy or a drive). Example: `E:\backups\2026-11-16T05-06-47Z`.
3. Check it. Run the backup code that is inside the snapshot:
   `node E:\backups\2026-11-16T05-06-47Z\intel\backup\backup.js verify E:\backups\2026-11-16T05-06-47Z`
   Expect `snapshot verified: every file matches`.
4. Restore into a new empty folder (it must be empty or not exist):
   `node E:\backups\2026-11-16T05-06-47Z\intel\backup\backup.js restore E:\backups\2026-11-16T05-06-47Z D:\strat-restore`
   Expect `restored N files to D:\strat-restore and verified them`.
5. The target now holds `intel\` and `candles\` side by side. This matches the paths in `config.json` (`candleLibrary` is `../candles`).
6. Candles: if the snapshot was made without `--with-candles`, download them. Use `D:\strat-restore\candles\update.js` (see `D:\strat-restore\candles\README.md`). This needs network.
7. Optional inputs the system reads from outside the snapshot: the `crypto-news` repo and the recorder data. Their paths are in `config.json` (`pulseBriefs`, `pulseEvents`, `recorderData`). Without them, the headlines step fails on `source folder found` and the recorder step is `blocked`. The stored datasets remain.
8. Put your keys back (`INTEL_SUPABASE_URL`, `INTEL_SUPABASE_KEY` in the environment or in a new `secrets.local.json`), if you use the live trade download.

If the snapshot is damaged, `restore` stops before copying and lists up to 5 faults. If the target is not empty, it stops with `target folder is not empty`.

## Verify the restore

In `D:\strat-restore\intel`:

1. `node run.js status` shows every dataset with `ok` and no `FAULT(S) on disk`. The `mexc` dataset may show `failed` if the recorder data was never pulled. That is normal.
2. `node run.js test` runs the test suite. The parity tests are skipped when the bot repos or the candle library are missing (`test\backtest-parity.test.js`). A test that needs data not in the snapshot may fail until the candles are downloaded. Run the tests again after step 6.
3. After the candle library is present: `node run.js all`, then read `reports\INDEX.md`.
