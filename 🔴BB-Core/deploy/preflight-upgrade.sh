#!/usr/bin/env bash
# deploy/preflight-upgrade.sh - READ-ONLY go / no-go before moving the running bot to a new bundle (see UPGRADE-LIVE.md). It changes NOTHING:
# it reads state/state.json and bot-config.json, the clock and the disk, and compares file hashes. It reads no key and sends nothing.
#   sudo bash /tmp/lucidio-new/lucidio/deploy/preflight-upgrade.sh          (run it from the extracted NEW bundle)
#   sudo bash deploy/preflight-upgrade.sh --app /opt/lucidio --bundle /tmp/lucidio-new/lucidio
# Exit 0 = GO, 1 = NO-GO (the reasons are printed).
set -uo pipefail
APP=/opt/lucidio; NEW="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
while [ $# -gt 0 ]; do case "$1" in --app) APP="$2"; shift 2;; --bundle) NEW="$2"; shift 2;; *) echo "unknown option $1"; exit 2;; esac; done
STOP=(); NOTE=()
ok()   { echo "   ok:   $*"; }
bad()  { echo "   STOP: $*"; STOP+=("$*"); }
info() { echo "   info: $*"; NOTE+=("$*"); }

echo "== 1. the bot"
if systemctl is-active --quiet lucidio 2>/dev/null; then ok "lucidio.service is running"; else info "lucidio.service is not running (fine for an update, it will not be started by it unless it was running)"; fi
if [ -f "$APP/bot-config.json" ]; then ok "mode: $(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).mode' "$APP/bot-config.json" 2>/dev/null || echo '?')"; else bad "no $APP/bot-config.json"; fi

echo "== 2. no open position, no unfinished order (state/state.json)"
if [ -f "$APP/state/state.json" ]; then
  RES="$(node -e '
const s = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")), out = [];
for (const [c, st] of Object.entries(s.coins || {})) { if (st.pos) out.push(c + " has an OPEN " + (st.pos.dir === 1 ? "LONG" : "SHORT") + " since " + new Date(st.pos.t0 * 1000).toISOString()); if (st.pending) out.push(c + " has an UNFINISHED ORDER"); }
const lr = s.lastRun && s.lastRun.ts ? (Date.now() - Date.parse(s.lastRun.ts)) / 60000 : null;
console.log(JSON.stringify({ open: out, lastRunMin: lr == null ? null : Math.round(lr), mode: s.mode, trades: Object.values(s.coins || {}).reduce((a, c) => a + (c.trades || []).length, 0) }));' "$APP/state/state.json" 2>/dev/null || echo '{"error":1}')"
  if echo "$RES" | grep -q '"error"'; then bad "state/state.json could not be read"; else
    OPEN="$(echo "$RES" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).open.join("; ")')"
    if [ -n "$OPEN" ]; then bad "$OPEN: wait until it is closed (its exit would be missing its entry in the journal)"; else ok "flat: no open position and no unfinished order in the state file"; fi
    echo "$RES" | node -e 'const r=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log("   info: "+r.trades+" closed trade(s) in the state file; last run "+(r.lastRunMin==null?"?":r.lastRunMin+" min ago"))'
    LR="$(echo "$RES" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).lastRunMin ?? -1')"
    [ "$LR" -gt 260 ] && bad "the bot has not run for $LR minutes (limit 260): look at it first (sudo journalctl -u lucidio -n 30)"
  fi
else info "no state/state.json yet (a first install)"; fi
echo "   info: in LIVE mode also look at MEXC itself: Futures -> Positions 0 and Open orders 0 (the state file only knows what the bot knows)"

echo "== 3. the 4-hour candle window (closes at 00/04/08/12/16/20 UTC; the bot decides within seconds of a close)"
NOW=${PREFLIGHT_NOW:-$(date -u +%s)}; SINCE=$((NOW % 14400)); UNTIL=$((14400 - SINCE))   # PREFLIGHT_NOW only exists so the tests can pick the time of day
if [ "$SINCE" -lt 720 ]; then bad "a candle closed $((SINCE / 60)) min ago: wait until at least 12 minutes after the close"
elif [ "$UNTIL" -lt 300 ]; then bad "the next candle closes in $((UNTIL / 60)) min: wait until it has passed (+12 min)"
else ok "now is $((SINCE / 60)) min after the last close and $((UNTIL / 60)) min before the next: safe"; fi

echo "== 4. disk, backups, the new bundle"
FREE_MB=$(df -Pm "${APP}" 2>/dev/null | awk 'NR==2{print $4}'); [ "${FREE_MB:-0}" -ge 500 ] && ok "disk free ${FREE_MB} MB" || bad "disk free ${FREE_MB:-?} MB (need 500)"
[ -d /var/backups/lucidio ] && ok "/var/backups/lucidio exists ($(ls -1 /var/backups/lucidio 2>/dev/null | wc -l) files)" || info "/var/backups/lucidio does not exist yet (setup creates it)"
if [ -f "$NEW/lucidio.js" ] && [ -f "$NEW/journal.js" ]; then ok "the new bundle has lucidio.js and journal.js ($NEW)"; else bad "$NEW does not look like the new bundle (lucidio.js / journal.js missing)"; fi
if [ -f "$NEW/BUILD_INFO.json" ]; then ok "new bundle: $(tr -d '\n ' < "$NEW/BUILD_INFO.json")"; fi
if [ -f "$APP/lucidio-core.js" ] && [ -f "$NEW/lucidio-core.js" ]; then
  A="$(sha256sum < "$APP/lucidio-core.js" | cut -c1-16)"; B="$(sha256sum < "$NEW/lucidio-core.js" | cut -c1-16)"
  if [ "$A" = "$B" ]; then ok "lucidio-core.js (the decision engine) is IDENTICAL in the running bot and the new bundle ($A): trading decisions do not change"
  else bad "lucidio-core.js DIFFERS (running $A, new $B): this upgrade would also change the trading engine. That is a different decision: stop and read UPGRADE-LIVE.md section 'If the engine file differs'"; fi
fi
echo "   files that differ between the running bot and the new bundle (code only):"
( cd "$NEW" && for f in $(ls *.js *.json 2>/dev/null) ; do [ "$f" = bot-config.json ] && continue; if [ -f "$APP/$f" ]; then cmp -s "$f" "$APP/$f" || echo "     changed: $f"; else echo "     new:     $f"; fi; done )

echo
if [ ${#STOP[@]} -eq 0 ]; then echo "GO: nothing in the way. Continue with UPGRADE-LIVE.md step 5."; exit 0; fi
echo "NO-GO (${#STOP[@]}):"; printf '  - %s\n' "${STOP[@]}"; exit 1
