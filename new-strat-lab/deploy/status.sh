#!/usr/bin/env bash
# Results of one lab bot.   sudo bash /opt/labwide/deploy/status.sh [compare]     (or /opt/labichi/...)
# compare = did the paper bot do what its backtest says on the same MEXC candles?
set -uo pipefail
D="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; S="$(basename "$D")"
case "$S" in labwide) M=lucidio.js; E=LUCIDIO; CMP=paper-vs-backtest.js;; labichi) M=icore.js; E=ICORE; CMP=compare-live-vs-backtest.js;; *) echo "unknown bot folder $D"; exit 1;; esac
cd "$D" || exit 1
runas() { sudo -u "$S" env "${E}_STATE_DIR=/var/lib/$S" "${E}_ENV_FILE=/var/lib/$S/no-env-file" "${E}_NO_NOTIFY=1" /usr/bin/node "$@"; }
if [ "${1:-}" = "compare" ]; then
  if [ "$S" = labwide ]; then runas "$CMP"; else runas "$CMP" --journal "/var/lib/$S/journal/trades.jsonl" --state "/var/lib/$S/state.json" --out-dir "/var/lib/$S/audit"; fi
  exit $?
fi
echo "== $S: $(systemctl is-active "$S" 2>/dev/null)"
runas "$M" status
echo; echo "== last log lines"; tail -n 8 "/var/lib/$S/bot.log" 2>/dev/null | cut -c1-170
