#!/usr/bin/env bash
# Builds dist/bbtrail.tar.gz and VPS-TRAIL-INSTALL.md (instructions + the whole bundle embedded, so it works from any PC with one file).
# Code, data history and installers only: no state, journal, keys or env files. Fails if a secret-like string, a key file or a CRLF in a script is found.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
FILES=(icore.js icore-core.js realpaper.js live.js mexc.js config.js envfile.js telegram.js journal.js dashboard-push.js ledger-sync.js keyinfo.js matchkey.js compare-live-vs-backtest.js lab-report.js bot-config.json README-TRAIL.md
  deploy-trail/install-trail-paper.sh deploy-trail/bbtrail.service deploy-trail/bbtrail-compare.service deploy-trail/bbtrail-compare.timer deploy-trail/status.sh
  data/SOL.json data/ZEC.json data/NEAR.json data/ADA.json data/GALA.json)
for f in "${FILES[@]}"; do mkdir -p "$STAGE/$(dirname "$f")"; cp "$f" "$STAGE/$f"; done
find "$STAGE" \( -name '*.sh' -o -name '*.service' -o -name '*.timer' \) -exec sed -i 's/\r$//' {} +
if grep -rnE '[0-9]{8,12}:[A-Za-z0-9_-]{30,}|hc-ping\.com/[0-9a-fA-F-]{16,}|mx0v[A-Za-z0-9]{10,}' "$STAGE" --include='*.js' --include='*.json' --include='*.sh' --include='*.service' --include='*.md'; then echo "FAIL: secret-like text"; exit 1; fi
if find "$STAGE" \( -name '.env' -o -name 'mexc-keys.json' -o -name '*.pem' \) | grep .; then echo "FAIL: a key or env file is in the bundle"; exit 1; fi
grep -q '"mode": "paper"' "$STAGE/bot-config.json" && grep -q '"realisticPaper": true' "$STAGE/bot-config.json" || { echo "FAIL: bot-config.json is not paper + realistic costs"; exit 1; }
grep -q 'const liveAllowed = () => false;' "$STAGE/icore.js" || { echo "FAIL: no paper lock in icore.js"; exit 1; }
mkdir -p dist; rm -f dist/bbtrail.tar.gz*
tar --owner=0 --group=0 --numeric-owner -C "$STAGE" -czf dist/bbtrail.tar.gz .
( cd dist && sha256sum bbtrail.tar.gz > bbtrail.tar.gz.sha256 )
SHA="$(cut -d' ' -f1 dist/bbtrail.tar.gz.sha256)"
{ sed "s/__SHA__/$SHA/g; s/__DATE__/$(date -u +%Y-%m-%d)/g" VPS-TRAIL-INSTALL.template.md; echo; echo "BEGIN-BUNDLE"; base64 -w 76 dist/bbtrail.tar.gz; echo "END-BUNDLE"; echo; echo "SHA-256: $SHA"; } > VPS-TRAIL-INSTALL.md
echo "files in bundle: $(tar -tzf dist/bbtrail.tar.gz | grep -vc '/$')  ·  VPS-TRAIL-INSTALL.md $(wc -c < VPS-TRAIL-INSTALL.md) bytes"; echo "$SHA"
