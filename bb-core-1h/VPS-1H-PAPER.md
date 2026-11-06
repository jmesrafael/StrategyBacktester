# Putting the 1h paper bot on the VPS

Simulated money only. It runs beside the live bots with its own user, folder and service. It holds no keys and cannot place orders. The installer checks the live bots' start times before and after and tells you if they changed.

Replace `YOUR-VPS` with the login you normally use for the server.

## 1. PC: copy the bundle to the server

In the folder that holds `lucidio-1h-paper.tar.gz`:

```
scp lucidio-1h-paper.tar.gz lucidio-1h-paper.tar.gz.sha256 YOUR-VPS:/tmp/
```

## 2. VPS: unpack and install

```
cd /tmp && sha256sum -c lucidio-1h-paper.tar.gz.sha256
mkdir -p /tmp/lucidio-1h-new && tar -xzf lucidio-1h-paper.tar.gz -C /tmp/lucidio-1h-new
sudo bash /tmp/lucidio-1h-new/deploy-1h/install-1h-paper.sh
```

The end of the output must say `live bots' start times unchanged: YES` and show the service running. If a step says `FATAL`, it stopped there and nothing later was changed.

## 3. PC: stop the local copy

Run `stop-paper.cmd` in `bb-core-1h`, so only the VPS keeps the paper record.

## Everyday commands (VPS)

| What | Command |
|---|---|
| Results and last log lines | `sudo bash /opt/lucidio-1h/deploy-1h/status.sh` |
| Paper against backtest (for the Dec 4 review) | `sudo bash /opt/lucidio-1h/deploy-1h/status.sh compare` |
| Live log | `sudo journalctl -u lucidio-1h -f` |
| Stop / start | `sudo systemctl stop lucidio-1h` / `sudo systemctl start lucidio-1h` |
| Remove, keep the record | `sudo bash /tmp/lucidio-1h-new/deploy-1h/install-1h-paper.sh --uninstall` |

## What to know

- A new paper record starts on the VPS at $100. The trades from the PC run are not carried over.
- It makes about 5 public MEXC candle requests an hour from the same server address as the live bots. It uses no API key.
- Telegram trade messages are on (labelled CORE 1H, PAPER) once TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are in /etc/lucidio-1h.env; it appears on the dashboard as BB-1h lab once DASHBOARD_URL and DASHBOARD_PUSH_SECRET are there too. It does not touch the ledger.
- If you install more than 15 minutes after the hour, the first check may log a signal as too late to enter. That is normal.
