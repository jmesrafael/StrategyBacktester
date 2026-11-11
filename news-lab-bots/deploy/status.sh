#!/usr/bin/env bash
# sudo bash /opt/<svc>/deploy/status.sh [newsbb|newsic|newstc]   — service state, last log lines, how often the news gate vetoed or shrank entries
set -uo pipefail
S="${1:-}"; [ -n "$S" ] || S="$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)")"
D="/var/lib/$S"
echo "== $S: $(systemctl is-active "$S" 2>/dev/null) (since $(systemctl show "$S" -p ActiveEnterTimestamp --value 2>/dev/null))"
echo "== last log lines"; tail -n 8 "$D/bot.log" 2>/dev/null | cut -c1-170
J="$(find "$D" -name '*.jsonl' -path '*journal*' 2>/dev/null)"
if [ -n "$J" ]; then
  echo "== news gate (from the journal)"
  echo "   entries:              $(cat $J | grep -c '"type":"entry"')"
  echo "   vetoed (news_gate):   $(cat $J | grep -c '"reason":"news_gate"')"
  echo "   entries shrunk:       $(cat $J | grep '"type":"entry"' | grep -c '"mult":0\.')"
  echo "   signal unavailable:   $(cat $J | grep '"type":"entry"' | grep -c '"source":"unavailable"')"
  echo "   last vetoes:"; cat $J | grep '"reason":"news_gate"' | tail -n 5 | sed -E 's/.*"symbol":"([A-Z_]+)".*"side":"([a-z]+)".*"detail":"([^"]*)".*/     \1 \2 · \3/' | cut -c1-160
fi
grep -h 'news signal unavailable' "$D/bot.log" 2>/dev/null | tail -n 2 | sed 's/^/   /'
