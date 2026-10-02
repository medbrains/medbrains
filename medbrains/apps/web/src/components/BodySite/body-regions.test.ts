import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Atlas } from "./anatomy-atlas";
import { BODY_REGIONS, regionLabel, regionParts } from "./body-regions";

// The synced model (`make anatomy-sync`, gitignored); a name it lacks would
// light nothing. Skipped where the model has not been synced.
const ATLAS = resolve(__dirname, "../../../public/anatomy/atlas.json");
const atlas: Atlas = existsSync(ATLAS)
  ? JSON.parse(readFileSync(ATLAS, "utf8"))
  : { version: "", parts: [], chunks: [] };
const partsByName = new Map(atlas.parts.map((p) => [p.name, p]));

describe.skipIf(atlas.parts.length === 0)("body regions", () => {
  it.each(
    BODY_REGIONS.map((r) => [r.label, r] as const),
  )("%s lights only structures the model has", (_, region) => {
    const both = region.structures.flatMap((s) =>
      s.includes("{side}") ? [s.replace("{side}", "Left"), s.replace("{side}", "Right")] : [s],
    );
    expect(both.filter((n) => !partsByName.has(n))).toEqual([]);
  });

  it("a sided region lights one side once the side is chosen", () => {
    const knee = BODY_REGIONS.find((r) => r.id === "knee");
    if (!knee) throw new Error("knee region missing");
    expect(regionParts(knee, null, partsByName).map((p) => p.name)).toEqual([
      "Left patella",
      "Right patella",
    ]);
    expect(regionParts(knee, "left", partsByName).map((p) => p.name)).toEqual(["Left patella"]);
    expect(regionLabel(knee, "left")).toBe("Left knee");
    expect(regionLabel(knee, null)).toBe("Knee");
  });
});
