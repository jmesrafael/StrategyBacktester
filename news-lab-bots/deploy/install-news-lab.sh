#!/usr/bin/env bash
# NEWS LAB: three PAPER bots with the news gate (BB-CORE, I-CORE, T-CORE), installed next to the live bots WITHOUT touching them (re-runnable).
#   sudo bash deploy/install-news-lab.sh                      install or refresh all three (keeps their paper records)
#   sudo bash deploy/install-news-lab.sh --only newsbb        one of newsbb | newsic | newstc
#   sudo bash deploy/install-news-lab.sh --uninstall [--purge]   stop and remove services and code (--purge: also records, env files, users)
# Touches:      users newsbb/newsic/newstc, /opt/news{bb,ic,tc}, /var/lib/news{bb,ic,tc}, /etc/news{bb,ic,tc}.env, /etc/systemd/system/news{bb,ic,tc}.service
# Never touches: lucidio, icore, tcore, bbtrail, lucidio-1h, lucidio-recorder: their code, keys, state, config or services.
# ORDER: the dashboard (ledger) must already know the tags bbn / icn / tcn, or it refuses these bots' reports.
set -uo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALL="newsbb newsic newstc"
LIVE_UNITS="lucidio icore tcore bbtrail lucidio-1h lucidio-recorder"
step() { echo; echo "== $*"; }
ok()   { echo "   ok: $*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"

dir_of()  { case "$1" in newsbb) echo news-bb;; newsic) echo news-ic;; newstc) echo news-tc;; esac; }
main_of() { case "$1" in newsbb) echo lucidio.js;; *) echo icore.js;; esac; }
envp_of() { case "$1" in newsbb) echo LUCIDIO;; *) echo ICORE;; esac; }
tag_of()  { case "$1" in newsbb) echo bbn;; newsic) echo icn;; newstc) echo tcn;; esac; }

SVCS="$ALL"
if [ "${1:-}" = "--only" ]; then case "${2:-}" in newsbb|newsic|newstc) SVCS="$2";; *) die "--only needs newsbb, newsic or newstc";; esac; fi

if [ "${1:-}" = "--uninstall" ]; then
  step "uninstall the news lab (live bots are not touched)"
  for s in $ALL; do
    systemctl disable --now "$s.service" >/dev/null 2>&1 || true
    rm -f "/etc/systemd/system/$s.service"; rm -rf "/opt/$s"
    if [ "${2:-}" = "--purge" ]; then rm -rf "/var/lib/$s" "/etc/$s.env"; userdel "$s" >/dev/null 2>&1 || true; fi
  done
  systemctl daemon-reload
  if [ "${2:-}" = "--purge" ]; then ok "services, code, paper records, env files and users removed"; else ok "services and code removed, paper records kept in /var/lib/news*"; fi
  exit 0
fi

live_times() { for u in $LIVE_UNITS; do echo "$u $(systemctl is-active "$u" 2>/dev/null || true) $(systemctl show "$u" -p ActiveEnterTimestampMonotonic 2>/dev/null || true)"; done; }
BEFORE="$(live_times)"

step "1. checks before anything changes"
[ -x /usr/bin/node ] || die "/usr/bin/node not found (the services need it there)"
[ "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "node $(/usr/bin/node -v) is too old (20 or newer)"
find "$SRC" \( -name 'mexc-keys*.json' -o -name '.env' -o -name '*.pem' \) | grep -q . && die "the bundle holds keys or an .env file: refusing"
for s in $SVCS; do
  d="$SRC/$(dir_of "$s")"; m="$(main_of "$s")"; t="$(tag_of "$s")"
  [ -f "$d/$m" ] || die "$s: $m missing in the bundle"
  [ -f "$SRC/deploy/$s.service" ] || die "$s: deploy/$s.service missing"
  for c in SOL ZEC NEAR ADA GALA; do [ -f "$d/data/$c.json" ] || die "$s: data/$c.json missing"; done
  grep -q '"mode": "paper"' "$d/bot-config.json"           || die "$s: bot-config.json is not paper: refusing"
  grep -q '"realisticPaper": true' "$d/bot-config.json"    || die "$s: realisticPaper is not on: refusing"
  grep -q 'const liveAllowed = () => false;' "$d/$m"       || die "$s: no paper lock in $m: refusing"
  grep -q 'newsgate.decide(opt.news' "$d/$m"               || die "$s: no news gate in $m: refusing"
  [ -f "$d/newsgate.js" ] && [ -f "$d/realpaper.js" ]      || die "$s: newsgate.js or realpaper.js missing"
  grep -q "bot: '$t'" "$d/dashboard-push.js"               || die "$s: dashboard-push.js does not report as $t: refusing (it would mix into another bot)"
  grep -q "news lab: Telegram is disabled in this build" "$d/telegram.js" || die "$s: telegram.js is not disabled: refusing"
  if [ -f "/etc/$s.env" ] && grep -qE '^[[:space:]]*(export[[:space:]]+)?TELEGRAM_' "/etc/$s.env"; then die "/etc/$s.env sets TELEGRAM_*: remove those lines (paper bots send no messages)"; fi
  ok "$s: paper lock, news gate, tag $t, Telegram off, no keys"
done

for s in $SVCS; do
  d="$SRC/$(dir_of "$s")"; m="$(main_of "$s")"; e="$(envp_of "$s")"
  step "2. $s: user, code (owned by root), data folder, env file"
  id "$s" >/dev/null 2>&1 || useradd --system --home "/opt/$s" --shell /usr/sbin/nologin "$s" || die "could not create user $s"
  rm -rf "/opt/$s.new"; install -d -m 755 -o root -g root "/opt/$s.new" "/opt/$s.new/data" "/opt/$s.new/deploy"
  for f in "$d"/*.js "$d"/*.json; do install -m 644 -o root -g root "$f" "/opt/$s.new/$(basename "$f")" || die "could not install $f"; done
  for c in SOL ZEC NEAR ADA GALA; do install -m 644 -o root -g root "$d/data/$c.json" "/opt/$s.new/data/$c.json"; done
  install -m 644 -o root -g root "$SRC/deploy/status.sh" "/opt/$s.new/deploy/status.sh"
  rm -rf "/opt/$s"; mv "/opt/$s.new" "/opt/$s"
  install -d -m 750 -o "$s" -g "$s" "/var/lib/$s"
  if [ ! -e "/etc/$s.env" ]; then
    install -m 600 -o root -g root /dev/null "/etc/$s.env"
    printf '%s\n' "# $s (news lab, paper). Dashboard: the same two values as the live bot (it reports as its own bot, tag $(tag_of "$s")). NEVER put TELEGRAM_* here." \
      '#DASHBOARD_URL=https://YOUR-DASHBOARD-ADDRESS' '#DASHBOARD_PUSH_SECRET=' > "/etc/$s.env"
    ok "created /etc/$s.env (dashboard values commented out)"
  else ok "/etc/$s.env kept"; fi

  step "3. $s: read-only pre-flight (public MEXC data, no keys, no Telegram)"
  PF="$(cd "/opt/$s" && sudo -u "$s" env "${e}_STATE_DIR=/var/lib/$s" "${e}_KEYS=/var/lib/$s/no-keys.json" "${e}_ENV_FILE=/var/lib/$s/no-env-file" "${e}_NO_NOTIFY=1" /usr/bin/node "$m" check 2>&1)"; RC=$?
  if [ "$RC" -ne 0 ] && echo "$PF" | grep -q "forming candle MISSING"; then echo "   the new 4h candle is not on MEXC yet: waiting 40 s"; sleep 40; PF="$(cd "/opt/$s" && sudo -u "$s" env "${e}_STATE_DIR=/var/lib/$s" "${e}_KEYS=/var/lib/$s/no-keys.json" "${e}_ENV_FILE=/var/lib/$s/no-env-file" "${e}_NO_NOTIFY=1" /usr/bin/node "$m" check 2>&1)"; RC=$?; fi
  echo "$PF" | grep -E '^(BAD|WARN)|candles|problem' | cut -c1-150
  [ "$RC" -eq 0 ] || die "$s: pre-flight found problems (above): not started"
  ok "$s: pre-flight passed"

  step "4. $s: systemd"
  install -m 644 "$SRC/deploy/$s.service" "/etc/systemd/system/$s.service" || die "could not install $s.service"
  systemctl daemon-reload
  systemctl enable "$s.service" >/dev/null 2>&1 && ok "$s enabled (survives reboots)"
  systemctl restart "$s.service"; sleep 6
  systemctl is-active --quiet "$s" || die "$s is not running: journalctl -u $s -n 30 --no-pager"
  ok "$s running"
done

step "5. summary"
AFTER="$(live_times)"
echo "$AFTER" | awk '{print "   "$1": "$2}'
if [ "$BEFORE" = "$AFTER" ]; then echo "   live bots' start times unchanged: YES"; else echo "   WARNING live bots' state or start time CHANGED, look now:"; diff <(echo "$BEFORE") <(echo "$AFTER"); fi
for s in $SVCS; do echo "   $s: $(systemctl is-active "$s")   status: sudo bash /opt/$s/deploy/status.sh $s"; done
echo "   dashboard: fill DASHBOARD_URL + DASHBOARD_PUSH_SECRET in /etc/news*.env (copy from the live bot env), then: sudo systemctl restart newsbb newsic newstc"
