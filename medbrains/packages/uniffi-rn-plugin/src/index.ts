/**
 * @medbrains/uniffi-rn-plugin — Expo config plugin
 *
 * Wires the `medbrains-edge-rn` Rust crate into a host Expo Prebuild
 * app:
 *   1. Cross-compiles the Rust crate to `staticlib` for iOS targets
 *      and `cdylib` for Android ABIs at prebuild time.
 *   2. Generates TypeScript Turbo Module bindings via
 *      `uniffi-bindgen-react-native`.
 *   3. Drops the iOS `.a` archives + Android `.so` libraries into the
 *      host's native projects.
 *   4. Patches the Podfile / build.gradle so the host links them.
 *
 * Phase B.1 of the mobile/TV/edge expansion roadmap. Apps consume
 * this declaratively from `app.json`:
 *
 * ```jsonc
 * {
 *   "expo": {
 *     "plugins": [
 *       ["@medbrains/uniffi-rn-plugin", {
 *         "cratePath": "../../crates/medbrains-edge-rn",
 *         "udlPath": "../../crates/medbrains-edge-rn/src/edge_rn.udl",
 *         "iosTargets": ["aarch64-apple-ios", "aarch64-apple-ios-sim"],
 *         "androidAbis": ["arm64-v8a", "armeabi-v7a", "x86_64"]
 *       }]
 *     ]
 *   }
 * }
 * ```
 *
 * Then in app code:
 *
 * ```ts
 * import { verifyJwt, AuthzCacheHandle } from "@medbrains/edge-rn-bindings";
 * ```
 *
 * The bindings package is auto-emitted by the plugin's prebuild hook
 * — apps don't manage it manually.
 */

import { type ConfigPlugin } from "@expo/config-plugins";
import { withMedbrainsUniffiAndroid } from "./android.js";
import { withMedbrainsUniffiIos } from "./ios.js";
import { withMedbrainsUniffiBindings } from "./bindings.js";

export interface UniffiRnPluginOptions {
  /**
   * Path to the Rust crate root (must contain `Cargo.toml` declaring
   * `crate-type = ["staticlib", "cdylib", "rlib"]`).
   * Resolved relative to the host app's project root.
   * @default "../../crates/medbrains-edge-rn"
   */
  cratePath?: string;

  /**
   * Path to the UDL file consumed by `uniffi-bindgen-react-native`.
   * @default "../../crates/medbrains-edge-rn/src/edge_rn.udl"
   */
  udlPath?: string;

  /**
   * Rust toolchain targets to cross-compile for iOS.
   * Device-only build for App Store releases; include `-sim` targets
   * for development on Apple Silicon Macs.
   * @default ["aarch64-apple-ios", "aarch64-apple-ios-sim"]
   */
  iosTargets?: string[];

  /**
   * Android ABIs to cross-compile for. Drop x86 entries unless
   * targeting old emulators on Intel Macs.
   * @default ["arm64-v8a", "armeabi-v7a", "x86_64"]
   */
  androidAbis?: string[];

  /**
   * Cargo build profile. `release` for production builds; `debug`
   * keeps incremental compilation faster during dev.
   * @default "release"
   */
  cargoProfile?: "debug" | "release";

  /**
   * Skip the actual cargo build during `expo prebuild`. Useful when
   * the .a / .so are already cached from a previous build (CI
   * artifact caching, EAS Build's cache, etc.). The plugin still
   * patches Podfile + Gradle.
   * @default false
   */
  skipBuild?: boolean;
}

const DEFAULTS: Required<UniffiRnPluginOptions> = {
  cratePath: "../../crates/medbrains-edge-rn",
  udlPath: "../../crates/medbrains-edge-rn/src/edge_rn.udl",
  iosTargets: ["aarch64-apple-ios", "aarch64-apple-ios-sim"],
  androidAbis: ["arm64-v8a", "armeabi-v7a", "x86_64"],
  cargoProfile: "release",
  skipBuild: false,
};

/**
 * Resolve user options against the defaults. Exposed for tests.
 */
export function resolveOptions(
  options: UniffiRnPluginOptions | undefined,
): Required<UniffiRnPluginOptions> {
  return { ...DEFAULTS, ...(options ?? {}) };
}

const withMedbrainsUniffiRn: ConfigPlugin<UniffiRnPluginOptions | void> = (
  config,
  rawOptions,
) => {
  const options = resolveOptions(rawOptions ?? undefined);

  // Order matters:
  //   1. Bindings first — generates @medbrains/edge-rn-bindings
  //      package the JS code imports from. Runs the cargo build
  //      that emits .a / .so artifacts.
  //   2. iOS then — Podfile + Xcode project patch.
  //   3. Android last — Gradle patch + jniLibs drop.
  let next = withMedbrainsUniffiBindings(config, options);
  next = withMedbrainsUniffiIos(next, options);
  next = withMedbrainsUniffiAndroid(next, options);
  return next;
};

export default withMedbrainsUniffiRn;
