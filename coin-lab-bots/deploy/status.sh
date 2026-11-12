#!/usr/bin/env bash
# sudo bash /opt/<svc>/deploy/status.sh [coinbb|cointc]   — service state, last log lines, trades so far per coin (paper)
set -uo pipefail
S="${1:-}"; [ -n "$S" ] || S="$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)")"
D="/var/lib/$S"
echo "== $S: $(systemctl is-active "$S" 2>/dev/null) (since $(systemctl show "$S" -p ActiveEnterTimestamp --value 2>/dev/null))"
echo "== last log lines"; tail -n 8 "$D/bot.log" 2>/dev/null | cut -c1-170
J="$(find "$D" -name '*.jsonl' -path '*journal*' 2>/dev/null)"
if [ -n "$J" ]; then
  echo "== paper trades (from the journal)"
  for c in SUI ARB; do
    echo "   $c: entries $(cat $J | grep '"type":"entry"' | grep -c "\"symbol\":\"${c}_USDT\"")  exits $(cat $J | grep '"type":"exit"' | grep -c "\"symbol\":\"${c}_USDT\"")"
  done
  echo "   skipped signals: $(cat $J | grep -c '"type":"skip"')"
fi
