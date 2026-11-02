#!/usr/bin/env bash
# Check a release is ready and print the commands that cut it. Never tags or
# pushes: the owner signs and pushes the tag, which starts .github/workflows/release.yml.
#
#   make release VERSION=1.0.0          (or: bash scripts/release.sh 1.0.0)
#
# docs/SECURITY-RELEASE-PROCESS.md and docs/COMPATIBILITY.md say what a
# release promises; this script checks the parts a machine can check.
set -euo pipefail

VERSION="${1:-${VERSION:-}}"
MB="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$MB/.." && pwd)"
FAILED=0
ok() { echo "  ok    $*"; }
bad() { echo "  FAIL  $*"; FAILED=1; }

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-(alpha|beta|rc)\.[0-9]+)?$ ]]; then
    echo "Usage: make release VERSION=1.2.3   (pre-releases: 1.2.3-rc.1)" >&2
    exit 2
fi
TAG="v$VERSION"
cd "$ROOT"

echo "==> Tree"
[[ "$(git rev-parse --abbrev-ref HEAD)" == "main" ]] && ok "on main" || bad "not on main"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] && ok "no uncommitted changes" \
    || bad "uncommitted changes to tracked files"
git fetch -q origin main
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] && ok "level with origin/main" \
    || bad "HEAD is not origin/main — pull or push first"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null \
    || git ls-remote --exit-code --tags origin "$TAG" >/dev/null 2>&1; then
    bad "$TAG already exists — versions are never reused"
else
    ok "$TAG is new"
fi

echo "==> Versions"
# One product version. The SDKs follow the protocol instead: their major is
# the manifestVersion they speak (docs/COMPATIBILITY.md §2).
toml_version() { python3 -c 'import sys,tomllib;d=tomllib.load(open(sys.argv[1],"rb"));print(d.get("workspace",{}).get("package",{}).get("version") or d["project"]["version"])' "$1"; }
json_version() { python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$1"; }
for pair in "medbrains/Cargo.toml:$(toml_version medbrains/Cargo.toml)" \
            "medbrains/package.json:$(json_version medbrains/package.json)" \
            "medbrains/apps/web/package.json:$(json_version medbrains/apps/web/package.json)"; do
    [[ "${pair#*:}" == "$VERSION" ]] && ok "${pair%%:*} = $VERSION" || bad "${pair%%:*} is ${pair#*:}, not $VERSION"
done
PROTOCOL="$(sed -n 's/^export const MANIFEST_VERSION = \([0-9]*\);/\1/p' medbrains/packages/sdk/src/manifest.ts)"
TS_SDK="$(json_version medbrains/packages/sdk/package.json)"
PY_SDK="$(toml_version medbrains/sdks/python/pyproject.toml)"
PY_INIT="$(sed -n 's/^__version__ = "\(.*\)"/\1/p' medbrains/sdks/python/medbrains_sdk/__init__.py)"
[[ "$TS_SDK" == "$PY_SDK" && "$PY_SDK" == "$PY_INIT" ]] && ok "SDKs agree ($TS_SDK)" \
    || bad "SDK versions differ: npm $TS_SDK, pyproject $PY_SDK, __version__ $PY_INIT"
[[ "${TS_SDK%%.*}" == "$PROTOCOL" ]] && ok "SDK major speaks protocol v$PROTOCOL" \
    || bad "SDK major ${TS_SDK%%.*} does not match protocol v$PROTOCOL"
grep -q "^## \[$VERSION\]" CHANGELOG.md && ok "CHANGELOG.md has a $VERSION section" \
    || bad "CHANGELOG.md has no '## [$VERSION]' section"

echo "==> Gates"
gate() {
    local name="$1" log; shift
    log="$(mktemp -t medbrains-release.XXXXXX)"
    if (cd "$MB" && "$@") >"$log" 2>&1; then ok "$name"
    else bad "$name (log: $log)"; tail -20 "$log"; fi
}
gate "accepted risks carry a reason and an unexpired date" python3 scripts/check_audit_ignores.py
# The gates CI enforces on every PR. `make check-all` is the goal, but 19 of its
# checks still failed on main on 2026-11-02 (make -k check-all lists them); a
# release gate that can never pass gets bypassed, so it is not one here yet.
gate "API contract, permissions, authz, kernel boundary, secrets, data classes" \
    make check-api check-permissions check-authz-collapse check-kernel-boundary check-secrets check-field-classes
gate "TypeScript SDK tests + conformance suite" pnpm --filter @medbrains/sdk test
gate "Python SDK tests" bash -c "cd sdks/python && python3 -m unittest discover -s tests"
# CI runs clippy and the full build, which this script does not. No CI run at
# all usually means Actions is not running — and then release.yml will not
# run on the tag either. ALLOW_NO_CI=1 downgrades this to a warning.
CI=""
command -v gh >/dev/null && CI="$(gh run list --branch main --workflow ci.yml --commit "$(git rev-parse HEAD)" \
    --limit 1 --json conclusion --jq '.[0].conclusion // ""' 2>/dev/null || true)"
if [[ "$CI" == "success" ]]; then
    ok "CI is green on this commit"
elif [[ "${ALLOW_NO_CI:-0}" == "1" ]]; then
    echo "  warn  CI on this commit: ${CI:-no run found} (ALLOW_NO_CI=1)"
else
    bad "CI on this commit: ${CI:-no run found} — check GitHub Actions is running (or ALLOW_NO_CI=1)"
fi

if [[ "$FAILED" -ne 0 ]]; then
    echo; echo "Not ready: fix the FAIL lines above. Nothing was tagged or pushed."
    exit 1
fi

cat <<NEXT

Ready. Nothing has been tagged or pushed. To release $TAG, run:

    git tag -s $TAG -m "MedBrains $VERSION"
    git push origin $TAG

The push starts .github/workflows/release.yml: build server + web, push the
multi-arch image to GHCR, sign it (cosign, keyless), write SBOMs and SHA-256
checksums, attest provenance, then publish the GitHub release with the
CHANGELOG.md section for $VERSION. The SDKs are not published by the tag:
run the "Publish SDKs" workflow by hand when you mean to.
NEXT
