# BB-Trail paper lab on the VPS

Written __DATE__. This one file is all you need: the whole install bundle is embedded at the bottom, so it works from any PC.

**What this installs:** one small paper-trading service, **BB-Trail**, on simulated money ($100 start). It uses bb-core's entry (a 4h close outside the Bollinger band with the 200 average) but exits with a 2 ATR stop that trails 14 ATR behind the best price, no target, no time limit. Public MEXC data only, no API keys, it cannot place an order (live trading is locked off in the code).

It is the third bot suggested in the ledger report *Live Pair vs Three-Bot Mix*. The backtest (2020 to Nov 2026): 613 trades, win rate 21%, +1.29R a trade, about 7.7 trades a month, worst drop 29.7R, longest losing streak 26. Most trades lose about 1R; a few ride a trend for weeks.

**What it does not touch:** the live BB-Core and I-Core bots, the 1h lab and the recorder, their keys, state or settings. The installer checks the live bots' start times before and after.

**It will not take the same trades as BB-Core.** The entry rule is shared, but each bot holds one position per coin and BB-Trail stays in a trade for weeks, so it skips signals BB-Core takes and the other way round. That is expected. BB-Trail is checked every day against **its own** backtest on the same candles, never against BB-Core's trades.

## The short version (about 10 minutes, all at the VPS)

First make sure the dashboard update is live (next section), then:

```
scp VPS-TRAIL-INSTALL.md YOUR-VPS:/tmp/                                  (from the PC)
cd /tmp && sed -n '/^BEGIN-BUNDLE$/,/^END-BUNDLE$/p' VPS-TRAIL-INSTALL.md | sed '1d;$d' | base64 -d > bbtrail.tar.gz && sha256sum bbtrail.tar.gz     (must be __SHA__)
mkdir -p /tmp/bbtrail && tar -xzf bbtrail.tar.gz -C /tmp/bbtrail && cd /tmp/bbtrail && sudo bash deploy-trail/install-trail-paper.sh
sudo grep -E '^(DASHBOARD_URL|DASHBOARD_PUSH_SECRET|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=' /opt/lucidio/.env | sudo tee -a /etc/bbtrail.env > /dev/null
sudo systemctl restart bbtrail
```

Then, on the dashboard, switch the bot selector to **BB-Trail lab**. If anything says `FATAL`, stop and send me the output.

## Before you start: the dashboard must be updated first

The dashboard needs this update (it learns the new bot `bbtr` and its trend-capture fields). If the VPS reports before that, the dashboard refuses the reports and they are lost (the bot keeps them in its outbox and they stay in the journal, but it is cleaner to deploy first). Deploy the ledger repo, then do the steps below.

## Steps

### 1. PC: copy this file to the server

```
scp VPS-TRAIL-INSTALL.md YOUR-VPS:/tmp/
```

### 2. VPS: rebuild the bundle from this file and check it

```
cd /tmp
sed -n '/^BEGIN-BUNDLE$/,/^END-BUNDLE$/p' VPS-TRAIL-INSTALL.md | sed '1d;$d' | base64 -d > bbtrail.tar.gz
sha256sum bbtrail.tar.gz
```

The hash must be `__SHA__`. If it is not, stop and copy the file again.

### 3. VPS: unpack and install

```
mkdir -p /tmp/bbtrail && tar -xzf bbtrail.tar.gz -C /tmp/bbtrail
cd /tmp/bbtrail && sudo bash deploy-trail/install-trail-paper.sh
```

The installer refuses to go on if anything is off (a key file in the bundle, the paper lock missing, the wrong strategy file, the wrong dashboard tag). **Check the end of the output:** it must say `live bots' start times unchanged: YES` and show the service running. The pre-flight in step 3 of the installer reads MEXC's public data and prints each coin's contract, fees and what a trade would risk. If a step says `FATAL`, nothing later was changed: send me the output.

### 4. VPS: show it on the dashboard and get Telegram messages (copy values, nothing is printed)

It works without this, but it will not appear on the dashboard and sends no Telegram messages. Same dashboard address and secret as the live bot; Telegram messages are labelled `[TRAIL LAB] · PAPER`.

```
sudo grep -E '^(DASHBOARD_URL|DASHBOARD_PUSH_SECRET|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=' /opt/lucidio/.env | sudo tee -a /etc/bbtrail.env > /dev/null
sudo systemctl restart bbtrail
```

To check: `sudo grep -cE '^(DASHBOARD_|TELEGRAM_)' /etc/bbtrail.env` must print `4` (or `2` if the live bot has no Telegram). If it prints `0`, `/opt/lucidio/.env` is not where the live bot keeps its settings: run `sudo systemctl cat lucidio` to find its folder, or fill `/etc/bbtrail.env` by hand with `sudo nano`.

### 5. Check it

```
sudo bash /opt/bbtrail/deploy-trail/status.sh
sudo bash /opt/bbtrail/deploy-trail/status.sh report
```

It checks the market every 4 hours (at the 00:00, 04:00, 08:00 ... UTC close). With no signal it simply says `flat`. Expect about 7 to 8 trades a month across the five coins, most of them small losses.

## What is recorded for analysis

- **Every trade:** the Bollinger numbers behind the entry, the fill from the real order book, contracts, fees, real funding, slippage, and for each closed trade the best and worst price it reached (in R), how much the trailing stop gave back, the stop it ended on, how many times the stop moved and how many candles it was held.
- **Every skipped signal** with the reason (this includes signals skipped because the bot was already in that coin).
- **Every run:** balance, positions, timing, MEXC latency, candle gaps, clock drift, errors.
- **Daily at 00:55 UTC:** a comparison of every trade with BB-Trail's own backtest on the same candles (saved in `/var/lib/bbtrail/audit/`, summary sent to the dashboard).
- **On the dashboard:** the BB-Trail lab view, with its results, trade list, the trend-capture table next to the backtest's numbers and each open trade's current trailing stop.

## Everyday commands (VPS)

| What | Command |
|---|---|
| Service, balance, open trades, log, last comparison | `sudo bash /opt/bbtrail/deploy-trail/status.sh` |
| Research report vs the backtest | `sudo bash /opt/bbtrail/deploy-trail/status.sh report` |
| Every trade vs its own backtest, now | `sudo bash /opt/bbtrail/deploy-trail/status.sh compare` |
| Report as JSON (copy it off the server to analyse) | `sudo bash /opt/bbtrail/deploy-trail/status.sh json` |
| Live log | `sudo journalctl -u bbtrail -f` |
| No new entries (open trades are still managed) | `sudo touch /opt/bbtrail/STOP` (remove the file to resume) |
| Stop / start | `sudo systemctl stop bbtrail` / `sudo systemctl start bbtrail` |
| Remove, keep the record | `sudo bash /tmp/bbtrail/deploy-trail/install-trail-paper.sh --uninstall` |
| Remove everything | add `--purge` after `--uninstall` (deletes the paper record and the env file) |

## What to know

- It runs at low priority with a 250 MB memory limit, so the live bots come first.
- The paper record is its own: `/var/lib/bbtrail`. It never mixes into BB-Core's numbers or into Total capital.
- Judge it slowly. With 21% winners and a median trade of -1R, a few dozen trades say little. The first thing to compare is the **trend-capture table** (how many trades reach +3R, +5R, +10R, and how much the trail gives back) against the backtest's rates; the totals mean something after about 100 trades (roughly 13 months).
- Going live would need its own review: the backtest drawdown (-29.7R, and 26 losing trades in a row at worst) is large, and it would need its own MEXC account and code changes. This install cannot do that.
- The code is covered by tests on the PC (the same 613 trades as the research engine, a full trade with realistic costs, the I-Core safety tests). The installer itself has not been run on this Linux server yet: this is its first real run.
