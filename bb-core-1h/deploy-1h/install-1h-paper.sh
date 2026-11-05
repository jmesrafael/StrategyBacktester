#!/usr/bin/env bash
# bb-core 1h PAPER bot: install next to the live bots WITHOUT touching them (re-runnable).
#   sudo bash deploy-1h/install-1h-paper.sh                     install or refresh the code, keeps the paper record
#   sudo bash deploy-1h/install-1h-paper.sh --uninstall         stop and remove service and code, keep the paper record
#   sudo bash deploy-1h/install-1h-paper.sh --uninstall --purge also delete the paper record and the user
# Touches:      user lucidio-1h, /opt/lucidio-1h, /var/lib/lucidio-1h, /etc/systemd/system/lucidio-1h.service
# Never touches: lucidio.service, icore.service, /opt/lucidio, /opt/icore, their keys, state or config.
set -uo pipefail
DEST=/opt/lucidio-1h; DATA=/var/lib/lucidio-1h; SVC=lucidio-1h
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_UNITS="lucidio icore"
step() { echo; echo "== $*"; }
ok()   { echo "   ok: $*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"

if [ "${1:-}" = "--uninstall" ]; then
  step "uninstall the 1h paper bot (the live bots are not touched)"
  systemctl disable --now "$SVC.service" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/$SVC.service"; systemctl daemon-reload; rm -rf "$DEST"; ok "service and code removed"
  if [ "${2:-}" = "--purge" ]; then rm -rf "$DATA"; userdel "$SVC" >/dev/null 2>&1 || true; ok "paper record and user removed"; else ok "paper record kept in $DATA"; fi
  exit 0
fi

step "1. checks before anything changes"
FILES="lucidio.js lucidio-core.js mexc.js live.js config.js envfile.js telegram.js journal.js dashboard-push.js ledger-sync.js keyinfo.js paper-vs-backtest.js bot-config.json README-1H.md"
for f in $FILES deploy-1h/lucidio-1h.service deploy-1h/status.sh; do [ -f "$SRC/$f" ] || die "missing in the bundle: $f"; done
[ ! -e "$SRC/mexc-keys.json" ] && [ ! -e "$SRC/.env" ] || die "the bundle holds keys or an .env file: refusing"
grep -q '"mode": "paper"' "$SRC/bot-config.json" || die "bot-config.json is not in paper mode: refusing"
grep -q 'const liveAllowed = () => false;' "$SRC/lucidio.js" || die "lucidio.js has no paper lock: refusing"
grep -q 'interval: 3600' "$SRC/lucidio-core.js" || die "lucidio-core.js is not the 1h version: refusing"
grep -q "'Min60'" "$SRC/mexc.js" || die "mexc.js does not read 1h candles: refusing"
[ -x /usr/bin/node ] || die "/usr/bin/node not found (the service needs it there)"
[ "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "node $(/usr/bin/node -v) is too old (20 or newer)"
ok "paper lock present, 1h settings present, no keys, node $(/usr/bin/node -v)"

# proof for the end: the live bots' start times before and after (must not change)
live_times() { for u in $LIVE_UNITS; do echo "$u $(systemctl is-active "$u" 2>/dev/null || true) $(systemctl show "$u" -p ActiveEnterTimestampMonotonic 2>/dev/null || true)"; done; }
BEFORE="$(live_times)"

step "2. user, code (owned by root: the bot cannot change its own code or settings), data folder"
id "$SVC" >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin "$SVC" || die "could not create the user"
install -d -m 755 -o root -g root "$DEST" "$DEST/deploy-1h"
for f in $FILES; do install -m 644 -o root -g root "$SRC/$f" "$DEST/$f" || die "could not install $f"; done
install -m 644 -o root -g root "$SRC/deploy-1h/status.sh" "$DEST/deploy-1h/status.sh"
install -d -m 750 -o "$SVC" -g "$SVC" "$DATA"
ok "code in $DEST, paper record in $DATA"

step "3. read-only pre-flight (public MEXC data, no keys)"
PF="$(cd "$DEST" && sudo -u "$SVC" env LUCIDIO_STATE_DIR="$DATA" LUCIDIO_NO_NOTIFY=1 /usr/bin/node lucidio.js check 2>&1)"; RC=$?
echo "$PF" | grep -E '^(BAD|WARN)|candles|problem' | cut -c1-150
[ "$RC" -eq 0 ] || die "pre-flight found problems (above): the service was not started"
ok "pre-flight passed"

step "4. systemd service (enabled: survives reboots, restarts itself)"
install -m 644 "$SRC/deploy-1h/lucidio-1h.service" "/etc/systemd/system/$SVC.service" || die "could not install the unit"
systemctl daemon-reload
systemctl enable "$SVC.service" >/dev/null 2>&1 && ok "enabled"
systemctl restart "$SVC.service"; sleep 8
systemctl is-active --quiet "$SVC" || die "not running: journalctl -u $SVC -n 30 --no-pager"
ok "running"; tail -n 3 "$DATA/bot.log" 2>/dev/null | cut -c1-150

step "5. summary"
AFTER="$(live_times)"
echo "$AFTER" | awk '{print "   "$1": "$2}'
if [ "$BEFORE" = "$AFTER" ]; then echo "   live bots' start times unchanged: YES"; else echo "   WARNING live bots' state or start time CHANGED, look now:"; diff <(echo "$BEFORE") <(echo "$AFTER"); fi
echo "   results:  sudo bash $DEST/deploy-1h/status.sh"
echo "   compare:  sudo bash $DEST/deploy-1h/status.sh compare"
echo "   logs:     sudo journalctl -u $SVC -f"
