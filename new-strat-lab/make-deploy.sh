#!/usr/bin/env bash
# Builds dist/stratlab.tar.gz (+ .sha256): builds both bots from fresh copies, runs every check (node test.js), then packs code and installer only:
# no candle data, state, journal, keys or env files. Fails on any failed check, secret-like text or a key file.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
node --max-old-space-size=8192 test.js
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
for b in lab-wide lab-ichi; do mkdir -p "$STAGE/$b"; cp out/$b/*.js out/$b/*.json "$STAGE/$b/"; done
mkdir -p "$STAGE/deploy"
cp deploy/install-strat-lab.sh deploy/status.sh "$STAGE/deploy/"
# one service file per bot, from the template
for pair in labwide:lucidio.js:LUCIDIO:BB-1H-WIDE labichi:icore.js:ICORE:ICHI-X4; do
  IFS=: read -r s m e n <<< "$pair"
  sed "s/__SVC__/$s/g; s/__MAIN__/$m/g; s/__ENVP__/$e/g; s/__NAME__/$n/g" deploy/lab.service.template > "$STAGE/deploy/$s.service"
done
find "$STAGE" \( -name '*.sh' -o -name '*.service' \) -exec sed -i 's/\r$//' {} +
if grep -rnE '[0-9]{8,12}:[A-Za-z0-9_-]{30,}|hc-ping\.com/[0-9a-fA-F-]{16,}|mx0v[A-Za-z0-9]{10,}' "$STAGE"; then echo "FAIL: secret-like text in the bundle"; exit 1; fi
if find "$STAGE" \( -name '.env' -o -name 'mexc-keys*.json' -o -name '*.pem' \) | grep .; then echo "FAIL: a key or env file is in the bundle"; exit 1; fi
bash -n "$STAGE/deploy/install-strat-lab.sh"; bash -n "$STAGE/deploy/status.sh"
mkdir -p dist; rm -f dist/stratlab.tar.gz*
tar --owner=0 --group=0 --numeric-owner -C "$STAGE" -czf dist/stratlab.tar.gz .
( cd dist && sha256sum stratlab.tar.gz > stratlab.tar.gz.sha256 )
echo; echo "bundle: $(pwd)/dist/stratlab.tar.gz  ($(tar -tzf dist/stratlab.tar.gz | grep -vc '/$') files)"; cat dist/stratlab.tar.gz.sha256
