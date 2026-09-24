import { describe, expect, it } from "vitest";
import { toIsoDate } from "./roster-tab";

describe("roster date", () => {
  it("is the local calendar date, not the UTC one", () => {
    // 23:30 on the 6th, local. In UTC this may already be the 7th (or still the 5th);
    // a night shift rostered at this moment belongs to the 6th.
    const d = new Date(2026, 8, 6, 23, 30);
    expect(toIsoDate(d)).toBe("2026-09-06");
  });

  it("zero-pads month and day so the API gets a real ISO date", () => {
    expect(toIsoDate(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});
