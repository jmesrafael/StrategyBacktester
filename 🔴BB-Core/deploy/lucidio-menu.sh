#!/usr/bin/env bash
# lucidio-menu.sh - arrow-key menu for the Lucid'io VPS (arrow keys + Enter; Esc leaves). The header clock is live (redrawn every second).
# Read-only except: kill switch, restart, Telegram test and "Pull changes from GitHub" (each asks first).
#   lucidio                       status first, then the menu          (installed as /usr/local/bin/lucidio)
#   lucidio --action trades       run one action and exit (status balance check trades details equity log server update tg)
# The menu is drawn by this script itself (arrow keys, no dialog tool needed); on a dumb terminal a numbered list is shown instead.
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
pause() { echo; read -rp "Press Enter to ${1:-return to the menu}... " _; }
head_line() { clear; echo "== $1 =="; echo; }

# Times are shown as 'Oct 23, 2026' and '4:40pm' (12-hour, no seconds, no space before am/pm). UTC is what the bot and the candles use; "your time" is your PC's clock.
MY_UTC_OFFSET="${LUCIDIO_MY_UTC_OFFSET:-8}"     # hours your PC is ahead of UTC (+8). Only used to show your own clock time; change it here if you move.
c12() { date -u -d "@$1" '+%-I:%M%P'; }          # epoch seconds -> 4:40pm
now_str() { local e=${1:-$(date +%s)}; printf '%s UTC | %s your time (UTC%+d)' "$(c12 "$e")" "$(c12 $((e + MY_UTC_OFFSET * 3600)))" "$MY_UTC_OFFSET"; }
dt_str() { printf '%s %s UTC' "$(date -u -d "@$1" '+%b %-d, %Y')" "$(c12 "$1")"; }   # Oct 23, 2026 4:40pm UTC
candle_times() {   # the six daily 4-hour candle closes, in UTC and in your time
  local h u="" l=""
  for h in 0 4 8 12 16 20; do u+="$(c12 $((h * 3600))), "; l+="$(c12 $((h * 3600 + MY_UTC_OFFSET * 3600))), "; done
  printf '%s UTC  =  %s your time' "${u%, }" "${l%, }"
}
H12_JS='const M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];const h12=(ts)=>{const d=new Date(ts);let h=d.getUTCHours();const m=String(d.getUTCMinutes()).padStart(2,"0"),ap=h>=12?"pm":"am";h=h%12||12;return M[d.getUTCMonth()]+" "+d.getUTCDate()+", "+d.getUTCFullYear()+" "+h+":"+m+ap+" UTC"};'

act_status()  { head_line "Bot status"; bot status; }
act_balance() { head_line "Account balance"; bot balance; }
act_check() {   # the CLI needs the same live flag the service has, or the live-gate row would complain
  head_line "Health check"
  if [ -f /etc/systemd/system/lucidio.service.d/live.conf ]; then as_bot env LUCIDIO_ALLOW_LIVE=1 node "$APP/lucidio.js" check; else bot check; fi
  echo; as_bot node "$APP/keyinfo.js" --status 2>/dev/null || true
}
act_log()     { head_line "Recent log (last 40 lines)"; sudo journalctl -u lucidio -n 40 --no-pager; }
act_follow()  { head_line "Live log (Ctrl+C to stop and come back)"; ( trap - INT; sudo journalctl -u lucidio -f -n 15 ); }

act_trades() {
  head_line "Trades and skipped signals (last 12 events)"
  as_bot env APP="$APP" node -e "$H12_JS"'
const fs=require("fs");let L=[];
try{L=fs.readFileSync(process.env.APP+"/journal/trades.jsonl","utf8").trim().split("\n").filter(Boolean).map(x=>JSON.parse(x))}catch(e){console.log("No journal yet.");process.exit()}
const ev=L.filter(e=>e.type!=="session").slice(-12);
if(!ev.length)console.log("No trades or skipped signals yet (only bot starts).");
for(const e of ev){const t=h12(e.ts);
 if(e.type==="entry")console.log(t,"ENTRY",e.symbol,e.side,"@",e.entry.fill_price,"stop",e.sl,"tp",e.tp,"risk $"+(+e.risk.risk_usd).toFixed(2));
 else if(e.type==="exit")console.log(t,"EXIT ",e.symbol,e.side,e.exit_reason,(e.r_result>=0?"+":"")+(+e.r_result).toFixed(2)+"R","$"+(+e.usd_pnl).toFixed(2));
 else console.log(t,"SKIP ",e.symbol||"",e.side||"",e.reason,e.detail?("- "+e.detail):"")}
const n=(k)=>L.filter(e=>e.type===k).length;
console.log("\nbot starts:",n("session"),"| entries:",n("entry"),"| exits:",n("exit"),"| skipped signals:",n("skip"));'
}
act_details() {   # per-coin trading numbers from the bot's state file: how many trades, wins and losses, result, what is open, the last few
  head_line "Trading details"
  as_bot env APP="$APP" node -e "$H12_JS"'
const fs=require("fs");let st;
try{st=JSON.parse(fs.readFileSync(process.env.APP+"/state/state.json","utf8"))}catch(e){console.log("No trading state yet.");process.exit()}
const money=(v)=>(v<0?"-":"")+"$"+Math.abs(v).toFixed(2),R=(v)=>(v>=0?"+":"")+v.toFixed(2)+"R";
const coins=Object.entries(st.coins||{});let tn=0,tr=0,tu=0,tw=0;
console.log("Mode",String(st.mode||"?").toUpperCase(),"| balance",money(+st.balance||0),"| total",R(+st.totalR||0),"| below best point",((+st.peakR||0)-(+st.totalR||0)).toFixed(1)+"R");
for(const [coin,x] of coins){
  const T=x.trades||[],w=T.filter(t=>t.R>0).length,l=T.filter(t=>t.R<0).length,sr=T.reduce((a,t)=>a+t.R,0),su=T.reduce((a,t)=>a+(t.usd||0),0);
  tn+=T.length;tr+=sr;tu+=su;tw+=w;
  console.log("\n"+coin+": "+T.length+" trade"+(T.length===1?"":"s")+" | "+w+" win"+(w===1?"":"s")+" / "+l+" loss"+(l===1?"":"es")+(T.length?" ("+Math.round(100*w/T.length)+"%)":"")+" | "+R(sr)+" | "+money(su)+(T.length?" | average "+R(sr/T.length):""));
  console.log(x.pos?"  OPEN "+(x.pos.dir===1?"LONG":"SHORT")+" entry "+(+x.pos.entry).toPrecision(6)+" stop "+(+x.pos.stop).toPrecision(6)+" target "+(+x.pos.tp).toPrecision(6)+" since "+h12(x.pos.t0*1000):"  flat (no open trade)");
  console.log("  last candle checked: "+(x.lastTime?h12(x.lastTime*1000):"none yet"));
  for(const t of T.slice(-5))console.log("  "+h12(t.tExit*1000)+"  "+(t.dir===1?"LONG ":"SHORT")+"  "+String(t.why).padEnd(7)+" "+R(t.R).padStart(7)+"  "+money(t.usd||0));
}
console.log("\nAll coins: "+tn+" trade"+(tn===1?"":"s")+" | "+tw+" win"+(tw===1?"":"s")+(tn?" ("+Math.round(100*tw/tn)+"%)":"")+" | "+R(tr)+" | "+money(tu));'
}
act_equity() {
  head_line "Equity over time (account snapshots)"
  as_bot env APP="$APP" node -e "$H12_JS"'
const fs=require("fs");let L=[];
try{L=fs.readFileSync(process.env.APP+"/journal/snapshots.jsonl","utf8").trim().split("\n").filter(Boolean).map(x=>JSON.parse(x))}catch(e){}
if(!L.length){console.log("No snapshots yet.");process.exit()}
const a=L[0],b=L[L.length-1],m=(v)=>"$"+(+v).toFixed(2);
console.log("First :",h12(a.ts)," equity",m(a.equity),"("+a.mode+")");
console.log("Latest:",h12(b.ts)," equity",m(b.equity),"available",m(b.available));
console.log("Change:",(((b.equity/a.equity)-1)*100).toFixed(2)+"%","|",L.length,"snapshots");
console.log("Positions on MEXC:",(b.mexc_positions||[]).length,"| the bot believes:",(b.bot_positions||[]).length);
console.log("\nLast 8 snapshots:");for(const s of L.slice(-8))console.log(" ",h12(s.ts),m(s.equity))'
}
act_server() {
  head_line "Server health"
  echo "Uptime / load : $(uptime -p) | load $(cut -d' ' -f1-3 /proc/loadavg)"
  echo "Time          : $(date -u '+%b %-d, %Y') · $(now_str)"
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
  echo "Time now      : $(now_str)"
  echo "Candles close : $(candle_times)"
  echo "Do NOT restart within ~10 minutes of a candle close: a signal check could be missed."
  read -rp "Restart now? [y/N] " a
  if [ "$a" = y ]; then sudo systemctl restart lucidio; sleep 4; sudo journalctl -u lucidio -n 6 --no-pager; fi
}

# ---- update: GitHub -> mirror in $SRC -> tests -> bundle (same package.sh + setup-vps.sh as a manual update) -> automatic rollback if the bot does not come back
git_run() { as_root env GIT_TERMINAL_PROMPT=0 TZ=UTC GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" git "$@"; }
git_src() { git_run -C "$SRC" "$@"; }
# ---- progress display for "Pull changes from GitHub": one coloured line per step (spinner, overall bar with the running step sweeping, step count, time), a green tick or a red cross when it ends.
# Without a terminal (a pipe, a test) it prints plain "[3/9] label ... ok" lines instead. Colours / glyphs are the menu's own (ASCII fallback included). It only SHOWS the work: every command is the same one as before.
PG_N=0; PG_TOTAL=1; PG_TTY=0; PG_LOG=/tmp/lucidio-update-step.log
pg_init() {
  [ -n "${R:-}" ] || { setup_glyphs; setup_colors; }
  PG_TTY=0; [ -t 1 ] && [ -z "${LUCIDIO_MENU_PLAIN:-}" ] && PG_TTY=1
  if [ "${ASCII:-0}" = 1 ]; then PG_SPIN=('|' '/' '-' '\'); PG_FULL='#'; PG_EMPTY='-'; PG_OK='OK'; PG_BAD='XX'
  else PG_SPIN=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏'); PG_FULL='█'; PG_EMPTY='░'; PG_OK='✔'; PG_BAD='✘'; fi
}
pg_bar() {   # $1 steps finished, $2 steps in all, $3 animation tick -> the bar (30 cells); the running step's share is dim with one bright cell sweeping through it
  local fin=$1 total=$2 tick=$3 w=30 i seg0 seg1 span pos out=""
  seg0=$(( fin * w / total )); seg1=$(( (fin + 1) * w / total )); [ "$seg1" -le "$seg0" ] && seg1=$(( seg0 + 1 ))
  span=$(( seg1 - seg0 )); pos=$(( seg0 + tick % span ))
  for ((i = 0; i < w; i++)); do
    if [ "$i" -lt "$seg0" ] || [ "$fin" -ge "$total" ]; then out+="$G$PG_FULL"
    elif [ "$i" -lt "$seg1" ] && [ "$i" -eq "$pos" ]; then out+="$Y$PG_FULL"
    else out+="$D$PG_EMPTY"; fi
  done
  printf '%s%s' "$out" "$R"
}
pg_step() {   # pg_step "label" command args...   (output goes to /tmp/lucidio-update-stepN.log; the return code is the command's)
  local label=$1; shift
  PG_N=$(( PG_N + 1 )); PG_LOG="/tmp/lucidio-update-step$PG_N.log"
  local t0=$SECONDS tick=0 pid rc el pct
  if [ "$PG_TTY" != 1 ]; then
    printf '[%d/%d] %s ...\n' "$PG_N" "$PG_TOTAL" "$label"
    "$@" > "$PG_LOG" 2>&1; rc=$?
    printf '      %s (%ds)\n' "$([ "$rc" = 0 ] && echo ok || echo FAILED)" $(( SECONDS - t0 )); return "$rc"
  fi
  "$@" > "$PG_LOG" 2>&1 & pid=$!
  printf '\e[?25l'
  while kill -0 "$pid" 2>/dev/null; do
    el=$(( SECONDS - t0 )); pct=$(( (PG_N - 1) * 100 / PG_TOTAL ))
    printf '\r\e[2K %s%s%s %s %s%3d%%%s  %s%d/%d%s  %s%d:%02d%s' "$Y" "${PG_SPIN[tick % ${#PG_SPIN[@]}]}" "$R" "$(pg_bar $(( PG_N - 1 )) "$PG_TOTAL" "$tick")" "$K" "$pct" "$R" "$D" "$PG_N" "$PG_TOTAL" "$R" "$D" $(( el / 60 )) $(( el % 60 )) "$R"
    printf '\n\e[2K   %s%s%s\e[1A' "$LG" "$label" "$R"
    tick=$(( tick + 1 )); sleep 0.12
  done
  wait "$pid"; rc=$?
  el=$(( SECONDS - t0 ))
  printf '\r\e[2K\n\e[2K\e[1A\r'   # clear the animated pair of lines, then leave one result line
  if [ "$rc" = 0 ]; then printf ' %s%s%s %s  %s%ds%s\n' "$G" "$PG_OK" "$R" "$label" "$D" "$el" "$R"
  else printf ' %s%s%s %s%s FAILED%s  %s%ds%s\n' "$RD" "$PG_BAD" "$R" "$RD" "$label" "$R" "$D" "$el" "$R"; fi
  printf '\e[?25h'
  return "$rc"
}
pg_done() { [ "$PG_TTY" = 1 ] && printf ' %s%s%s %s 100%%%s\n' "$G" "$PG_OK" "$R" "$(pg_bar "$PG_TOTAL" "$PG_TOTAL" 0)" "$R"; return 0; }

act_update() {
  head_line "Pull changes from GitHub"
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
  pg_init; PG_N=0; PG_TOTAL=1
  pg_step "Checking GitHub for changes" git_src fetch --quiet --depth 20 origin "$BRANCH" || { echo "Could not reach GitHub (network, or the deploy key was removed)."; return 1; }
  local after deployed was now_state installed
  after=$(git_src rev-parse FETCH_HEAD) || return 1
  deployed=$(as_root cat "$SRC/.deployed-commit" 2>/dev/null || true)
  if [ "$deployed" = "$after" ]; then echo "Already up to date: $(git_src log -1 --format='%h %s' "$after")"; return 0; fi
  echo "What is new on GitHub ($BRANCH):"; echo
  git_src log -n 8 --format='%h|%at|%s' "$after" | while IFS='|' read -r h t m; do printf '  %s  %s  %s
' "$h" "$(dt_str "$t")" "$m"; done
  if [ -n "$deployed" ] && git_src cat-file -e "$deployed^{commit}" 2>/dev/null; then echo; git_src diff --stat "$deployed" "$after" | tail -n 15
  else echo; echo "(the installed version is not known to this copy: showing the latest commits only)"; fi
  echo; read -rp "Pull these changes? [y/N] " a; [ "$a" = y ] || { echo "Cancelled. Nothing was changed."; return 0; }
  if near_candle_close; then
    echo; echo "A 4-hour candle closes within a few minutes (or just closed). The bot is about to make, or just made, its trade decision;"
    echo "the update restarts it, which could cost a signal. Better: try again 15 minutes after a candle close."
    echo "Time now      : $(now_str)"; echo "Candles close : $(candle_times)"
    read -rp "Type force to continue anyway, or press Enter to cancel: " a; [ "$a" = force ] || { echo "Cancelled. Nothing was changed."; return 0; }
  fi
  local tests=() t W=/tmp/lucidio-update
  if [ -z "${LUCIDIO_UPDATE_SKIP_TESTS:-}" ]; then for t in selftest ops-test journal-test fixes-test; do [ -f "$SRC/test/$t.js" ] && tests+=("$t"); done; fi
  echo; PG_N=0; PG_TOTAL=$(( ${#tests[@]} + 5 ))
  pg_step "Switching to the new code" git_src checkout --quiet --force --detach "$after" || return 1
  for t in "${tests[@]}"; do   # the safety tests on the new code: any failure stops here and the bot keeps the old code
    pg_step "Safety test: $t" as_root bash -c "cd '$SRC' && timeout 900 node test/$t.js" || { tail -n 15 "$PG_LOG"; echo; echo "NOT installed: the bot keeps running the old code."; return 1; }
  done
  as_root rm -rf "$W"; as_root mkdir -p "$W"
  pg_step "Building the bundle and scanning it for secrets" as_root bash -c "cd '$SRC' && OUT='$W/lucidio-deploy.tar.gz' bash deploy/package.sh" \
    || { tail -n 15 "$PG_LOG"; echo; echo "NOT installed: the bundle could not be built."; return 1; }
  if [ -n "${LUCIDIO_UPDATE_DRYRUN:-}" ]; then echo "(dry run: stopping before the install)"; return 0; fi
  pg_step "Checking the bundle" as_root bash -c "cd '$W' && sha256sum -c lucidio-deploy.tar.gz.sha256 >/dev/null && tar -xzf lucidio-deploy.tar.gz" || { echo "NOT installed: the bundle check failed."; return 1; }
  was=$(systemctl is-active lucidio 2>/dev/null || true)
  pg_step "Installing (the bot restarts for a few seconds)" as_root bash -c "cd '$W/lucidio' && bash deploy/setup-vps.sh"
  tail -n 14 "$PG_LOG"
  pg_step "Waiting for the bot to come back" sleep 8
  pg_done
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
    status) act_status;; balance) act_balance;; check) act_check;; trades) act_trades;; details) act_details;; equity) act_equity;;
    log) act_log;; follow) act_follow;; server) act_server;; update) act_update;; tg) act_tg;; kill) act_kill;; restart) act_restart;;
    *) echo "unknown action: $1"; return 2;;
  esac
}

# ---- the menu itself: a small arrow-key selector (no dialog tools needed). Design: design/menu-design.html
#   gradient logo (when the window is tall enough, else a text title) · status row · account row · clock row · next-candle-close row with a countdown bar ·
#   items in three groups (Tools / Monitor / Control) · a full-width selection bar (red for the dangerous ones) · key hints.
# The header never prompts for a password (sudo -n): without it the status row simply has less in it. The whole frame is redrawn every second, so the clock is live.
# Colours are 24-bit (Windows Terminal and most terminals show them); LUCIDIO_MENU_COLOR=16 uses plain 16-colour codes, LUCIDIO_MENU_LOGO=off never shows the logo,
# LUCIDIO_MENU_ASCII=1 draws everything in plain ASCII (also chosen automatically when the terminal is not UTF-8).
LOGO=(
  "██╗     ██╗   ██╗ ██████╗██╗██████╗  ██╗            "
  "██║     ██║   ██║██╔════╝██║██╔══██╗ ╚█║ ██╗        "
  "██║     ██║   ██║██║     ██║██║  ██║  ╚╝ ╚═╝ █████╗ "
  "██║     ██║   ██║██║     ██║██║  ██║     ██╗██╔══██╗"
  "███████╗╚██████╔╝╚██████╗██║██████╔╝     ██║╚█████╔╝"
  "╚══════╝ ╚═════╝  ╚═════╝╚═╝╚═════╝      ╚═╝ ╚════╝ "
)
LOGO_W=52
SPACES="$(printf '%*s' 200 '')"
HDR_JS='const fs=require("fs"),d=process.argv[1];let c={},s=null,st=null;
try{c=JSON.parse(fs.readFileSync(d+"/bot-config.json","utf8"))}catch(e){}
try{const L=fs.readFileSync(d+"/journal/snapshots.jsonl","utf8").trim().split("\n");s=JSON.parse(L[L.length-1])}catch(e){}
try{st=JSON.parse(fs.readFileSync(d+"/state/state.json","utf8"))}catch(e){}
const co=st&&st.coins?Object.values(st.coins):[],rk=+c.riskPct*100;
const o={MODE:c.mode||"",RISK:isNaN(rk)?"":rk.toFixed(1),EQUITY:s&&s.equity!=null?(+s.equity).toFixed(2):"",TRADES:st?co.reduce((a,x)=>a+(x.n||0),0):"",R:st?(+st.totalR||0).toFixed(2):"",KILL:fs.existsSync(d+"/STOP")?1:0};
for(const k in o)console.log(k+"="+o[k])'
ST_WORD="Bot state unknown"; ST_CLS=yellow; STATS=(); ACC="Account: not available"
refresh_header() {   # fills ST_WORD / ST_CLS / STATS / ACC for the status and account rows
  local st info k v M="" RK="" EQ="" TR="" RR="" KL=0
  st=${LUCIDIO_MENU_BOT_STATE:-$(systemctl is-active lucidio 2>/dev/null || true)}; [ -z "$st" ] && st=unknown
  if [ -n "${LUCIDIO_MENU_NOSUDO:-}" ] || [ "$(id -un)" = "$LUCIDIO_USER" ]; then info=$(node -e "$HDR_JS" "$APP" 2>/dev/null)
  else info=$(sudo -n -u "$LUCIDIO_USER" node -e "$HDR_JS" "$APP" 2>/dev/null); fi
  while IFS='=' read -r k v; do case "$k" in MODE) M=$v;; RISK) RK=$v;; EQUITY) EQ=$v;; TRADES) TR=$v;; R) RR=$v;; KILL) KL=$v;; esac; done <<< "$info"
  if [ "$st" = unknown ]; then ST_WORD="Bot state unknown"; ST_CLS=yellow
  elif [ "$st" != active ]; then ST_WORD="Bot is stopped"; ST_CLS=red
  elif [ "$KL" = 1 ]; then ST_WORD="Kill switch is on"; ST_CLS=yellow
  else ST_WORD="Bot is active"; ST_CLS=green; fi
  STATS=(); [ -n "$TR" ] && STATS=("$TR trade$([ "$TR" = 1 ] || echo s)" "${RR}R")
  if [ -n "$M" ]; then ACC="Account (${M^}): $([ -n "$EQ" ] && echo "\$$EQ" || echo "n/a")$([ -n "$RK" ] && echo " ($RK% Risk)")"; else ACC="Account: not available"; fi
}
# the clock rows: "PH 11:56am | UTC 3:56am" and "Candle Close 4:00am UTC (12:00pm PH)" + a bar of how much of the 4-hour candle has passed + the time left
clock_rows() {
  local e=${LUCIDIO_NOW:-$(date +%s)} nx secs
  CLK_LBL=PH; [ "$MY_UTC_OFFSET" != 8 ] && CLK_LBL="UTC$(printf '%+d' "$MY_UTC_OFFSET")"
  nx=$(( (e / 14400 + 1) * 14400 )); secs=$(( nx - e ))
  CLK_LOC=$(c12 $((e + MY_UTC_OFFSET * 3600))); CLK_UTC=$(c12 "$e")
  CLOSE_TXT="Candle Close $(c12 "$nx") UTC ($(c12 $((nx + MY_UTC_OFFSET * 3600))) $CLK_LBL)"
  printf -v CLOSE_CD '%dh %02dm' $((secs / 3600)) $(( (secs % 3600) / 60 ))
  BAR_FILLED=$(( ((14400 - secs) * 12 + 7200) / 14400 )); [ "$BAR_FILLED" -lt 0 ] && BAR_FILLED=0; [ "$BAR_FILLED" -gt 12 ] && BAR_FILLED=12
}
setup_glyphs() {
  export LC_ALL=C.UTF-8 2>/dev/null; local t='█'
  if [ "${#t}" -eq 1 ] && [ -z "${LUCIDIO_MENU_ASCII:-}" ]; then
    F_TL='╭'; F_TR='╮'; F_BL='╰'; F_BR='╯'; F_H='─'; F_V='│'; F_ML='├'; F_MR='┤'; MARK='▶'; DIV='│'; BAR_CH='━'; KEYS_UD='↑↓'; ASCII=0
  else
    F_TL='+'; F_TR='+'; F_BL='+'; F_BR='+'; F_H='-'; F_V='|'; F_ML='+'; F_MR='+'; MARK='>'; DIV='|'; BAR_CH='='; KEYS_UD='Up/Down'; ASCII=1
  fi
}
setup_colors() {
  R=$'\e[0m'
  if [ "${LUCIDIO_MENU_COLOR:-}" = 16 ]; then
    G=$'\e[92m'; TT=$'\e[1;92m'; Y=$'\e[1;93m'; D=$'\e[90m'; LG=$'\e[37m'; K=$'\e[1;97m'; RD=$'\e[91m'; BAR=$'\e[1;30;102m'; BARD=$'\e[1;30;101m'
    LMAIN=("$TT" "$TT" "$TT" "$TT" "$TT" "$TT"); LSHADOW=$'\e[32m'
  else
    G=$'\e[38;2;22;198;12m'; TT=$'\e[1m\e[38;2;22;198;12m'; Y=$'\e[1m\e[38;2;253;228;8m'; D=$'\e[38;2;118;118;118m'; LG=$'\e[38;2;180;180;180m'; K=$'\e[1m\e[38;2;255;255;255m'
    RD=$'\e[38;2;231;72;86m'; BAR=$'\e[1m\e[48;2;22;198;12m\e[38;2;6;36;10m'; BARD=$'\e[1m\e[48;2;231;72;86m\e[38;2;26;3;6m'
    LMAIN=($'\e[38;2;155;255;138m' $'\e[38;2;100;244;83m' $'\e[38;2;47;220;34m' $'\e[38;2;22;198;12m' $'\e[38;2;16;165;8m' $'\e[38;2;11;132;6m'); LSHADOW=$'\e[38;2;11;92;7m'
  fi
  LOGO_S=(); [ "${ASCII:-0}" = 1 ] && return 0; local r i ch col cur out
  for r in 0 1 2 3 4 5; do   # coloured once: solid blocks in the row's colour, the shadow strokes darker
    out=""; cur=""
    for ((i = 0; i < ${#LOGO[r]}; i++)); do ch=${LOGO[r]:i:1}; if [ "$ch" = "█" ]; then col=${LMAIN[r]}; else col=$LSHADOW; fi; [ "$col" != "$cur" ] && { out+="$col"; cur=$col; }; out+="$ch"; done
    LOGO_S[r]="$out$R"
  done
}
grp_of() { case "$1" in shell|update) echo 0;; kill|restart|exit) echo 2;; *) echo 1;; esac; }
danger_of() { case "$1" in kill|restart|exit) return 0;; *) return 1;; esac; }
OUT=()
ln() { OUT+=("$PAD$1"); }
hrule() { ln "$G$1$HL$2$R"; }
# one frame row. plain = the text without colours (its length sets the padding), styled = the same text with colour codes, align c = centred
frow() {
  local plain="$1" styled="${2:-}" align="${3:-}" inner=$(( BOX_W - 4 )) w left right
  w=${#plain}; if [ "$w" -gt "$inner" ]; then plain=${plain:0:$inner}; styled=""; w=$inner; fi
  [ -z "$styled" ] && styled=$plain
  left=0; [ "$align" = c ] && left=$(( (inner - w) / 2 )); right=$(( inner - w - left ))
  ln "$G$F_V$R ${SPACES:0:$left}$styled${SPACES:0:$right} $G$F_V$R"
}
build_frame() {
  local i idx inner=$(( BOX_W - 4 )) plain styled s cd gap right_plain bars empty tag label prevg g c st_style keys
  OUT=(); clock_rows
  hrule "$F_TL" "$F_TR"
  if [ "$LOGO_ON" = 1 ]; then frow ""; for ((i = 0; i < 6; i++)); do frow "${LOGO[i]}" "${LOGO_S[i]}" c; done; frow "by: Bugimann" "${LG}by: Bugimann$R" c; frow ""
  else frow "Lucid'io Bot" "${TT}Lucid'io Bot$R" c; fi
  hrule "$F_ML" "$F_MR"
  case "$ST_CLS" in red) st_style=$RD;; yellow) st_style=$Y;; *) st_style=$TT;; esac
  plain=$ST_WORD; styled="$st_style$ST_WORD$R"
  for s in "${STATS[@]}"; do plain+=" $DIV $s"; styled+=" $G$DIV$R $LG$s$R"; done
  frow "$plain" "$styled"
  frow "$ACC" "$K$ACC$R"
  frow "$CLK_LBL $CLK_LOC $DIV UTC $CLK_UTC" "$LG$CLK_LBL$R $K$CLK_LOC$R $G$DIV$R ${LG}UTC$R $K$CLK_UTC$R"
  right_plain="${SPACES:0:12} $CLOSE_CD"; gap=$(( inner - ${#CLOSE_TXT} - ${#right_plain} ))
  if [ "$gap" -ge 2 ]; then
    printf -v bars '%*s' "$BAR_FILLED" ''; bars=${bars// /$BAR_CH}; printf -v empty '%*s' $((12 - BAR_FILLED)) ''; empty=${empty// /$BAR_CH}
    frow "$CLOSE_TXT${SPACES:0:$gap}$right_plain" "$Y$CLOSE_TXT$R${SPACES:0:$gap}$Y$bars$R$D$empty$R $LG$CLOSE_CD$R"
  else frow "$CLOSE_TXT" "$Y$CLOSE_TXT$R"; fi
  prevg=-1
  for ((i = 0; i < VIS; i++)); do
    idx=$(( TOP + i )); [ "$idx" -ge "$N" ] && break
    tag=${ITEMS[idx*2]}; label=${ITEMS[idx*2+1]}; g=${GRP[idx]}
    if [ "$i" -eq 0 ] || { [ "$GROUPED" = 1 ] && [ "$g" != "$prevg" ]; }; then hrule "$F_ML" "$F_MR"; fi
    prevg=$g
    if [ "$idx" -eq "$SEL" ]; then
      plain="$MARK $label"; plain+="${SPACES:0:$((inner - ${#plain}))}"; c=$BAR; danger_of "$tag" && c=$BARD
      frow "$plain" "$c$plain$R"
    else
      plain="  $label"; if danger_of "$tag"; then frow "$plain" "  $RD$label$R"; else frow "$plain"; fi
    fi
  done
  hrule "$F_ML" "$F_MR"
  if [ $(( TOP + VIS )) -lt "$N" ]; then plain="$KEYS_UD Move    Enter Ok    Esc Exit    more below"; styled="$K$KEYS_UD$R ${D}Move$R    ${K}Enter$R ${D}Ok$R    ${K}Esc$R ${D}Exit$R    ${D}more below$R"
  else plain="$KEYS_UD Move    Enter Ok    Esc Exit"; styled="$K$KEYS_UD$R ${D}Move$R    ${K}Enter$R ${D}Ok$R    ${K}Esc$R ${D}Exit$R"; fi
  frow "$plain" "$styled" c
  hrule "$F_BL" "$F_BR"
}
draw_menu() {
  local buf
  build_frame
  TOPROW=$(( (ROWS - ${#OUT[@]}) / 2 + 1 )); [ "$TOPROW" -lt 1 ] && TOPROW=1
  printf -v buf '%s\e[K\n' "${OUT[@]}"
  printf '\e[%d;1H%s\e[J' "$TOPROW" "$buf"
}
# in: ITEMS (tag, label pairs), the header variables.  out: CHOICE.  Returns 1 when Esc / q is pressed (or the input ends).
menu_select() {
  local key rest cols rc tick=0 last="" i inner avail hdr ng prev g
  setup_glyphs; setup_colors
  N=$(( ${#ITEMS[@]} / 2 )); SEL=0; TOP=0; GRP=(); prev=-1; ng=0
  for ((i = 0; i < N; i++)); do g=$(grp_of "${ITEMS[i*2]}"); GRP[i]=$g; [ "$g" != "$prev" ] && { ng=$((ng + 1)); prev=$g; }; done
  printf '\e[?25l\e[2J'
  while true; do
    ROWS=${LUCIDIO_MENU_ROWS:-$(tput lines 2>/dev/null || echo 24)}; cols=${LUCIDIO_MENU_COLS:-$(tput cols 2>/dev/null || echo 80)}
    BOX_W=$(( cols - 2 )); [ "$BOX_W" -gt 66 ] && BOX_W=66; [ "$BOX_W" -lt 46 ] && BOX_W=46; inner=$(( BOX_W - 4 ))
    printf -v HL '%*s' $(( BOX_W - 2 )) ''; HL=${HL// /$F_H}
    # what fits: the logo needs 9 rows for itself; the frame is (header rows + items + group rules + 9) tall. Short window: text title, then a scrolling flat list.
    avail=$(( ROWS - 1 ))
    LOGO_ON=0; GROUPED=1; VIS=$N
    if [ "${LUCIDIO_MENU_LOGO:-auto}" != off ] && [ "$ASCII" = 0 ] && [ "$inner" -ge "$LOGO_W" ] && [ $(( 9 + N + ng + 9 )) -le "$avail" ]; then LOGO_ON=1; hdr=9; else hdr=1; fi
    if [ $(( hdr + N + ng + 9 )) -gt "$avail" ]; then GROUPED=0; VIS=$(( avail - hdr - 9 - 1 )); [ "$VIS" -gt "$N" ] && VIS=$N; [ "$VIS" -lt 3 ] && VIS=3; fi
    [ "$SEL" -lt "$TOP" ] && TOP=$SEL; [ "$SEL" -ge $(( TOP + VIS )) ] && TOP=$(( SEL - VIS + 1 ))
    PAD="${SPACES:0:$(( (cols - BOX_W) / 2 > 0 ? (cols - BOX_W) / 2 : 0 ))}"        # centred in the window
    [ "$last" != "$ROWS x $cols" ] && { printf '\e[2J'; last="$ROWS x $cols"; }       # window resized: wipe the old frame
    draw_menu
    IFS= read -rsn1 -t 1 key; rc=$?
    if [ "$rc" -gt 128 ]; then        # a second passed with no key: draw again, so the clock is live; the bot rows are re-read every 30 seconds
      tick=$(( tick + 1 )); [ $(( tick % 30 )) -eq 0 ] && refresh_header
      continue
    elif [ "$rc" -ne 0 ]; then printf '\e[?25h\e[2J\e[H'; return 1; fi   # the input ended
    case "$key" in
      $'\e') rest=""; IFS= read -rsn2 -t 0.1 rest || true
             case "$rest" in
               '[A'|'OA') SEL=$(( (SEL + N - 1) % N ));;
               '[B'|'OB') SEL=$(( (SEL + 1) % N ));;
               '[H'|'[1') SEL=0;;
               '[F'|'[4') SEL=$(( N - 1 ));;
               '') printf '\e[?25h\e[2J\e[H'; return 1;;
             esac;;
      k|K) SEL=$(( (SEL + N - 1) % N ));;
      j|J) SEL=$(( (SEL + 1) % N ));;
      q|Q) printf '\e[?25h\e[2J\e[H'; return 1;;
      '')  CHOICE="${ITEMS[SEL*2]}"; printf '\e[?25h\e[2J\e[H'; return 0;;
    esac
  done
}

main() {
  if [ "${1:-}" = "--action" ]; then run_action "${2:-}"; return $?; fi
  trap : INT       # Ctrl+C stops a running action, not the menu
  trap 'printf "\e[?25h"' EXIT
  # one password prompt per session, so the header can read the bot's status (those files are private to the bot user); Ctrl+C skips it
  if [ -n "$SUDO" ] && ! sudo -n true 2>/dev/null; then echo "Enter your admin password once, so the menu can show the bot status:"; sudo -v || true; fi
  ITEMS=(
    shell   "Open a normal command line"
    update  "Pull changes from GitHub"
    status  "Bot status"
    balance "Account balance"
    trades  "Trades and skipped signals"
    details "Trading details"
    equity  "Equity over time"
    check   "Health check"
    log     "Recent log"
    follow  "Live log  (Ctrl+C to stop)"
    server  "Server health and installed code"
    tg      "Send a Telegram test message"
    kill    "Kill switch  (on / off)"
    restart "Restart the bot"
    exit    "Disconnect"
  )
  local n i
  while true; do
    refresh_header
    if [ -n "${TERM:-}" ] && [ "$TERM" != dumb ]; then
      menu_select || break
    else   # no usable terminal: a numbered list
      clock_rows; echo; echo "$ST_WORD$(for x in "${STATS[@]}"; do printf ' | %s' "$x"; done)"; echo "$ACC"; echo "$CLK_LBL $CLK_LOC | UTC $CLK_UTC"; echo "$CLOSE_TXT ($CLOSE_CD left)"; echo
      for ((i=0;i<${#ITEMS[@]};i+=2)); do printf '  %2d) %s\n' $((i/2+1)) "${ITEMS[i+1]}"; done
      read -rp "Number (empty = leave): " n; [ -z "$n" ] && break
      CHOICE="${ITEMS[$(( (n-1)*2 ))]:-}"; [ -z "$CHOICE" ] && continue
    fi
    case "$CHOICE" in
      exit) break;;
      shell) clear; echo "Normal command line. Type 'exit' to disconnect, or 'lucidio' for this menu."; exec bash -l;;
      *) run_action "$CHOICE"; pause;;
    esac
  done
  clear; echo "Menu closed. Disconnecting."
}
if [ -z "${LUCIDIO_MENU_NOMAIN:-}" ]; then main "$@"; exit $?; fi
