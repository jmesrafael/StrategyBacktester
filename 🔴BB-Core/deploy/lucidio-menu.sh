#!/usr/bin/env bash
# lucidio-menu.sh - arrow-key menu for the Lucid'io VPS (Up/Down + Enter; Esc leaves). Read-only except: kill switch, restart, Telegram test (each asks first).
#   bash lucidio-menu.sh                 status first, then the menu
#   bash lucidio-menu.sh --action trades run one action and exit (status balance check trades equity log server tg)
# Uses `whiptail` (standard on Ubuntu); without it a numbered list is shown instead.
APP="${APP:-/opt/lucidio}"
LUCIDIO_USER=lucidio

as_bot() {   # run a command as the bot's user (needs the admin sudo password once per session)
  if [ -n "${LUCIDIO_MENU_NOSUDO:-}" ] || [ "$(id -un)" = "$LUCIDIO_USER" ]; then "$@"; else sudo -u "$LUCIDIO_USER" "$@"; fi
}
bot() { as_bot node "$APP/lucidio.js" "$@"; }
pause() { echo; read -rp "Press Enter to return to the menu... " _; }
head_line() { clear; echo "== $1 =="; echo; }

act_status()  { head_line "Bot status"; bot status; }
act_balance() { head_line "Account balance (MEXC futures)"; bot balance; }
act_check()   { head_line "Health check"; bot check; }
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
act_restart() {
  head_line "Restart the bot"
  echo "Time now: $(date -u +%H:%M) UTC. Candles close at 00, 04, 08, 12, 16 and 20 UTC."
  echo "Do NOT restart within ~10 minutes of a candle close: a signal check could be missed."
  read -rp "Restart now? [y/N] " a
  if [ "$a" = y ]; then sudo systemctl restart lucidio; sleep 4; sudo journalctl -u lucidio -n 6 --no-pager; fi
}

run_action() {
  case "$1" in
    status) act_status;; balance) act_balance;; check) act_check;; trades) act_trades;; equity) act_equity;;
    log) act_log;; follow) act_follow;; server) act_server;; tg) act_tg;; kill) act_kill;; restart) act_restart;;
    *) echo "unknown action: $1"; return 2;;
  esac
}

if [ "${1:-}" = "--action" ]; then run_action "${2:-}"; exit $?; fi

trap : INT       # Ctrl+C stops a running action, not the menu
head_line "Lucid'io VPS - $(date -u '+%Y-%m-%d %H:%M UTC')"
act_status 2>&1 || true
pause

ITEMS=(
  status  "Bot status (mode, positions, results)"
  balance "Account balance on MEXC"
  check   "Health check (clock, API key, contracts, gates)"
  trades  "Trades and skipped signals"
  equity  "Equity over time (snapshots)"
  log     "Recent log (last 40 lines)"
  follow  "Live log (Ctrl+C to stop)"
  server  "Server health (load, memory, disk, uptime)"
  tg      "Send a Telegram test message"
  kill    "Kill switch (show / on / off)"
  restart "Restart the bot"
  shell   "Open a normal command line"
  exit    "Disconnect"
)
while true; do
  if command -v whiptail >/dev/null 2>&1; then
    choice=$(whiptail --title "Lucid'io VPS" --menu "Up/Down arrows to move, Enter to select, Esc to leave" 22 70 13 "${ITEMS[@]}" 3>&1 1>&2 2>&3) || break
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
