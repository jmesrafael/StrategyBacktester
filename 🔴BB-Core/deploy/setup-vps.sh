#!/usr/bin/env bash
# One-time VPS setup for Lucidyo (Ubuntu 22.04/24.04, e.g. Lightsail Nano in Tokyo/Singapore). Run as root:
#   sudo bash setup-vps.sh            (from the folder that contains lucidyo.js, or copy the BB-Core folder to /opt/lucidyo first)
set -euo pipefail
APP=/opt/lucidyo

echo "== 1. swap (1 GB) so a memory spike never kills the bot"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 2. clock: chrony (MEXC rejects signed requests > 10 s off; the bot wakes on the clock)"
apt-get update -y && apt-get install -y chrony curl ca-certificates
systemctl enable --now chrony
timedatectl set-timezone UTC

echo "== 3. Node.js 20 LTS (the bot has no npm dependencies)"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
fi
node --version

echo "== 4. app folder + service user"
id lucidyo >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin lucidyo
mkdir -p "$APP"
if [ -f ./lucidyo.js ] && [ "$(pwd)" != "$APP" ]; then cp -r ./* "$APP"/; fi
chown -R lucidyo:lucidyo "$APP"
[ -f "$APP/mexc-keys.json" ] && chmod 600 "$APP/mexc-keys.json"

echo "== 5. systemd service (starts on boot, restarts on crash)"
cp "$APP/deploy/lucidyo.service" /etc/systemd/system/lucidyo.service
systemctl daemon-reload
systemctl enable lucidyo

echo "== 6. firewall: SSH only (the dashboard binds to 127.0.0.1 — use an SSH tunnel: ssh -L 8787:127.0.0.1:8787 ubuntu@<ip>)"
if command -v ufw >/dev/null; then ufw allow OpenSSH && ufw --force enable; fi

echo
echo "Done. Next:"
echo "  1) put the API key in $APP/mexc-keys.json (chmod 600, owner lucidyo)"
echo "  2) sudo -u lucidyo node $APP/lucidyo.js check                 # everything OK?"
echo "  3) sudo -u lucidyo node $APP/lucidyo.js test-trade SOL --yes  # live mode only: proves orders + stop/target work"
echo "  4) sudo systemctl start lucidyo && sudo journalctl -u lucidyo -f"
echo "Public IP for the MEXC key binding: $(curl -s https://checkip.amazonaws.com || echo '?')"
