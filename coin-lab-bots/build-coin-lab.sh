#!/usr/bin/env bash
# Builds dist/coinlab.tar.gz and COIN-LAB-INSTALL.md (instructions + the whole bundle embedded, so it works from any PC with one file).
# Rebuilds both bots from fresh copies (node build.js), checks replay parity on SUI / ARB, then packs code + data + installers only:
# no state, journal, keys, env files or tests. Fails on secret-like text, key files, a non-paper config, a missing paper lock / tag, or Telegram left on.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
node build.js
( cd out/coin-bb && node lucidio.js replay ARB | grep -q 'IDENTICAL trade-for-trade' ) || { echo "FAIL: coin-bb replay parity"; exit 1; }
( cd out/coin-tc && [ "$(node icore.js replay SUI,ARB | grep -c 'IDENTICAL trade-for-trade')" -eq 2 ] ) || { echo "FAIL: coin-tc replay parity"; exit 1; }
echo "replay parity passed"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
for pair in coin-bb:ARB coin-tc:SUI,ARB; do
  IFS=: read -r b cs <<< "$pair"
  mkdir -p "$STAGE/$b/data"
  cp out/$b/*.js out/$b/*.json "$STAGE/$b/"
  for c in ${cs//,/ }; do cp out/$b/data/$c.json "$STAGE/$b/data/"; done
done
mkdir -p "$STAGE/deploy"; cp deploy/*.service deploy/install-coin-lab.sh deploy/status.sh "$STAGE/deploy/"
find "$STAGE" \( -name '*.sh' -o -name '*.service' \) -exec sed -i 's/\r$//' {} +
if grep -rnE '[0-9]{8,12}:[A-Za-z0-9_-]{30,}|hc-ping\.com/[0-9a-fA-F-]{16,}|mx0v[A-Za-z0-9]{10,}' "$STAGE" --include='*.js' --include='*.json' --include='*.sh' --include='*.service'; then echo "FAIL: secret-like text in the bundle"; exit 1; fi
if find "$STAGE" \( -name '.env' -o -name 'mexc-keys*.json' -o -name '*.pem' \) | grep .; then echo "FAIL: a key or env file is in the bundle"; exit 1; fi
for pair in coin-bb:lucidio.js:cbb coin-tc:icore.js:ctc; do
  IFS=: read -r b m t <<< "$pair"
  grep -q '"mode": "paper"' "$STAGE/$b/bot-config.json" && grep -q '"realisticPaper": true' "$STAGE/$b/bot-config.json" || { echo "FAIL: $b is not paper + realistic costs"; exit 1; }
  grep -q 'const liveAllowed = () => false;' "$STAGE/$b/$m" || { echo "FAIL: $b has no paper lock"; exit 1; }
  grep -q "bot: '$t'" "$STAGE/$b/dashboard-push.js" || { echo "FAIL: $b does not report as $t"; exit 1; }
  grep -q 'coin lab: Telegram is disabled in this build' "$STAGE/$b/telegram.js" || { echo "FAIL: $b Telegram not disabled"; exit 1; }
done
if grep -h 'TELEGRAM_' "$STAGE"/deploy/*.service | grep -v '^#' | grep -q .; then echo "FAIL: a service file sets TELEGRAM_*"; exit 1; fi
mkdir -p dist; rm -f dist/coinlab.tar.gz*
tar --owner=0 --group=0 --numeric-owner -C "$STAGE" -czf dist/coinlab.tar.gz .
( cd dist && sha256sum coinlab.tar.gz > coinlab.tar.gz.sha256 )
SHA="$(cut -d' ' -f1 dist/coinlab.tar.gz.sha256)"
{ sed "s/__SHA__/$SHA/g; s/__DATE__/$(date -u +%Y-%m-%d)/g" COIN-LAB-INSTALL.template.md; echo; echo "BEGIN-BUNDLE"; base64 -w 76 dist/coinlab.tar.gz; echo "END-BUNDLE"; echo; echo "SHA-256: $SHA"; } > COIN-LAB-INSTALL.md
echo "files in bundle: $(tar -tzf dist/coinlab.tar.gz | grep -vc '/$')  ·  COIN-LAB-INSTALL.md $(wc -c < COIN-LAB-INSTALL.md) bytes"; echo "$SHA"
