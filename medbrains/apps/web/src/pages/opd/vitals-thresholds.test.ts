import { describe, expect, it } from "vitest";
import { bloodPressureSeverity, severityTone, spo2Severity } from "./vitals-thresholds";

describe("bloodPressureSeverity", () => {
  /**
   * The bug this was written for. The badge used `systolic > 140`, so a
   * reading of exactly 140 painted as normal — while the camp analytics
   * counted the same reading as stage 2 ("476 showed stage 2 elevation
   * >=140/90"). Two parts of the product disagreed about the same patient.
   *
   * Clinicians round to the nearest 5 or 10, so the boundary is not an edge
   * case here; it is one of the commonest values recorded.
   */
  it("treats exactly 140 systolic as high, not normal", () => {
    expect(bloodPressureSeverity(140, 85)).toBe("high");
    expect(bloodPressureSeverity(139, 85)).toBe("normal");
  });

  /**
   * The larger miss: diastolic was never consulted. 130/95 is hypertensive on
   * the diastolic alone and rendered as a normal blue pill.
   */
  it("flags a high diastolic even when systolic looks fine", () => {
    expect(bloodPressureSeverity(130, 95)).toBe("high");
    expect(bloodPressureSeverity(130, 90)).toBe("high");
    expect(bloodPressureSeverity(130, 89)).toBe("normal");
  });

  it("still flags hypotension", () => {
    expect(bloodPressureSeverity(85, 60)).toBe("low");
    expect(bloodPressureSeverity(90, 60)).toBe("normal");
  });

  /**
   * High beats low when a reading is somehow both. Whichever number is wrong,
   * the one that kills faster belongs on screen.
   */
  it("prefers high over low on a contradictory reading", () => {
    expect(bloodPressureSeverity(85, 95)).toBe("high");
  });

  /**
   * 273 of 1,542 real registrations have no systolic. A missing reading is
   * not a normal reading, and it is certainly not 0 — coerced to a number, a
   * blank field would read as profound hypotension and flag every unmeasured
   * patient.
   */
  it("says nothing about a patient whose pressure was never taken", () => {
    expect(bloodPressureSeverity(null, null)).toBe("normal");
    expect(bloodPressureSeverity(undefined, undefined)).toBe("normal");
    expect(bloodPressureSeverity("" as unknown as number, "" as unknown as number)).toBe("normal");
  });

  /** Half a reading is still a reading — flag on the half that exists. */
  it("uses whichever number was recorded", () => {
    expect(bloodPressureSeverity(160, null)).toBe("high");
    expect(bloodPressureSeverity(null, 100)).toBe("high");
    expect(bloodPressureSeverity(120, null)).toBe("normal");
  });

  it("ignores a value that will not parse rather than trusting it", () => {
    expect(bloodPressureSeverity("abc" as unknown as number, 80)).toBe("normal");
  });
});

describe("spo2Severity", () => {
  it("flags below 94 and not at 94", () => {
    expect(spo2Severity(93)).toBe("low");
    expect(spo2Severity(94)).toBe("normal");
  });

  /** 226 real registrations have no SpO2. Absent is not hypoxic. */
  it("says nothing when it was never measured", () => {
    expect(spo2Severity(null)).toBe("normal");
    expect(spo2Severity(undefined)).toBe("normal");
  });
});

describe("severityTone", () => {
  /**
   * Both directions of danger read as danger. A nurse scanning a ward list
   * should not have to recall which colour means high and which means low.
   */
  it("paints high as danger and low as warning", () => {
    expect(severityTone("high")).toBe("danger");
    expect(severityTone("low")).toBe("warning");
    expect(severityTone("normal")).toBe("primary");
  });
});
