/**
 * The decision: "connected" and "reporting" are different facts, and the app
 * must not present the first as the second.
 *
 * A band paired three weeks ago that has sent nothing is not connected in any
 * sense the person cares about. Showing it green would be the same failure as
 * an empty ward reading as a fact about the ward — a silence dressed as an
 * answer.
 */

import { describe, expect, it } from "vitest";
import type { Band } from "./bands.js";
import { bandState, describeBandState, STALE_AFTER_HOURS } from "./bands.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function band(over: Partial<Band> = {}): Band {
  return { id: "b1", kind: "medbrains", name: "My band", ...over };
}

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe("bandState", () => {
  it("is never_synced when nothing has ever arrived", () => {
    expect(bandState(band(), NOW)).toBe("never_synced");
  });

  it("is reporting when data arrived recently", () => {
    expect(bandState(band({ lastSyncedAt: hoursAgo(2) }), NOW)).toBe("reporting");
  });

  it("goes stale rather than staying green when the band falls silent", () => {
    expect(bandState(band({ lastSyncedAt: hoursAgo(STALE_AFTER_HOURS + 1) }), NOW)).toBe("stale");
  });

  it("holds at the boundary — exactly the threshold is still reporting", () => {
    expect(bandState(band({ lastSyncedAt: hoursAgo(STALE_AFTER_HOURS) }), NOW)).toBe("reporting");
  });

  it("never describes a silent band as connected", () => {
    for (const state of ["stale", "never_synced"] as const) {
      expect(describeBandState(state).toLowerCase()).not.toContain("connected");
    }
  });
});
