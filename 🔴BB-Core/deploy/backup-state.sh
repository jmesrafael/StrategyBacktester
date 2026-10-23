#!/usr/bin/env bash
# Daily backup of the bot's state (positions, trades, run history) and settings. Keys are NOT included on purpose (secrets stay in one file).
# Restore:  sudo systemctl stop lucidio && sudo tar -xzf /var/backups/lucidio/state-<stamp>.tar.gz -C /opt/lucidio && sudo chown -R lucidio:lucidio /opt/lucidio && sudo systemctl start lucidio
set -euo pipefail
umask 077
APP="${LUCIDIO_APP:-/opt/lucidio}"; DEST="${LUCIDIO_BACKUP_DIR:-/var/backups/lucidio}"; KEEP="${KEEP:-14}"
mkdir -p "$DEST"
[ -d "$APP/state" ] || { echo "no $APP/state yet: nothing to back up"; exit 0; }
OUT="$DEST/state-$(date -u +%Y%m%d-%H%M%S).tar.gz"
FILES=(state); [ -f "$APP/bot-config.json" ] && FILES+=(bot-config.json)
tar -czf "$OUT" -C "$APP" "${FILES[@]}"
# keep the newest $KEEP
ls -1t "$DEST"/state-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "backup written: $OUT ($(du -h "$OUT" | cut -f1)), $(ls -1 "$DEST"/state-*.tar.gz | wc -l) kept"
