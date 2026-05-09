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

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { type ConfigPlugin, withDangerousMod } from "@expo/config-plugins";
import type { UniffiRnPluginOptions } from "./index.js";

type ResolvedOptions = Required<UniffiRnPluginOptions>;
type NativePlatform = "ios" | "android";

export const withMedbrainsUniffiBindings: ConfigPlugin<ResolvedOptions> = (config, options) => {
  let next = withDangerousMod(config, [
    "ios",
    async (configWithProps) => {
      const projectRoot = configWithProps.modRequest.projectRoot;
      runBindingsGeneration(projectRoot, options, "ios");
      return configWithProps;
    },
  ]);

  next = withDangerousMod(next, [
    "android",
    async (configWithProps) => {
      const projectRoot = configWithProps.modRequest.projectRoot;
      runBindingsGeneration(projectRoot, options, "android");
      return configWithProps;
    },
  ]);

  return next;
};

function runBindingsGeneration(
  projectRoot: string,
  options: ResolvedOptions,
  platform: NativePlatform,
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

  if (platform === "ios") {
    for (const target of options.iosTargets) {
      log(`cargo build iOS target: ${target}`);
      cargoBuild(crateAbs, target, options.cargoProfile);
    }
  } else {
    for (const abi of options.androidAbis) {
      const triple = abiToTriple(abi);
      log(`cargo build Android ABI: ${abi} (${triple})`);
      cargoBuild(crateAbs, triple, options.cargoProfile);
    }
  }

  // 2. uniffi-bindgen-react-native — emit TypeScript Turbo Module
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
  const bindingsOutDir = path.join(workspaceRoot, "packages", "edge-rn-bindings");

  log(`bindings out: ${bindingsOutDir}`);

  const configPath = path.join(crateRoot, "ubrn.config.yaml");
  if (!fileExists(configPath)) {
    log(
      `ubrn.config.yaml not found at ${configPath}; keeping existing ` +
        "@medbrains/edge-rn-bindings placeholder package",
    );
    return;
  }

  // Invoke the current uniffi-bindgen-react-native CLI. The bindings
  // command expects a UniFFI TOML path via --config, while the turbo
  // module command expects ubrn.config.yaml. If the crate provides a
  // dedicated uniffi.toml, use it; otherwise rely on generator defaults.
  const uniffiToml = path.join(crateRoot, "uniffi.toml");
  const bindingsCmd = [
    "pnpm dlx uniffi-bindgen-react-native generate jsi bindings",
    `--ts-dir ${shellQuote(bindingsOutDir)}`,
    `--cpp-dir ${shellQuote(path.join(bindingsOutDir, "cpp"))}`,
    fileExists(uniffiToml) ? `--config ${shellQuote(uniffiToml)}` : "",
    shellQuote(udlPath),
  ]
    .filter(Boolean)
    .join(" ");

  const turboModuleCmd = [
    "pnpm dlx uniffi-bindgen-react-native generate jsi turbo-module",
    `--config ${shellQuote(configPath)}`,
    namespaceFromUdl(udlPath),
  ].join(" ");

  try {
    execSync(bindingsCmd, { cwd: workspaceRoot, stdio: "inherit" });
    execSync(turboModuleCmd, { cwd: bindingsOutDir, stdio: "inherit" });
  } catch (err) {
    throw new Error(`uniffi-bindgen-react-native failed: ${(err as Error).message}`);
  }
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function namespaceFromUdl(udlPath: string): string {
  const source = fs.readFileSync(udlPath, "utf-8");
  const match = source.match(/\bnamespace\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/);
  if (!match?.[1]) {
    throw new Error(`could not read UniFFI namespace from ${udlPath}`);
  }
  return match[1];
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
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
