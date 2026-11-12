# Coin lab on the VPS: two paper bots for SUI and ARB

Written __DATE__. This one file is all you need: the whole install bundle is embedded at the bottom.

**Why:** the SUI / ARB study (`StrategyBacktester/research/coin-walkforward/SUI-ARB.md`) found the best split is BB-CORE + ARB, T-CORE + SUI + ARB, and I-CORE unchanged
(TRI-CORE return/drawdown 13.6 → 15.8 since Jun 2023, picked in hindsight). These bots watch that forward, on simulated money, before any real money.

| service | strategy | coins | dashboard tag |
|---|---|---|---|
| `coinbb` | BB-CORE 4h (fresh copy of bb-core) | ARB | `cbb` (BB-CORE coin lab) |
| `cointc` | T-CORE (fresh copy of the bb-trail paper lab) | SUI, ARB | `ctc` (T-CORE coin lab) |

Each bot trades ONLY the new coins, so the dashboard shows exactly what SUI and ARB add. The strategy rules are the original bots' byte for byte
(replay check: identical trade-for-trade with the backtest on both coins). $100 paper start each, the bots' own risk steps, realistic paper costs
(MEXC's real fees, order book fills and funding).

Public MEXC data only, no API keys, it cannot place an order (live trading is locked off in the code), and **Telegram is removed from the code**
(the installer also refuses an env file with `TELEGRAM_*`).

**What it does not touch:** the live BB-CORE, I-CORE and T-CORE bots, the T-CORE paper lab (bbtr), the 1h lab, the recorder and the news lab: their code, keys,
state, settings or services. The installer checks their start times before and after. Each coin-lab bot has its own user, `/opt/<svc>` (root-owned),
`/var/lib/<svc>`, `/etc/<svc>.env`, and is capped at 200 MB RAM, 20% CPU, nice 10.

## Before you start: the dashboard must be updated first

The ledger (dashboard) must already accept the tags `cbb` and `ctc` and the symbols `SUI_USDT` and `ARB_USDT` (database migration applied).
If the bots report before that, the dashboard refuses their reports (they wait in each bot's outbox and stay in its journal).

## The short version (about 10 minutes, all at the VPS)

```
scp COIN-LAB-INSTALL.md YOUR-VPS:/tmp/                                       (from the PC)
cd /tmp && sed -n '/^BEGIN-BUNDLE$/,/^END-BUNDLE$/p' COIN-LAB-INSTALL.md | sed '1d;$d' | base64 -d > coinlab.tar.gz && sha256sum coinlab.tar.gz     (must be __SHA__)
mkdir -p /tmp/coinlab && tar -xzf coinlab.tar.gz -C /tmp/coinlab && cd /tmp/coinlab && sudo bash deploy/install-coin-lab.sh
for s in coinbb cointc; do sudo grep -E '^(DASHBOARD_URL|DASHBOARD_PUSH_SECRET)=' /opt/lucidio/.env | sudo tee -a /etc/$s.env > /dev/null; done
sudo systemctl restart coinbb cointc
```

The end of the installer output must say `other bots' start times unchanged: YES` and show both running. If anything says `FATAL`, nothing after it was changed: stop and send the output.

Only the two `DASHBOARD_*` lines are copied: never copy `TELEGRAM_*` into these env files.

## Checking on them

```
sudo bash /opt/coinbb/deploy/status.sh coinbb      (cointc the same)
sudo journalctl -u coinbb -f
```

What to expect (backtest, per coin): about 3-4 BB-CORE trades a month on ARB, about 2 T-CORE trades a month per coin, most of them losers with a few big winners.
Judge after ~6 months; don't react to the first few weeks.

## Removing them

```
sudo bash /tmp/coinlab/deploy/install-coin-lab.sh --uninstall           (keeps the paper records)
sudo bash /tmp/coinlab/deploy/install-coin-lab.sh --uninstall --purge   (also records, env files, users)
```

## Bundle

SHA-256 of `coinlab.tar.gz`: `__SHA__`
