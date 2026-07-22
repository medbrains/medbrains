import { describe, expect, it } from "vitest";
import { statusColor } from "./status-colors";

/**
 * One 464-entry status-to-colour map serves 37 pages. Colour is how a
 * clinician reads severity at a glance, so the mappings that carry a safety
 * meaning are pinned here — a status that quietly turns green is a worse
 * failure than one that throws.
 */

describe("statusColor lookup", () => {
  it("is case-insensitive", () => {
    expect(statusColor("CRITICAL")).toBe(statusColor("critical"));
    expect(statusColor("Expired")).toBe("danger");
  });

  it("falls back to slate for absent input", () => {
    expect(statusColor(null)).toBe("slate");
    expect(statusColor(undefined)).toBe("slate");
    expect(statusColor("")).toBe("slate");
  });

  it("honours a caller-supplied fallback", () => {
    expect(statusColor(null, "info")).toBe("info");
    expect(statusColor("no_such_status", "info")).toBe("info");
  });

  it("does not trim, so a padded status misses the map", () => {
    expect(statusColor(" critical ")).toBe("slate");
  });
});

describe("safety-critical statuses stay alarming", () => {
  /**
   * These are the ones where green or grey would actively mislead. If a
   * future edit reassigns any of them, this fails rather than shipping a
   * reassuring colour on a dangerous state.
   */
  it("maps danger states to danger", () => {
    for (const status of [
      "critical",
      "critical_high",
      "critical_low",
      "expired",
      "incompatible",
      "quarantine",
      "rejected",
      "failed",
      "overdue",
      "stat",
      "emergency",
      "positive",
    ]) {
      expect(statusColor(status)).toBe("danger");
    }
  });

  it("maps abnormal to a warning rather than to success", () => {
    expect(statusColor("abnormal")).toBe("warning");
  });

  it("does not render any danger state as success", () => {
    for (const status of ["critical", "critical_high", "critical_low", "expired", "failed"]) {
      expect(statusColor(status)).not.toBe("success");
    }
  });
});

describe("priority scale", () => {
  /**
   * low/medium/high is a priority ramp, which is why low is green: a
   * low-priority item is not a concern. Lab criticality is a different axis
   * and has its own keys, so a low result is critical_low, not low.
   */
  it("ramps from success through warning to orange", () => {
    expect(statusColor("low")).toBe("success");
    expect(statusColor("medium")).toBe("warning");
    expect(statusColor("high")).toBe("orange");
  });

  it("keeps lab criticality on its own keys, both flagged danger", () => {
    expect(statusColor("critical_low")).toBe("danger");
    expect(statusColor("critical_high")).toBe("danger");
    // The plain priority words must not be reused for lab flags.
    expect(statusColor("low")).not.toBe(statusColor("critical_low"));
  });
});

describe("unmapped statuses", () => {
  /**
   * QUIRK: an unknown status resolves to neutral slate, the same colour as
   * genuinely neutral states like voided. Several words a clinical module
   * could plausibly emit are not in the map today, so they would render as
   * unremarkable grey rather than as an alert.
   *
   * Listing them is the point — if any is later added to the map, this test
   * fails and the list gets revisited deliberately.
   */
  it("QUIRK: these safety-sounding statuses are unmapped and render neutral", () => {
    for (const status of ["panic", "contaminated", "reaction", "recalled"]) {
      expect(statusColor(status)).toBe("slate");
    }
  });

  it("an unmapped status is indistinguishable from a deliberately neutral one", () => {
    expect(statusColor("panic")).toBe(statusColor("voided"));
  });
});
