#!/usr/bin/env bash
# deploy/package-shadow.sh - build lucidio-shadow.tar.gz: ONLY the shadow recorder (no bot code, no config, no keys, no state).
#   bash deploy/package-shadow.sh            -> lucidio-shadow.tar.gz + .sha256 in the bot folder (or OUT=/path/file.tar.gz)
# Install on the VPS without touching the bot:  scp it, tar -xzf, then  sudo bash lucidio/deploy/install-shadow.sh   (see DEPLOY.md section 16).
# lucidio-core.js is included because the recorder makes the same decision as the bot with the same file; the installer warns if it differs from the bot's copy.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT:-$PWD/lucidio-shadow.tar.gz}"
trap 'rc=$?; rm -rf "${CHK:-}"; if [ "$rc" -ne 0 ]; then rm -f "$OUT" "$OUT.sha256"; echo "bundle removed: verification failed (exit $rc)"; fi' EXIT
FILES=(sidecar/shadow-recorder.js shadow-reader.js matchkey.js lucidio-core.js deploy/install-shadow.sh deploy/lucidio-shadow.service)
for f in "${FILES[@]}"; do [ -f "$f" ] || { echo "FAIL: missing $f"; exit 1; }; done
if grep -lq $'\r' deploy/install-shadow.sh deploy/lucidio-shadow.service 2>/dev/null; then echo "FAIL: CRLF line endings in deploy/ (bash and systemd need LF)"; exit 1; fi
# the recorder must be what it claims: it requires no bot module (selfcheck and tests/shadow-test.js check the rest: no key token, only public GET paths)
if grep -vE '^\s*//' sidecar/shadow-recorder.js | grep -nE "require\('(\./|\.\./)?(mexc|live|lucidio|journal|config|telegram|ledger-sync|dashboard-push|envfile)(\.js)?'\)" ; then echo "FAIL: the recorder requires a bot module (lines above)"; exit 1; fi
rm -f "$OUT" "$OUT.sha256"
tar --sort=name --owner=0 --group=0 --numeric-owner --transform 's,^,lucidio/,' -czf "$OUT" "${FILES[@]}"
( cd "$(dirname "$OUT")" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )
echo "== contents"; tar -tzvf "$OUT" | awk '$1 !~ /^d/ {printf "  %9d  %s\n", $3, $6}'
CHK="$(mktemp -d)"; tar -xzf "$OUT" -C "$CHK"
PATTERNS=('[0-9]{8,12}:[A-Za-z0-9_-]{30,}' 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}' 'sb_(publishable|secret)_[A-Za-z0-9_-]{10,}' 'hc-ping\.com/[0-9a-fA-F-]{16,}' '(^|[^A-Za-z0-9])[A-Fa-f0-9]{32,}([^A-Za-z0-9]|$)')
HITS=0; for p in "${PATTERNS[@]}"; do if grep -rInE -e "$p" "$CHK/lucidio"; then HITS=$((HITS + 1)); fi; done
[ "$HITS" -eq 0 ] || { echo "FAIL: $HITS secret pattern(s) matched"; exit 1; }
echo "== secrets check: ${#PATTERNS[@]} patterns, 0 matches; $(wc -c < "$OUT") bytes; $(cat "$OUT.sha256")"
echo "OK: $OUT"
