# Putting the two new paper bots on the VPS

Simulated money only. They run beside the other bots with their own users, folders and services. They hold no keys and cannot place orders.
The installer checks the other bots' start times before and after and tells you if they changed.

Replace `YOUR-VPS` with the login you normally use for the server.

## Before you start: deploy the dashboard

The ledger must already accept the tags `bbw` and `ichix` (ledger branch `paper-labs-wide-ichi`, merged to `main` so Vercel deploys it).
If the bots report before that, the dashboard refuses their reports and they wait in each bot's outbox.

## 0. YOUR PC, Git Bash: build the bundle

```
cd "/c/Users/james/Desktop/SB/🔴StrategyBacktester/new-strat-lab" && bash make-deploy.sh
```
It must end with `bundle: ... stratlab.tar.gz` and a long checksum line. If it says `FAILED` or `FAIL`, stop.

## 1. YOUR PC, Git Bash: copy it to the server

```
cd "/c/Users/james/Desktop/SB/🔴StrategyBacktester/new-strat-lab/dist" && scp stratlab.tar.gz stratlab.tar.gz.sha256 YOUR-VPS:/tmp/
```

## 2. THE VPS (prompt `admin@lucidiobot`): unpack and install

```
cd /tmp && sha256sum -c stratlab.tar.gz.sha256 && rm -rf /tmp/stratlab-new && mkdir -p /tmp/stratlab-new && tar -xzf stratlab.tar.gz -C /tmp/stratlab-new && sudo bash /tmp/stratlab-new/deploy/install-strat-lab.sh
```

The end of the output must say `other bots' start times unchanged: YES`, and show `labwide: active` and `labichi: active`.
If a step says `FATAL`, it stopped there and nothing later was changed.

## 3. THE VPS: connect them to the dashboard

Copy the two lines `DASHBOARD_URL=...` and `DASHBOARD_PUSH_SECRET=...` from the env file of a bot that already reports into
`/etc/labwide.env` and `/etc/labichi.env` (edit with `sudo nano`; never paste the secret into a chat), then:

```
sudo systemctl restart labwide labichi
```
Within a few minutes the dashboard's Research Lab shows **BB 1H WIDE lab** and **ICHI-X4 lab**.

## Everyday commands (THE VPS)

| What | Command |
|---|---|
| Results | `sudo bash /opt/labwide/deploy/status.sh` and `sudo bash /opt/labichi/deploy/status.sh` |
| Paper against backtest | add `compare` to the line above |
| Live log | `sudo journalctl -u labichi -f` (or `labwide`) |
| Stop / start | `sudo systemctl stop labichi` / `sudo systemctl start labichi` |
| Remove, keep the record | `sudo bash /tmp/stratlab-new/deploy/install-strat-lab.sh --uninstall` |

## What to know

- ICHI-X4 decides every 4 hours (12:00am, 4:00am, 8:00am, 12:00pm, 4:00pm, 8:00pm UTC). BB-1H-WIDE decides every hour.
- A first check made more than 15 minutes after a candle close may log a signal as too late to enter. That is normal.
- No Telegram messages. Results are on the dashboard's Research Lab, or use the commands above.
