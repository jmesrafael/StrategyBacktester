#!/usr/bin/env bash
# Builds dist/newslab.tar.gz and NEWS-LAB-INSTALL.md (instructions + the whole bundle embedded, so it works from any PC with one file).
# Rebuilds the three bots from fresh copies first (node build.js), runs the tests, then packs code + data + installers only:
# no state, journal, keys, env files or tests. Fails on secret-like text, key files, a non-paper config, a missing paper lock / news gate / tag, or Telegram left on.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
node build.js
node --test test/newsgate-test.js >/dev/null
for b in bb ic tc; do NEWS_BOT=$b node --test test/bot-test.js >/dev/null || { echo "FAIL: news-$b tests"; exit 1; }; done
echo "tests passed"
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
for b in news-bb news-ic news-tc; do
  mkdir -p "$STAGE/$b/data"
  cp out/$b/*.js out/$b/*.json "$STAGE/$b/"
  for c in SOL ZEC NEAR ADA GALA; do cp out/$b/data/$c.json "$STAGE/$b/data/"; done
done
mkdir -p "$STAGE/deploy"; cp deploy/*.service deploy/install-news-lab.sh deploy/status.sh "$STAGE/deploy/"
find "$STAGE" \( -name '*.sh' -o -name '*.service' \) -exec sed -i 's/\r$//' {} +
if grep -rnE '[0-9]{8,12}:[A-Za-z0-9_-]{30,}|hc-ping\.com/[0-9a-fA-F-]{16,}|mx0v[A-Za-z0-9]{10,}' "$STAGE" --include='*.js' --include='*.json' --include='*.sh' --include='*.service'; then echo "FAIL: secret-like text"; exit 1; fi
if find "$STAGE" \( -name '.env' -o -name 'mexc-keys*.json' -o -name '*.pem' \) | grep .; then echo "FAIL: a key or env file is in the bundle"; exit 1; fi
for pair in news-bb:lucidio.js:bbn news-ic:icore.js:icn news-tc:icore.js:tcn; do
  IFS=: read -r b m t <<< "$pair"
  grep -q '"mode": "paper"' "$STAGE/$b/bot-config.json" && grep -q '"realisticPaper": true' "$STAGE/$b/bot-config.json" || { echo "FAIL: $b is not paper + realistic costs"; exit 1; }
  grep -q 'const liveAllowed = () => false;' "$STAGE/$b/$m" || { echo "FAIL: $b has no paper lock"; exit 1; }
  grep -q 'newsgate.decide(opt.news' "$STAGE/$b/$m" || { echo "FAIL: $b has no news gate"; exit 1; }
  grep -q "bot: '$t'" "$STAGE/$b/dashboard-push.js" || { echo "FAIL: $b does not report as $t"; exit 1; }
  grep -q 'news lab: Telegram is disabled in this build' "$STAGE/$b/telegram.js" || { echo "FAIL: $b Telegram not disabled"; exit 1; }
done
if grep -h 'TELEGRAM_' "$STAGE"/deploy/*.service | grep -v '^#' | grep -q .; then echo "FAIL: a service file sets TELEGRAM_*"; exit 1; fi
mkdir -p dist; rm -f dist/newslab.tar.gz*
tar --owner=0 --group=0 --numeric-owner -C "$STAGE" -czf dist/newslab.tar.gz .
( cd dist && sha256sum newslab.tar.gz > newslab.tar.gz.sha256 )
SHA="$(cut -d' ' -f1 dist/newslab.tar.gz.sha256)"
{ sed "s/__SHA__/$SHA/g; s/__DATE__/$(date -u +%Y-%m-%d)/g" NEWS-LAB-INSTALL.template.md; echo; echo "BEGIN-BUNDLE"; base64 -w 76 dist/newslab.tar.gz; echo "END-BUNDLE"; echo; echo "SHA-256: $SHA"; } > NEWS-LAB-INSTALL.md
echo "files in bundle: $(tar -tzf dist/newslab.tar.gz | grep -vc '/$')  ·  NEWS-LAB-INSTALL.md $(wc -c < NEWS-LAB-INSTALL.md) bytes"; echo "$SHA"
