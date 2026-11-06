#!/usr/bin/env bash
# Builds dist/tcore-live.tar.gz (+ .sha256): the T-CORE LIVE bot = a copy of this folder with apply-tcore-live-patch.js applied.
# The paper lab source in this folder is never changed. Code, data history and installers only: no state, journal, keys or env files.
# Fails if a secret-like string, a key file or a CRLF in a script is found, or if the patch did not produce a live build.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
FILES=(icore.js icore-core.js realpaper.js live.js mexc.js config.js envfile.js telegram.js journal.js dashboard-push.js ledger-sync.js keyinfo.js matchkey.js compare-live-vs-backtest.js lab-report.js bot-config.json README-TRAIL.md
  deploy-tcore/install-tcore-live.sh deploy-tcore/make-keys.sh deploy-tcore/status.sh deploy-tcore/track-old-position.js deploy-tcore/tcore.service deploy-tcore/tcore-compare.service deploy-tcore/tcore-compare.timer
  data/SOL.json data/ZEC.json data/NEAR.json data/ADA.json data/GALA.json)
for f in "${FILES[@]}"; do mkdir -p "$STAGE/$(dirname "$f")"; cp "$f" "$STAGE/$f"; done
node apply-tcore-live-patch.js "$STAGE"
find "$STAGE" \( -name '*.sh' -o -name '*.service' -o -name '*.timer' \) -exec sed -i 's/\r$//' {} +
if grep -rnE '[0-9]{8,12}:[A-Za-z0-9_-]{30,}|hc-ping\.com/[0-9a-fA-F-]{16,}|mx0v[A-Za-z0-9]{10,}' "$STAGE" --include='*.js' --include='*.json' --include='*.sh' --include='*.service' --include='*.md'; then echo "FAIL: secret-like text"; exit 1; fi
if find "$STAGE" \( -name '.env' -o -name 'mexc-keys.json' -o -name '*.pem' \) | grep .; then echo "FAIL: a key or env file is in the bundle"; exit 1; fi
grep -q '"mode": "live"' "$STAGE/bot-config.json" || { echo "FAIL: bot-config.json is not live"; exit 1; }
grep -q "process.env.ICORE_ALLOW_LIVE === '1'" "$STAGE/icore.js" || { echo "FAIL: no live gate in icore.js"; exit 1; }
grep -q "bot: 'tcore'" "$STAGE/dashboard-push.js" || { echo "FAIL: dashboard tag is not tcore"; exit 1; }
( cd "$STAGE" && node -e "process.env.ICORE_STATE_DIR=require('os').tmpdir()+'/tcore-build-check'; const b=require('./icore.js'); if(b.CFG.mode!=='live'||b.liveAllowed()) process.exit(1)" ) || { echo "FAIL: the live build does not load, or is live without ICORE_ALLOW_LIVE"; exit 1; }
mkdir -p dist; rm -f dist/tcore-live.tar.gz*
tar --owner=0 --group=0 --numeric-owner -C "$STAGE" -czf dist/tcore-live.tar.gz .
( cd dist && sha256sum tcore-live.tar.gz > tcore-live.tar.gz.sha256 )
echo "files in bundle: $(tar -tzf dist/tcore-live.tar.gz | grep -vc '/$')  ·  $(cut -d' ' -f1 dist/tcore-live.tar.gz.sha256)"
