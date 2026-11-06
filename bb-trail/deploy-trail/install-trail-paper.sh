#!/usr/bin/env bash
# BB-Trail PAPER lab bot: install next to the live bots WITHOUT touching them (re-runnable).
#   sudo bash deploy-trail/install-trail-paper.sh                     install or refresh the code, keeps the paper record
#   sudo bash deploy-trail/install-trail-paper.sh --uninstall         stop and remove services and code, keep the paper record
#   sudo bash deploy-trail/install-trail-paper.sh --uninstall --purge also delete the paper record and the user
# Touches:      user bbtrail, /opt/bbtrail, /var/lib/bbtrail, /etc/bbtrail.env, /etc/systemd/system/bbtrail*.{service,timer}
# Never touches: lucidio.service, icore.service, lucidio-1h.service, lucidio-recorder.service, their code, keys, state or config.
set -uo pipefail
DEST=/opt/bbtrail; DATA=/var/lib/bbtrail; SVC=bbtrail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LIVE_UNITS="lucidio icore"
step() { echo; echo "== $*"; }
ok()   { echo "   ok: $*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"

if [ "${1:-}" = "--uninstall" ]; then
  step "uninstall the BB-Trail paper lab (the live bots are not touched)"
  systemctl disable --now "$SVC.service" "$SVC-compare.timer" >/dev/null 2>&1 || true
  rm -f "/etc/systemd/system/$SVC.service" "/etc/systemd/system/$SVC-compare.service" "/etc/systemd/system/$SVC-compare.timer"; systemctl daemon-reload; rm -rf "$DEST"; ok "services and code removed"
  if [ "${2:-}" = "--purge" ]; then rm -rf "$DATA" /etc/bbtrail.env; userdel "$SVC" >/dev/null 2>&1 || true; ok "paper record, env file and user removed"; else ok "paper record kept in $DATA"; fi
  exit 0
fi

step "1. checks before anything changes"
FILES="icore.js icore-core.js realpaper.js live.js mexc.js config.js envfile.js telegram.js journal.js dashboard-push.js ledger-sync.js keyinfo.js matchkey.js compare-live-vs-backtest.js lab-report.js bot-config.json README-TRAIL.md"
for f in $FILES deploy-trail/bbtrail.service deploy-trail/bbtrail-compare.service deploy-trail/bbtrail-compare.timer deploy-trail/status.sh; do [ -f "$SRC/$f" ] || die "missing in the bundle: $f"; done
for c in SOL ZEC NEAR ADA GALA; do [ -f "$SRC/data/$c.json" ] || die "missing in the bundle: data/$c.json (the report's backtest numbers)"; done
[ ! -e "$SRC/mexc-keys.json" ] && [ ! -e "$SRC/.env" ] || die "the bundle holds keys or an .env file: refusing"
grep -q '"mode": "paper"' "$SRC/bot-config.json" || die "bot-config.json is not in paper mode: refusing"
grep -q '"realisticPaper": true' "$SRC/bot-config.json" || die "bot-config.json does not have realisticPaper on: refusing"
grep -q 'const liveAllowed = () => false;' "$SRC/icore.js" || die "icore.js has no paper lock: refusing"
grep -q 'kTrail: 14' "$SRC/icore-core.js" || die "icore-core.js is not the bb-trail core (14 ATR trail): refusing"
grep -q "bot: 'bbtr'" "$SRC/dashboard-push.js" || die "dashboard-push.js does not report as bbtr: refusing (it would mix into another bot)"
grep -q 'fundingHistory' "$SRC/mexc.js" || die "mexc.js has no funding history call: refusing"
[ -x /usr/bin/node ] || die "/usr/bin/node not found (the service needs it there)"
[ "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "node $(/usr/bin/node -v) is too old (20 or newer)"
ok "paper lock present, bb-trail core present, dashboard tag bbtr, no keys, node $(/usr/bin/node -v)"

live_times() { for u in $LIVE_UNITS; do echo "$u $(systemctl is-active "$u" 2>/dev/null || true) $(systemctl show "$u" -p ActiveEnterTimestampMonotonic 2>/dev/null || true)"; done; }
BEFORE="$(live_times)"

step "2. user, code (owned by root: the bot cannot change its own code or settings), data folder"
id "$SVC" >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin "$SVC" || die "could not create the user"
install -d -m 755 -o root -g root "$DEST" "$DEST/deploy-trail" "$DEST/data"
for f in $FILES; do install -m 644 -o root -g root "$SRC/$f" "$DEST/$f" || die "could not install $f"; done
for c in SOL ZEC NEAR ADA GALA; do install -m 644 -o root -g root "$SRC/data/$c.json" "$DEST/data/$c.json"; done
install -m 644 -o root -g root "$SRC/deploy-trail/status.sh" "$DEST/deploy-trail/status.sh"
install -d -m 750 -o "$SVC" -g "$SVC" "$DATA" "$DATA/audit"
ok "code in $DEST, paper record in $DATA"
if [ ! -e /etc/bbtrail.env ]; then
  install -m 600 -o root -g root /dev/null /etc/bbtrail.env
  printf '%s\n' '# BB-Trail paper lab. Dashboard: copy the two values from the live bot env file (same server, same secret); it reports as its own bot (bbtr).' \
    '#DASHBOARD_URL=https://YOUR-DASHBOARD-ADDRESS' '#DASHBOARD_PUSH_SECRET=' \
    '# Telegram trade messages (optional; labelled [TRAIL LAB] · PAPER). Same bot token and chat as the others is fine.' '#TELEGRAM_BOT_TOKEN=' '#TELEGRAM_CHAT_ID=' > /etc/bbtrail.env
  ok "created /etc/bbtrail.env (empty): fill DASHBOARD_URL and DASHBOARD_PUSH_SECRET to show this bot on the dashboard"
else ok "/etc/bbtrail.env kept"; fi

step "3. read-only pre-flight (public MEXC data, no keys)"
pre_flight() { PF="$(cd "$DEST" && sudo -u "$SVC" env ICORE_STATE_DIR="$DATA" ICORE_KEYS="$DATA/no-keys.json" ICORE_NO_NOTIFY=1 /usr/bin/node icore.js check 2>&1)"; RC=$?; }
pre_flight
if [ "$RC" -ne 0 ] && echo "$PF" | grep -q "forming candle MISSING"; then echo "   the new 4h candle is not on MEXC yet (just after the close): waiting 40 s and checking once more"; sleep 40; pre_flight; fi
echo "$PF" | grep -E '^(BAD|WARN)|candles|problem' | cut -c1-150
[ "$RC" -eq 0 ] || die "pre-flight found problems (above): the service was not started"
ok "pre-flight passed"

step "4. systemd: the bot (enabled: survives reboots, restarts itself) and the daily shadow-backtest comparison"
for u in bbtrail.service bbtrail-compare.service bbtrail-compare.timer; do install -m 644 "$SRC/deploy-trail/$u" "/etc/systemd/system/$u" || die "could not install $u"; done
systemctl daemon-reload
systemctl enable "$SVC.service" >/dev/null 2>&1 && ok "bot enabled"
systemctl enable --now "$SVC-compare.timer" >/dev/null 2>&1 && ok "daily comparison timer enabled (00:55 UTC)"
systemctl restart "$SVC.service"; sleep 8
systemctl is-active --quiet "$SVC" || die "not running: journalctl -u $SVC -n 30 --no-pager"
ok "running"; tail -n 3 "$DATA/bot.log" 2>/dev/null | cut -c1-150

step "5. summary"
AFTER="$(live_times)"
echo "$AFTER" | awk '{print "   "$1": "$2}'
if [ "$BEFORE" = "$AFTER" ]; then echo "   live bots' start times unchanged: YES"; else echo "   WARNING live bots' state or start time CHANGED, look now:"; diff <(echo "$BEFORE") <(echo "$AFTER"); fi
echo "   results:     sudo bash $DEST/deploy-trail/status.sh"
echo "   research:    sudo bash $DEST/deploy-trail/status.sh report"
echo "   vs backtest: sudo bash $DEST/deploy-trail/status.sh compare"
echo "   logs:        sudo journalctl -u $SVC -f"
