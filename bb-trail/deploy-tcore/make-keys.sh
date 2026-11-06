#!/usr/bin/env bash
# Create / update /var/lib/tcore/mexc-keys.json WITHOUT the secrets touching shell history or the screen (prompts are silent).
#   sudo bash /opt/tcore/deploy-tcore/make-keys.sh
# Asks for T-CORE's OWN MEXC key (the T-CORE account only) and its ledger wallet key. The ledger address and the shared bot key (ledgerUrl, ledgerKey) are
# copied from I-Core's key file without being shown. Enter keeps what is already there. Written chmod 600, owner tcore.
set -euo pipefail
FILE=/var/lib/tcore/mexc-keys.json; ICORE=/opt/icore/mexc-keys.json
[ "$(id -u)" -eq 0 ] || { echo "run as root: sudo bash $0"; exit 1; }
[ -d /var/lib/tcore ] || { echo "/var/lib/tcore is missing: run deploy-tcore/install-tcore-live.sh first"; exit 1; }
echo "T-CORE's MEXC API key: View Account + View Order + Order Placing ONLY (never Withdraw), on the T-CORE account, linked to this server's IPv4: $(curl -4 -s --max-time 8 https://checkip.amazonaws.com || echo '?')"
echo "Do NOT reuse BB-Core's or I-Core's key: each bot must see only its own account."
read -rp  "MEXC apiKey (Enter = keep existing): " K; read -rsp "MEXC apiSecret (hidden, Enter = keep existing): " S; echo
read -rp  "Is this key LINKED to this server's IP on MEXC? y/N (Enter = no / keep): " IB
read -rsp "Ledger wallet key for wallet 'tcore' (hidden; Enter = keep the one in the file, or MAKE a new one here if there is none): " LW; echo
K="$K" S="$S" IB="$IB" LW="$LW" FILE="$FILE" ICORE="$ICORE" node -e '
const fs = require("fs"), e = process.env; let k = {}, ic = {};
try { k = JSON.parse(fs.readFileSync(e.FILE, "utf8")); } catch {}
try { ic = JSON.parse(fs.readFileSync(e.ICORE, "utf8")); } catch {}
if (e.K) k.apiKey = e.K.trim(); if (e.S) k.apiSecret = e.S.trim();
if (e.K) { delete k.apiKeyCreated; delete k.apiKeyExpires; delete k.apiKeyIpBound; }
if (/^y/i.test(e.IB || "")) k.apiKeyIpBound = true;
if (ic.apiKey && k.apiKey && ic.apiKey === k.apiKey) { console.error("this is I-Core'"'"'s MEXC key: T-CORE needs its OWN account and key (nothing written)"); process.exit(1); }
for (const f of ["ledgerUrl", "ledgerKey"]) if (!k[f] && ic[f]) k[f] = ic[f];
k.ledgerWallet = "tcore"; if (e.LW) k.ledgerWalletKey = e.LW.trim();
let made = false;
if (!k.ledgerWalletKey) { k.ledgerWalletKey = require("crypto").randomBytes(32).toString("hex"); made = true; }   // made here: the secret never leaves this server
const hash = require("crypto").createHash("sha256").update(k.ledgerWalletKey).digest("hex");
if (!k.apiKey !== !k.apiSecret) { console.error("give apiKey AND apiSecret, or neither (nothing written)"); process.exit(1); }
fs.writeFileSync(e.FILE, JSON.stringify(k, null, 2) + "\n", { mode: 0o600 });
console.log("fields: " + Object.keys(k).sort().join(", ") + " (values not shown)");
console.log((made ? "A NEW ledger wallet key was made for tcore. " : "") + "Register (or re-register) the wallet in the ledger with this SQL (Supabase SQL Editor; it holds only the hash):\n");
console.log(`  insert into public.bot_wallets(wallet, label, key_hash) values (\x27tcore\x27, \x27T-CORE\x27, \x27${hash}\x27)\n  on conflict (wallet) do update set key_hash = excluded.key_hash, label = excluded.label, active = true;\n`);'
chown tcore:tcore "$FILE"; chmod 600 "$FILE"
echo "written: $(ls -l "$FILE" | awk '{print $1, $3, $4, $9}')"
echo "next: sudo bash /opt/tcore/deploy-tcore/status.sh check"
