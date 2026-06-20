#!/usr/bin/env bash
# Ship already-staged changes as a squash-merged PR, then return to master.
#
#   git add <files>
#   bash scripts/ship.sh <branch> "<title>" "<pr-body>"
#
# - <pr-body> is optional; defaults to <title>.
# - Commits staged changes, pushes, opens a PR, squash-merges (deletes branch),
#   returns to master, and fast-forward pulls. Prints the merged PR URL.
set -euo pipefail

branch="${1:?branch required}"
title="${2:?title required}"
body="${3:-$2}"

cd "$(dirname "$0")/.."

git checkout -b "$branch" >/dev/null 2>&1
git commit -q -m "$title"
git push -u origin "$branch" >/dev/null 2>&1
gh pr create --title "$title" --body "$body" --base master >/dev/null 2>&1
url="$(gh pr view --json url -q .url 2>/dev/null)"
gh pr merge --squash --delete-branch >/dev/null 2>&1
git checkout master >/dev/null 2>&1
git pull --ff-only >/dev/null 2>&1
echo "shipped: ${url:-$branch}"
