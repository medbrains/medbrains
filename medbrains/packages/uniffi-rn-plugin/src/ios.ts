/**
 * iOS mod — drops the iOS staticlib(s) into the host's `ios/`
 * directory and patches the Podfile so CocoaPods picks them up.
 *
 * Universal binary: when both `aarch64-apple-ios` (device) and
 * `aarch64-apple-ios-sim` (simulator) targets are configured, we
 * use `lipo` to fat-merge them into a single `.a` so the host can
 * build for either context without conditional linking.
 */

import {
  withDangerousMod,
  withXcodeProject,
  type ConfigPlugin,
} from "@expo/config-plugins";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { UniffiRnPluginOptions } from "./index.js";

type ResolvedOptions = Required<UniffiRnPluginOptions>;

const LIB_BASENAME = "libmedbrains_edge_rn";

export const withMedbrainsUniffiIos: ConfigPlugin<ResolvedOptions> = (
  config,
  options,
) => {
  let next = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const platformRoot = cfg.modRequest.platformProjectRoot;
      copyIosArtifact(projectRoot, platformRoot, options);
      patchPodfile(platformRoot);
      return cfg;
    },
  ]);

  next = withXcodeProject(next, (cfg) => {
    addStaticLibToXcode(cfg);
    return cfg;
  });

  return next;
};

function copyIosArtifact(
  projectRoot: string,
  iosRoot: string,
  options: ResolvedOptions,
): void {
  const crateRoot = path.resolve(projectRoot, options.cratePath);
  const profileDir = options.cargoProfile === "release" ? "release" : "debug";
  const destDir = path.join(iosRoot, "MedbrainsEdgeRn");
  fs.mkdirSync(destDir, { recursive: true });

  const archives = options.iosTargets.map((target) =>
    path.join(crateRoot, "target", target, profileDir, `${LIB_BASENAME}.a`),
  );
  for (const archive of archives) {
    if (!fs.existsSync(archive)) {
      throw new Error(
        `expected iOS archive missing: ${archive}\n` +
          `Did the cargo build complete? Re-run \`expo prebuild --clean\`.`,
      );
    }
  }

  const destArchive = path.join(destDir, `${LIB_BASENAME}.a`);

  if (archives.length === 1) {
    fs.copyFileSync(archives[0]!, destArchive);
    log(`copied ${archives[0]} → ${destArchive}`);
    return;
  }

  // Multiple targets → fat binary via lipo. Apple-only tool; not
  // available on Linux EAS Build runners. EAS Build for iOS runs on
  // macOS so this is fine.
  const lipoCmd = `lipo -create -output ${destArchive} ${archives.join(" ")}`;
  log(`lipo merge: ${archives.length} archives → ${destArchive}`);
  execSync(lipoCmd, { stdio: "inherit" });
}

function patchPodfile(iosRoot: string): void {
  const podfilePath = path.join(iosRoot, "Podfile");
  if (!fs.existsSync(podfilePath)) {
    log("Podfile not found — skipping (probably first run before prebuild)");
    return;
  }
  let podfile = fs.readFileSync(podfilePath, "utf-8");

  const marker = "# medbrains-edge-rn (auto-added by uniffi-rn-plugin)";
  if (podfile.includes(marker)) {
    log("Podfile already patched");
    return;
  }

  // Add a `pre_install` hook block that links the static library
  // against the main target. The default Expo Podfile has a
  // `target '<AppName>' do ... end` block; we splice ours in
  // before the closing `end` of that block.
  const insertion = [
    "",
    `  ${marker}`,
    `  pre_install do |installer|`,
    `    # Link Rust staticlib produced by the medbrains-edge-rn crate.`,
    `    installer.aggregate_targets.each do |target|`,
    `      target.user_build_configurations.each do |config_name, _config|`,
    `        target.user_project.targets.each do |t|`,
    `          t.build_configurations.each do |bc|`,
    `            bc.build_settings['OTHER_LDFLAGS'] ||= ['$(inherited)']`,
    `            unless bc.build_settings['OTHER_LDFLAGS'].include?('-l${LIB_BASENAME.replace(/^lib/, "")}')`,
    `              bc.build_settings['OTHER_LDFLAGS'] << '-l${LIB_BASENAME.replace(/^lib/, "")}'`,
    `              bc.build_settings['OTHER_LDFLAGS'] << '-L$(PROJECT_DIR)/MedbrainsEdgeRn'`,
    `            end`,
    `          end`,
    `        end`,
    `      end`,
    `    end`,
    `  end`,
    "",
  ].join("\n");

  // Splice before the post_integrate / final `end` of the target
  // block. Heuristic: insert after the `use_expo_modules!` line.
  podfile = podfile.replace(
    /(use_expo_modules!.*\n)/,
    (_full, line: string) => `${line}${insertion}`,
  );

  fs.writeFileSync(podfilePath, podfile, "utf-8");
  log("Podfile patched with OTHER_LDFLAGS for medbrains-edge-rn");
}

function addStaticLibToXcode(cfg: {
  modResults: { rootObject: { mainGroup: string } } & Record<string, unknown>;
}): void {
  // The iOS XcodeProject mod gives us the parsed Pods project. We
  // don't add the .a to the project file directly here — the
  // Podfile pre_install hook above handles linking via search
  // paths. This function exists as a hook point: a future iteration
  // could add an `Embed Libraries` build phase if we ever ship a
  // dynamic library variant.
  void cfg;
}

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[uniffi-rn-plugin/ios] ${message}`);
}
