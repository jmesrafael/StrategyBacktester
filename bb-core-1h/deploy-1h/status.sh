#!/usr/bin/env bash
# Results of the 1h paper bot.   sudo bash /opt/lucidio-1h/deploy-1h/status.sh [compare]
cd /opt/lucidio-1h || exit 1
run() { sudo -u lucidio-1h env LUCIDIO_STATE_DIR=/var/lib/lucidio-1h LUCIDIO_NO_NOTIFY=1 node "$@"; }
if [ "${1:-}" = "compare" ]; then run paper-vs-backtest.js; exit $?; fi
echo "service: $(systemctl is-active lucidio-1h)"
run lucidio.js status
echo; echo "--- last log lines"; tail -n 8 /var/lib/lucidio-1h/bot.log
