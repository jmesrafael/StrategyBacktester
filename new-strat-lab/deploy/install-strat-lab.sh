#!/usr/bin/env bash
# NEW STRATEGY LAB: two PAPER bots (simulated money), installed next to the live bots WITHOUT touching them (re-runnable).
#   labwide = BB-1H-WIDE (1h)      labichi = ICHI-X4 (4h)      both on SOL ZEC NEAR ADA GALA ARB, US$200 paper each
#   sudo bash deploy/install-strat-lab.sh                          install or refresh both (keeps their paper records)
#   sudo bash deploy/install-strat-lab.sh --uninstall [--purge]    stop and remove services and code (--purge: also records and users)
# Touches:      users labwide/labichi, /opt/lab{wide,ichi}, /var/lib/lab{wide,ichi}, /etc/systemd/system/lab{wide,ichi}.service
# Never touches: any other bot: its code, keys, state, config or service. No keys, no Telegram, no dashboard, no ledger.
set -uo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALL="labwide labichi"
OTHERS="lucidio icore tcore bbtrail lucidio-1h lucidio-recorder coinbb cointc"
step() { echo; echo "== $*"; }
ok()   { echo "   ok: $*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"

dir_of()  { case "$1" in labwide) echo lab-wide;; labichi) echo lab-ichi;; esac; }
main_of() { case "$1" in labwide) echo lucidio.js;; labichi) echo icore.js;; esac; }
envp_of() { case "$1" in labwide) echo LUCIDIO;; labichi) echo ICORE;; esac; }

if [ "${1:-}" = "--uninstall" ]; then
  step "uninstall the new strategy lab (no other bot is touched)"
  for s in $ALL; do
    systemctl disable --now "$s.service" >/dev/null 2>&1 || true
    rm -f "/etc/systemd/system/$s.service"; rm -rf "/opt/$s"
    if [ "${2:-}" = "--purge" ]; then rm -rf "/var/lib/$s"; userdel "$s" >/dev/null 2>&1 || true; fi
  done
  systemctl daemon-reload
  if [ "${2:-}" = "--purge" ]; then ok "services, code, paper records and users removed"; else ok "services and code removed, paper records kept in /var/lib/lab*"; fi
  exit 0
fi

# proof for the end: the other bots' start times before and after (must not change)
other_times() { for u in $OTHERS; do echo "$u $(systemctl is-active "$u" 2>/dev/null || true) $(systemctl show "$u" -p ActiveEnterTimestampMonotonic 2>/dev/null || true)"; done; }
BEFORE="$(other_times)"

step "1. checks before anything changes"
[ -x /usr/bin/node ] || die "/usr/bin/node not found (the services need it there)"
[ "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "node $(/usr/bin/node -v) is too old (20 or newer)"
find "$SRC" \( -name 'mexc-keys*.json' -o -name '.env' -o -name '*.pem' \) | grep -q . && die "the bundle holds keys or an .env file: refusing"
FREE_MB="$(free -m | awk '/^Mem:/{print $7}')"
echo "   free memory: ${FREE_MB} MB (the two bots use roughly 150 MB together)"
[ "${FREE_MB:-0}" -ge 200 ] || die "under 200 MB of memory free: not installing next to the live bots"
for s in $ALL; do
  d="$SRC/$(dir_of "$s")"; m="$(main_of "$s")"
  [ -f "$d/$m" ] || die "$s: $m missing in the bundle"
  [ -f "$SRC/deploy/$s.service" ] || die "$s: deploy/$s.service missing"
  grep -q '"mode": "paper"' "$d/bot-config.json"        || die "$s: bot-config.json is not paper: refusing"
  grep -q '"realisticPaper": true' "$d/bot-config.json" || die "$s: realisticPaper is not on: refusing"
  grep -q 'const liveAllowed = () => false;' "$d/$m"    || die "$s: no paper lock in $m: refusing"
  grep -q 'const enabled = () => false;' "$d/dashboard-push.js" || die "$s: the dashboard push is not switched off: refusing"
  grep -q 'new strategy lab: Telegram is disabled' "$d/telegram.js" || die "$s: Telegram is not disabled: refusing"
  ok "$s: paper lock, no keys, no Telegram, no dashboard"
done

for s in $ALL; do
  d="$SRC/$(dir_of "$s")"; m="$(main_of "$s")"; e="$(envp_of "$s")"
  step "2. $s: user, code (owned by root), data folder"
  id "$s" >/dev/null 2>&1 || useradd --system --home "/opt/$s" --shell /usr/sbin/nologin "$s" || die "could not create user $s"
  rm -rf "/opt/$s.new"; install -d -m 755 -o root -g root "/opt/$s.new" "/opt/$s.new/deploy"
  for f in "$d"/*.js "$d"/*.json; do install -m 644 -o root -g root "$f" "/opt/$s.new/$(basename "$f")" || die "could not install $f"; done
  install -m 644 -o root -g root "$SRC/deploy/status.sh" "/opt/$s.new/deploy/status.sh"
  rm -rf "/opt/$s"; mv "/opt/$s.new" "/opt/$s"
  install -d -m 750 -o "$s" -g "$s" "/var/lib/$s"
  ok "code in /opt/$s, paper record in /var/lib/$s"

  step "3. $s: read-only pre-flight (public MEXC data, no keys)"
  preflight() { PF="$(cd "/opt/$s" && sudo -u "$s" env "${e}_STATE_DIR=/var/lib/$s" "${e}_KEYS=/var/lib/$s/no-keys.json" "${e}_ENV_FILE=/var/lib/$s/no-env-file" "${e}_NO_NOTIFY=1" /usr/bin/node "$m" check 2>&1)"; RC=$?; }
  preflight
  if [ "$RC" -ne 0 ] && echo "$PF" | grep -q "forming candle MISSING"; then echo "   the new candle is not on MEXC yet: waiting 40 s"; sleep 40; preflight; fi
  echo "$PF" | grep -E '^(BAD|WARN)|candles|problem' | cut -c1-150
  [ "$RC" -eq 0 ] || die "$s: pre-flight found problems (above): not started"
  ok "$s: pre-flight passed"

  step "4. $s: service"
  install -m 644 "$SRC/deploy/$s.service" "/etc/systemd/system/$s.service" || die "could not install $s.service"
  systemctl daemon-reload
  systemctl enable "$s.service" >/dev/null 2>&1 && ok "$s enabled (survives reboots)"
  systemctl restart "$s.service"; sleep 6
  systemctl is-active --quiet "$s" || die "$s is not running: journalctl -u $s -n 30 --no-pager"
  ok "$s running"
done

step "5. summary"
AFTER="$(other_times)"
echo "$AFTER" | awk '{print "   "$1": "$2}'
if [ "$BEFORE" = "$AFTER" ]; then echo "   other bots' start times unchanged: YES"; else echo "   WARNING another bot's state or start time CHANGED, look now:"; diff <(echo "$BEFORE") <(echo "$AFTER"); fi
for s in $ALL; do echo "   $s: $(systemctl is-active "$s")   results: sudo bash /opt/$s/deploy/status.sh"; done
