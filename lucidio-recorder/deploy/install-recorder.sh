#!/usr/bin/env bash
# Lucid'io data recorder: install next to the live bots WITHOUT touching them (re-runnable).
#   sudo bash deploy/install-recorder.sh                     install or refresh the code, keeps everything recorded
#   sudo bash deploy/install-recorder.sh --uninstall         stop and remove service and code, keep the recorded data
#   sudo bash deploy/install-recorder.sh --uninstall --purge also delete the recorded data and the user
# Touches:      user lucidio-recorder, /opt/lucidio-recorder, /var/lib/lucidio-recorder, /etc/lucidio-recorder.env (only created, never overwritten), /etc/systemd/system/lucidio-recorder.service
# Never touches: lucidio.service, icore.service, lucidio-1h.service, /opt/lucidio, /opt/icore, /opt/lucidio-1h, their keys, state or config.
set -uo pipefail
DEST=/opt/lucidio-recorder; DATA=/var/lib/lucidio-recorder; SVC=lucidio-recorder; ENVF=/etc/lucidio-recorder.env
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_UNITS="lucidio icore lucidio-1h"
step() { echo; echo "== $*"; }
ok()   { echo "   ok: $*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"

if [ "${1:-}" = "--uninstall" ]; then
  step "uninstall the recorder (the bots are not touched)"
  systemctl disable --now "$SVC.service" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/$SVC.service"; systemctl daemon-reload; rm -rf "$DEST"; ok "service and code removed"
  if [ "${2:-}" = "--purge" ]; then rm -rf "$DATA"; userdel "$SVC" >/dev/null 2>&1 || true; rm -f "$ENVF"; ok "recorded data, user and settings file removed"; else ok "recorded data kept in $DATA, settings kept in $ENVF"; fi
  exit 0
fi

step "1. checks before anything changes"
FILES="recorder.js regime.js bookstats.js archive.js mexcpub.js push.js regime-history.js README.md"
for f in $FILES deploy/lucidio-recorder.service deploy/status.sh deploy/vps-check.sh deploy/add-swap.sh; do [ -f "$SRC/$f" ] || die "missing in the bundle: $f"; done
[ ! -e "$SRC/.env" ] && [ ! -e "$SRC/mexc-keys.json" ] || die "the bundle holds keys or an .env file: refusing"
if grep -nE "apiSecret|createOrder|/private/|X-MEXC-APIKEY|ApiKey" "$SRC"/recorder.js "$SRC"/mexcpub.js "$SRC"/archive.js "$SRC"/push.js "$SRC"/bookstats.js "$SRC"/regime.js >/dev/null 2>&1; then die "the recorder code mentions a key or a private endpoint: refusing"; fi
[ -x /usr/bin/node ] || die "/usr/bin/node not found (the service needs it there)"
[ "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "node $(/usr/bin/node -v) is too old (20 or newer)"
FREE_GB=$(df -BG --output=avail /var/lib 2>/dev/null | tail -1 | tr -dc '0-9'); [ "${FREE_GB:-0}" -ge 3 ] || die "less than 3 GB free on /var/lib (${FREE_GB:-?} GB): the recorder needs room to grow"
ok "no keys, public data only, node $(/usr/bin/node -v), ${FREE_GB} GB free"

live_times() { for u in $LIVE_UNITS; do echo "$u $(systemctl is-active "$u" 2>/dev/null || true) $(systemctl show "$u" -p ActiveEnterTimestampMonotonic 2>/dev/null || true)"; done; }
BEFORE="$(live_times)"

step "2. user, code (owned by root: the recorder cannot change its own code), data folder"
id "$SVC" >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin "$SVC" || die "could not create the user"
install -d -m 755 -o root -g root "$DEST" "$DEST/deploy"
for f in $FILES; do install -m 644 -o root -g root "$SRC/$f" "$DEST/$f" || die "could not install $f"; done
for f in status.sh vps-check.sh add-swap.sh; do install -m 755 -o root -g root "$SRC/deploy/$f" "$DEST/deploy/$f"; done
install -d -m 755 -o "$SVC" -g "$SVC" "$DATA"
ok "code in $DEST, recorded data in $DATA"
# settings: a root-only file systemd reads. Created once with comments only, never overwritten.
if [ ! -e "$ENVF" ]; then
  install -m 600 -o root -g root /dev/null "$ENVF"
  printf '%s\n' "# Settings for the data recorder. Remove the # in front of a line to switch it on, then: sudo systemctl restart lucidio-recorder" \
    "# Show the regime, measured slippage and recorder health on the dashboard (the same two values as the live bot's env file):" \
    "#DASHBOARD_URL=https://YOUR-DASHBOARD-ADDRESS" "#DASHBOARD_PUSH_SECRET=" \
    "# A copy of the recorded data somewhere that is not this server, once a day. Any shell command; it runs with RECORDER_DIR set. Examples:" \
    "#RECORDER_SYNC_CMD=rsync -a -e 'ssh -i /etc/lucidio-recorder/key -o StrictHostKeyChecking=accept-new' \"\$RECORDER_DIR/\" user@your-pc-or-server:/path/lucidio-data/" \
    "#RECORDER_SYNC_CMD=rclone sync \"\$RECORDER_DIR\" remote:lucidio-data --config /etc/lucidio-recorder/rclone.conf" > "$ENVF"
  ok "created $ENVF (everything commented out): fill it to show the recorder on the dashboard and to copy the data off this server"
else ok "$ENVF kept"; fi

step "3. first run (public MEXC data, no keys): it backfills 200 days of 1h candles, so it takes about 20 seconds"
OUT="$(cd "$DEST" && sudo -u "$SVC" env RECORDER_DIR="$DATA" /usr/bin/node recorder.js once 2>&1)"; RC=$?
echo "$OUT" | grep -E "ERROR|WARNING|one cycle done" | cut -c1-160
[ "$RC" -eq 0 ] || die "the first run failed (above): the service was not started"
echo "$OUT" | grep -q "ERROR" && echo "   note: some tasks reported errors above; the service retries them every cycle"
ok "first run done"

step "4. systemd service (enabled: survives reboots, restarts itself)"
install -m 644 "$SRC/deploy/lucidio-recorder.service" "/etc/systemd/system/$SVC.service" || die "could not install the unit"
systemctl daemon-reload
systemctl enable "$SVC.service" >/dev/null 2>&1 && ok "enabled"
systemctl restart "$SVC.service"; sleep 10
systemctl is-active --quiet "$SVC" || die "not running: journalctl -u $SVC -n 30 --no-pager"
ok "running"
journalctl -u "$SVC" -n 3 --no-pager 2>/dev/null | cut -c1-160 | sed 's/^/   /'

step "5. summary"
AFTER="$(live_times)"
echo "$AFTER" | awk '{print "   "$1": "$2}'
if [ "$BEFORE" = "$AFTER" ]; then echo "   the bots' start times unchanged: YES"; else echo "   WARNING a bot's state or start time CHANGED, look now:"; diff <(echo "$BEFORE") <(echo "$AFTER"); fi
echo "   what it has:  sudo bash $DEST/deploy/status.sh"
echo "   logs:         sudo journalctl -u $SVC -f"
echo "   settings:     sudo nano $ENVF   (dashboard address, copy off the server)"
