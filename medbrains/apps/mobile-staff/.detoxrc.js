/**
 * Detox — grey-box end-to-end for the staff app.
 *
 * Chosen over black-box driving because Detox synchronises with the JS thread:
 * it waits for React Native to be idle rather than for a timeout to expire, so
 * a slow list or an in-flight fetch does not produce a flake that has to be
 * retried in CI. On a clinical app that matters twice over — a test that is
 * retried until green stops being evidence.
 *
 * Matchers are `by.id`, not text. Copy on these screens is deliberate and gets
 * revised; a suite anchored to sentences breaks on wording and then gets
 * `--skip`ped, which is how a mobile suite dies.
 *
 * Release is the configuration CI should run. Debug talks to Metro, so a
 * failure there can be the bundler rather than the app.
 *
 * The specs provision their own identities over HTTPS against the local dev
 * stack, whose certificate is signed by the mkcert root. Node's fetch has its
 * own trust store and does not read the system one, so the runner is given the
 * root explicitly below — without it every spec fails at `beforeAll` with
 * "unable to verify the first certificate", which reads like a broken test and
 * is a missing CA.
 */

/** The scheme Expo prebuild generated. */
const SCHEME = "MedBrainsStaff";
const IOS_BUILD_DIR = "ios/build";

/** One pinned simulator. "Latest available" makes a green run unreproducible. */
const SIMULATOR = "iPhone 16";

/** Where mkcert keeps the root it signed the dev certificate with. */
function mkcertRootCA() {
  const { execFileSync } = require("node:child_process");
  const path = require("node:path");
  try {
    const root = execFileSync("mkcert", ["-CAROOT"], { encoding: "utf8" }).trim();
    return path.join(root, "rootCA.pem");
  } catch {
    // mkcert is not installed. Leave the trust store alone and let the failure
    // say what it is rather than pointing at a path that does not exist.
    return undefined;
  }
}

module.exports = {
  testRunner: {
    args: {
      $0: "jest",
      config: "e2e/jest.config.js",
    },
    // Only when the caller has not already chosen one, so CI can point at a
    // real bundle without editing this file.
    env: process.env.NODE_EXTRA_CA_CERTS
      ? undefined
      : { NODE_EXTRA_CA_CERTS: mkcertRootCA() },
    // The app is launched, the bundle loaded and a login round trip made before
    // the first matcher runs. The default 120s is not generous here, it is
    // barely enough on a cold simulator.
    jest: {
      setupTimeout: 240000,
    },
  },
  apps: {
    "ios.debug": {
      type: "ios.app",
      binaryPath: `${IOS_BUILD_DIR}/Build/Products/Debug-iphonesimulator/${SCHEME}.app`,
      build:
        `xcodebuild -workspace ios/${SCHEME}.xcworkspace -scheme ${SCHEME} ` +
        `-configuration Debug -sdk iphonesimulator -derivedDataPath ${IOS_BUILD_DIR} ` +
        "-quiet",
    },
    "ios.release": {
      type: "ios.app",
      binaryPath: `${IOS_BUILD_DIR}/Build/Products/Release-iphonesimulator/${SCHEME}.app`,
      build:
        `xcodebuild -workspace ios/${SCHEME}.xcworkspace -scheme ${SCHEME} ` +
        `-configuration Release -sdk iphonesimulator -derivedDataPath ${IOS_BUILD_DIR} ` +
        "-quiet",
    },
    "android.debug": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
      build:
        "cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..",
      reversePorts: [8081],
    },
    "android.release": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/release/app-release.apk",
      build:
        "cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release && cd ..",
    },
  },
  devices: {
    simulator: {
      type: "ios.simulator",
      device: { type: SIMULATOR },
    },
    emulator: {
      type: "android.emulator",
      device: { avdName: "Pixel_7_API_34" },
    },
  },
  configurations: {
    "ios.sim.debug": { device: "simulator", app: "ios.debug" },
    "ios.sim.release": { device: "simulator", app: "ios.release" },
    "android.emu.debug": { device: "emulator", app: "android.debug" },
    "android.emu.release": { device: "emulator", app: "android.release" },
  },
};
