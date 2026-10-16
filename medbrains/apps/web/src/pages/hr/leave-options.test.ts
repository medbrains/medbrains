import { describe, expect, it } from "vitest";
import { leaveDays } from "./leave-options";

describe("leaveDays", () => {
  it("counts both ends of the range", () => {
    expect(leaveDays("2026-11-02", "2026-11-04", false)).toBe(3);
    expect(leaveDays("2026-11-02", "2026-11-02", false)).toBe(1);
  });

  it("spans a month boundary", () => {
    expect(leaveDays("2026-10-30", "2026-11-02", false)).toBe(4);
  });

  it("refuses an end before the start", () => {
    expect(leaveDays("2026-11-04", "2026-11-02", false)).toBeNull();
  });

  it("allows a half day only on a single date", () => {
    expect(leaveDays("2026-11-02", "2026-11-02", true)).toBe(0.5);
    expect(leaveDays("2026-11-02", "2026-11-03", true)).toBeNull();
  });

  it("refuses a missing date", () => {
    expect(leaveDays("", "2026-11-02", false)).toBeNull();
  });
});
