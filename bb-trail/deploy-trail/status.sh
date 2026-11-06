#!/usr/bin/env bash
# The BB-Trail paper lab.   sudo bash /opt/bbtrail/deploy-trail/status.sh [report | compare | json]
#   (none)   service, balance, open trades, last log lines
#   report   the research report: results, trend capture (best/worst price, give-back), real costs, per coin/side, vs the backtest
#   compare  every trade vs this bot's own backtest on the same candles (its shadow backtester; not bb-core's)
#   json     the research report as JSON (copy it off the server for an analysis)
cd /opt/bbtrail || exit 1
run() { sudo -u bbtrail env ICORE_STATE_DIR=/var/lib/bbtrail ICORE_KEYS=/var/lib/bbtrail/no-keys.json ICORE_NO_NOTIFY=1 node "$@"; }
case "${1:-}" in
  report)  run lab-report.js; exit $? ;;
  json)    run lab-report.js --json; exit $? ;;
  compare) run compare-live-vs-backtest.js --mode paper --tolerance 0.15 --rel-tolerance 0.05 --out-dir /var/lib/bbtrail/audit; exit $? ;;
esac
echo "service: $(systemctl is-active bbtrail) · daily comparison timer: $(systemctl is-active bbtrail-compare.timer)"
run icore.js status
echo; echo "--- last log lines"; tail -n 8 /var/lib/bbtrail/bot.log
echo; echo "--- last comparison with its own backtest"; ls -t /var/lib/bbtrail/audit/compare-*.txt 2>/dev/null | head -1 | xargs -r head -n 12
