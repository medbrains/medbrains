/**
 * One Detox configuration, shared by every device surface.
 *
 * There are seven React Native apps — five phone variants, the TV, and the
 * tablet form factor of the staff app — and a `.detoxrc.js` per app is seven
 * copies of the same simulator pin, the same build command shape, and the same
 * four hard-won harness settings. The copies drift: the first app to hit a
 * problem gets the fix and the other six keep the bug. That is exactly how the
 * TypeScript pin ended up on `apps/tv` alone while five apps could not start.
 *
 * An app's `.detoxrc.js` becomes three lines: its scheme, its bundle id, and
 * which surfaces it runs on.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Where mkcert keeps the root that signed the dev certificate.
 *
 * Node's fetch has its own trust store and does not read the system one, so a
 * spec that provisions its identity over the local HTTPS stack fails in
 * `beforeAll` with "unable to verify the first certificate" — which reads like
 * a broken test and is a missing CA. Returns undefined when mkcert is absent,
 * so the failure says what it is rather than pointing at a path that does not
 * exist.
 */
export function mkcertRootCA(): string | undefined {
  try {
    const root = execFileSync("mkcert", ["-CAROOT"], { encoding: "utf8" }).trim();
    return path.join(root, "rootCA.pem");
  } catch {
    return undefined;
  }
}

/**
 * Devices are pinned, never "latest available".
 *
 * A green run on whatever simulator the machine happened to have is not a
 * result anybody can reproduce, and the three form factors genuinely behave
 * differently: a tablet lays out in two columns where a phone stacks, and a TV
 * has no touch at all.
 */
export const DEVICES = {
  phone: { type: "ios.simulator", device: { type: "iPhone 16" } },
  tablet: { type: "ios.simulator", device: { type: "iPad Pro 11-inch (M4)" } },
  tv: { type: "android.emulator", device: { avdName: "Android_TV_1080p_API_34" } },
} as const;

export type SurfaceName = keyof typeof DEVICES;

export interface AppSurfaceOptions {
  /** The Xcode scheme and workspace name, e.g. `MedBrainsStaff`. */
  scheme: string;
  /** Which surfaces this app is built for. */
  surfaces: readonly SurfaceName[];
  /** Where the specs live, relative to the app. Defaults to `e2e`. */
  e2eDir?: string;
}

const IOS_BUILD_DIR = "ios/build";

/**
 * Detox does not merge partial configs, so this returns a whole one.
 *
 * The four settings below are each here because leaving them out produced a
 * red run that looked like a broken app:
 *
 *   `setupTimeout` — the app is launched, the bundle loaded and a login round
 *   trip made before the first matcher runs. 120s is barely enough cold.
 *
 *   `NODE_EXTRA_CA_CERTS` — see `mkcertRootCA`.
 *
 *   Release configurations exist and are what CI should run. Debug talks to
 *   Metro, so a failure there can be the bundler rather than the app, and
 *   React Native's dev-warning toasts cover the bottom of the screen where the
 *   last control on a list usually sits.
 */
export function detoxConfig(options: AppSurfaceOptions): Record<string, unknown> {
  const { scheme, surfaces, e2eDir = "e2e" } = options;
  const ca = mkcertRootCA();

  const iosApp = (configuration: "Debug" | "Release") => ({
    type: "ios.app",
    binaryPath: `${IOS_BUILD_DIR}/Build/Products/${configuration}-iphonesimulator/${scheme}.app`,
    build:
      `xcodebuild -workspace ios/${scheme}.xcworkspace -scheme ${scheme} ` +
      `-configuration ${configuration} -sdk iphonesimulator ` +
      `-derivedDataPath ${IOS_BUILD_DIR} -quiet`,
  });

  const apps: Record<string, unknown> = {};
  const devices: Record<string, unknown> = {};
  const configurations: Record<string, unknown> = {};

  for (const surface of surfaces) {
    devices[surface] = DEVICES[surface];
    if (surface === "tv") {
      apps["android.debug"] = {
        type: "android.apk",
        binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
        build:
          "cd android && ./gradlew assembleDebug assembleAndroidTest " +
          "-DtestBuildType=debug && cd ..",
        reversePorts: [8081],
      };
      configurations["tv.debug"] = { device: "tv", app: "android.debug" };
      continue;
    }
    apps["ios.debug"] = iosApp("Debug");
    apps["ios.release"] = iosApp("Release");
    configurations[`${surface}.debug`] = { device: surface, app: "ios.debug" };
    configurations[`${surface}.release`] = { device: surface, app: "ios.release" };
  }

  return {
    /**
     * Every run leaves evidence, not just the failures.
     *
     * A green line in a terminal is a claim. A screenshot at the start and end
     * of each test is the thing somebody can actually check, and when a spec
     * does fail the surrounding frames usually say why faster than the matcher
     * error does. Device logs are kept for the same reason.
     *
     * `keepOnlyFailedTestsArtifacts` is deliberately off: the passing frames
     * are how a reviewer sees the journey without running it.
     */
    artifacts: {
      rootDir: "artifacts",
      plugins: {
        log: { enabled: true },
        screenshot: {
          enabled: true,
          shouldTakeAutomaticSnapshots: true,
          keepOnlyFailedTestsArtifacts: false,
          takeWhen: {
            testStart: true,
            testDone: true,
            appNotReady: true,
          },
        },
      },
    },
    testRunner: {
      args: { $0: "jest", config: `${e2eDir}/jest.config.js` },
      jest: { setupTimeout: 240_000 },
      ...(ca ? { env: { NODE_EXTRA_CA_CERTS: ca } } : {}),
    },
    apps,
    devices,
    configurations,
  };
}
