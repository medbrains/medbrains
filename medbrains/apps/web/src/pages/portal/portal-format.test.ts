import { describe, expect, it } from "vitest";
import { flagTone, isOutsideRange, portalDate } from "./portal-format";

describe("isOutsideRange", () => {
  it("recognises the shorthands labs actually emit", () => {
    for (const flag of ["H", "l", "High", "LOW", "abnormal", "critical high"]) {
      expect(isOutsideRange(flag)).toBe(true);
    }
  });

  it("treats an absent or normal flag as in range", () => {
    for (const flag of [null, undefined, "", "N", "normal"]) {
      expect(isOutsideRange(flag)).toBe(false);
    }
  });

  /**
   * The safe direction here is the opposite of most of this codebase. Adding a
   * caution to a result that is fine is its own harm — the value and the range
   * are both on screen, so an unrecognised flag stays quiet.
   */
  it("stays quiet on a flag it does not recognise", () => {
    expect(isOutsideRange("delta-check")).toBe(false);
    expect(isOutsideRange("???")).toBe(false);
  });
});

describe("flagTone", () => {
  /**
   * Nothing reaches danger. The server already withholds results carrying an
   * unacknowledged critical alert, so a patient never sees one here before a
   * clinician has spoken to them — shouting about a mildly high value they are
   * about to discuss anyway is alarm without information.
   */
  it("never escalates to danger", () => {
    for (const flag of ["H", "critical", "abnormal", "low", null, "normal"]) {
      expect(flagTone(flag)).not.toBe("danger");
    }
  });

  it("marks an out-of-range value and leaves the rest plain", () => {
    expect(flagTone("H")).toBe("warning");
    expect(flagTone("normal")).toBe("neutral");
    expect(flagTone(null)).toBe("neutral");
  });
});

describe("portalDate", () => {
  it("renders a date without a time of day", () => {
    const rendered = portalDate("2026-03-04T09:15:00Z");
    expect(rendered).toMatch(/2026/);
    expect(rendered).not.toMatch(/:/);
  });

  it("returns an unparseable value unchanged rather than showing 'Invalid Date'", () => {
    expect(portalDate("not a date")).toBe("not a date");
  });
});
