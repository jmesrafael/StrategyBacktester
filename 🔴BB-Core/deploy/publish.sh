#!/usr/bin/env bash
# deploy/publish.sh - (on your PC, Git Bash) send the COMMITTED bot code to the private bb-core repo; the VPS menu "Update the bot code" pulls from there.
#   bash deploy/publish.sh
# Refuses while there are uncommitted changes (they would not be published). Never force-pushes: a rejected push means bb-core has commits you do not have.
# Inside the big StrategyBacktester repo it sends only the 🔴BB-Core folder (git subtree, history kept); inside the bb-core repo itself it is a plain push.
set -euo pipefail
REPO_URL="https://github.com/jmesrafael/bb-core.git"
PREFIX="🔴BB-Core"
top="$(git rev-parse --show-toplevel)"; cd "$top"
if [ -d "$top/$PREFIX" ]; then
  [ -z "$(git status --porcelain -- "$PREFIX")" ] || { echo "Uncommitted changes in $PREFIX (commit them first, they are not published otherwise):"; git status --short -- "$PREFIX"; exit 1; }
  git remote get-url bbcore >/dev/null 2>&1 || git remote add bbcore "$REPO_URL"
  git -c core.quotepath=false subtree push --prefix="$PREFIX" bbcore main
else
  [ -z "$(git status --porcelain)" ] || { echo "Uncommitted changes (commit them first):"; git status --short; exit 1; }
  git push origin main
fi
echo
echo "Published. On the VPS: lucidio -> 'Update the bot code from GitHub'."
