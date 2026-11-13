#!/usr/bin/env bash
# Print the app version and build number every native app ships with:
#
#   scripts/app_version.sh            # "3.33.0 33300"
#   scripts/app_version.sh v3.33.0    # the same, or exit 1 if the tag names another version
#                                     # (v3.33.0-rc1 is accepted for 3.33.0)
#   scripts/app_version.sh --self-test
#
# The one source is `[workspace.package] version` in medbrains/Cargo.toml (`make release`
# bumps it). The build number is major*10000 + minor*100 + patch, so it rises with every
# release, as Android's versionCode and iOS's CFBundleVersion must; minor and patch must
# stay below 100. Android computes the same formula in apps/android/build.gradle.kts.
set -euo pipefail

cargo_toml="$(dirname "$0")/../Cargo.toml"

# The version from [workspace.package] in the given Cargo.toml.
workspace_version() {
  awk '/^\[workspace\.package\]/ { on = 1; next } /^\[/ { on = 0 }
       on && $1 == "version" { gsub(/"/, "", $3); print $3; exit }' "$1"
}

# major*10000 + minor*100 + patch for a plain X.Y.Z version; refuses anything else.
build_number() {
  if [[ ! "$1" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    echo "app_version: '$1' is not X.Y.Z" >&2; return 1
  fi
  local major=${BASH_REMATCH[1]} minor=$((10#${BASH_REMATCH[2]})) patch=$((10#${BASH_REMATCH[3]}))
  if (( minor > 99 || patch > 99 )); then
    echo "app_version: minor and patch must be below 100 for the build number ($1)" >&2; return 1
  fi
  echo $(( 10#$major * 10000 + minor * 100 + patch ))
}

if [[ "${1:-}" == --self-test ]]; then
  [[ "$(build_number 3.33.0)" == 33300 ]]
  [[ "$(build_number 3.33.1)" == 33301 ]]
  [[ "$(build_number 4.0.0)" -gt "$(build_number 3.99.99)" ]]
  "$0" v"$(workspace_version "$cargo_toml")"-rc1 >/dev/null
  build_number 3.100.0 2>/dev/null && exit 1
  build_number 3.33.0-rc1 2>/dev/null && exit 1
  echo "app_version: self-test passed"; exit 0
fi

version=$(workspace_version "$cargo_toml")
# A pre-release tag (v3.33.0-rc1) builds the version it leads up to.
if [[ -n "${1:-}" && "$1" != "v$version" ]] && [[ "$1" != "v$version-"* ]]; then
  echo "app_version: tag $1 does not match the workspace version $version" >&2; exit 1
fi
echo "$version $(build_number "$version")"
