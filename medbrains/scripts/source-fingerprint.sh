#!/usr/bin/env bash
# Terraform external data source: fingerprint the source that the deploy
# artefacts are supposed to be built from.
#
# Terraform's own triggers hash the artefacts sitting in binaries_dir, which
# answers "did the payload change since last apply" — not "was the payload
# built from the source checked out now". Those are different questions, and
# only the second one catches shipping yesterday's binary. Worse, once
# null_resource.bootstrap is tainted the plan reads "1 to add, 1 to destroy"
# no matter what the payload is, so a stale build and a fresh one produce
# identical plans.
#
# This gives terraform a value that changes whenever the source does, so the
# build resource replans — and therefore rebuilds — on its own.
#
# Prints exactly one JSON object on stdout; the external provider requires
# string values only.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT"

head_sha=$(git rev-parse HEAD 2>/dev/null || echo "no-git")

# Committed state alone is not enough: an operator building from a dirty tree
# is the normal case here. Hash the working-tree diff of the paths that end up
# in the deploy, so uncommitted edits move the fingerprint too.
dirty=$(git status --porcelain -- crates apps packages Cargo.toml Cargo.lock 2>/dev/null || true)
diff_hash=$(git diff HEAD -- crates apps packages Cargo.toml Cargo.lock 2>/dev/null \
            | shasum -a 256 | cut -d' ' -f1)

fingerprint=$(printf '%s|%s|%s' "$head_sha" "$diff_hash" "$(printf '%s' "$dirty" | shasum -a 256 | cut -d' ' -f1)" \
              | shasum -a 256 | cut -d' ' -f1)

printf '{"fingerprint":"%s","head":"%s","dirty":"%s"}\n' \
    "$fingerprint" "${head_sha:0:12}" "$([ -n "$dirty" ] && echo yes || echo no)"
