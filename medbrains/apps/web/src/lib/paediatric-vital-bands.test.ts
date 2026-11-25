import { describe, expect, it } from "vitest";
import { completedYears, hospitalToday, paediatricRanges } from "./paediatric-vital-bands";

describe("age for the vitals chart", () => {
  it("counts a year only once the birthday has come round", () => {
    expect(completedYears("2021-11-26", "2026-11-25")).toBe(4);
    expect(completedYears("2021-11-25", "2026-11-25")).toBe(5);
    expect(completedYears("2026-11-20", "2026-11-25")).toBe(0);
    expect(completedYears(null, "2026-11-25")).toBeNull();
    expect(completedYears("2026-12-01", "2026-11-25")).toBeNull();
  });

  it("takes today in the hospital's zone: 00:30 IST is still the previous day in UTC", () => {
    const halfPastMidnightIst = new Date("2026-11-24T19:00:00Z");
    expect(hospitalToday("Asia/Kolkata", halfPastMidnightIst)).toBe("2026-11-25");
    expect(hospitalToday("UTC", halfPastMidnightIst)).toBe("2026-11-24");
  });

  it("switches charts at 1, 5, 12 and 16 years", () => {
    expect(paediatricRanges(0)?.pulse.normal).toEqual([110, 159]);
    expect(paediatricRanges(1)?.pulse.normal).toEqual([90, 139]);
    expect(paediatricRanges(5)?.pulse.normal).toEqual([80, 129]);
    expect(paediatricRanges(15)?.pulse.normal).toEqual([65, 109]);
    expect(paediatricRanges(16)).toBeNull();
  });
});
