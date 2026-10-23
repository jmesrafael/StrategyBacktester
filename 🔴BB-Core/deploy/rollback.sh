#!/usr/bin/env bash
# Put the previous CODE back (settings, state and keys are never touched).  setup-vps.sh saves the old code before every update.
#   sudo bash /opt/lucidio/deploy/rollback.sh            -> newest code backup
#   sudo bash /opt/lucidio/deploy/rollback.sh --list     -> show them
#   sudo bash /opt/lucidio/deploy/rollback.sh /var/backups/lucidio/code-20261101-120000.tar.gz
set -euo pipefail
APP=/opt/lucidio; DEST=/var/backups/lucidio
[ "$(id -u)" -eq 0 ] || { echo "run as root: sudo bash $0"; exit 1; }
if [ "${1:-}" = "--list" ]; then ls -1t "$DEST"/code-*.tar.gz 2>/dev/null || echo "no code backups yet"; exit 0; fi
ARCHIVE="${1:-$(ls -1t "$DEST"/code-*.tar.gz 2>/dev/null | head -n 1 || true)}"
[ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || { echo "no code backup found in $DEST (nothing to roll back to)"; exit 1; }
echo "rolling back to $ARCHIVE"
WAS=$(systemctl is-active lucidio || true)
[ "$WAS" = "active" ] && systemctl stop lucidio
tar -xzf "$ARCHIVE" -C "$APP"
chown -R lucidio:lucidio "$APP"
systemctl daemon-reload
[ "$WAS" = "active" ] && systemctl start lucidio
echo "done. node $(node -v); service: $(systemctl is-active lucidio || true)"
echo "check: sudo -u lucidio node $APP/lucidio.js status && sudo journalctl -u lucidio -n 20 --no-pager"
