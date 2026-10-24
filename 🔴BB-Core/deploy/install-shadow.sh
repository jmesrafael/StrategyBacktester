#!/usr/bin/env bash
# Lucid'io shadow recorder: OPTIONAL install, next to a running bot, WITHOUT restarting or touching it.
#   sudo bash deploy/install-shadow.sh                 install / refresh the recorder (re-runnable)
#   sudo bash deploy/install-shadow.sh --uninstall     stop and remove the service and its code (the recorded data stays)
#   sudo bash deploy/install-shadow.sh --uninstall --purge   ... and delete the recorded data too
# Run it from the folder you extracted a bundle into (the full bundle or the small one from deploy/package-shadow.sh).
#
# What it touches:   new user lucidio-shadow, /opt/lucidio-shadow (code, owned by root), /var/lib/lucidio-shadow (data), /etc/systemd/system/lucidio-shadow.service
# What it never does: stop, start, restart or reconfigure lucidio.service; write anything under /opt/lucidio; read mexc-keys.json, .env or state/.
# (The only thing it reads of the bot is lucidio-core.js, a public code file, to tell you if the recorder's copy differs from the bot's.)
set -uo pipefail
APP=/opt/lucidio; DEST=/opt/lucidio-shadow; DATA=/var/lib/lucidio-shadow; SVC=lucidio-shadow
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
step() { echo; echo "== $*"; }
ok()   { echo "   ok: $*"; }
warn() { echo "   WARN: $*" >&2; }
die()  { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"

if [ "${1:-}" = "--uninstall" ]; then
  step "uninstall the shadow recorder (the bot is not touched)"
  systemctl disable --now "$SVC.service" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/$SVC.service"; systemctl daemon-reload
  rm -rf "$DEST"; ok "service and code removed"
  if [ "${2:-}" = "--purge" ]; then rm -rf "$DATA"; userdel "$SVC" >/dev/null 2>&1 || true; ok "recorded data and user removed"; else ok "recorded data kept in $DATA"; fi
  echo "   lucidio.service: $(systemctl is-active lucidio 2>/dev/null || true) (unchanged)"; exit 0
fi

# the files the recorder needs: from the full bundle (sidecar/ + the bot's root files) or from the small shadow bundle (the same layout)
REC="$SRC/sidecar/shadow-recorder.js"; [ -f "$REC" ] || REC="$SRC/shadow-recorder.js"
for f in "$REC" "$SRC/shadow-reader.js" "$SRC/matchkey.js" "$SRC/lucidio-core.js" "$SRC/deploy/lucidio-shadow.service"; do [ -f "$f" ] || die "missing in the extracted bundle: $f"; done
command -v node >/dev/null 2>&1 || die "node is not installed (the bot's setup installs it: deploy/setup-vps.sh)"
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "node $(node -v) is too old (20 or newer)"

# proof for the end: the bot's start time before and after (it must not change)
BOT_BEFORE="$(systemctl show lucidio -p ActiveEnterTimestampMonotonic 2>/dev/null || true)"; BOT_STATE="$(systemctl is-active lucidio 2>/dev/null || true)"

step "1. user, code folder (owned by root: the recorder cannot change its own code), data folder"
id "$SVC" >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin "$SVC"
install -d -m 755 -o root -g root "$DEST"
install -m 644 -o root -g root "$REC" "$DEST/shadow-recorder.js"
install -m 644 -o root -g root "$SRC/shadow-reader.js" "$DEST/shadow-reader.js"
install -m 644 -o root -g root "$SRC/matchkey.js" "$DEST/matchkey.js"
install -m 644 -o root -g root "$SRC/lucidio-core.js" "$DEST/lucidio-core.js"
install -d -m 755 -o "$SVC" -g "$SVC" "$DATA"
ok "code in $DEST (root-owned), data in $DATA (owner $SVC)"
if [ -f "$APP/lucidio-core.js" ]; then
  if [ "$(sha256sum < "$APP/lucidio-core.js")" = "$(sha256sum < "$DEST/lucidio-core.js")" ]; then ok "the recorder's lucidio-core.js is byte-identical to the bot's (same decision engine)";
  else warn "the recorder's lucidio-core.js DIFFERS from the one the bot runs: its decisions will not be comparable. Install the recorder from the same bundle as the bot."; fi
fi

step "2. offline self-check (no network, writes only to a temp folder)"
if (cd "$DEST" && sudo -u "$SVC" env SHADOW_DIR="$(mktemp -d)" node shadow-recorder.js selfcheck | tail -4); then ok "self-check finished"; else warn "self-check reported a problem: read the lines above before relying on the recorder"; fi

step "3. systemd service (its own unit: enabled, restarts itself, logs to the journal)"
install -m 644 "$SRC/deploy/lucidio-shadow.service" "/etc/systemd/system/$SVC.service" || die "could not install the unit"
systemctl daemon-reload
systemctl enable "$SVC.service" >/dev/null 2>&1 && ok "enabled (starts on boot)"
systemctl restart "$SVC.service"; sleep 3
if systemctl is-active --quiet "$SVC"; then ok "running: $(journalctl -u "$SVC" -n 1 --no-pager -o cat 2>/dev/null)"; else warn "not running: journalctl -u $SVC -n 30 --no-pager"; fi

step "summary"
BOT_AFTER="$(systemctl show lucidio -p ActiveEnterTimestampMonotonic 2>/dev/null || true)"
echo "   shadow recorder: $(systemctl is-active "$SVC" || true), data $DATA, disk cap 300 MB (edit SHADOW_MAX_MB in the unit)"
echo "   bot (lucidio.service): $BOT_STATE -> $(systemctl is-active lucidio 2>/dev/null || true); start time unchanged: $([ "$BOT_BEFORE" = "$BOT_AFTER" ] && echo YES || echo "NO (check why)")"
echo "   look: sudo systemctl status $SVC · sudo journalctl -u $SVC -f · sudo cat $DATA/status.json"
echo "   remove: sudo bash $0 --uninstall   (add --purge to delete the data)"
