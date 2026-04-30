import { describe, it, expect } from "vitest";
import { resolveOptions } from "./index.js";

describe("resolveOptions", () => {
  it("returns defaults when no options passed", () => {
    const opts = resolveOptions(undefined);
    expect(opts.cratePath).toBe("../../crates/medbrains-edge-rn");
    expect(opts.udlPath).toBe("../../crates/medbrains-edge-rn/src/edge_rn.udl");
    expect(opts.iosTargets).toEqual([
      "aarch64-apple-ios",
      "aarch64-apple-ios-sim",
    ]);
    expect(opts.androidAbis).toEqual(["arm64-v8a", "armeabi-v7a", "x86_64"]);
    expect(opts.cargoProfile).toBe("release");
    expect(opts.skipBuild).toBe(false);
  });

  it("user options override defaults", () => {
    const opts = resolveOptions({
      cargoProfile: "debug",
      iosTargets: ["aarch64-apple-ios"],
    });
    expect(opts.cargoProfile).toBe("debug");
    expect(opts.iosTargets).toEqual(["aarch64-apple-ios"]);
    // Other defaults preserved.
    expect(opts.androidAbis).toEqual(["arm64-v8a", "armeabi-v7a", "x86_64"]);
  });

  it("skipBuild flag honored", () => {
    const opts = resolveOptions({ skipBuild: true });
    expect(opts.skipBuild).toBe(true);
  });
});
