#!/usr/bin/env bash
# PC ONLY (Git Bash). The VPS "Pull changes from GitHub" reads the repo jmesrafael/bb-core, NOT the StrategyBacktester repo your normal commits go to.
# This copies the COMMITTED state of the 🔴BB-Core folder into a local clone of bb-core, so you can review it, commit it and push it there.
#   bash deploy/publish-to-bbcore.sh [folder-for-the-clone]      default folder: ~/bb-core-publish
# It never commits and never pushes: it stops after showing what changed and prints the two commands for that. It reads GitHub (clone / fetch) only.
# bb-core has its own history, so this copies files (like the repo already holds them) instead of merging histories.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; FOLDER="🔴BB-Core"
URL="${BBCORE_URL:-https://github.com/jmesrafael/bb-core.git}"; WORK="${1:-$HOME/bb-core-publish}"
cd "$ROOT"
[ -z "$(git status --porcelain -- "$FOLDER")" ] || [ -n "${PUBLISH_ALLOW_DIRTY:-}" ] || { echo "There are uncommitted changes in $FOLDER. Commit them first (this copies what is COMMITTED):"; git status --short -- "$FOLDER" | head -10; exit 1; }
echo "Publishing commit $(git log -1 --format='%h %s' -- "$FOLDER")"
if [ -d "$WORK/.git" ]; then
  [ -z "$(git -C "$WORK" status --porcelain)" ] || { echo "$WORK has uncommitted changes from an earlier run. Commit or discard them there first (git -C \"$WORK\" status)."; exit 1; }
  git -C "$WORK" fetch --quiet origin main && git -C "$WORK" checkout --quiet main && git -C "$WORK" merge --quiet --ff-only origin/main
else
  git clone --quiet "$URL" "$WORK"
fi
STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
git archive --format=tar HEAD "$FOLDER" | tar -x -C "$STAGE" --strip-components=1 --exclude='.git-nested-backup'
find "$WORK" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$STAGE/." "$WORK/"
git -C "$WORK" add -A
echo; echo "== what will change in bb-core"; git -C "$WORK" status --short | head -60; echo "   ($(git -C "$WORK" status --short | wc -l) files)"
[ -n "$(git -C "$WORK" status --porcelain)" ] || { echo "bb-core is already identical to this commit: nothing to publish."; exit 0; }
for f in keyinfo.js lucidio-core.js; do [ -f "$WORK/$f" ] || { echo "WARNING: $f is missing from the copy: do not push."; exit 1; }; done
echo; echo "lucidio-core.js in the copy: $(git hash-object "$WORK/lucidio-core.js")   (must be 7cc03e24e38143b9303eb260cf1830a0e38b2e34)"
echo; echo "Review it, then publish with:"
echo "  git -C \"$WORK\" commit -m \"update bot: ask-now poll, reserve API key, progress menu\""
echo "  git -C \"$WORK\" push origin main"
echo "Then on the VPS: lucidio -> Pull changes from GitHub."
