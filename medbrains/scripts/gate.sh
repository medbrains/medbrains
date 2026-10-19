#!/usr/bin/env bash
# make gate — the strict pre-merge sequence, in the order that fails fastest.
#
#   CRATES="medbrains-device-pairing"   crates to clippy + unit test
#                                       (default: crates changed vs origin/master)
#   TESTS="device_binding_test"         medbrains-server integration tests to run
#
# Cargo waits for the machine via build_guard --wait; a filter that runs zero
# tests is a failure, not a pass.
set -euo pipefail
cd "$(dirname "$0")/.."
# The pnpm on PATH may be older than package.json's engines (>=10).
PNPM=${PNPM:-$([ -x "$HOME/Library/pnpm/pnpm" ] && echo "$HOME/Library/pnpm/pnpm" || echo pnpm)}
step() { printf '\n== %s\n' "$1"; }

base=$(git merge-base HEAD origin/master)
changed=$(git diff --name-only --relative "$base"; git ls-files --others --exclude-standard)

step "biome (changed files)"
web_files=$(echo "$changed" | grep -E '\.(ts|tsx|json)$' | grep -v tsbuildinfo | while read -r f; do [ -f "$f" ] && echo "$f"; done || true)
if [ -n "$web_files" ]; then npx biome check $web_files; else echo "no web files changed"; fi

step "packages build + web typecheck"
# Committed tsbuildinfo makes tsc -b skip packages whose dist is missing.
restore_buildinfo() { git checkout -- $(git ls-files 'packages/*tsbuildinfo' 'packages/**/*.tsbuildinfo') 2>/dev/null || true; }
trap restore_buildinfo EXIT
find packages -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete
"$PNPM" -r --filter "./packages/**" build
restore_buildinfo
(cd apps/web && npx tsc --noEmit -p .)

step "static checks"
make check-all

crates=${CRATES:-$(echo "$changed" | sed -n 's#^crates/\([^/]*\)/.*#\1#p' | sort -u | tr '\n' ' ')}
export SQLX_OFFLINE=true
if [ -n "${crates// /}" ]; then
  pkgs=$(for c in $crates; do printf -- '-p %s ' "$c"; done)
  step "clippy: $crates"
  bash scripts/build_guard.sh --wait
  cargo clippy $pkgs
  step "unit tests: $crates"
  bash scripts/build_guard.sh --wait
  cargo test $pkgs --lib 2>&1 | tee /tmp/mb-gate-unit.log
fi

for t in ${TESTS:-}; do
  step "integration test: $t"
  bash scripts/build_guard.sh --wait
  cargo test -p medbrains-server --test "$t" 2>&1 | tee /tmp/mb-gate-it.log
  if ! grep -Eq 'test result: ok\. [1-9]' /tmp/mb-gate-it.log; then
    echo "FAIL: $t ran zero tests (wrong name or filter?)"; exit 1
  fi
done

step "gate passed"
