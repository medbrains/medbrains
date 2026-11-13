#!/usr/bin/env bash
# Pre-commit hook: run migration header lint + RLS audit on staged migrations.
#
# Install:
#   git config core.hooksPath .githooks
#   chmod +x .githooks/pre-commit-migrations.sh
# Or call it from .git/hooks/pre-commit if you prefer the default path.

set -euo pipefail

# The repo root from this script's own place (medbrains/.githooks/), not from git: inside a hook
# git sets GIT_DIR, and run from medbrains/ in a worktree --show-toplevel answers medbrains/.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"

# Only run if any staged file is a migration
if ! git diff --cached --name-only | grep -qE 'crates/medbrains-db-migrations/src/migrations/.*\.sql$'; then
    exit 0
fi

echo "[pre-commit] Checking migration headers..."
python3 "$SCRIPTS_DIR/migration_header_lint.py" || {
    echo "✗ migration_header_lint.py failed. Fix the headers above, then re-stage."
    exit 1
}

echo "[pre-commit] Running RLS audit..."
python3 "$SCRIPTS_DIR/check_rls.py" || {
    echo "✗ check_rls.py failed. Either close the gap or declare RLS-Posture appropriately."
    exit 1
}

echo "[pre-commit] All migration checks passed."
