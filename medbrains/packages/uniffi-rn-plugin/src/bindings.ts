/**
 * Bindings mod — runs `uniffi-bindgen-react-native` and `cargo build`
 * during `expo prebuild`. Outputs:
 *   - `target/<triple>/<profile>/libmedbrains_edge_rn.a` (iOS)
 *   - `target/<triple>/<profile>/libmedbrains_edge_rn.so` (Android)
 *   - `<workspace>/packages/edge-rn-bindings/` (TypeScript Turbo
 *     Module bindings) — generated package the host imports from
 *
 * The actual cargo invocation runs once per prebuild; subsequent
 * runs reuse cargo's incremental cache. CI builds (EAS Build) get
 * a clean run each time, which is intentional — no cache poisoning.
 */

import { withDangerousMod, type ConfigPlugin } from "@expo/config-plugins";
import { execSync } from "node:child_process";
import * as path from "node:path";
import type { UniffiRnPluginOptions } from "./index.js";

type ResolvedOptions = Required<UniffiRnPluginOptions>;

export const withMedbrainsUniffiBindings: ConfigPlugin<ResolvedOptions> = (
  config,
  options,
) =>
  withDangerousMod(config, [
    "ios",
    async (configWithProps) => {
      const projectRoot = configWithProps.modRequest.projectRoot;
      runBindingsGeneration(projectRoot, options);
      return configWithProps;
    },
  ]);

function runBindingsGeneration(
  projectRoot: string,
  options: ResolvedOptions,
): void {
  if (options.skipBuild) {
    log("skipBuild=true; skipping cargo + uniffi-bindgen invocation");
    return;
  }

  const crateAbs = path.resolve(projectRoot, options.cratePath);
  const udlAbs = path.resolve(projectRoot, options.udlPath);

  log(`crate root: ${crateAbs}`);
  log(`udl: ${udlAbs}`);
  log(`profile: ${options.cargoProfile}`);

  // 1. iOS targets — cargo build per triple, leave artifacts in
  //    target/<triple>/<profile>/. The iOS mod picks them up.
  for (const target of options.iosTargets) {
    log(`cargo build iOS target: ${target}`);
    cargoBuild(crateAbs, target, options.cargoProfile);
  }

  // 2. Android ABIs — cargo build via cargo-ndk wrapper if available;
  //    falls back to direct triple if cargo-ndk isn't installed.
  for (const abi of options.androidAbis) {
    const triple = abiToTriple(abi);
    log(`cargo build Android ABI: ${abi} (${triple})`);
    cargoBuild(crateAbs, triple, options.cargoProfile);
  }

  // 3. uniffi-bindgen-react-native — emit TypeScript Turbo Module
  //    bindings into packages/edge-rn-bindings.
  generateTsBindings(projectRoot, crateAbs, udlAbs, options);
}

function cargoBuild(
  crateRoot: string,
  target: string,
  profile: ResolvedOptions["cargoProfile"],
): void {
  const profileFlag = profile === "release" ? "--release" : "";
  const cmd = `cargo build --target ${target} ${profileFlag}`.trim();
  try {
    execSync(cmd, { cwd: crateRoot, stdio: "inherit" });
  } catch (err) {
    throw new Error(
      `cargo build failed for ${target}: ${(err as Error).message}\n` +
        `Run \`rustup target add ${target}\` if the target isn't installed.`,
    );
  }
}

function generateTsBindings(
  projectRoot: string,
  crateRoot: string,
  udlPath: string,
  _options: ResolvedOptions,
): void {
  // Workspace root = projectRoot's parent.parent for our monorepo
  // (apps/<name>/ → ../../). Adjust if invoked from a non-standard
  // workspace structure.
  const workspaceRoot = path.resolve(projectRoot, "..", "..");
  const bindingsOutDir = path.join(
    workspaceRoot,
    "packages",
    "edge-rn-bindings",
  );

  log(`bindings out: ${bindingsOutDir}`);

  // Invoke uniffi-bindgen-react-native. The CLI is installed via
  // `npx uniffi-bindgen-react-native` so it's available without a
  // global install.
  const cmd = [
    "npx --yes uniffi-bindgen-react-native",
    `--ts-out-dir ${bindingsOutDir}`,
    `--cpp-out-dir ${path.join(bindingsOutDir, "cpp")}`,
    `--config ${path.join(crateRoot, "ubrn.config.yaml")}`,
    udlPath,
  ].join(" ");

  try {
    execSync(cmd, { cwd: workspaceRoot, stdio: "inherit" });
  } catch (err) {
    throw new Error(
      `uniffi-bindgen-react-native failed: ${(err as Error).message}`,
    );
  }
}

function abiToTriple(abi: string): string {
  switch (abi) {
    case "arm64-v8a":
      return "aarch64-linux-android";
    case "armeabi-v7a":
      return "armv7-linux-androideabi";
    case "x86_64":
      return "x86_64-linux-android";
    case "x86":
      return "i686-linux-android";
    default:
      throw new Error(`unknown Android ABI: ${abi}`);
  }
}

function log(message: string): void {
  // Expo plugins log via console; matches the rest of the
  // @expo/config-plugins ecosystem.
  // eslint-disable-next-line no-console
  console.log(`[uniffi-rn-plugin] ${message}`);
}
