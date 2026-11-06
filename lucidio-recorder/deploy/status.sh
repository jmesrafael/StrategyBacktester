#!/usr/bin/env bash
# What the recorder has recorded.   sudo bash /opt/lucidio-recorder/deploy/status.sh [verify]
cd /opt/lucidio-recorder || exit 1
run() { sudo -u lucidio-recorder env RECORDER_DIR=/var/lib/lucidio-recorder node "$@"; }
if [ "${1:-}" = "verify" ]; then run recorder.js verify; exit $?; fi
echo "service: $(systemctl is-active lucidio-recorder)"
run recorder.js status
echo; echo "--- last log lines"; journalctl -u lucidio-recorder -n 6 --no-pager 2>/dev/null | cut -c1-170
