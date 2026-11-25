# HOME: put the new BB-Core rules (v4, 1.05x) on the VPS

Written Nov 25, 2026. **Not done yet.** BB-Core on the VPS still runs rules v3.
The code is already on GitHub (`bb-core` main, commit `c7f6100`). Only the server steps are left.
Time needed: about 15 minutes. When finished, move this file to `archive-done/` with a `DONE-` name.

## What changes
| Part | Now (v3) | After (v4 at 1.05x) |
|---|---|---|
| Shorts | every signal | only when Intraday Intensity(21) is below 0 |
| Risk, normal trade (2.5% step) | 2.5% | 2.625% |
| Risk when ADX(14) is above 27 | 2.5% | 1.3125% |
| Entry, stop, time exit, open trades | | unchanged |
| I-Core and T-Core | | unchanged |

## When to run it
Between 15 minutes after a 4h candle close and 10 minutes before the next one.
**Philippine time: 12:15-3:50, 4:15-7:50 or 8:15-11:50 (AM or PM).**

## Checklist (stop at the first step that does not match)

### [ ] 1. Look before you change anything
    sudo -u lucidio node /opt/lucidio/lucidio.js check
    sudo -u lucidio node /opt/lucidio/lucidio.js status
Expect: mode LIVE, no problem line. Note the open trades; check on MEXC that each has its stop.

    sudo node -e 'for (const b of ["lucidio","icore","tcore"]) { const c = require("/opt/" + b + "/bot-config.json"); console.log(b, JSON.stringify({ riskPct: c.riskPct, riskTiers: c.riskTiers, maxRiskUsd: c.maxRiskUsd, haltAtR: c.haltAtR, shared: c.sharedSizing })) }'
Expect: steps 2.5% / 2% / 1.5%, maxRiskUsd 500, haltAtR -39 / -35 / -45.

### [ ] 2. Pull the new code
`lucidio` menu, then **Pull changes from GitHub**, answer `y`.
Expect: safety tests pass and the bot comes back. The new rules are still OFF.

### [ ] 3. Run the new test (the old menu does not include it on this first pull)
    sudo bash -c 'cd /opt/lucidio-src && node test/tweak-test.js'
Expect the last line to end with **0 failed**.

### [ ] 4. Check, still off
    sudo -u lucidio node /opt/lucidio/lucidio.js check
Expect: the `rules` row says `rules v3 (rules v4 off ...)`, mode LIVE, same open trades.

### [ ] 5. Switch on at 1.05x
This backs up the config, then starts the rules at the NEXT 4h candle (the time is worked out for you):

    sudo cp /opt/lucidio/bot-config.json /opt/lucidio/bot-config.json.bak-v4
    sudo node -e 'const fs=require("fs"),f="/opt/lucidio/bot-config.json",c=JSON.parse(fs.readFileSync(f));c.tweakFrom=new Date((Math.floor(Date.now()/144e5)+1)*144e5).toISOString().slice(0,16)+"Z";c.tweakSizeMult=1.05;fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n");console.log(c.mode,c.tweakFrom,c.tweakSizeMult)'

Expect: `live <next candle time>Z 1.05`. No restart needed.
Run it once only (running it again moves the start time later).

### [ ] 6. Confirm it is on
    sudo -u lucidio node /opt/lucidio/lucidio.js check
Expect: `rules v4 ON for signal candles from ... risk x1.05`.
The first decision under v4 comes when that candle closes, 4 hours after the start time.

**Total: 6 steps.**

## If something goes wrong
| Problem | Do this |
|---|---|
| Switch the new rules off (keeps the new code) | `sudo node -e 'const fs=require("fs"),f="/opt/lucidio/bot-config.json",c=JSON.parse(fs.readFileSync(f));c.tweakFrom="";fs.writeFileSync(f,JSON.stringify(c,null,2)+"\n");console.log(c.mode,"v4 off")'` then run the check |
| The bot does not run after the pull | `sudo bash /opt/lucidio/deploy/rollback.sh` (puts the previous code back; settings and trades are kept) |
| `check` shows `rules v4 OFF because of a bad value` | the bot is safe on v3; redo step 5 |
| Anything else | send the output to Claude before changing more |

Open trades are never changed by switching on or off.

## After it is on
- [ ] Same day: look at the log for `SIZE <coin>: rules v4 ...` on a new entry, or a skipped short (`volume_filter`):
      `sudo journalctl -u lucidio -n 60 --no-pager`
- [ ] Next day: the daily compare should still say `match`.
- [ ] Monthly (on the PC, in `bb-core`): `node v4-shadow.js --from <switch-on time>` shows old rules next to new rules.

## Later improvements (no hurry, none changes trading)
- [ ] Update the dashboard text, the backtest pages and the research engine (`intel`) to describe rules v4.
- [ ] Check whether the dashboard performance checks flag differences after the switch.
- [ ] Teach the shadow recorder rules v4 (its note can say "saw a signal" for a skipped short).
- [ ] Decide at about 6 months whether 1.05x stays, goes to 1.00x, or v4 is switched off.

## Do not
- Do not change I-Core or T-Core. T-Core trail 12 was tested and **not** built.
- Do not judge v4 on a few weeks: a few months show only that the code behaves; a real difference takes years.

## Background
- What to expect on past data (2020 to Nov 2026, BB-Core): current +707R with a worst fall of 45.4R (open trades
  included); v4 at 1.05x +711R with 32.9R. On the whole account the fall barely changes (65.7R to 63.8R).
- Opus reviewed it and suggested 1.00x; the owner chose 1.05x on Nov 25.
- Full guide: `bb-core/V4-GO-LIVE.md`. Review: `research/opus-validate-nov25/REPORT.md`.
