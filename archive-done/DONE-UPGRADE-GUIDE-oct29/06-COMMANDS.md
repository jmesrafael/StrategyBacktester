# Commands, all in one place

For Option B (you run the VPS commands) copy from here and paste the output back to me. For Option A I run them myself.
`PC` = Git Bash. Set `STRAT` once per terminal: the folder that holds your clones of `bb-core`, `i-core`, `ledger` and `StrategyBacktester` (this PC: `/c/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat`; at home: wherever you cloned them):

```bash
export STRAT=/c/Users/WEB.WEB-DEVPC1/Desktop/testing/Strat
```

Bundles are built into `$STRAT/bundles` (outside every repo, never committed).
 `VPS` = after `ssh admin@193.181.221.91`. Bot names: BB-Core = `lucidio` (user `lucidio`, `/opt/lucidio`); I-Core = `icore` (user `icore`, `/opt/icore`).

## The 4-hour candle clock

Candles close at these times. The bot acts in the first seconds after each close. Philippine time = UTC + 8.

| Close (UTC) | Close (PH) | Safe window to restart a bot with trades open (UTC) | (PH) | Best start |
|---|---|---|---|---|
| 00:00 | 08:00 | 00:15 - 03:30 | 08:15 - 11:30 | 08:30 - 09:30 |
| 04:00 | 12:00 | 04:15 - 07:30 | 12:15 - 15:30 | 12:30 - 13:30 |
| 08:00 | 16:00 | 08:15 - 11:30 | 16:15 - 19:30 | 16:30 - 17:30 |
| 12:00 | 20:00 | 12:15 - 15:30 | 20:15 - 23:30 | 20:30 - 21:30 |
| 16:00 | 00:00 | 16:15 - 19:30 | 00:15 - 03:30 | not recommended (night) |
| 20:00 | 04:00 | 20:15 - 23:30 | 04:15 - 07:30 | not recommended (night) |

Daily jobs: compare BB-Core 00:40 UTC (08:40 PH), I-Core 00:50 UTC (08:50 PH). Performance watch BB-Core 01:05 UTC (09:05 PH), I-Core 01:15 UTC (09:15 PH). The preflight refuses outside its window by itself.

---

## PC: test and build (Phase 1)

```bash
cd $STRAT/bb-core
for f in test/*-test.js test/selftest.js; do echo "$f: $(node $f 2>&1 | grep passed | tail -1)"; done
node lucidio.js replay SOL,ZEC,NEAR,ADA,GALA          # every line must say IDENTICAL trade-for-trade
cd ../i-core
for f in test/*-test.js test/selftest.js; do echo "$f: $(node $f 2>&1 | grep passed | tail -1)"; done
node icore.js replay SOL,ZEC,NEAR,ADA,GALA

# after the commit: build the bundles (use /c/... paths: a "C:" path makes tar look for a remote host)
mkdir -p $STRAT/bundles
cd $STRAT/bb-core && OUT=$STRAT/bundles/lucidio-deploy.tar.gz bash deploy/package.sh
cd $STRAT/i-core  && OUT=$STRAT/bundles/icore-deploy.tar.gz bash deploy/package.sh
```

## VPS: read-only look (Phase 2)

```bash
systemctl is-active lucidio icore lucidio-shadow
sudo -u lucidio node /opt/lucidio/lucidio.js status
sudo -u icore   node /opt/icore/icore.js status
sudo -u lucidio node /opt/lucidio/lucidio.js check
sudo -u icore   node /opt/icore/icore.js check
sudo -u lucidio node -e 'const c=require("/opt/lucidio/config.js").load();console.log(JSON.stringify({mode:c.mode,coins:c.coins,riskPct:c.riskPct,maxRiskUsd:c.maxRiskUsd,riskTiers:c.riskTiers??null}))'
sudo -u icore   node -e 'const c=require("/opt/icore/config.js").load();console.log(JSON.stringify({mode:c.mode,coins:c.coins,riskPct:c.riskPct,maxRiskUsd:c.maxRiskUsd,riskTiers:c.riskTiers??null}))'
systemctl list-timers | grep -E 'lucidio|icore'
tail -n 3 /var/log/ledger-wallet.log
ls -1t /var/backups/lucidio | head -3 ; ls -1t /var/backups/icore | head -3
```

## VPS: pin the risk (Phase 3). Repeat with `icore` for I-Core.

```bash
sudo -u lucidio cp -p /opt/lucidio/bot-config.json /opt/lucidio/bot-config.json.bak-$(date +%Y%m%d%H%M)
sudo -u lucidio node -e 'const fs=require("fs"),f="/opt/lucidio/bot-config.json",c=JSON.parse(fs.readFileSync(f));c.riskTiers=[];fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n");console.log("riskPct",c.riskPct,"maxRiskUsd",c.maxRiskUsd,"riskTiers",JSON.stringify(c.riskTiers))'
```

## PC to VPS, then on the VPS: upgrade BB-Core (Phase 4)

```bash
# PC
cd $STRAT
scp bb-core/deploy/upgrade-ready.sh admin@193.181.221.91:/tmp/
scp bundles/lucidio-deploy.tar.gz bundles/lucidio-deploy.tar.gz.sha256 admin@193.181.221.91:/tmp/

# VPS
sudo bash /tmp/upgrade-ready.sh --keep-open                    # must say READY (keep open)
cd /tmp && sha256sum -c lucidio-deploy.tar.gz.sha256 && rm -rf lucidio-new && mkdir lucidio-new && tar -xzf lucidio-deploy.tar.gz -C lucidio-new
sudo systemctl start lucidio-backup.service
sudo bash /tmp/lucidio-new/lucidio/deploy/preflight-upgrade.sh --keep-open --engine-change   # must end with GO
# compare the printed stops/targets with the MEXC app, then, after your "go":
cd /tmp/lucidio-new/lucidio && sudo bash deploy/setup-vps.sh --skip-ssh-hardening
```

Right after, and after the next 4h close:

```bash
systemctl is-active lucidio lucidio-perf.timer
sudo -u lucidio node /opt/lucidio/lucidio.js status            # same open trades as before
sudo journalctl -u lucidio -n 30 --no-pager
sudo tail -n 2 /opt/lucidio/state/runs.jsonl | cut -c1-300    # lagSec small, errors []
sudo -u lucidio node /opt/lucidio/perf-watch.js --print
```

## PC to VPS, then on the VPS: upgrade I-Core (Phase 6)

```bash
# PC
cd $STRAT && scp bundles/icore-deploy.tar.gz bundles/icore-deploy.tar.gz.sha256 admin@193.181.221.91:/tmp/

# VPS
cd /tmp && sha256sum -c icore-deploy.tar.gz.sha256 && rm -rf icore-new && mkdir icore-new && tar -xzf icore-deploy.tar.gz -C icore-new
sudo systemctl start icore-backup.service
sudo bash /tmp/icore-new/icore/deploy/preflight-upgrade.sh --app /opt/icore --keep-open   # must end with GO (engine file IDENTICAL)
# after your "go":
cd /tmp/icore-new/icore && sudo bash deploy/setup-vps.sh --skip-ssh-hardening
systemctl is-active icore icore-perf.timer
sudo -u icore node /opt/icore/icore.js status
sudo journalctl -u icore -n 30 --no-pager
```

## VPS: switch on the new risk and cap (Phase 7, after your "go")

Replace `500` with your D3 value (`10` keeps today's cap, `0` removes it). Skip the I-Core line if you decided to leave it as is.

```bash
sudo -u lucidio node -e 'const c=require("/opt/lucidio/config.js");const v=c.validate({riskTiers:[[0,0.025],[500,0.02],[1000,0.015]],maxRiskUsd:500});if(!v.ok){console.error(v.errors);process.exit(1)}c.save(v.next);console.log("saved",JSON.stringify(v.next.riskTiers),v.next.maxRiskUsd)'
sudo -u icore   node -e 'const c=require("/opt/icore/config.js");const v=c.validate({riskTiers:[[0,0.025],[500,0.02],[1000,0.015]],maxRiskUsd:500});if(!v.ok){console.error(v.errors);process.exit(1)}c.save(v.next);console.log("saved",JSON.stringify(v.next.riskTiers),v.next.maxRiskUsd)'
sudo -u lucidio node /opt/lucidio/lucidio.js check | grep -E "risk"
```

Back to flat risk and the $10 cap (undo):

```bash
sudo -u lucidio node -e 'const c=require("/opt/lucidio/config.js");const v=c.validate({riskTiers:[],maxRiskUsd:10});if(!v.ok){console.error(v.errors);process.exit(1)}c.save(v.next);console.log("saved",JSON.stringify(v.next.riskTiers),v.next.maxRiskUsd)'
```

## Emergency

```bash
sudo -u lucidio touch /opt/lucidio/STOP      # no new entries, open trades stay protected. rm the file to resume
sudo -u icore   touch /opt/icore/STOP
sudo bash /opt/lucidio/deploy/rollback.sh --list ; sudo bash /opt/lucidio/deploy/rollback.sh
sudo bash /opt/icore/deploy/rollback.sh
```

## Ledger / Vercel (Phase 8, PC)

```bash
cd $STRAT/ledger
git fetch && git checkout main && git merge --ff-only origin/bb-core-no-target-dashboard   # the dashboard change was pushed to this branch, not to main (see 03-STEPS Phase 8)
git push                                                                   # only this push makes Vercel deploy it to production
```
