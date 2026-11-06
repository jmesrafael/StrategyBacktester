#!/usr/bin/env bash
# Builds vps-lab/dist/lucidio-lab.tar.gz and VPS-LAB-INSTALL.md (instructions + the whole bundle embedded, so it works from any PC with one file).
# Code and installers only: no data, state, keys or env files. Fails if a secret-like string, a key file or a CRLF in a script is found.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
ROOT="$(cd .. && pwd)"; STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
BOT_FILES=(lucidio.js lucidio-core.js realpaper.js mexc.js live.js config.js envfile.js telegram.js journal.js dashboard-push.js ledger-sync.js keyinfo.js paper-vs-backtest.js bot-config.json README-1H.md deploy-1h/install-1h-paper.sh deploy-1h/status.sh deploy-1h/lucidio-1h.service)
REC_FILES=(recorder.js regime.js bookstats.js archive.js mexcpub.js push.js regime-history.js README.md deploy/install-recorder.sh deploy/lucidio-recorder.service deploy/status.sh deploy/vps-check.sh deploy/add-swap.sh)
mkdir -p "$STAGE/bb-core-1h" "$STAGE/lucidio-recorder"
for f in "${BOT_FILES[@]}"; do mkdir -p "$STAGE/bb-core-1h/$(dirname "$f")"; cp "$ROOT/bb-core-1h/$f" "$STAGE/bb-core-1h/$f"; done
for f in "${REC_FILES[@]}"; do mkdir -p "$STAGE/lucidio-recorder/$(dirname "$f")"; cp "$ROOT/lucidio-recorder/$f" "$STAGE/lucidio-recorder/$f"; done
cp install-lab.sh "$STAGE/install-lab.sh"
find "$STAGE" -name '*.sh' -exec sed -i 's/\r$//' {} +
find "$STAGE" -name '*.service' -exec sed -i 's/\r$//' {} +
if grep -rnE '[0-9]{8,12}:[A-Za-z0-9_-]{30,}|hc-ping\.com/[0-9a-fA-F-]{16,}|mx0v[A-Za-z0-9]{10,}' "$STAGE"; then echo "FAIL: secret-like text"; exit 1; fi
if find "$STAGE" \( -name '.env' -o -name 'mexc-keys.json' -o -name '*.pem' \) | grep .; then echo "FAIL: a key or env file is in the bundle"; exit 1; fi
mkdir -p dist; rm -f dist/lucidio-lab.tar.gz*
tar --owner=0 --group=0 --numeric-owner -C "$STAGE" -czf dist/lucidio-lab.tar.gz .
( cd dist && sha256sum lucidio-lab.tar.gz > lucidio-lab.tar.gz.sha256 )
SHA="$(cut -d' ' -f1 dist/lucidio-lab.tar.gz.sha256)"
{ sed "s/__SHA__/$SHA/g; s/__DATE__/$(date -u +%Y-%m-%d)/g" VPS-LAB-INSTALL.template.md; echo; echo "BEGIN-BUNDLE"; base64 -w 76 dist/lucidio-lab.tar.gz; echo "END-BUNDLE"; echo; echo "SHA-256: $SHA"; } > VPS-LAB-INSTALL.md
echo "files in bundle: $(tar -tzf dist/lucidio-lab.tar.gz | grep -vc '/$')  ·  VPS-LAB-INSTALL.md $(wc -c < VPS-LAB-INSTALL.md) bytes"; echo "$SHA"
