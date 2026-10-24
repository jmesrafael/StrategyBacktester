#!/usr/bin/env bash
# deploy/package.sh - build lucidio-deploy.tar.gz: ONLY what the bot needs at runtime, then prove it holds no secrets.
#   bash deploy/package.sh                 runtime bundle (what runs on the VPS)
#   bash deploy/package.sh --with-tests    + test/ and data/SOL.json, ZEC.json, MEXC_ZEC.json: the minimum that selftest.js, fixes-test.js (needs the MEXC_ZEC gap) and
#                                          `lucidio.js replay SOL,ZEC` read (they check a new server before you trust it). Everything else
#                                          in data/ stays out.
#   OUT=/path/file.tar.gz bash deploy/package.sh     choose the output file
# Output: lucidio-deploy.tar.gz + lucidio-deploy.tar.gz.sha256 in the bot folder. Inside, everything sits under lucidio/.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT:-$PWD/lucidio-deploy.tar.gz}"
WITH_TESTS=0; [ "${1:-}" = "--with-tests" ] && WITH_TESTS=1

# a bundle that failed verification must not be left lying around to be uploaded by mistake
trap 'rc=$?; rm -rf "${CHK:-}" "${BI:-}"; if [ "$rc" -ne 0 ]; then rm -f "$OUT" "$OUT.sha256"; echo "bundle removed: verification failed (exit $rc)"; fi' EXIT

# ---- 1. what goes in (explicit list, nothing else) ----
shopt -s nullglob
FILES=()
for f in lucidio*.js live.js mexc.js config.js ledger-sync.js telegram.js journal.js dashboard-push.js envfile.js matchkey.js shadow-reader.js compare-live-vs-backtest.js dashboard.* bot-config.json package.json; do [ -f "$f" ] && FILES+=("$f"); done
FILES+=(deploy sidecar)
# --with-tests: the tests, their 3 data files, the Vercel-side code the dashboard tests exercise (dashboard/, never deployed to the VPS) and export-trades.js (needs data/)
if [ "$WITH_TESTS" = 1 ]; then FILES+=(test dashboard export-trades.js data/SOL.json data/ZEC.json data/MEXC_ZEC.json); fi
for need in matchkey.js shadow-reader.js sidecar/shadow-recorder.js lucidio.js lucidio-core.js live.js mexc.js config.js ledger-sync.js telegram.js journal.js dashboard-push.js envfile.js compare-live-vs-backtest.js dashboard.js dashboard.html bot-config.json deploy/setup-vps.sh deploy/lucidio.service deploy/lucidio.env.example deploy/lucidio-compare.timer; do
  printf '%s\n' "${FILES[@]}" | grep -qx "$need" || [ -e "$need" ] || { echo "FAIL: required runtime file missing: $need"; exit 1; }
done

# ---- 2. pre-flight on the source tree ----
node -e '
const c = JSON.parse(require("fs").readFileSync("bot-config.json", "utf8")), bad = [];
if (c.mode !== "paper") bad.push("mode is " + c.mode + " (must be paper in a bundle)");
if (c.heartbeatUrl) bad.push("heartbeatUrl is set (it is a secret ping URL: set it on the server, not in the bundle)");
if (c.ledgerSync) bad.push("ledgerSync is true");
if (!(c.riskPct <= 0.01)) bad.push("riskPct " + c.riskPct + " is above the 1% cap");
if (bad.length) { console.error("FAIL bot-config.json: " + bad.join("; ")); process.exit(1); }
console.log("bot-config.json: mode paper, riskPct " + c.riskPct + ", heartbeatUrl empty, ledgerSync off - ok");'
if grep -lq $'\r' deploy/*.sh deploy/*.service deploy/*.timer 2>/dev/null; then echo "FAIL: CRLF line endings in deploy/ (bash and systemd need LF)"; exit 1; fi

# ---- 3. build ----
rm -f "$OUT" "$OUT.sha256"
# BUILD_INFO.json: which commit this bundle was built from (the VPS has no .git); journal events carry it as provenance. dirty = uncommitted changes were included.
BI="$(mktemp -d)"
COMMIT="$(git rev-parse HEAD 2>/dev/null || echo unknown)"; DIRTY=false; [ -n "$(git status --porcelain -- . 2>/dev/null)" ] && DIRTY=true
printf '{"commit":"%s","dirty":%s,"built_at":"%s"}\n' "$COMMIT" "$DIRTY" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$BI/BUILD_INFO.json"
tar --sort=name --owner=0 --group=0 --numeric-owner --transform 's,^,lucidio/,' \
    --exclude='*.tar.gz' --exclude='*.sha256' --exclude='*.log' --exclude='*.jsonl' --exclude='node_modules' --exclude='.git' \
    -czf "$OUT" "${FILES[@]}" -C "$BI" BUILD_INFO.json
( cd "$(dirname "$OUT")" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )

# ---- 4. report ----
echo; echo "== bundle contents ($(tar -tzf "$OUT" | grep -vc '/$') files)"
tar -tzvf "$OUT" | awk '$1 !~ /^d/ {printf "  %9d  %s\n", $3, $6}'
echo; echo "== bundle size: $(du -h "$OUT" | cut -f1) ($(wc -c < "$OUT") bytes)   $(cat "$OUT.sha256")"

# ---- 5. prove it: forbidden paths + secret patterns, scanned in a fresh extraction ----
echo; echo "== secrets check"
if tar -tzf "$OUT" | grep -E '(^|/)(state|node_modules|\.git|research|audit|app-reference|docs)(/|$)|mexc-keys|(^|/)\.env|(^|/)STOP$|\.log$|\.jsonl$|\.pid$|\.tar\.gz$'; then echo "FAIL: forbidden path inside the bundle (listed above)"; exit 1; fi
if [ "$WITH_TESTS" = 1 ]; then ALLOWED='lucidio/data/(SOL|ZEC|MEXC_ZEC)\.json'; else ALLOWED='NOTHING-ALLOWED'; fi
if tar -tzf "$OUT" | grep -E '^lucidio/data/' | grep -vE "^($ALLOWED)$"; then echo "FAIL: unexpected data/ file inside the bundle"; exit 1; fi
echo "  paths: no state/, mexc-keys.json, .env, node_modules, .git, research/, audit/, logs, pid or jsonl files"
CHK="$(mktemp -d)"
tar -xzf "$OUT" -C "$CHK"
PATTERNS=(
  '[0-9]{8,12}:[A-Za-z0-9_-]{30,}'                                                          # Telegram bot token
  'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'                                               # JWT / Supabase legacy keys
  'sb_(publishable|secret)_[A-Za-z0-9_-]{10,}'                                              # Supabase new-style keys
  'hc-ping\.com/[0-9a-fA-F-]{16,}'                                                          # healthchecks.io ping URL
  '"(apiKey|apiSecret|telegramToken|telegramChatId|ledgerUrl|ledgerKey|ledgerBotKey)"[[:space:]]*:[[:space:]]*"[^"]{6,}"'   # secret JSON with a value
  '(^|[^A-Za-z0-9])[A-Fa-f0-9]{32,}([^A-Za-z0-9]|$)'                                        # a bare 32+ hex string (MEXC secrets look like this)
)
HITS=0
# test/ and data/ are fixtures, not config: data/*.json is numbers only, so only scan code, config and deploy files
for p in "${PATTERNS[@]}"; do
  if grep -rInE --exclude-dir=data --exclude=BUILD_INFO.json -e "$p" "$CHK/lucidio"; then HITS=$((HITS + 1)); fi
done
# BUILD_INFO.json is generated above (a commit hash is 40 hex characters, which the hex pattern would flag): check its exact shape instead
grep -qE '^\{"commit":"([0-9a-f]{40}|unknown)","dirty":(true|false),"built_at":"[0-9TZ:-]+"\}$' "$CHK/lucidio/BUILD_INFO.json" || { echo "FAIL: BUILD_INFO.json has an unexpected shape"; HITS=$((HITS + 1)); }
if [ "$HITS" -gt 0 ]; then echo "FAIL: $HITS secret pattern(s) matched (lines above)"; exit 1; fi
echo "  content: scanned $(find "$CHK/lucidio" -type f ! -path '*/data/*' | wc -l) files for ${#PATTERNS[@]} secret patterns (Telegram/JWT/Supabase/healthchecks URLs, secret JSON values, 32+ hex): 0 matches"
echo "  bot-config.json inside the bundle: $(tr -d '\n ' < "$CHK/lucidio/bot-config.json")"
echo; echo "OK: $OUT"
