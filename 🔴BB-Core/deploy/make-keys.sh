#!/usr/bin/env bash
# Create / update /opt/lucidio/mexc-keys.json WITHOUT the secrets touching shell history or the screen (prompts are silent).
#   sudo bash /opt/lucidio/deploy/make-keys.sh
# Keeps fields you already have (ledger*, telegram*) when you just press Enter. MEXC key is optional for paper mode: Telegram alone is fine. File is written chmod 600, owner lucidio.
set -euo pipefail
APP=/opt/lucidio; FILE="$APP/mexc-keys.json"
[ "$(id -u)" -eq 0 ] || { echo "run as root: sudo bash $0"; exit 1; }
command -v node >/dev/null || { echo "node not installed: run deploy/setup-vps.sh first"; exit 1; }
echo "MEXC API key: View Account + View Order + Order Placing ONLY (never Withdraw), bound to this server's IPv4: $(curl -4 -s --max-time 8 https://checkip.amazonaws.com || echo '?')"
read -rp  "MEXC apiKey (Enter = keep existing): " K; read -rsp "MEXC apiSecret (hidden, Enter = keep existing): " S; echo
read -rsp "Telegram bot token (hidden, Enter = keep/skip): " TT; echo
read -rp  "Telegram chat id (Enter = keep/skip): " TC
K="$K" S="$S" TT="$TT" TC="$TC" FILE="$FILE" node -e '
const fs = require("fs"), e = process.env; let k = {};
try { k = JSON.parse(fs.readFileSync(e.FILE, "utf8")); } catch {}
if (e.K) k.apiKey = e.K.trim(); if (e.S) k.apiSecret = e.S.trim();
if (e.TT) k.telegramToken = e.TT.trim(); if (e.TC) k.telegramChatId = e.TC.trim();
if (!k.apiKey !== !k.apiSecret) { console.error("give apiKey AND apiSecret, or neither (nothing written)"); process.exit(1); }
if (!Object.keys(k).length) { console.error("nothing entered (nothing written)"); process.exit(1); }
fs.writeFileSync(e.FILE, JSON.stringify(k, null, 2) + "\n", { mode: 0o600 });'
chown lucidio:lucidio "$FILE"; chmod 600 "$FILE"
echo "written: $(ls -l "$FILE" | awk '{print $1, $3, $4, $9}')  (contents not shown)"
echo "next: sudo -u lucidio node $APP/lucidio.js check"
