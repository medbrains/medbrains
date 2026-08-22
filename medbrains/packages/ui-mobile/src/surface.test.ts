import { describe, expect, it } from "vitest";
import { SURFACE_SCALE, space, tapTarget, type } from "./surface.js";

describe("surface scales", () => {
  it("never puts a target below the WCAG floor", () => {
    // 44 is SC 2.5.8's minimum. A surface may exceed it; none may go under.
    for (const [surface, scale] of Object.entries(SURFACE_SCALE)) {
      expect(scale.tapTarget, `${surface} is under the WCAG floor`).toBeGreaterThanOrEqual(44);
    }
  });

  it("gives a surface further from the eye more room, not the same", () => {
    // The bug this replaces: a tablet and a TV inheriting a phone's numbers.
    expect(tapTarget("tablet")).toBeGreaterThan(tapTarget("phone"));
    expect(tapTarget("tv")).toBeGreaterThan(tapTarget("tablet"));
    expect(space("tv", "md")).toBeGreaterThan(space("phone", "md"));
    expect(type("tv", 16)).toBeGreaterThan(type("phone", 16));
  });

  it("keeps content out of the TV's overscan and nothing else's", () => {
    // Overscan is physical: content inside it is cut off by the panel. A phone
    // has no such band, and inventing one would waste a screen that is small.
    expect(SURFACE_SCALE.tv.inset.horizontal).toBeGreaterThan(0);
    expect(SURFACE_SCALE.phone.inset).toEqual({ horizontal: 0, vertical: 0 });
    expect(SURFACE_SCALE.tablet.inset).toEqual({ horizontal: 0, vertical: 0 });
  });

  it("knows a TV has no finger", () => {
    // Drives focus handling: a remote surface needs a visible focus ring and
    // D-pad order, which a touch surface does not.
    expect(SURFACE_SCALE.tv.pointer).toBe("remote");
    expect(SURFACE_SCALE.phone.pointer).toBe("touch");
  });

  it("rounds to whole pixels", () => {
    // Fractional spacing renders as a hairline seam between adjacent surfaces
    // on some densities.
    expect(Number.isInteger(space("tablet", "md"))).toBe(true);
    expect(Number.isInteger(type("tablet", 15))).toBe(true);
  });
});
