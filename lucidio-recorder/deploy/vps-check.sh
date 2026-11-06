#!/usr/bin/env bash
# What the server has to spare, before anything is added.   bash /opt/lucidio-recorder/deploy/vps-check.sh   (read only, changes nothing)
echo "== memory"; free -m | awk 'NR==1||NR==2||/Swap/'
echo; echo "== disk"; df -h / /var/lib 2>/dev/null | awk '!seen[$0]++'
echo; echo "== load (1 / 5 / 15 min, on $(nproc) CPU)"; cut -d' ' -f1-3 /proc/loadavg
echo; echo "== the services here: memory in use (MB) and state"
for u in lucidio icore lucidio-1h lucidio-recorder; do
  if systemctl cat "$u.service" >/dev/null 2>&1; then
    pid=$(systemctl show "$u" -p MainPID --value 2>/dev/null); rss=0; [ -n "$pid" ] && [ "$pid" != 0 ] && rss=$(awk '/VmRSS/{printf "%d", $2/1024}' /proc/$pid/status 2>/dev/null)
    printf '   %-18s %-10s %s MB\n' "$u" "$(systemctl is-active $u 2>/dev/null)" "${rss:-0}"
  fi
done
echo; SW=$(free -m | awk '/Swap/{print $2}')
if [ "${SW:-0}" -eq 0 ]; then echo "NOTE: no swap. With 1.6 GB of RAM a memory spike would make the system kill a bot instead of slowing down."; echo "      Add 1 GB (safe, undoable):  sudo bash /opt/lucidio-recorder/deploy/add-swap.sh"; else echo "swap: ${SW} MB: ok"; fi
