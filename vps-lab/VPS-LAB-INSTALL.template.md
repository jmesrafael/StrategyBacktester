# Lab on the VPS: data recorder + 1h paper bot with real costs

Written __DATE__. This one file is all you need: the whole install bundle is embedded at the bottom, so it works from any PC.

**What this installs** (two small services, public MEXC data only, no API keys, neither can place an order):

- **Data recorder.** Writes down, all day and without anyone asking: 1m, 1h and 4h candles of the five coins, an order-book snapshot every 5 minutes (spread, depth, what a $100 ... $20,000 market order would really cost), MEXC's real funding rates, and what kind of market each coin is in. Research then uses the data the bots actually saw.
- **1h paper bot, with real-world costs.** The 1h bb-core on simulated money ($250 start). Unlike the first paper version, each trade pays what MEXC would charge: the coin's own fee rate, a fill taken from the real order book, real funding every 8 hours, whole contracts like the live bot. Stops use the *bad case* slippage the recorder measured.

**What it does not touch:** the live BB-Core and I-Core bots, their keys, state or settings. Each installer checks the bots' start times before and after.

## Before you start: the dashboard must be updated first

The dashboard needs the lab update (it learns the new bot `bb1h` and the `recorder`). If the VPS reports before that, the dashboard refuses the reports and they are lost. Deploy the dashboard first, then do the steps below.

## Steps

### 1. PC: copy this file to the server

Replace `YOUR-VPS` with your usual server login.

```
scp VPS-LAB-INSTALL.md YOUR-VPS:/tmp/
```

### 2. VPS: rebuild the bundle from this file and check it

```
cd /tmp
sed -n '/^BEGIN-BUNDLE$/,/^END-BUNDLE$/p' VPS-LAB-INSTALL.md | sed '1d;$d' | base64 -d > lucidio-lab.tar.gz
sha256sum lucidio-lab.tar.gz
```

The hash must be `__SHA__`. If it is not, stop and copy the file again.

### 3. VPS: unpack and install

```
mkdir -p /tmp/lucidio-lab && tar -xzf lucidio-lab.tar.gz -C /tmp/lucidio-lab
cd /tmp/lucidio-lab && sudo bash install-lab.sh --add-swap
```

`--add-swap` adds 1 GB of swap if the server has none (this server has 1.6 GB of RAM: swap makes a memory spike slow things down instead of killing a bot). Add `--check` instead to only look at what the server has to spare.

**Check the end of the output.** Each of the two installs must say `start times unchanged: YES` and show its service running. If a step says `FATAL`, it stopped there and nothing later was changed: send me the output. The recorder's first run takes about 20 seconds (it fetches 200 days of 1h candles).

### 4. VPS: show them on the dashboard (two small files)

Both services work without this, they just do not appear on the dashboard. Open each file, remove the `#` in front of the two lines, and paste the same address and secret the live bot uses (look in the live bot's env file):

```
sudo nano /etc/lucidio-recorder.env      then   sudo systemctl restart lucidio-recorder
sudo nano /etc/lucidio-1h.env            then   sudo systemctl restart lucidio-1h
```

### 5. Work PC: stop the local 1h paper copy

In `D:\testing\Strat\bb-core-1h`, run `stop-paper.cmd`, so only the VPS keeps the paper record. The VPS starts a new record at $250.

### 6. Check it after the next hour

```
sudo bash /opt/lucidio-recorder/deploy/status.sh
sudo bash /opt/lucidio-1h/deploy-1h/status.sh
```

On the dashboard: open **Research** and use the switch at the top right of the first panel to pick **BB-1h lab**. The *market now* panel needs the recorder; *what trading costs here* appears after about an hour of order-book snapshots; the 1h bot's trades appear as it takes them (about 20 a month across the five coins).

## Keep a copy of the recorded data off the server (recommended)

The recorder keeps everything on the VPS. If the server were lost, so would the data. Pick one way, once; after that it is automatic:

- **Pull from the work PC (no secrets anywhere):** run `pull-recorder-data.cmd YOUR-VPS` (in the lucidio-recorder folder) whenever you like. It downloads a copy to `D:\testing\Strat\recorder-data`.
- **Push every night from the server:** put a copy command in `/etc/lucidio-recorder.env` as `RECORDER_SYNC_CMD` (the file has an rsync and an rclone example). The dashboard's recorder panel shows when the last copy worked.

## Everyday commands (VPS)

| What | Command |
|---|---|
| What the recorder has, the market now, measured slippage | `sudo bash /opt/lucidio-recorder/deploy/status.sh` |
| Holes in the stored candles | `sudo bash /opt/lucidio-recorder/deploy/status.sh verify` |
| 1h paper bot results | `sudo bash /opt/lucidio-1h/deploy-1h/status.sh` |
| Paper against backtest (for the Dec 4 review) | `sudo bash /opt/lucidio-1h/deploy-1h/status.sh compare` |
| Live logs | `sudo journalctl -u lucidio-recorder -f` · `sudo journalctl -u lucidio-1h -f` |
| What the server has to spare | `bash /opt/lucidio-recorder/deploy/vps-check.sh` |
| Stop / start | `sudo systemctl stop lucidio-recorder` / `sudo systemctl start lucidio-recorder` (same for `lucidio-1h`) |
| Remove, keep the data | `sudo bash /tmp/lucidio-lab/lucidio-recorder/deploy/install-recorder.sh --uninstall` · `sudo bash /tmp/lucidio-lab/bb-core-1h/deploy-1h/install-1h-paper.sh --uninstall` |
| Remove everything | add `--purge` after `--uninstall` (deletes the recorded data and the paper record) |

## What to know

- Both services run at low priority with their own memory limits (recorder 180 MB, paper bot 250 MB), so the live bots come first. The recorder makes about 15 public requests every 5 minutes.
- The recorded data grows by roughly 0.6 MB a day (finished months and days are compressed): about 200 MB a year. It stops writing and says so on the dashboard if the disk gets below 1.5 GB free.
- Paper costs now come from MEXC: the coin's listed fee (never below 0.02%, so a promotional 0% is not counted as free), the real order book, real funding. If a data call fails, that trade falls back to a fixed assumption and says so. Treat the first results as a forecast of live, still without a live account's real fills.
- The 1h paper bot keeps its own record and appears on the dashboard as **BB-1h lab**. It never mixes into BB-Core's numbers or into Total capital.
- Both installers have been syntax-checked and the code tested against live MEXC data, but the installers have not been run on this Linux server yet: this is their first real run.

