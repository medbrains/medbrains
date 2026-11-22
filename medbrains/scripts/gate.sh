#!/usr/bin/env bash
# The gate: every command CI's blocking jobs run, one stage per job. ci.yml
# calls this script for each of those jobs, so `make gate` and CI cannot differ.
# A check belongs here, never as a new `run:` line in ci.yml.
#
#   gate.sh all                  every stage below (`make gate`)
#   gate.sh rust                 rust-fmt + rust-clippy
#   gate.sh web contracts docs   any stages, in the order given
#
#   stage           ci.yml job (names are held by the ruleset; do not rename)
#   rust-fmt        Rust format
#   rust-clippy     Rust clippy
#   rust-test       Rust tests            needs DATABASE_URL and cargo-nextest
#   web             Web typecheck, lint, test, build
#   contracts       API + UI contracts
#   audit           Audit checks (RLS, sharing, egress, PCI)
#   readiness       Readiness meters (evidence + generated badges)
#   toolchain       Dockerfile matches the toolchain
#   docs            Every new function is documented     needs a base branch
#   support-dates   Support dates only get longer        needs a base branch
#
# Not here: "Docker image builds" (needs Docker; pull requests only), and the
# report-only jobs (Web lint, Schema + tenancy, Docs prose).
#
# Base branch (docs, support-dates): GATE_BASE, else the pull request's base,
# else the nearest origin release, hotfix or main branch. No guess at a name
# that may not exist: with no base the stage fails.
#
# Away from CI, cargo waits for the machine first (scripts/build_guard.sh --wait).
set -euo pipefail
MB="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$MB/.." && pwd)"
export SQLX_OFFLINE=true
# The pnpm on a laptop's PATH may be older than package.json's engines (>=10).
PNPM=${PNPM:-$([[ -x "$HOME/Library/pnpm/pnpm" ]] && echo "$HOME/Library/pnpm/pnpm" || echo pnpm)}
ALL="rust-fmt rust-clippy web contracts audit readiness toolchain docs support-dates rust-test"

# Print a step heading.
step() { printf '\n== %s\n' "$1"; }

# Stop the gate with a reason.
die() { echo "gate: FAIL: $*" >&2; exit 1; }

# Block until no other cargo build is running. CI runners build one job each.
wait_for_machine() { [[ -n "${CI:-}" ]] || bash "$MB/scripts/build_guard.sh" --wait; }

# Print the ref this work merges into, or fail: never a branch that may not exist.
find_base() {
  local ref="" pr
  if [[ -n "${GATE_BASE:-}" ]]; then
    ref="$GATE_BASE"
  elif [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    ref="origin/$GITHUB_BASE_REF"
  elif pr=$(gh pr view --json baseRefName --jq .baseRefName 2>/dev/null) && [[ -n "$pr" ]]; then
    ref="origin/$pr"
  else
    # No pull request yet: the origin branch with the fewest commits between it and HEAD.
    ref=$(git -C "$ROOT" for-each-ref --format='%(refname:short)' \
        'refs/remotes/origin/release/*' 'refs/remotes/origin/hotfix/*' refs/remotes/origin/main |
      while read -r b; do
        mb=$(git -C "$ROOT" merge-base HEAD "$b" 2>/dev/null) || continue
        echo "$(git -C "$ROOT" rev-list --count "$mb..HEAD") $b"
      done | sort -n | head -1 | cut -d' ' -f2)
  fi
  git -C "$ROOT" rev-parse -q --verify "$ref^{commit}" >/dev/null 2>&1 \
    || die "no base branch (tried '${ref:-nothing}'); fetch it, or set GATE_BASE=origin/<branch>"
  echo "$ref"
}

# Rust format. rust-toolchain.toml pins rustfmt, so CI and a laptop format alike.
stage_rust_fmt() { cd "$MB"; cargo fmt --all -- --check; }

# Rust clippy, the whole workspace: workspace lints such as `unreachable_pub`
# only fail there, and `-p <crate>` passed code that CI then refused.
stage_rust_clippy() {
  cd "$MB"
  # Every crate except the desktop GUI tree, which needs GTK. Denied lints fail on their
  # own; pedantic and nursery are warnings by policy, so no -D warnings.
  wait_for_machine
  cargo clippy --locked --workspace --exclude medbrains-desktop
  # Test targets: no new denied lint, and the baseline only falls (#5978). cargo exits
  # non-zero on the baseline's own errors; the script decides.
  python3 scripts/check_clippy_tests.py --self-test
  wait_for_machine
  { cargo clippy --locked --workspace --exclude medbrains-desktop --all-targets \
      --keep-going --message-format=json || true; } | python3 scripts/check_clippy_tests.py
}

# Rust tests. Blocking since #5978: a flaky test is fixed, or quarantined by name in
# .config/nextest.toml with its issue. Doc tests run even when a test failed.
stage_rust_test() {
  cd "$MB"
  [[ -n "${DATABASE_URL:-}" ]] || die "rust-test needs DATABASE_URL (a PostgreSQL 17 made for tests, as scripts/ci_postgres.sh makes)"
  cargo nextest --version >/dev/null 2>&1 || die "rust-test needs cargo-nextest (the version ci.yml pins)"
  local failed=0
  wait_for_machine
  cargo nextest run --locked --workspace --exclude medbrains-desktop --profile ci || failed=1
  wait_for_machine
  cargo test --locked --workspace --exclude medbrains-desktop --doc --no-fail-fast || failed=1
  return "$failed"
}

# Web: build before typecheck (a stale tsbuildinfo reports clean over real errors),
# scoped to the web app and the packages it uses.
stage_web() {
  cd "$MB"
  # vitest.config.ts adds a JUnit reporter when this is set.
  VITEST_REPORT_DIR=test-results "$PNPM" turbo run build typecheck test --filter=@medbrains/web...
  step "web first-load JS stays under its ceiling"
  python3 scripts/check_size_budgets.py
  step "web functions and files only shrink"
  python3 scripts/check_web_size.py --self-test
  python3 scripts/check_web_size.py
}

# API + UI contracts: the static checks that read files only.
stage_contracts() {
  cd "$ROOT"
  python3 scripts/check_api_contract.py
  python3 scripts/check_ui_api_coverage.py
  python3 medbrains/scripts/check_ui_slop.py
  # `data ?? []` draws an outage as an empty ward; per-file ratchet (#5474).
  python3 medbrains/scripts/check_query_fallbacks.py --self-test
  python3 medbrains/scripts/check_query_fallbacks.py
  python3 medbrains/scripts/check_ui_seam.py
  python3 medbrains/scripts/check_raw_html.py
  # A redactable field never classified falls back to Routine and shows to everyone.
  python3 medbrains/scripts/check_field_classes.py
  # An authz error turned into `false` answers a fault like a refusal.
  python3 medbrains/scripts/check_authz_collapse.py
  # A read whose error becomes an empty result shows an outage as "nothing there" (#6009).
  python3 medbrains/scripts/check_query_collapse.py --self-test
  python3 medbrains/scripts/check_query_collapse.py
  # A query in a loop is one round trip per row; baselined per function (#5462).
  python3 medbrains/scripts/check_query_in_loop.py --self-test
  python3 medbrains/scripts/check_query_in_loop.py --check
  # Class A size rules (docs/SOFTWARE-CLASSES.md): Rust functions and files only shrink.
  python3 medbrains/scripts/check_rust_size.py --self-test
  python3 medbrains/scripts/check_rust_size.py
  # Apps reach tenancy, authz, audit, sequences, storage and config only through the kernel.
  python3 medbrains/scripts/check_kernel_boundary.py --self-test
  python3 medbrains/scripts/check_kernel_boundary.py
  # The kernel is technical only (RFC-HOSPITAL-OS §3a).
  python3 medbrains/scripts/check_kernel_no_domain.py --self-test
  python3 medbrains/scripts/check_kernel_no_domain.py
  # A crate without `[lints] workspace = true` escapes every denied lint (#5976).
  python3 medbrains/scripts/check_lints_inheritance.py --self-test
  python3 medbrains/scripts/check_lints_inheritance.py
  # Kernel lines and dependencies, package and crate counts. The web stage re-runs it
  # after a build, for first-load JS.
  python3 medbrains/scripts/check_size_budgets.py --self-test
  python3 medbrains/scripts/check_size_budgets.py
  # The menu comes from the one screen registry; a stale copy shows retired screens.
  python3 medbrains/scripts/generate_app_screens.py --self-test
  python3 medbrains/scripts/generate_app_screens.py --check
  python3 medbrains/scripts/check_nav_drift.py
  # The committed fonts are exactly what the pinned build makes. The build tools are
  # pinned in tools/fonts/requirements.txt: ci.yml installs them, a laptop gets them from uv
  # (as `make check-fonts` does).
  local fonts_py="python3 -I"
  [[ -n "${CI:-}" ]] || fonts_py="uv run --no-project --python 3.12 --with-requirements medbrains/tools/fonts/requirements.txt python -I"
  $fonts_py medbrains/tools/fonts/build_medbrains_sans.py --check
  $fonts_py medbrains/tools/fonts/check_glyph_collisions.py
  # The test report's labelling, JUnit conversion and theme contrast (e2e.yml uses it).
  python3 medbrains/scripts/test_report.py --self-test
  # The Python SDK has no other runner.
  (cd medbrains/sdks/python && python3 -m unittest discover -s tests)
}

# Audit checks that pass today, kept blocking so they cannot regress.
stage_audit() {
  cd "$ROOT"
  python3 scripts/check_sharing.py
  python3 scripts/check_audit_coverage.py
  python3 scripts/check_region_pinning.py
  python3 scripts/check_no_card_logging.py
  python3 scripts/check_egress_allowlist.py
  python3 scripts/check_windows_names.py --self-test
  python3 scripts/check_windows_names.py
  # The server tarball carries every binary install.sh installs.
  python3 medbrains/scripts/check_release_bins.py --self-test
  python3 medbrains/scripts/check_release_bins.py
}

# Readiness meters. Evidence PRs are found in the history, so it must all be there.
stage_readiness() {
  cd "$ROOT"
  python3 scripts/readiness.py --self-test
  python3 scripts/readiness.py --check
}

# The Dockerfile's Rust must be the pinned toolchain (v3.33.0 shipped rust:1.85 on a 1.95 MSRV).
stage_toolchain() {
  cd "$MB"
  local want have
  want=$(sed -nE 's/^channel *= *"([^"]+)".*/\1/p' rust-toolchain.toml)
  have=$(sed -nE 's/^FROM rust:([0-9.]+)-.*/\1/p' Dockerfile)
  echo "rust-toolchain.toml: $want  Dockerfile: $have"
  [[ -n "$want" && "$want" == "$have" ]] \
    || die "medbrains/Dockerfile: FROM rust:$have must match rust-toolchain.toml ($want)"
}

# Every function the branch adds or changes has a doc comment.
stage_docs() {
  cd "$ROOT"
  local base; base=$(find_base)
  echo "base: $base ($(git rev-parse --short "$base"))"
  python3 medbrains/scripts/check_docs_on_new_functions.py --self-test
  python3 medbrains/scripts/check_docs_on_new_functions.py "$base"
}

# A published end-of-support date may be extended, never cut (COMPATIBILITY.md §4, #5499).
stage_support_dates() {
  cd "$ROOT"
  local base; base=$(find_base)
  echo "base: $base ($(git rev-parse --short "$base"))"
  python3 scripts/check_support_dates.py --self-test
  python3 scripts/check_support_dates.py "$base"
}

[[ $# -gt 0 ]] || die "name a stage: all, rust, or any of: $ALL"
stages=""
for arg in "$@"; do
  case "$arg" in
    all) stages+=" $ALL" ;;
    rust) stages+=" rust-fmt rust-clippy" ;;
    *) [[ " $ALL " == *" $arg "* ]] || die "unknown stage '$arg' (all, rust, or: $ALL)"
       stages+=" $arg" ;;
  esac
done
for stage in $stages; do
  step "gate: $stage"
  "stage_${stage//-/_}"
done
step "gate passed:$stages"
