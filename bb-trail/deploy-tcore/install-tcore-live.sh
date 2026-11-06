#!/usr/bin/env bash
# T-CORE LIVE bot: install next to the other bots WITHOUT touching them (re-runnable). Installing does NOT start trading.
#   sudo bash deploy-tcore/install-tcore-live.sh             install or refresh code and units; the bot stays STOPPED (state, journal and keys are kept)
#   sudo bash deploy-tcore/install-tcore-live.sh --start     after make-keys.sh and a passed test trade: pre-flight, then start the bot, its daily comparison and wallet reports
#   sudo bash deploy-tcore/install-tcore-live.sh --stop      stop trading (open positions stay on MEXC with their stop) and the wallet reports
#   sudo bash deploy-tcore/install-tcore-live.sh --uninstall stop and remove units and code; keeps /var/lib/tcore (state, journal, keys)
# Touches:      user tcore, /opt/tcore, /var/lib/tcore, /etc/tcore.env, /etc/cron.d/tcore-wallet, /etc/systemd/system/tcore*.{service,timer}
# Never touches: lucidio, icore, lucidio-1h, bbtrail (the T-CORE paper lab), lucidio-recorder: their code, keys, state or config.
set -uo pipefail
DEST=/opt/tcore; DATA=/var/lib/tcore; SVC=tcore; KEYS=/var/lib/tcore/mexc-keys.json
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OTHER_UNITS="lucidio icore lucidio-1h bbtrail"
step() { echo; echo "== $*"; }
ok()   { echo "   ok: $*"; }
die()  { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"
other_times() { for u in $OTHER_UNITS; do echo "$u $(systemctl is-active "$u" 2>/dev/null || true) $(systemctl show "$u" -p ActiveEnterTimestampMonotonic 2>/dev/null || true)"; done; }
summary() {
  step "summary"
  AFTER="$(other_times)"; echo "$AFTER" | awk '{print "   "$1": "$2}'
  if [ "$BEFORE" = "$AFTER" ]; then echo "   other bots' start times unchanged: YES"; else echo "   WARNING other bots' state or start time CHANGED, look now:"; diff <(echo "$BEFORE") <(echo "$AFTER"); fi
  echo "   tcore: $(systemctl is-active $SVC 2>/dev/null) · status: sudo bash $DEST/deploy-tcore/status.sh"
}
BEFORE="$(other_times)"
pf() { PF="$(cd "$DEST" && sudo -u "$SVC" env ICORE_STATE_DIR="$DATA" ICORE_KEYS="$KEYS" ICORE_ALLOW_LIVE=1 ICORE_NO_NOTIFY=1 /usr/bin/node icore.js check 2>&1)"; RC=$?; }

case "${1:-}" in
  --uninstall)
    step "uninstall T-CORE live (the other bots are not touched; open positions stay on MEXC with their stop)"
    systemctl disable --now "$SVC.service" "$SVC-compare.timer" >/dev/null 2>&1 || true; rm -f /etc/cron.d/tcore-wallet
    rm -f "/etc/systemd/system/$SVC.service" "/etc/systemd/system/$SVC-compare.service" "/etc/systemd/system/$SVC-compare.timer"; systemctl daemon-reload; rm -rf "$DEST"
    ok "units and code removed; $DATA (state, journal, keys) kept"; summary; exit 0 ;;
  --stop)
    step "stop T-CORE live"
    systemctl disable --now "$SVC.service" >/dev/null 2>&1 || true; rm -f /etc/cron.d/tcore-wallet
    ok "bot stopped and disabled, wallet reports off (open positions stay on MEXC with their stop; check them in the MEXC app)"; summary; exit 0 ;;
  --start)
    step "pre-flight before going live"
    [ -d "$DEST" ] || die "not installed yet: run this script without --start first"
    [ -f "$KEYS" ] || die "no key file: sudo bash $DEST/deploy-tcore/make-keys.sh"
    node -e 'const k=require(process.argv[1]); if(!k.apiKey||!k.apiSecret) process.exit(3); if(k.ledgerWallet!=="tcore"||!k.ledgerWalletKey) process.exit(4)' "$KEYS"; c=$?
    [ $c -eq 3 ] && die "the key file has no MEXC key: sudo bash $DEST/deploy-tcore/make-keys.sh"
    [ $c -eq 4 ] && die "the key file has no ledger wallet key for 'tcore': register the wallet (LEDGER/scripts/new-wallet-key.mjs tcore), then make-keys.sh"
    [ -f "$DATA/test-trade-passed" ] || die "no passed test trade recorded: run the test trade first (TCORE-LIVE-GO.md step 6), then: sudo touch $DATA/test-trade-passed"
    pf; echo "$PF" | grep -E '^(BAD|WARN|OK)' | cut -c1-160
    [ "$RC" -eq 0 ] || die "pre-flight found problems (above): not started"
    ok "pre-flight passed"
    step "start: bot, daily comparison, wallet reports to the ledger"
    systemctl enable --now "$SVC-compare.timer" >/dev/null 2>&1 && ok "daily comparison timer on (00:58 UTC)"
    systemctl enable "$SVC.service" >/dev/null 2>&1; systemctl restart "$SVC.service"; sleep 10
    systemctl is-active --quiet "$SVC" || die "not running: journalctl -u $SVC -n 30 --no-pager"
    ok "T-CORE LIVE running"; tail -n 4 "$DATA/bot.log" 2>/dev/null | cut -c1-160
    printf '%s\n' '# T-CORE live: its own wallet report to the ledger every 5 minutes (read-only on MEXC)' \
      '*/5 * * * * tcore ICORE_STATE_DIR=/var/lib/tcore ICORE_KEYS=/var/lib/tcore/mexc-keys.json node /opt/tcore/icore.js ledger-wallet-sync >> /var/log/ledger-wallet-tcore.log 2>&1' > /etc/cron.d/tcore-wallet
    chmod 644 /etc/cron.d/tcore-wallet; touch /var/log/ledger-wallet-tcore.log; chown tcore:tcore /var/log/ledger-wallet-tcore.log
    ok "wallet reports every 5 minutes (/var/log/ledger-wallet-tcore.log)"
    summary; exit 0 ;;
  "") ;;
  *) die "unknown option $1" ;;
esac

step "1. checks before anything changes"
FILES="icore.js icore-core.js realpaper.js live.js mexc.js config.js envfile.js telegram.js journal.js dashboard-push.js ledger-sync.js keyinfo.js matchkey.js compare-live-vs-backtest.js lab-report.js bot-config.json README-TRAIL.md"
for f in $FILES deploy-tcore/tcore.service deploy-tcore/tcore-compare.service deploy-tcore/tcore-compare.timer deploy-tcore/status.sh deploy-tcore/make-keys.sh; do [ -f "$SRC/$f" ] || die "missing in the bundle: $f"; done
for c in SOL ZEC NEAR ADA GALA; do [ -f "$SRC/data/$c.json" ] || die "missing in the bundle: data/$c.json"; done
[ ! -e "$SRC/mexc-keys.json" ] && [ ! -e "$SRC/.env" ] || die "the bundle holds keys or an .env file: refusing"
grep -q '"mode": "live"' "$SRC/bot-config.json" || die "bot-config.json is not the live config: refusing (build with build-tcore-live.sh)"
grep -q "process.env.ICORE_ALLOW_LIVE === '1'" "$SRC/icore.js" || die "icore.js has no live gate: this is the paper build, refusing"
grep -q 'kTrail: 14' "$SRC/icore-core.js" || die "icore-core.js is not the T-CORE core (14 ATR trail): refusing"
grep -q "bot: 'tcore'" "$SRC/dashboard-push.js" || die "dashboard-push.js does not report as tcore: refusing (it would mix into the paper lab)"
[ -x /usr/bin/node ] || die "/usr/bin/node not found"
[ "$(/usr/bin/node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || die "node $(/usr/bin/node -v) is too old (20 or newer)"
ok "live build, T-CORE core, dashboard tag tcore, no keys in the bundle, node $(/usr/bin/node -v)"

step "2. user, code (owned by root: the bot cannot change its own code or settings), data folder"
WAS_ACTIVE="$(systemctl is-active $SVC 2>/dev/null || true)"
id "$SVC" >/dev/null 2>&1 || useradd --system --home "$DEST" --shell /usr/sbin/nologin "$SVC" || die "could not create the user"
install -d -m 755 -o root -g root "$DEST" "$DEST/deploy-tcore" "$DEST/data"
for f in $FILES; do install -m 644 -o root -g root "$SRC/$f" "$DEST/$f" || die "could not install $f"; done
for c in SOL ZEC NEAR ADA GALA; do install -m 644 -o root -g root "$SRC/data/$c.json" "$DEST/data/$c.json"; done
for f in status.sh make-keys.sh install-tcore-live.sh; do install -m 755 -o root -g root "$SRC/deploy-tcore/$f" "$DEST/deploy-tcore/$f"; done
install -d -m 750 -o "$SVC" -g "$SVC" "$DATA" "$DATA/audit"
ok "code in $DEST, state in $DATA"
if [ ! -e /etc/tcore.env ]; then
  install -m 600 -o root -g root /dev/null /etc/tcore.env
  if [ -f /opt/lucidio/.env ]; then grep -E '^(DASHBOARD_URL|DASHBOARD_PUSH_SECRET|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)=' /opt/lucidio/.env >> /etc/tcore.env || true; fi
  ok "created /etc/tcore.env with $(grep -cE '^(DASHBOARD_|TELEGRAM_)' /etc/tcore.env) dashboard/Telegram value(s) copied from the BB-Core env (not shown)"
else ok "/etc/tcore.env kept"; fi

step "3. systemd units (the bot is NOT started by this step)"
for u in tcore.service tcore-compare.service tcore-compare.timer; do install -m 644 "$SRC/deploy-tcore/$u" "/etc/systemd/system/$u" || die "could not install $u"; done
systemctl daemon-reload
if [ "$WAS_ACTIVE" = "active" ]; then systemctl restart "$SVC.service"; sleep 8; systemctl is-active --quiet "$SVC" && ok "was running: restarted on the new code" || die "restart failed: journalctl -u $SVC -n 30 --no-pager"
else ok "units installed, bot stopped (start it with --start after the keys and the test trade)"; fi

step "4. read-only pre-flight (public MEXC data; the account part needs the key)"
pf; echo "$PF" | grep -E '^(BAD|WARN|OK)' | cut -c1-160
if [ -f "$KEYS" ]; then [ "$RC" -eq 0 ] && ok "pre-flight passed" || echo "   pre-flight has problems (above): fix them before --start"
else echo "   no key file yet: next step is  sudo bash $DEST/deploy-tcore/make-keys.sh"; fi
summary
