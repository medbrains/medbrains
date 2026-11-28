import { describe, expect, it } from "vitest";
import { releaseName } from "./release-name";

describe("releaseName", () => {
  it("uses the release the build names, so browser and server errors share one release", () => {
    expect(releaseName("medbrains@3.34.0", "4f2a9c1d0b3e")).toBe("medbrains@3.34.0");
  });

  it("falls back to the commit when the build names none", () => {
    expect(releaseName(undefined, "4f2a9c1d0b3e")).toBe("4f2a9c1d0b3e");
  });

  it("treats a blank variable as unset rather than reporting an empty release", () => {
    expect(releaseName("  ", "4f2a9c1d0b3e")).toBe("4f2a9c1d0b3e");
  });
});
