#!/usr/bin/env bash
# set-env.sh - set or change ONE variable in the server env file (/opt/lucidio/.env) without opening an editor. Never prints the value.
#   sudo bash /opt/lucidio/deploy/set-env.sh TELEGRAM_BOT_TOKEN             hidden prompt: nothing on screen, nothing in the shell history
#   sudo bash /opt/lucidio/deploy/set-env.sh TELEGRAM_CHAT_ID 6295273072    value on the command line (fine for non-secret values like the chat id)
#   sudo bash /opt/lucidio/deploy/set-env.sh DASHBOARD_URL https://example.vercel.app --restart      --restart (last) also restarts the service
# Allowed names: TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID DASHBOARD_URL DASHBOARD_PUSH_SECRET DASHBOARD_SHARE_LIVE_EQUITY
set -euo pipefail
FILE="${LUCIDIO_ENV_FILE:-/opt/lucidio/.env}"
RESTART=0; ARGS=(); for a in "$@"; do if [ "$a" = "--restart" ]; then RESTART=1; else ARGS+=("$a"); fi; done
KEY="${ARGS[0]:-}"; VAL="${ARGS[1]:-}"
case "$KEY" in
  TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID|DASHBOARD_URL|DASHBOARD_PUSH_SECRET|DASHBOARD_SHARE_LIVE_EQUITY) ;;
  *) echo "usage: sudo bash $0 NAME [VALUE] [--restart]   NAME is one of: TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID DASHBOARD_URL DASHBOARD_PUSH_SECRET DASHBOARD_SHARE_LIVE_EQUITY"; exit 1;;
esac
if [ -z "$VAL" ]; then read -rsp "$KEY (hidden, then Enter): " VAL; echo; fi
[ -n "$VAL" ] || { echo "empty value: nothing changed"; exit 1; }
case "$VAL" in *[[:space:]]*|*\"*|*\'*) echo "the value contains a space or a quote: refusing (check what you pasted)"; exit 1;; esac
[ -f "$FILE" ] || { install -m 600 /dev/null "$FILE"; }
TMP="$(mktemp "$FILE.XXXXXX")"
# replace the existing NAME= line, or add it at the end; values go through the environment so no character is interpreted
K="$KEY" V="$VAL" awk 'BEGIN { k = ENVIRON["K"]; v = ENVIRON["V"]; done = 0 } index($0, k "=") == 1 { print k "=" v; done = 1; next } { print } END { if (!done) print k "=" v }' "$FILE" > "$TMP"
OWNER="$(stat -c '%U:%G' "$FILE" 2>/dev/null || echo '')"
chmod 600 "$TMP"; [ -n "$OWNER" ] && chown "$OWNER" "$TMP" 2>/dev/null || true
mv "$TMP" "$FILE"
echo "set $KEY in $FILE (value not shown). Variables now set: $(grep -E '^[A-Z_]+=.+' "$FILE" | cut -d= -f1 | tr '\n' ' ')"
if [ "$RESTART" = 1 ]; then systemctl restart lucidio && echo "lucidio restarted"; else echo "applies after: sudo systemctl restart lucidio"; fi
