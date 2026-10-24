# Moving the already-running bot to the journal version

For a bot that is **already trading** on the VPS and was installed before the trade journal existed. The new version adds the append-only journal
(`journal/trades.jsonl`), the match key and the compare tooling. **It does not change trading**: `lucidio-core.js` (the decision engine), sizing, the 1% risk cap,
the 39R halt, the kill switch and the live gate are untouched, and a journal write that fails raises an alert but never stops the bot from managing a trade.

Every step says where it runs: **PC** (Git Bash or PowerShell) or **VPS** (SSH session). Nothing here touches Supabase.
Expect about 15 minutes, with the bot stopped for about 10 seconds.

## 0. What can go wrong, and what protects you

| Risk | Protection |
|---|---|
| Restarting while a position is open | step 3: you only continue when flat (the bot's stops/targets sit on MEXC anyway, but the journal would miss the entry) |
| Restarting at a candle close (a signal could be missed) | step 4: the preflight refuses inside 5 min before / 12 min after a close |
| A different decision engine sneaking in | the preflight compares `lucidio-core.js` of the running bot with the new bundle and says NO-GO if they differ |
| The new code does not start | step 7 `check`, and the bot's own crash guard; rollback in one command (step 9) |
| Losing state | step 2: state, journal and the old code are backed up first; the update never overwrites `state/`, `mexc-keys.json` or `bot-config.json` |

## 1. Build and ship the new bundle

**PC** (Git Bash, in the `🔴BB-Core` folder):

```bash
bash deploy/package.sh
```

It prints `OK: .../lucidio-deploy.tar.gz`, the file list and a clean secrets scan. If it prints FAIL, stop and read why.

**PC** (PowerShell, from the `🔴BB-Core` folder; replace `YOUR_IP` and `admin`):

```powershell
scp lucidio-deploy.tar.gz lucidio-deploy.tar.gz.sha256 admin@YOUR_IP:/tmp/
```

**VPS**:

```bash
cd /tmp && sha256sum -c lucidio-deploy.tar.gz.sha256          # must say: lucidio-deploy.tar.gz: OK
rm -rf /tmp/lucidio-new && mkdir /tmp/lucidio-new && tar -xzf lucidio-deploy.tar.gz -C /tmp/lucidio-new
cat /tmp/lucidio-new/lucidio/BUILD_INFO.json                  # the commit this bundle was built from
```

## 2. Back up: state, journal, the current code

**VPS**:

```bash
sudo systemctl start lucidio-backup.service                   # state + journal + compare reports + bot-config.json -> /var/backups/lucidio/state-<stamp>.tar.gz
sudo tar -czf /var/backups/lucidio/pre-journal-code.tar.gz -C /opt/lucidio --exclude=./state --exclude=./journal --exclude=./audit --exclude=./.env --exclude=./mexc-keys.json .
ls -lh /var/backups/lucidio | tail -5                         # both files are there, not empty
```

(`setup-vps.sh` also saves the old code as `code-<stamp>.tar.gz` by itself right before replacing it: that is the file the one-command rollback uses. `mexc-keys.json` and `.env` are deliberately not in any backup: they stay in one place.)

## 3. Confirm there is no open position

**VPS**:

```bash
sudo -u lucidio node /opt/lucidio/lucidio.js status
```

Read the output: no `OPEN LONG/SHORT` line and no `UNFINISHED ORDER` line for either coin. **In live mode also open MEXC**: Futures -> Positions must be empty and Open orders must be 0.
If a trade is open, wait for it to close (a trade ends at its stop or target, or at the latest by the time exit after 49 candles, about 8 days) and start again from step 2.

## 4. Go / no-go (read-only) and the candle window

Candles close at 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00 UTC. The bot decides within seconds of a close. Do the restart **between 15 minutes after a close and 10 minutes before the next one**.

**VPS**:

```bash
sudo bash /tmp/lucidio-new/lucidio/deploy/preflight-upgrade.sh
```

It must end with `GO`. It checks: flat (state file), the candle window, disk, that this really is the new bundle, and **that `lucidio-core.js` is byte-identical in the running bot and the new bundle**.
It also lists which code files differ. If it says NO-GO, fix what it names (usually: wait) and run it again.

## 5. Install (this restarts the bot)

**VPS**:

```bash
sudo bash /tmp/lucidio-new/lucidio/deploy/setup-vps.sh
```

It saves the old code to `/var/backups/lucidio/code-<stamp>.tar.gz`, stops the bot, copies the new code (never `state/`, `journal/`, `mexc-keys.json`, `.env`, `bot-config.json`),
reinstalls the systemd units and starts the bot again if it was running. The stop-to-start gap is a few seconds. Read any `WARN` lines it prints.

## 6. Run the check

**VPS**:

```bash
sudo -u lucidio node /opt/lucidio/lucidio.js check
sudo systemctl status lucidio --no-pager | head -8
sudo journalctl -u lucidio -n 30 --no-pager
```

`check` must show no `BAD` lines (it reports clock, API key, open positions, state, journal, live gate, Telegram, dashboard). The status must be `active (running)`, and the log must show the bot starting in the **same mode as before**
(`mode` is in `bot-config.json`; the update does not change it). If `check` shows a BAD line, go to step 9 (rollback) unless it is something you understand and can fix in a minute.

## 7. Verify the first candle

**Right after the restart**, the journal exists and has one line (a "session" record: the moment the journal started watching):

```bash
sudo tail -n 1 /opt/lucidio/journal/trades.jsonl | cut -c1-200
```

**About 2-3 minutes after the next 4-hour close**:

```bash
sudo tail -n 2 /opt/lucidio/state/runs.jsonl | cut -c1-300          # a new run: lagSec small (about 2-10), errors [] , both coins fetched
sudo -u lucidio node /opt/lucidio/lucidio.js status                  # "last candle" moved forward for both coins
sudo -u lucidio node /opt/lucidio/compare-live-vs-backtest.js --quiet; echo "exit=$?"
```

Expected: 0 (match) or 1 (an item to investigate, read `audit/out/compare-<date>.txt`). **2 means the comparison could not run**: read its message.
If the candle had a signal, the journal has an `entry` (or a `skip` with a reason) whose `trade_id` is `SYMBOL|SIDE|signal-candle-open-ms`; without a signal nothing is written. That is normal.
If the shadow recorder is installed as well (DEPLOY.md section 16), the same report joins its decisions on that key.

## 8. Do not do these

- Do not run the update inside the candle window "just this once".
- Do not edit `bot-config.json` as part of the update. The bundle's copy is a paper template and the server's copy is never overwritten.
- Do not delete `journal/`: it is append-only evidence. It is in the daily backup.

## 9. Rollback (one command)

**VPS**:

```bash
sudo bash /opt/lucidio/deploy/rollback.sh
```

It stops the bot, puts back the newest saved code (`code-<stamp>.tar.gz`, the code from right before this update), and starts the bot again. State and keys are never touched.
`sudo bash /opt/lucidio/deploy/rollback.sh --list` shows the saved versions; pass one as an argument to choose it.
Then check: `sudo -u lucidio node /opt/lucidio/lucidio.js status && sudo journalctl -u lucidio -n 20 --no-pager`.

What stays after a rollback: `journal/` (the old code ignores it), and `state/state.json` is compatible both ways. If you ever need the state of before the update:

```bash
sudo systemctl stop lucidio && sudo tar -xzf /var/backups/lucidio/state-<stamp>.tar.gz -C /opt/lucidio && sudo chown -R lucidio:lucidio /opt/lucidio && sudo systemctl start lucidio
```

## If the engine file differs

If the preflight says `lucidio-core.js DIFFERS`, the bundle is **not** a pure journal upgrade: it also changes how the bot decides. Do not continue. Either build the bundle from the commit the
running bot was built from plus only the journal files, or review the difference on purpose (`diff /opt/lucidio/lucidio-core.js /tmp/lucidio-new/lucidio/lucidio-core.js`) and treat it as a strategy change with its own sign-off.

## Without the journal

You can start recording and comparing before this upgrade: install the shadow recorder (it needs no bot restart, DEPLOY.md section 16) and, on your PC, run
`node compare-live-vs-backtest.js --no-journal --state state.json --shadow-dir shadow-copy` against copies of the bot's `state/state.json` and the recorder's folder (the exact commands are in DEPLOY.md section 16).
It compares the bot's own trade records with the backtest and the recorder's decisions on the same match key, and prints a "CANNOT CHECK" list: skipped signals, the indicators and candles the bot itself saw,
the exit candle, fill slippage and provenance need the journal.
