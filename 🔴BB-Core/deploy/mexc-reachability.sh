#!/usr/bin/env bash
# Can THIS server reach MEXC public API? Run it from the VPS:  sudo -u lucidio bash /opt/lucidio/deploy/mexc-reachability.sh
# PASS = HTTP 200 + JSON | BLOCKED = 403/451, an HTML page or region/access text | UNKNOWN = timeout / anything else. Public endpoints only, no keys.
# Exit code: 0 all PASS, 1 any BLOCKED, 2 otherwise.
BASE=https://api.mexc.com; NOW=$(date +%s); BODY=$(mktemp); trap 'rm -f "$BODY"' EXIT; RC=0
echo "outbound IPv4 (bind the MEXC API key to this): $(curl -4 -s -m 8 https://checkip.amazonaws.com || echo '? (no answer)')"
probe() {   # name path
  local code first status rc
  code=$(curl -4 -s -m 10 -o "$BODY" -w '%{http_code}' "$BASE$2"); rc=$?
  first=$(head -c 200 "$BODY" 2>/dev/null | tr '\n\r' '  ')
  if [ "$rc" = 28 ] || [ "$code" = 000 ]; then status=UNKNOWN; first="(timeout or no connection, curl exit $rc)"
  elif [ "$code" = 403 ] || [ "$code" = 451 ] || grep -qiE '<html|<!doctype|region|country|restricted|not available in|access denied|forbidden' "$BODY"; then status=BLOCKED
  elif [ "$code" = 200 ] && head -c 1 "$BODY" | grep -q '[{[]' && grep -q '"success" *: *true' "$BODY"; then status=PASS
  else status=UNKNOWN; fi
  printf '%-8s %-6s HTTP %s  %s\n' "$status" "$1" "$code" "$first"
  case $status in BLOCKED) RC=1;; UNKNOWN) [ "$RC" = 1 ] || RC=2;; esac
}
probe ping  /api/v1/contract/ping
probe kline "/api/v1/contract/kline/SOL_USDT?interval=Hour4&start=$((NOW - 86400))&end=$NOW"
exit $RC
