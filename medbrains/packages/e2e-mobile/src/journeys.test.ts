import { describe, expect, it } from "vitest";
import { coverage, journeysFor, SURFACE_JOURNEYS } from "./journeys.js";

describe("the journey catalogue", () => {
  it("gives every journey a unique id", () => {
    const ids = SURFACE_JOURNEYS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("makes every journey assert something, not merely exist", () => {
    // A catalogue entry with no assertions is a title. The point of writing
    // them down is that the spec has to satisfy a claim somebody made.
    for (const journey of SURFACE_JOURNEYS) {
      expect(journey.assertions.length, `${journey.id} has no assertions`).toBeGreaterThan(0);
    }
  });

  it("names a spec for everything it calls automated", () => {
    // Otherwise "automated" is a claim with nothing behind it, and the
    // coverage number becomes a story rather than a measurement.
    for (const journey of SURFACE_JOURNEYS.filter((j) => j.automationStatus === "automated")) {
      expect(journey.spec, `${journey.id} claims automated with no spec`).toBeTruthy();
    }
  });

  it("says what a backlog journey is blocked on", () => {
    // A gap with a reason is work. A gap without one is a shrug.
    for (const journey of SURFACE_JOURNEYS.filter((j) => j.automationStatus === "backlog")) {
      expect(journey.blockedOn, `${journey.id} is backlog with no reason`).toBeTruthy();
    }
  });

  it("assigns every journey to at least one surface", () => {
    for (const journey of SURFACE_JOURNEYS) {
      expect(journey.surfaces.length, `${journey.id} belongs to no surface`).toBeGreaterThan(0);
    }
  });

  it("orders a surface's journeys by priority", () => {
    const priorities = journeysFor("phone").map((j) => j.priority);
    expect(priorities).toEqual([...priorities].sort());
  });

  it("counts a surface's gaps rather than hiding them", () => {
    const tv = coverage("tv");
    // The TV has journeys and no runner yet. That has to show up as a number,
    // because the alternative is a surface with no entries at all looking the
    // same as one that is fully covered.
    expect(tv.total).toBeGreaterThan(0);
    expect(tv.automated).toBe(0);
    expect(tv.gaps.every((g) => g.blockedOn)).toBe(true);
  });
});
