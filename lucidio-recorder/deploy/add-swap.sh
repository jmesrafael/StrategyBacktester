#!/usr/bin/env bash
# Adds 1 GB of swap so a memory spike slows the server down instead of killing a bot. Safe and undoable. Only does anything when there is no swap yet.
#   sudo bash add-swap.sh            add it       sudo bash add-swap.sh --remove     take it away again
set -uo pipefail
F=/swapfile
[ "$(id -u)" -eq 0 ] || { echo "run as root: sudo bash $0" >&2; exit 1; }
if [ "${1:-}" = "--remove" ]; then
  swapoff "$F" 2>/dev/null; rm -f "$F" /etc/sysctl.d/99-lucidio-swap.conf; sed -i '\#^/swapfile #d' /etc/fstab; echo "swap removed"; exit 0
fi
if [ "$(free -m | awk '/Swap/{print $2}')" -gt 0 ]; then echo "there is already swap: nothing to do"; free -m | awk '/Swap/'; exit 0; fi
FREE_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9'); [ "${FREE_GB:-0}" -ge 4 ] || { echo "less than 4 GB free on /: not adding swap" >&2; exit 1; }
fallocate -l 1G "$F" 2>/dev/null || dd if=/dev/zero of="$F" bs=1M count=1024 status=none
chmod 600 "$F"; mkswap "$F" >/dev/null && swapon "$F" || { echo "could not enable swap" >&2; rm -f "$F"; exit 1; }
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-lucidio-swap.conf; sysctl -q -p /etc/sysctl.d/99-lucidio-swap.conf >/dev/null 2>&1 || true   # use swap only when really short of memory
echo "1 GB of swap added (used only when memory runs short)"; free -m | awk '/Swap/'
