#!/usr/bin/env bash
# deploy/export-journal.sh - pack the trade journal and the account snapshots into one file you can copy to your PC for live-review.js.
#   sudo bash /opt/lucidio/deploy/export-journal.sh            -> /tmp/lucidio-journal-YYYYMMDD.tgz   (owned by the user who ran sudo)
# Read-only: it never touches the bot, the state or the keys. The pack holds only journal/ (trades.jsonl, snapshots.jsonl): no mexc-keys.json, no .env.
set -euo pipefail
APP="${LUCIDIO_APP:-/opt/lucidio}"
OUT="${1:-/tmp/lucidio-journal-$(date -u +%Y%m%d).tgz}"
[ -d "$APP/journal" ] || { echo "no $APP/journal yet (the bot writes it on its first run)"; exit 1; }
tar czf "$OUT" -C "$APP" journal
[ -n "${SUDO_USER:-}" ] && chown "$SUDO_USER" "$OUT"
echo "packed: $OUT ($(du -h "$OUT" | cut -f1))"
tar tzf "$OUT" | sed 's/^/  /'
echo
echo "Next, on your PC (PowerShell):  scp admin@YOUR_SERVER_IP:$OUT ."
