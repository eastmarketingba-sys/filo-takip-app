#!/usr/bin/env bash
# Fires on every Stop event for this project. No-ops unless there is a
# committed, unreleased change sitting on top of the last published tag.
# When there is one: patch-bumps package.json, commits, tags, and pushes
# source to GitHub. Does NOT run the actual publish (npm run publish:win) -
# that step ships straight to customers' auto-updaters, so it stays a
# deliberate, confirmed action rather than something that fires unattended.
set -uo pipefail
cd "c:/Users/Equin/filo-takip-app" || exit 0

# Never act on a dirty tree - wait for the changes to actually be committed.
if [ -n "$(git status --porcelain)" ]; then
  exit 0
fi

LAST_TAG="$(git describe --tags --match 'v*' --abbrev=0 2>/dev/null || true)"
HEAD_SHA="$(git rev-parse HEAD)"
LAST_TAG_SHA="$(git rev-parse "$LAST_TAG" 2>/dev/null || true)"

if [ -n "$LAST_TAG" ] && [ "$HEAD_SHA" = "$LAST_TAG_SHA" ]; then
  # HEAD is exactly what's already published/prepped - nothing new.
  exit 0
fi

NEW_VERSION="$(npm version patch -m "Release v%s" 2>&1 | tail -1 | sed 's/^v//')"
if [ -z "$NEW_VERSION" ]; then
  echo "{\"systemMessage\": \"Auto-publish prep: version bump failed - nothing changed.\"}"
  exit 0
fi

if git push origin main --follow-tags >/tmp/auto-publish-push.log 2>&1; then
  echo "{\"systemMessage\": \"Auto-publish prep: bumped to v$NEW_VERSION, committed, tagged, and pushed. Ready to ship - say the word and I'll run npm run publish:win.\"}"
else
  echo "{\"systemMessage\": \"Auto-publish prep: bumped to v$NEW_VERSION but git push failed - check /tmp/auto-publish-push.log\"}"
fi
