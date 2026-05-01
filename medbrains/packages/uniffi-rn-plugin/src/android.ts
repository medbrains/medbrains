/**
 * Android mod — drops the Rust cdylib(s) into the host's
 * `android/app/src/main/jniLibs/<abi>/` directory and patches the
 * app `build.gradle` so Gradle picks them up.
 */

import {
  withDangerousMod,
  type ConfigPlugin,
} from "@expo/config-plugins";
import * as fs from "node:fs";
import * as path from "node:path";
import type { UniffiRnPluginOptions } from "./index.js";

type ResolvedOptions = Required<UniffiRnPluginOptions>;

const LIB_BASENAME = "libmedbrains_edge_rn";

export const withMedbrainsUniffiAndroid: ConfigPlugin<ResolvedOptions> = (
  config,
  options,
) =>
  withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      copyAndroidArtifacts(projectRoot, platformRoot, options);
      patchAppBuildGradle(platformRoot);
      return cfg;
    },
  ]);

function copyAndroidArtifacts(
  projectRoot: string,
  androidRoot: string,
  options: ResolvedOptions,
): void {
  const crateRoot = path.resolve(projectRoot, options.cratePath);
  const profileDir = options.cargoProfile === "release" ? "release" : "debug";

  for (const abi of options.androidAbis) {
    const triple = abiToTriple(abi);
    const src = path.join(
      crateRoot,
      "target",
      triple,
      profileDir,
      `${LIB_BASENAME}.so`,
    );
    if (!fs.existsSync(src)) {
      throw new Error(
        `expected Android shared library missing: ${src}\n` +
          `Did the cargo build complete? Run \`cargo install cargo-ndk\` ` +
          `and \`rustup target add ${triple}\` if missing.`,
      );
    }

    const destDir = path.join(
      androidRoot,
      "app",
      "src",
      "main",
      "jniLibs",
      abi,
    );
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, `${LIB_BASENAME}.so`);
    fs.copyFileSync(src, dest);
    log(`copied ${src} → ${dest}`);
  }
}

function patchAppBuildGradle(androidRoot: string): void {
  const gradlePath = path.join(androidRoot, "app", "build.gradle");
  if (!fs.existsSync(gradlePath)) {
    log("app/build.gradle not found — skipping (first run before prebuild)");
    return;
  }
  let gradle = fs.readFileSync(gradlePath, "utf-8");

  const marker = "// medbrains-edge-rn (auto-added by uniffi-rn-plugin)";
  if (gradle.includes(marker)) {
    log("build.gradle already patched");
    return;
  }

  // Add a `sourceSets` snippet inside the top-level `android { ... }`
  // block so jniLibs.srcDirs picks up our drop.
  const insertion = [
    "",
    `    ${marker}`,
    `    sourceSets {`,
    `        main {`,
    `            jniLibs.srcDirs += ['src/main/jniLibs']`,
    `        }`,
    `    }`,
    `    packagingOptions {`,
    `        pickFirst '**/${LIB_BASENAME}.so'`,
    `    }`,
    "",
  ].join("\n");

  // Splice into the top-level `android { ... }` block. Heuristic:
  // insert after the line containing `compileSdkVersion`.
  if (gradle.includes("compileSdkVersion")) {
    gradle = gradle.replace(
      /(compileSdkVersion[^\n]*\n)/,
      (_full, line: string) => `${line}${insertion}`,
    );
  } else {
    log("compileSdkVersion not found in build.gradle; appending sourceSets to file end");
    gradle = `${gradle}\n${insertion}`;
  }

  fs.writeFileSync(gradlePath, gradle, "utf-8");
  log("build.gradle patched with jniLibs sourceSet for medbrains-edge-rn");
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
  // eslint-disable-next-line no-console
  console.log(`[uniffi-rn-plugin/android] ${message}`);
}
