#!/usr/bin/env bash
# Builds dist/lucidio-1h-paper.tar.gz (+ .sha256): code and installer only, no data, state, keys or env files. Fails if a secret-like string or CRLF is found.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
FILES=(lucidio.js lucidio-core.js realpaper.js mexc.js live.js config.js envfile.js telegram.js journal.js dashboard-push.js ledger-sync.js keyinfo.js paper-vs-backtest.js bot-config.json README-1H.md VPS-1H-PAPER.md deploy-1h/install-1h-paper.sh deploy-1h/status.sh deploy-1h/lucidio-1h.service)
for f in deploy-1h/*; do sed -i 's/\r$//' "$f"; done
if grep -nE '[0-9]{8,12}:[A-Za-z0-9_-]{30,}|hc-ping\.com/[0-9a-fA-F-]{16,}|mx0v[A-Za-z0-9]{10,}' "${FILES[@]}"; then echo "FAIL: secret-like text"; exit 1; fi
mkdir -p dist; rm -f dist/lucidio-1h-paper.tar.gz*
tar --owner=0 --group=0 --numeric-owner -czf dist/lucidio-1h-paper.tar.gz "${FILES[@]}"
( cd dist && sha256sum lucidio-1h-paper.tar.gz > lucidio-1h-paper.tar.gz.sha256 )
cp VPS-1H-PAPER.md dist/
echo "files in bundle: $(tar -tzf dist/lucidio-1h-paper.tar.gz | wc -l)"; cat dist/lucidio-1h-paper.tar.gz.sha256
