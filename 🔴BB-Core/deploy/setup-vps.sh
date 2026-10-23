#!/usr/bin/env bash
# Lucid'io - VPS setup AND update in one script. Ubuntu 22.04 / 24.04. RE-RUNNABLE: every step checks before it acts.
#   sudo bash deploy/setup-vps.sh [--admin-user NAME] [--skip-ssh-hardening] [--ssh-port N]
# Run it from the folder you extracted the bundle into (e.g. /tmp/lucidio-new). It installs/refreshes:
#   swap (never fatal) - chrony clock - Node.js LTS (NODE_MAJOR, default 22) - ufw - fail2ban - key-only SSH - unattended-upgrades -
#   journald cap - the app in /opt/lucidio (state, mexc-keys.json and bot-config.json are NEVER overwritten) - systemd service + watchdog +
#   daily state backup. Before it replaces code it saves the old code to /var/backups/lucidio/code-*.tar.gz (deploy/rollback.sh).
# It does not start the bot for the first time and never touches live trading: the service starts in paper mode.
set -uo pipefail

APP=/opt/lucidio; SVC=lucidio; BACKUPS=/var/backups/lucidio
NODE_MAJOR="${NODE_MAJOR:-22}"             # 22 = LTS (maintenance until 2027-04); override: NODE_MAJOR=24 sudo -E bash deploy/setup-vps.sh
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADMIN_USER="${SUDO_USER:-}"; SKIP_SSH=0; SSH_PORT=""
WARNINGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --admin-user) ADMIN_USER="${2:-}"; shift 2;;
    --skip-ssh-hardening) SKIP_SSH=1; shift;;
    --ssh-port) SSH_PORT="${2:-}"; shift 2;;
    *) echo "unknown option: $1"; exit 1;;
  esac
done

step() { echo; echo "== $*"; }
ok()   { echo "   ok: $*"; }
warn() { echo "   WARN: $*" >&2; WARNINGS+=("$*"); }
die()  { echo "FATAL: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash deploy/setup-vps.sh"
[ -f "$SRC/lucidio.js" ] || die "lucidio.js not found in $SRC: run this from the extracted bundle (deploy/setup-vps.sh)"
export DEBIAN_FRONTEND=noninteractive

step "0. OS"
. /etc/os-release
case "${VERSION_ID:-}" in 22.04|24.04) ok "Ubuntu $VERSION_ID";; *) warn "tested for Ubuntu 22.04/24.04, this is ${PRETTY_NAME:-unknown}";; esac
RAM_MB=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo); ok "RAM ${RAM_MB} MB, disk free $(df -h / | awk 'NR==2{print $4}')"

step "1. packages (apt)"
apt-get update -y >/dev/null 2>&1 || warn "apt-get update failed (network / mirror?)"
if apt-get install -y chrony curl ca-certificates gnupg ufw fail2ban python3-systemd unattended-upgrades jq >/dev/null 2>&1; then
  ok "chrony curl gnupg ufw fail2ban unattended-upgrades jq installed"
else
  warn "some apt packages failed to install: run 'apt-get install -y chrony ufw fail2ban unattended-upgrades jq' by hand and read the error"
fi

step "2. swap (a safety net; never aborts the setup)"
if swapon --show=NAME --noheadings 2>/dev/null | grep -q .; then
  ok "swap already active: $(swapon --show=NAME,SIZE --noheadings | tr '\n' ' ')"
elif systemd-detect-virt --container -q 2>/dev/null; then
  warn "container virtualisation: swap cannot be created here; continuing without it (1 GB RAM is enough: the bot peaks near 80 MB)"
else
  [ -f /swapfile ] || { fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none; }
  chmod 600 /swapfile
  if mkswap /swapfile >/dev/null 2>&1 && swapon /swapfile 2>/dev/null; then
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    ok "1 GB swap enabled"
  else
    warn "could not enable swap; continuing without it"
  fi
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/99-lucidio.conf; sysctl -q -p /etc/sysctl.d/99-lucidio.conf >/dev/null 2>&1 || true

step "3. clock (MEXC rejects signed requests more than 10 s off)"
timedatectl set-timezone UTC 2>/dev/null || warn "could not set timezone to UTC"
systemctl enable --now chrony >/dev/null 2>&1 || warn "chrony not running"
if systemctl is-active --quiet chrony; then ok "chrony active ($(chronyc tracking 2>/dev/null | awk -F': ' '/System time/{print $2}'))"; fi

step "4. Node.js ${NODE_MAJOR}.x (NodeSource apt repo with a verified signing key; the bot has no npm dependencies)"
CUR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$CUR" = "$NODE_MAJOR" ]; then
  ok "node $(node -v) already installed"
else
  install -d -m 0755 /etc/apt/keyrings
  if curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg; then
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    printf 'Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 600\n' > /etc/apt/preferences.d/nodejs
    apt-get update -y >/dev/null 2>&1; apt-get install -y nodejs >/dev/null 2>&1
  fi
  [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 20 ] || die "Node.js ${NODE_MAJOR} could not be installed (check network access to deb.nodesource.com)"
  ok "node $(node -v)"
fi
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 22 ] || warn "Node $(node -v) is older than 22 (20 is end-of-life): rerun with NODE_MAJOR=22"

step "5. firewall (ufw: deny in, allow out, SSH only) - before touching SSH"
[ -n "$SSH_PORT" ] || SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
SSH_PORT="${SSH_PORT:-22}"
ufw default deny incoming >/dev/null 2>&1; ufw default allow outgoing >/dev/null 2>&1
ufw allow "${SSH_PORT}/tcp" >/dev/null 2>&1
CUR_PORT="${SSH_CONNECTION:-}"; CUR_PORT="${CUR_PORT##* }"       # the port of THIS ssh session, so enabling ufw can never cut it off
if [ -n "$CUR_PORT" ] && [ "$CUR_PORT" != "$SSH_PORT" ]; then ufw allow "${CUR_PORT}/tcp" >/dev/null 2>&1; fi
if ufw --force enable >/dev/null 2>&1; then ok "ufw active, SSH ${SSH_PORT}/tcp open, everything else closed (the dashboard is local only)"; else warn "ufw could not be enabled"; fi

step "6. fail2ban (SSH brute force)"
install -d /etc/fail2ban/jail.d
printf '[DEFAULT]\nbantime = 1h\nfindtime = 10m\nmaxretry = 5\n\n[sshd]\nenabled = true\nport = %s\nbackend = systemd\n' "$SSH_PORT" > /etc/fail2ban/jail.d/lucidio.local
systemctl enable fail2ban >/dev/null 2>&1; systemctl restart fail2ban >/dev/null 2>&1
if systemctl is-active --quiet fail2ban; then ok "fail2ban active"; else warn "fail2ban is not running: journalctl -u fail2ban -n 30"; fi

step "7. unattended security upgrades (no automatic reboot: reboot yourself after kernel updates; the bot starts on boot)"
printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > /etc/apt/apt.conf.d/20auto-upgrades
printf 'Unattended-Upgrade::Automatic-Reboot "false";\nUnattended-Upgrade::Remove-Unused-Dependencies "true";\n' > /etc/apt/apt.conf.d/52lucidio-unattended
ok "daily security updates on (Node from NodeSource is NOT auto-updated: update it with apt on purpose)"

step "8. SSH: key-only (only when a key is already installed, so you cannot lock yourself out)"
HAVE_KEY=0
for h in /root "/home/${ADMIN_USER:-nobody}"; do [ -s "$h/.ssh/authorized_keys" ] && HAVE_KEY=1; done
if [ "$SKIP_SSH" = 1 ]; then
  warn "SSH hardening skipped (--skip-ssh-hardening)"
elif [ "$HAVE_KEY" = 0 ]; then
  warn "no ~/.ssh/authorized_keys for root or '${ADMIN_USER:-?}': NOT disabling password login. Add your public key (ssh-copy-id) and re-run this script"
elif ! grep -qE '^[[:space:]]*Include[[:space:]]+/etc/ssh/sshd_config\.d/' /etc/ssh/sshd_config 2>/dev/null; then
  warn "/etc/ssh/sshd_config does not include sshd_config.d: set PasswordAuthentication no by hand"
else
  # named 00-* because sshd keeps the FIRST value it sees and cloud images ship 50-cloud-init.conf with PasswordAuthentication yes
  CONF=/etc/ssh/sshd_config.d/00-lucidio-hardening.conf
  printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPubkeyAuthentication yes\nPermitRootLogin prohibit-password\nX11Forwarding no\nMaxAuthTries 4\nLoginGraceTime 30\n' > "$CONF"
  if sshd -t 2>/dev/null; then
    systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null
    PA="$(sshd -T 2>/dev/null | awk '/^passwordauthentication /{print $2}')"
    if [ "$PA" = "no" ]; then ok "password login disabled, keys only (root: key only). KEEP THIS SESSION OPEN and test a new login in a second terminal"
    else warn "sshd still reports passwordauthentication=$PA: another file wins; check 'sshd -T'"; fi
  else
    rm -f "$CONF"; warn "sshd -t rejected the hardening file; removed it, SSH unchanged"
  fi
fi

step "9. journald cap (logs go to stdout AND state/bot.log)"
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\nRuntimeMaxUse=50M\nMaxRetentionSec=1month\n' > /etc/systemd/journald.conf.d/99-lucidio.conf
if systemctl restart systemd-journald 2>/dev/null; then ok "journald capped at 200 MB / 1 month"; else warn "could not restart journald"; fi

step "10. service user + app folder ($APP)"
id "$SVC" >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin "$SVC"
install -d -m 700 "$BACKUPS"; mkdir -p "$APP"
WAS_ACTIVE=0; if systemctl is-active --quiet lucidio; then WAS_ACTIVE=1; fi
if [ "$SRC" != "$APP" ]; then
  if [ -f "$APP/lucidio.js" ]; then   # update: keep the old code for rollback, never the state or secrets
    if tar -czf "$BACKUPS/code-$(date -u +%Y%m%d-%H%M%S).tar.gz" -C "$APP" --exclude=./state --exclude=./journal --exclude=./audit --exclude=./.env --exclude=./mexc-keys.json --exclude=./bot-config.json --exclude=./STOP .; then
      ok "old code saved in $BACKUPS (rollback: sudo bash $APP/deploy/rollback.sh)"
    else warn "could not save the old code"; fi
    ls -1t "$BACKUPS"/code-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
  fi
  if [ "$WAS_ACTIVE" = 1 ]; then systemctl stop lucidio; fi
  (cd "$SRC" && tar -cf - --exclude=./state --exclude=./journal --exclude=./audit --exclude=./.env --exclude=./mexc-keys.json --exclude=./bot-config.json --exclude=./STOP .) | tar -xf - -C "$APP" || die "copying the bundle to $APP failed"
  if [ ! -f "$APP/bot-config.json" ]; then cp "$SRC/bot-config.json" "$APP/bot-config.json" && ok "bot-config.json created (mode paper)"; fi
  ok "code copied to $APP (existing bot-config.json, state/ and mexc-keys.json untouched)"
fi
chown -R "$SVC:$SVC" "$APP"; chmod 750 "$APP"; mkdir -p "$APP/state" "$APP/journal" "$APP/audit/out"; chown -R "$SVC:$SVC" "$APP/state" "$APP/journal" "$APP/audit"; chmod 700 "$APP/state" "$APP/journal"
# the server env file (Telegram, dashboard): created empty from the template once, then never overwritten; owner lucidio, mode 600
if [ ! -f "$APP/.env" ]; then
  install -m 600 -o "$SVC" -g "$SVC" "$APP/deploy/lucidio.env.example" "$APP/.env" && ok ".env created from the template (fill in TELEGRAM_* / DASHBOARD_*: see DEPLOY.md)"
else chown "$SVC:$SVC" "$APP/.env"; chmod 600 "$APP/.env"; ok ".env: owner $SVC, mode 600 (kept as it is)"; fi
if [ -f "$APP/mexc-keys.json" ]; then chown "$SVC:$SVC" "$APP/mexc-keys.json"; chmod 600 "$APP/mexc-keys.json"; ok "mexc-keys.json: owner $SVC, mode 600"; fi
chmod 755 "$APP"/deploy/*.sh 2>/dev/null
# the arrow-key menu as a command anyone can type: "lucidio" (or "menu"). $APP is private to the bot user, so it is copied to /usr/local/bin.
if [ -f "$APP/deploy/lucidio-menu.sh" ]; then install -m 755 "$APP/deploy/lucidio-menu.sh" /usr/local/bin/lucidio && ln -sf /usr/local/bin/lucidio /usr/local/bin/menu && ok "command 'lucidio' (arrow-key menu) installed"; fi
if grep -q '"mode"[[:space:]]*:[[:space:]]*"live"' "$APP/bot-config.json"; then warn "bot-config.json says mode LIVE. The bot still refuses to trade without LUCIDIO_ALLOW_LIVE=1"; fi

step "11. systemd: bot service, watchdog (no run in 4h20m), failure alert, daily state backup"
for u in lucidio.service lucidio-failed.service lucidio-watchdog.service lucidio-watchdog.timer lucidio-backup.service lucidio-backup.timer lucidio-compare.service lucidio-compare.timer; do
  install -m 644 "$APP/deploy/$u" "/etc/systemd/system/$u" || warn "could not install $u"
done
systemctl daemon-reload
if systemctl enable lucidio.service >/dev/null 2>&1; then ok "lucidio.service enabled (starts on boot)"; fi
if systemctl enable --now lucidio-watchdog.timer lucidio-backup.timer lucidio-compare.timer >/dev/null 2>&1; then ok "watchdog (10 min), daily state+journal backup (03:30 UTC) and daily live-vs-backtest compare (00:40 UTC) timers enabled"; else warn "timers could not be enabled"; fi
if [ "$WAS_ACTIVE" = 1 ]; then systemctl start lucidio && ok "service restarted with the new code"; fi

step "summary"
echo "   node $(node -v) - service: $(systemctl is-active lucidio || true) - enabled: $(systemctl is-enabled lucidio 2>/dev/null) - ufw: $(ufw status 2>/dev/null | head -1) - lucidio timers: $(systemctl list-timers 'lucidio-*' --no-legend 2>/dev/null | wc -l)"
if [ ${#WARNINGS[@]} -gt 0 ]; then echo; echo "${#WARNINGS[@]} warning(s):"; printf '  - %s\n' "${WARNINGS[@]}"; fi
echo
echo "Next (first install):"
echo "  0) sudo -u $SVC nano $APP/.env                               # TELEGRAM_BOT_TOKEN, then: sudo -u $SVC node $APP/lucidio.js telegram-setup (see DEPLOY.md)"
echo "  1) sudo bash $APP/deploy/make-keys.sh                       # MEXC key (+ Telegram), hidden prompts"
echo "  2) sudo -u $SVC node $APP/lucidio.js check                  # no BAD lines"
echo "  3) sudo systemctl start lucidio && sudo journalctl -u lucidio -f"
echo "Public IPv4 for the MEXC key binding: $(curl -4 -s --max-time 8 https://checkip.amazonaws.com || echo '?')"
