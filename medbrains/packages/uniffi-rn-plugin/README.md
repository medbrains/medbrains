# @medbrains/uniffi-rn-plugin

Expo config plugin that wires the [`medbrains-edge-rn`](../../crates/medbrains-edge-rn) Rust crate into a host Expo Prebuild app.

## What it does

At `expo prebuild` time:

1. Cross-compiles `medbrains-edge-rn` for iOS (`staticlib`) and Android (`cdylib`) per configured ABI
2. Drops the `.a` archives into `ios/MedbrainsEdgeRn/` and the `.so` libraries into `android/app/src/main/jniLibs/<abi>/`
3. Patches `Podfile` (iOS link flags) and `app/build.gradle` (jniLibs sourceSet)
4. Runs `uniffi-bindgen-react-native` to emit a `@medbrains/edge-rn-bindings` package the host imports from

## Usage

In the host app's `app.json`:

```jsonc
{
  "expo": {
    "plugins": [
      ["@medbrains/uniffi-rn-plugin", {
        "cratePath": "../../crates/medbrains-edge-rn",
        "udlPath": "../../crates/medbrains-edge-rn/src/edge_rn.udl",
        "iosTargets": ["aarch64-apple-ios", "aarch64-apple-ios-sim"],
        "androidAbis": ["arm64-v8a", "armeabi-v7a", "x86_64"],
        "cargoProfile": "release"
      }]
    ]
  }
}
```

Then in app code:

```ts
import { verifyJwt, AuthzCacheHandle, RevocationCacheHandle } from "@medbrains/edge-rn-bindings";
```

## Required toolchain

- Rust 1.85+ (`rustup target add aarch64-apple-ios aarch64-apple-ios-sim aarch64-linux-android armv7-linux-androideabi x86_64-linux-android`)
- `cargo-ndk` for Android cross-compilation: `cargo install cargo-ndk`
- Xcode (iOS) and Android NDK (Android) — both pre-installed on EAS Build runners
- `npx uniffi-bindgen-react-native` — pulled at prebuild time

## Options

| Option | Default | Notes |
|---|---|---|
| `cratePath` | `"../../crates/medbrains-edge-rn"` | Path to the Rust crate root, relative to the host app's `package.json` |
| `udlPath` | `"../../crates/medbrains-edge-rn/src/edge_rn.udl"` | UDL file consumed by the bindgen |
| `iosTargets` | `["aarch64-apple-ios", "aarch64-apple-ios-sim"]` | Drop `-sim` for App Store-only release builds |
| `androidAbis` | `["arm64-v8a", "armeabi-v7a", "x86_64"]` | Drop `x86_64` if not targeting old emulators |
| `cargoProfile` | `"release"` | `"debug"` for faster dev iteration |
| `skipBuild` | `false` | When `true`, skip cargo invocation and only patch native projects (CI artifact-cache scenarios) |

## How it fits in the architecture

- **Phase B** (PR #24) shipped the UniFFI surface in `medbrains-edge-rn`
- **Phase B.1** (this package) wraps the bindgen + native wiring as an Expo config plugin so apps consume it declaratively
- **Phase C** (`@medbrains/mobile-shell`) imports from `@medbrains/edge-rn-bindings` (auto-emitted by this plugin) for offline auth + permissions hooks
- **Phase D** (generator) writes the plugin entry into every new app's `app.json`
- **Phases E/F/G/H** (apps) get the Rust core for free via the plugin

See `~/.claude/plans/delegated-discovering-milner.md` for the full roadmap.
