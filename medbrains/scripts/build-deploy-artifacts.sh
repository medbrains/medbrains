#!/usr/bin/env bash
# Build everything the standalone/attach host actually runs.
#
# One script, two callers: `make build-starter` and terraform's
# null_resource.build. They used to be separate code paths, which is how a
# green `make build` could produce nothing at all while terraform happily
# shipped whatever binaries were left on disk from the day before.
#
# Only what the host runs is built here. The mobile and desktop apps in
# apps/ are not deployed to this host and are not this script's business.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TARGET="${STARTER_TARGET:-aarch64-unknown-linux-gnu}"

cd "$REPO_ROOT"

say() { printf '    %s\n' "$*"; }

echo "==> building server binaries (target=$TARGET)"
for spec in "medbrains-server:medbrains-server" \
            "medbrains-server:medbrains-archive" \
            "medbrains-proxy:medbrains-proxy"; do
    pkg="${spec%%:*}"; bin="${spec##*:}"
    say "$bin"
    cargo zigbuild --release --target="$TARGET" -p "$pkg" --bin "$bin"
done

# medbrains-edge-app is a library crate here — no main.rs, and git history has
# never held one. The install side already skips the edge unit when the binary
# is absent; requiring it on the build side stopped the build before it ever
# reached the SPA. Build it if it ever appears, carry on if it hasn't.
if cargo metadata --no-deps --format-version 1 | grep -q '"name":"medbrains-edge-app"'; then
    say "medbrains-edge"
    cargo zigbuild --release --target="$TARGET" -p medbrains-edge-app --bin medbrains-edge
else
    say "medbrains-edge — not in the workspace, skipping"
fi

echo "==> building the web SPA"
pnpm --filter "@medbrains/types" \
     --filter "@medbrains/utils" \
     --filter "@medbrains/schemas" \
     --filter "@medbrains/api" \
     --filter "@medbrains/stores" \
     --filter "@medbrains/expressions" \
     --filter "@medbrains/crdt" build
pnpm --filter @medbrains/web exec vite build

# Ship the SPA as one file, not 1,571.
#
# Terraform's file provisioner uploads a directory entry by entry over SCP,
# one round trip each. Over a direct LAN connection that is merely wasteful;
# over an SSM tunnel, where every round trip carries real latency, it turns a
# 59 MB directory into a transfer slow enough that operators conclude the
# deploy has hung and kill it. That is not hypothetical — it is what happened
# on 5 September, and the deploy was cancelled four minutes in with the
# binaries already uploaded and nothing installed.
#
# One compressed archive is one round trip, and it travels smaller.
echo "==> packing the SPA"
rm -f apps/web/dist.tgz
tar -czf apps/web/dist.tgz -C apps/web/dist .
say "dist.tgz $(du -h apps/web/dist.tgz | cut -f1) (from $(du -sh apps/web/dist | cut -f1), $(find apps/web/dist -type f | wc -l | tr -d ' ') files)"

# A build that reports success having produced nothing is the exact failure
# this script exists to prevent, so check rather than assume.
echo "==> verifying artefacts exist"
missing=0
for f in "target/$TARGET/release/medbrains-server" \
         "target/$TARGET/release/medbrains-archive" \
         "target/$TARGET/release/medbrains-proxy" \
         "apps/web/dist/index.html"; do
    if [ -e "$f" ]; then
        say "ok      $f"
    else
        say "MISSING $f"
        missing=1
    fi
done
[ "$missing" = "0" ] || { echo "ERROR: build finished but artefacts are missing."; exit 1; }

echo "==> build OK"
