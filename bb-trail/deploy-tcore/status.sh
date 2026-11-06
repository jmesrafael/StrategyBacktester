#!/usr/bin/env bash
# T-CORE LIVE.   sudo bash /opt/tcore/deploy-tcore/status.sh [check | balance | report | compare]
#   (none)   service, balance, open trades, last log lines
#   check    pre-flight: keys, account, hedge mode, candles (read only, no orders)
#   balance  the MEXC account (read only)
#   report   results, trend capture, real costs, vs the backtest
#   compare  every trade vs this bot's own backtest on the same candles
cd /opt/tcore || exit 1
run() { sudo -u tcore env ICORE_STATE_DIR=/var/lib/tcore ICORE_KEYS=/var/lib/tcore/mexc-keys.json ICORE_ALLOW_LIVE=1 ICORE_NO_NOTIFY=1 node "$@"; }
case "${1:-}" in
  check)   run icore.js check; exit $? ;;
  balance) run icore.js balance; exit $? ;;
  report)  run lab-report.js; exit $? ;;
  compare) run compare-live-vs-backtest.js --mode live --tolerance 0.15 --rel-tolerance 0.05 --out-dir /var/lib/tcore/audit; exit $? ;;
esac
echo "service: $(systemctl is-active tcore) · enabled: $(systemctl is-enabled tcore 2>/dev/null) · daily comparison timer: $(systemctl is-active tcore-compare.timer)"
run icore.js status
echo; echo "--- last log lines"; tail -n 8 /var/lib/tcore/bot.log 2>/dev/null
echo; echo "--- last comparison with its own backtest"; ls -t /var/lib/tcore/audit/compare-*.txt 2>/dev/null | head -1 | xargs -r head -n 12
