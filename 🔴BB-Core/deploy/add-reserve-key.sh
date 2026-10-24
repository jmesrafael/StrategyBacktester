#!/usr/bin/env bash
# Add (or replace) the RESERVE MEXC API key in /opt/lucidio/mexc-keys.json WITHOUT the secret touching shell history or the screen (prompts are silent).
#   sudo bash /opt/lucidio/deploy/add-reserve-key.sh
# The bot signs with the primary key and moves to the reserve by itself when MEXC rejects the primary as expired (no restart: the file is re-read when it changes).
# When the primary has already expired and the reserve is carrying the bot, the old reserve is promoted to primary and this new key becomes the reserve.
# Create the new key on MEXC first: View Account + View Order + Order Placing ONLY (never Withdraw), bound to this server's IPv4.
set -euo pipefail
APP="${LUCIDIO_APP:-/opt/lucidio}"; FILE="${LUCIDIO_KEYS:-$APP/mexc-keys.json}"
[ "$(id -u)" -eq 0 ] || { echo "run as root: sudo bash $0"; exit 1; }
command -v node >/dev/null || { echo "node not installed: run deploy/setup-vps.sh first"; exit 1; }
[ -f "$FILE" ] || { echo "no $FILE yet: run deploy/make-keys.sh first (the primary key goes there)"; exit 1; }
echo "RESERVE MEXC API key, bound to this server's IPv4: $(curl -4 -s --max-time 8 https://checkip.amazonaws.com || echo '?')"
read -rp  "Reserve apiKey: " K; read -rsp "Reserve apiSecret (hidden): " S; echo
read -rp  "Is this key LINKED to this server's IP on MEXC (then it never expires)? y/N: " IB
C=""; X=""
if [[ ! "$IB" =~ ^[Yy] ]]; then
  read -rp  "Day this key was created on MEXC, like 2026-10-23 (Enter = today): " C
  read -rp  "Expiry day shown by MEXC, like 2027-01-21 (Enter = created + 90 days): " X
fi
K="$K" S="$S" C="$C" X="$X" IB="$IB" FILE="$FILE" KI="$APP/keyinfo.js" node -e '
const fs = require("fs"), e = process.env, ki = require(e.KI);
let k = {}; try { k = JSON.parse(fs.readFileSync(e.FILE, "utf8")); } catch { console.error("cannot read the keys file (nothing written)"); process.exit(1); }
try {
  const r = ki.addReserve(k, { apiKey: e.K, apiSecret: e.S, created: e.C, expires: e.X, ipBound: /^y/i.test(e.IB || "") });
  fs.writeFileSync(e.FILE + ".tmp", JSON.stringify(r.keys, null, 2) + "\n", { mode: 0o600 }); fs.renameSync(e.FILE + ".tmp", e.FILE);
  console.log(r.action);
} catch (err) { console.error(err.message + " (nothing written)"); process.exit(1); }'
chown lucidio:lucidio "$FILE" 2>/dev/null || true; chmod 600 "$FILE"
echo "written: $(ls -l "$FILE" | awk '{print $1, $3, $4, $9}')  (contents not shown)"
node "$APP/keyinfo.js" --status
