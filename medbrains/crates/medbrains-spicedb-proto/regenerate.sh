#!/usr/bin/env bash
# Rebuild src/gen from proto/ with the one-off generator in generate/.
# Needs protoc on PATH (or PROTOC set); the well-known google/protobuf types
# come from protoc's own include directory.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/../../scripts/build_guard.sh" --wait
PROTOC="${PROTOC:-$(command -v protoc)}" CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/tmp/mb-spicedb-proto-gen}" \
  cargo run --quiet --manifest-path "$here/generate/Cargo.toml" -- "$here/proto" "$here/src/gen"
# The generator emits every imported package; the client needs only these two.
find "$here/src/gen" -name '*.rs' ! -name 'authzed.api.v1.rs' ! -name 'google.rpc.rs' -delete
