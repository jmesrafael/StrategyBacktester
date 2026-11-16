# backup: snapshots and restore

One file: `backup.js`. Full guide with restore steps: [BACKUP-AND-RESTORE.md](../BACKUP-AND-RESTORE.md).

## What it does

It makes versioned snapshots of everything intel owns. A snapshot runs on a machine that has only Node.js, because it contains the code.

## Inputs

The `intel` code folders (`lib`, `ingest`, `integrity`, `backup`, `engines`, `test`, `strategies`), top-level `.md/.json/.js/.csv` files, `inputs`, `data`, `reports`, and the candle library helper files. Optional: candle files (`--with-candles`) and recorder data (`--with-recorder`). Never `secrets.local.json` and never the `backups` folder.

## Outputs

`backups\<UTC time>\` holding all files plus `SNAPSHOT.json` (SHA-256 and size of every file). If config `backupCopyTo` is set, a full copy goes to `<backupCopyTo>\<id>\`.

## How to run

```
node run.js snapshot [--with-candles] [--with-recorder]
node backup/backup.js snapshot [--with-candles] [--with-recorder]
node backup/backup.js list
node backup/backup.js verify <snapshot folder>
node backup/backup.js restore <snapshot folder> <target folder>
```

## Method in plain words

- `snapshot`: hash every file. If the previous snapshot has the same hash for the same path, make a hard link. Else copy. Write `SNAPSHOT.json`.
- `verify`: re-hash every file listed in `SNAPSHOT.json`. Report `missing:` and `changed:` files.
- `restore`: verify first. Stop if damaged. Stop if the target folder is not empty. Copy every file, copy `SNAPSHOT.json`, verify the target.

## Tests

| File | Covers |
|---|---|
| `test\backup.test.js` | `verify` and `restore` on small fake snapshots |

`snapshot` and `plan` have no test.

## Limits

- Hard links only work on the same disk. Otherwise files are copied and the snapshot is larger.
- The folder `strategies` is listed in the code but does not exist in `intel`. It is skipped.
