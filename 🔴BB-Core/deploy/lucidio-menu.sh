#!/usr/bin/env bash
# lucidio-menu.sh - arrow-key menu for the Lucid'io VPS (Up/Down + Enter; Esc leaves).
# Read-only except: kill switch, restart, Telegram test and "Update the bot code" (each asks first).
#   lucidio                       status first, then the menu          (installed as /usr/local/bin/lucidio)
#   lucidio --action trades       run one action and exit (status balance check trades equity log server update tg)
# Uses `whiptail` (standard on Ubuntu); without it a numbered list is shown instead.
# Everything is inside functions and the last line is "main; exit": bash has read the whole file before anything runs, so an update that
# replaces this very file (setup-vps.sh installs the new menu) cannot confuse the copy that is running.
APP="${APP:-/opt/lucidio}"
LUCIDIO_USER=lucidio
SRC="${LUCIDIO_SRC:-/opt/lucidio-src}"                 # mirror of the bot repo (root-owned); the running bot lives in $APP
BRANCH="${LUCIDIO_UPDATE_BRANCH:-main}"
DEPLOY_KEY="${LUCIDIO_DEPLOY_KEY:-/root/.ssh/lucidio_deploy}"
SUDO=sudo; if [ -n "${LUCIDIO_MENU_NOSUDO:-}" ] || [ "$(id -u)" = 0 ]; then SUDO=""; fi

as_root() { if [ -z "$SUDO" ]; then "$@"; else sudo "$@"; fi; }
as_bot() {   # run a command as the bot's user (needs the admin sudo password once per session)
  if [ -n "${LUCIDIO_MENU_NOSUDO:-}" ] || [ "$(id -un)" = "$LUCIDIO_USER" ]; then "$@"; else sudo -u "$LUCIDIO_USER" "$@"; fi
}
bot() { as_bot node "$APP/lucidio.js" "$@"; }
pause() { echo; read -rp "Press Enter to return to the menu... " _; }
head_line() { clear; echo "== $1 =="; echo; }

act_status()  { head_line "Bot status"; bot status; }
act_balance() { head_line "Account balance (MEXC futures)"; bot balance; }
act_check() {   # the CLI needs the same live flag the service has, or the live-gate row would complain
  head_line "Health check"
  if [ -f /etc/systemd/system/lucidio.service.d/live.conf ]; then as_bot env LUCIDIO_ALLOW_LIVE=1 node "$APP/lucidio.js" check; else bot check; fi
}
act_log()     { head_line "Recent log (last 40 lines)"; sudo journalctl -u lucidio -n 40 --no-pager; }
act_follow()  { head_line "Live log (Ctrl+C to stop and come back)"; ( trap - INT; sudo journalctl -u lucidio -f -n 15 ); }

act_trades() {
  head_line "Trades and skipped signals (last 12 events)"
  as_bot env APP="$APP" node -e '
const fs=require("fs");let L=[];
try{L=fs.readFileSync(process.env.APP+"/journal/trades.jsonl","utf8").trim().split("\n").filter(Boolean).map(x=>JSON.parse(x))}catch(e){console.log("No journal yet.");process.exit()}
const ev=L.filter(e=>e.type!=="session").slice(-12);
if(!ev.length)console.log("No trades or skipped signals yet (only bot starts).");
for(const e of ev){const t=e.ts.slice(0,16).replace("T"," ");
 if(e.type==="entry")console.log(t,"ENTRY",e.symbol,e.side,"@",e.entry.fill_price,"stop",e.sl,"tp",e.tp,"risk $"+(+e.risk.risk_usd).toFixed(2));
 else if(e.type==="exit")console.log(t,"EXIT ",e.symbol,e.side,e.exit_reason,(e.r_result>=0?"+":"")+(+e.r_result).toFixed(2)+"R","$"+(+e.usd_pnl).toFixed(2));
 else console.log(t,"SKIP ",e.symbol||"",e.side||"",e.reason,e.detail?("- "+e.detail):"")}
const n=(k)=>L.filter(e=>e.type===k).length;
console.log("\nbot starts:",n("session"),"| entries:",n("entry"),"| exits:",n("exit"),"| skipped signals:",n("skip"));'
}
act_equity() {
  head_line "Equity over time (account snapshots)"
  as_bot env APP="$APP" node -e '
const fs=require("fs");let L=[];
try{L=fs.readFileSync(process.env.APP+"/journal/snapshots.jsonl","utf8").trim().split("\n").filter(Boolean).map(x=>JSON.parse(x))}catch(e){}
if(!L.length){console.log("No snapshots yet.");process.exit()}
const a=L[0],b=L[L.length-1],m=(v)=>"$"+(+v).toFixed(2);
console.log("First :",a.ts.slice(0,16).replace("T"," "),"UTC  equity",m(a.equity),"("+a.mode+")");
console.log("Latest:",b.ts.slice(0,16).replace("T"," "),"UTC  equity",m(b.equity),"available",m(b.available));
console.log("Change:",(((b.equity/a.equity)-1)*100).toFixed(2)+"%","|",L.length,"snapshots");
console.log("Positions on MEXC:",(b.mexc_positions||[]).length,"| the bot believes:",(b.bot_positions||[]).length);
console.log("\nLast 8 snapshots:");for(const s of L.slice(-8))console.log(" ",s.ts.slice(0,16).replace("T"," "),m(s.equity))'
}
act_server() {
  head_line "Server health"
  echo "Uptime / load : $(uptime -p) | load $(cut -d' ' -f1-3 /proc/loadavg)"
  echo "Time (UTC)    : $(date -u '+%Y-%m-%d %H:%M:%S')"
  free -h | awk 'NR==1{print "Memory        : "$0} NR==2{print "                "$0}'
  df -h / | awk 'NR==2{print "Disk (/)      : "$3" used of "$2" ("$5")"}'
  echo "Bot service   : $(systemctl is-active lucidio) | restarts since boot: $(systemctl show lucidio -p NRestarts --value)" \
       "| memory $(systemctl show lucidio -p MemoryCurrent --value | awk '{printf "%.0f MB", $1/1048576}')"
  echo "Watchdog timer: $(systemctl is-active lucidio-watchdog.timer 2>/dev/null) | daily backup timer: $(systemctl is-active lucidio-backup.timer 2>/dev/null)"
  echo "Firewall      : $(sudo ufw status 2>/dev/null | head -1)"
  echo "Kill switch   : $(as_bot test -e "$APP/STOP" && echo 'ON (no new entries)' || echo off)"
  echo "Installed code: $(as_root node -e 'try{const b=require(process.argv[1]);console.log(String(b.commit).slice(0,7)+(b.dirty?" (built from uncommitted changes)":"")+" built "+b.built_at)}catch(e){console.log("unknown")}' "$APP/BUILD_INFO.json")"
}
act_tg() {
  head_line "Telegram test"
  as_bot node "$APP/deploy/watchdog.js" --notify "test from the VPS menu" && echo "Sent. Check Telegram."
}
act_kill() {
  head_line "Kill switch"
  if as_bot test -e "$APP/STOP"; then     # as the bot user: $APP is private to it, admin could not even see the file
    echo "The kill switch is ON: the bot opens no new trades (open trades keep their stop/target on MEXC)."
    read -rp "Switch it OFF and resume trading? [y/N] " a; [ "$a" = y ] && as_bot rm -f "$APP/STOP" && echo "Kill switch OFF."
  else
    echo "The kill switch is OFF: the bot trades normally."
    read -rp "Switch it ON (no new entries; open trades stay protected on MEXC)? [y/N] " a; [ "$a" = y ] && as_bot touch "$APP/STOP" && echo "Kill switch ON."
  fi
}

# true when a 4h candle closes within 5 minutes, or closed less than 12 minutes ago (candles close at multiples of 14400 s since the epoch = 00/04/08/12/16/20 UTC)
near_candle_close() { local m=$(( ${LUCIDIO_NOW:-$(date +%s)} % 14400 )); [ "$m" -lt 720 ] || [ "$m" -ge $((14400 - 300)) ]; }
act_restart() {
  head_line "Restart the bot"
  echo "Time now: $(date -u +%H:%M) UTC. Candles close at 00, 04, 08, 12, 16 and 20 UTC."
  echo "Do NOT restart within ~10 minutes of a candle close: a signal check could be missed."
  read -rp "Restart now? [y/N] " a
  if [ "$a" = y ]; then sudo systemctl restart lucidio; sleep 4; sudo journalctl -u lucidio -n 6 --no-pager; fi
}

# ---- update: GitHub -> mirror in $SRC -> tests -> bundle (same package.sh + setup-vps.sh as a manual update) -> automatic rollback if the bot does not come back
git_run() { as_root env GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" git "$@"; }
git_src() { git_run -C "$SRC" "$@"; }
act_update() {
  head_line "Update the bot code from GitHub"
  command -v git >/dev/null 2>&1 || { echo "git is not installed on this server. Run:  sudo apt-get install -y git   then try again."; return 1; }
  if ! as_root test -d "$SRC/.git"; then
    echo "First time: there is no copy of the code at $SRC yet."
    echo "Paste the address of the bot repo. A private repo uses the SSH form:  git@github.com:YOUR-NAME/YOUR-REPO.git"
    read -rp "Repo address: " url; [ -z "$url" ] && { echo "Cancelled."; return 1; }
    case "$url" in git@*|ssh://*)
      if ! as_root test -f "$DEPLOY_KEY"; then
        as_root mkdir -p "$(dirname "$DEPLOY_KEY")"; as_root chmod 700 "$(dirname "$DEPLOY_KEY")"
        as_root ssh-keygen -q -t ed25519 -N "" -C "lucidio-vps-deploy" -f "$DEPLOY_KEY" || return 1
      fi
      echo; echo "Add this key on GitHub as a READ-ONLY deploy key:"
      echo "  repo -> Settings -> Deploy keys -> Add deploy key  (leave 'Allow write access' UNCHECKED), paste:"; echo
      as_root cat "$DEPLOY_KEY.pub"; echo
      read -rp "Press Enter once the key is added on GitHub... " _;;
    esac
    as_root mkdir -p "$(dirname "$SRC")"
    git_run clone --quiet --depth 20 --branch "$BRANCH" "$url" "$SRC" || { echo "Could not clone $url (branch $BRANCH). Check the address, the deploy key, and the branch name."; return 1; }
  fi
  git_src fetch --quiet --depth 20 origin "$BRANCH" || { echo "Could not reach GitHub (network, or the deploy key was removed)."; return 1; }
  local after deployed was now_state installed
  after=$(git_src rev-parse FETCH_HEAD) || return 1
  deployed=$(as_root cat "$SRC/.deployed-commit" 2>/dev/null || true)
  if [ "$deployed" = "$after" ]; then echo "Already up to date: $(git_src log -1 --format='%h %s' "$after")"; return 0; fi
  echo "What is new on GitHub ($BRANCH):"; echo
  git_src log -n 8 --date=format:'%Y-%m-%d %H:%M' --format='  %h  %ad  %s' "$after"
  if [ -n "$deployed" ] && git_src cat-file -e "$deployed^{commit}" 2>/dev/null; then echo; git_src diff --stat "$deployed" "$after" | tail -n 15
  else echo; echo "(the installed version is not known to this copy: showing the latest commits only)"; fi
  echo; read -rp "Install this update? [y/N] " a; [ "$a" = y ] || { echo "Cancelled. Nothing was changed."; return 0; }
  if near_candle_close; then
    echo; echo "A 4-hour candle closes within a few minutes (or just closed). The bot is about to make, or just made, its trade decision;"
    echo "the update restarts it, which could cost a signal. Better: try again 15 minutes after the hour (00/04/08/12/16/20 UTC)."
    read -rp "Type force to continue anyway, or press Enter to cancel: " a; [ "$a" = force ] || { echo "Cancelled. Nothing was changed."; return 0; }
  fi
  git_src checkout --quiet --force --detach "$after" || return 1
  if [ -z "${LUCIDIO_UPDATE_SKIP_TESTS:-}" ]; then
    echo; echo "Running the safety tests on the new code (a minute or two)..."
    local t t0
    for t in selftest ops-test journal-test fixes-test; do
      [ -f "$SRC/test/$t.js" ] || continue
      t0=$SECONDS
      if as_root bash -c "cd '$SRC' && timeout 900 node test/$t.js > /tmp/lucidio-update-$t.log 2>&1"; then printf '  PASS  %-13s %s s\n' "$t" "$((SECONDS - t0))"
      else printf '  FAIL  %-13s\n' "$t"; tail -n 15 "/tmp/lucidio-update-$t.log"; echo; echo "NOT installed: the bot keeps running the old code."; return 1; fi
    done
  fi
  local W=/tmp/lucidio-update
  as_root rm -rf "$W"; as_root mkdir -p "$W"
  echo; echo "Building the bundle (also scans it for secrets)..."
  as_root bash -c "cd '$SRC' && OUT='$W/lucidio-deploy.tar.gz' bash deploy/package.sh" > /tmp/lucidio-update-package.log 2>&1 \
    || { tail -n 15 /tmp/lucidio-update-package.log; echo; echo "NOT installed: the bundle could not be built."; return 1; }
  if [ -n "${LUCIDIO_UPDATE_DRYRUN:-}" ]; then echo "(dry run: stopping before the install)"; return 0; fi
  as_root bash -c "cd '$W' && sha256sum -c lucidio-deploy.tar.gz.sha256 >/dev/null && tar -xzf lucidio-deploy.tar.gz" || { echo "NOT installed: the bundle check failed."; return 1; }
  was=$(systemctl is-active lucidio 2>/dev/null || true)
  echo; echo "Installing (the bot restarts for a few seconds)..."
  as_root bash -c "cd '$W/lucidio' && bash deploy/setup-vps.sh" 2>&1 | tail -n 14
  sleep 8
  now_state=$(systemctl is-active lucidio 2>/dev/null || true)
  installed=$(as_root node -e 'try{console.log(require(process.argv[1]).commit)}catch(e){}' "$APP/BUILD_INFO.json")
  if [ "$was" = active ] && [ "$now_state" != active ]; then
    echo; echo "!! The bot did not come back up with the new code (service: $now_state). Rolling back to the previous code..."
    as_root bash "$APP/deploy/rollback.sh" 2>&1 | tail -n 4
    return 1
  fi
  if [ "$installed" != "$after" ]; then echo; echo "!! The install did not finish (installed code is ${installed:0:7}, expected ${after:0:7}). The bot is still $now_state on the old code."; return 1; fi
  echo "$after" | as_root tee "$SRC/.deployed-commit" >/dev/null
  echo; echo "Updated to: $(git_src log -1 --format='%h %s' "$after")"
  as_bot node "$APP/deploy/watchdog.js" --notify "code updated to $(git_src log -1 --format='%h: %s' "$after")" >/dev/null 2>&1 || true
  sudo journalctl -u lucidio -n 6 --no-pager
}

run_action() {
  case "$1" in
    status) act_status;; balance) act_balance;; check) act_check;; trades) act_trades;; equity) act_equity;;
    log) act_log;; follow) act_follow;; server) act_server;; update) act_update;; tg) act_tg;; kill) act_kill;; restart) act_restart;;
    *) echo "unknown action: $1"; return 2;;
  esac
}

main() {
  if [ "${1:-}" = "--action" ]; then run_action "${2:-}"; return $?; fi
  trap : INT       # Ctrl+C stops a running action, not the menu
  head_line "Lucid'io VPS - $(date -u '+%Y-%m-%d %H:%M UTC')"
  act_status 2>&1 || true
  pause
  local ITEMS=(
    status  "Bot status (mode, positions, results)"
    balance "Account balance on MEXC"
    check   "Health check (clock, API key, contracts, gates)"
    trades  "Trades and skipped signals"
    equity  "Equity over time (snapshots)"
    log     "Recent log (last 40 lines)"
    follow  "Live log (Ctrl+C to stop)"
    server  "Server health (load, memory, disk, installed code)"
    update  "Update the bot code from GitHub"
    tg      "Send a Telegram test message"
    kill    "Kill switch (show / on / off)"
    restart "Restart the bot"
    shell   "Open a normal command line"
    exit    "Disconnect"
  )
  local choice n i
  while true; do
    if command -v whiptail >/dev/null 2>&1; then
      choice=$(whiptail --title "Lucid'io VPS" --menu "Up/Down arrows to move, Enter to select, Esc to leave" 24 72 14 "${ITEMS[@]}" 3>&1 1>&2 2>&3) || break
    else
      echo; for ((i=0;i<${#ITEMS[@]};i+=2)); do printf '  %2d) %s\n' $((i/2+1)) "${ITEMS[i+1]}"; done
      read -rp "Number (empty = leave): " n; [ -z "$n" ] && break
      choice="${ITEMS[$(( (n-1)*2 ))]:-}"; [ -z "$choice" ] && continue
    fi
    case "$choice" in
      exit) break;;
      shell) clear; echo "Normal command line. Type 'exit' to disconnect."; exec bash -l;;
      *) run_action "$choice"; pause;;
    esac
  done
  clear; echo "Menu closed. Disconnecting."
}
main "$@"; exit $?
