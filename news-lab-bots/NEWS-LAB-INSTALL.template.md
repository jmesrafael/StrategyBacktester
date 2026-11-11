# News lab on the VPS: three paper bots with the news gate

Written __DATE__. This one file is all you need: the whole install bundle is embedded at the bottom.

**What this installs:** three small paper-trading services on simulated money ($100 start each), one per TRI-CORE strategy, each with the **news gate** in front of new entries:

| service | strategy | dashboard tag |
|---|---|---|
| `newsbb` | BB-CORE 4h | `bbn` (BB-CORE news lab) |
| `newsic` | I-CORE | `icn` (I-CORE news lab) |
| `newstc` | T-CORE (bb-trail P14) | `tcn` (T-CORE news lab) |

Before each new entry the bot asks the news signal (`https://cryptobai.vercel.app/api/signal`, fetched once per 4h run). The gate can only **skip** an entry (journal + dashboard reason `news_gate`) or **shrink** its risk; it never opens a trade. If the signal is unreachable or older than 6 hours, the bot trades exactly like the strategy without news (fail-open). Every entry records what the gate said, so the dashboard can compare.

Public MEXC data only, no API keys, it cannot place an order (live trading is locked off in the code), and **Telegram is removed from the code** (no messages, whatever the env file says; the installer also refuses an env file with `TELEGRAM_*`).

**What it does not touch:** the live BB-CORE, I-CORE and T-CORE bots, the T-CORE paper lab (bbtr), the 1h lab, the recorder: their code, keys, state, settings or services. The installer checks their start times before and after. Each news bot has its own user, `/opt/<svc>` (root-owned), `/var/lib/<svc>`, `/etc/<svc>.env`, and is capped at 200 MB RAM, 20% CPU, nice 10.

## Before you start: the dashboard must be updated first

The ledger (dashboard) must already accept the tags `bbn`, `icn`, `tcn` and show the news fields (`news_gate`, `news_reasons` on entries). Deploy the ledger first. If the bots report before that, the dashboard refuses their reports (they wait in each bot's outbox and stay in its journal).

## The short version (about 10 minutes, all at the VPS)

```
scp NEWS-LAB-INSTALL.md YOUR-VPS:/tmp/                                       (from the PC)
cd /tmp && sed -n '/^BEGIN-BUNDLE$/,/^END-BUNDLE$/p' NEWS-LAB-INSTALL.md | sed '1d;$d' | base64 -d > newslab.tar.gz && sha256sum newslab.tar.gz     (must be __SHA__)
mkdir -p /tmp/newslab && tar -xzf newslab.tar.gz -C /tmp/newslab && cd /tmp/newslab && sudo bash deploy/install-news-lab.sh
for s in newsbb newsic newstc; do sudo grep -E '^(DASHBOARD_URL|DASHBOARD_PUSH_SECRET)=' /opt/lucidio/.env | sudo tee -a /etc/$s.env > /dev/null; done
sudo systemctl restart newsbb newsic newstc
```

The end of the installer output must say `live bots' start times unchanged: YES` and show all three running. If anything says `FATAL`, nothing after it was changed: stop and send the output.

Only the two `DASHBOARD_*` lines are copied: never copy `TELEGRAM_*` into these env files (the installer refuses them on the next run).

## Checking on them

```
sudo bash /opt/newsbb/deploy/status.sh newsbb      (newsic, newstc the same)
sudo journalctl -u newsbb -f
```

`status.sh` shows how many entries the gate let through, vetoed (`news_gate`) or shrank, and the last vetoes with their reasons.

## Removing them

```
sudo bash /tmp/newslab/deploy/install-news-lab.sh --uninstall           (keeps the paper records)
sudo bash /tmp/newslab/deploy/install-news-lab.sh --uninstall --purge   (also records, env files, users)
```

## Bundle

SHA-256 of `newslab.tar.gz`: `__SHA__`
