#!/usr/bin/env bash
# Lucid'io lab: the data recorder, then the 1h paper bot with real-world costs. One command, re-runnable, touches neither live bot.
#   sudo bash install-lab.sh               install or refresh both
#   sudo bash install-lab.sh --add-swap    the same, and first add 1 GB of swap when the server has none (recommended on 1.6 GB of RAM)
#   sudo bash install-lab.sh --check       only report what the server has to spare, change nothing
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
die() { echo "FATAL: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"
[ -d "$HERE/lucidio-recorder" ] && [ -d "$HERE/bb-core-1h" ] || die "run this from the unpacked bundle (it holds lucidio-recorder/ and bb-core-1h/)"

echo "== what the server has to spare"; bash "$HERE/lucidio-recorder/deploy/vps-check.sh"
[ "${1:-}" = "--check" ] && exit 0
if [ "${1:-}" = "--add-swap" ]; then echo; echo "== swap"; bash "$HERE/lucidio-recorder/deploy/add-swap.sh" || die "swap was not added"; fi

echo; echo "################ 1/2  data recorder ################"
bash "$HERE/lucidio-recorder/deploy/install-recorder.sh" || die "the recorder install stopped (above): the 1h bot was not touched"

echo; echo "################ 2/2  1h paper bot (real-world costs) ################"
bash "$HERE/bb-core-1h/deploy-1h/install-1h-paper.sh" || die "the 1h bot install stopped (above); the recorder is installed and running"

echo; echo "################ done ################"
echo "Both are running. Two small files still need your dashboard address and secret (the same two values as the live bot's env file):"
echo "   sudo nano /etc/lucidio-recorder.env     then   sudo systemctl restart lucidio-recorder"
echo "   sudo nano /etc/lucidio-1h.env           then   sudo systemctl restart lucidio-1h"
echo "Without them both keep working and recording; they just do not show on the dashboard."
echo "Look at them:   sudo bash /opt/lucidio-recorder/deploy/status.sh     sudo bash /opt/lucidio-1h/deploy-1h/status.sh"
