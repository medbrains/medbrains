import { describe, expect, it } from "vitest";
import {
  ADULT_VITAL_BANDS,
  bloodPressureGrade,
  gradeLabel,
  gradeTone,
  gradeVital,
  type VitalGrade,
} from "./vitals-thresholds";

describe("bloodPressureGrade", () => {
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
    expect(bloodPressureGrade(140, 85)).toBe("high");
    expect(bloodPressureGrade(139, 85)).toBe("normal");
  });

  /**
   * The larger miss: diastolic was never consulted. 130/95 is hypertensive on
   * the diastolic alone and rendered as a normal blue pill.
   */
  it("flags a high diastolic even when systolic looks fine", () => {
    expect(bloodPressureGrade(130, 95)).toBe("high");
    expect(bloodPressureGrade(130, 90)).toBe("high");
    expect(bloodPressureGrade(130, 89)).toBe("normal");
  });

  /** 70/40 was amber with no word. NEWS2 scores a systolic of 90 or less 3 (red), 91-110 amber. */
  it("grades low systolic pressure by its NEWS2 score", () => {
    expect(bloodPressureGrade(70, 40)).toBe("critical_low");
    expect(bloodPressureGrade(90, 60)).toBe("critical_low");
    expect(bloodPressureGrade(91, 60)).toBe("low");
    expect(bloodPressureGrade(110, 70)).toBe("low");
    expect(bloodPressureGrade(111, 70)).toBe("normal");
  });

  /** NEWS2 scores a systolic of 220 or more 3; the crisis rule already reaches it at 180. */
  it("grades a systolic of 220 or more as critical high", () => {
    expect(bloodPressureGrade(220, 80)).toBe("critical_high");
  });

  it("grades a hypertensive crisis as critical high, on either number", () => {
    expect(bloodPressureGrade(180, 100)).toBe("critical_high");
    expect(bloodPressureGrade(150, 120)).toBe("critical_high");
    expect(bloodPressureGrade(179, 119)).toBe("high");
  });

  /** Critical beats high when a reading is somehow both. */
  it("prefers critical low over a high diastolic", () => {
    expect(bloodPressureGrade(85, 95)).toBe("critical_low");
  });

  /**
   * 273 of 1,542 real registrations have no systolic. A missing reading is
   * not a normal reading, and it is certainly not 0 — coerced to a number, a
   * blank field would read as profound hypotension and flag every unmeasured
   * patient.
   */
  it("says nothing about a patient whose pressure was never taken", () => {
    expect(bloodPressureGrade(null, null)).toBe("normal");
    expect(bloodPressureGrade(undefined, undefined)).toBe("normal");
    expect(bloodPressureGrade("" as unknown as number, "" as unknown as number)).toBe("normal");
  });

  /** Half a reading is still a reading — flag on the half that exists. */
  it("uses whichever number was recorded", () => {
    expect(bloodPressureGrade(160, null)).toBe("high");
    expect(bloodPressureGrade(null, 100)).toBe("high");
    expect(bloodPressureGrade(120, null)).toBe("normal");
  });

  it("ignores a value that will not parse rather than trusting it", () => {
    expect(bloodPressureGrade("abc" as unknown as number, 80)).toBe("normal");
  });
});

describe("gradeVital", () => {
  /**
   * Every NEWS2 (RCP 2017, Chart 1) boundary, both sides: 0 is normal, 1-2
   * amber (low/high), 3 red (critical). [reading, grade] per row.
   */
  const boundaries: Record<keyof typeof ADULT_VITAL_BANDS, [number, VitalGrade][]> = {
    respiratory_rate: [
      [8, "critical_low"],
      [9, "low"],
      [11, "low"],
      [12, "normal"],
      [20, "normal"],
      [21, "high"],
      [24, "high"],
      [25, "critical_high"],
    ],
    spo2: [
      [91, "critical_low"],
      [92, "low"],
      [93, "low"],
      [94, "low"],
      [95, "low"],
      [96, "normal"],
      [100, "normal"],
    ],
    systolic_bp: [
      [90, "critical_low"],
      [91, "low"],
      [100, "low"],
      [101, "low"],
      [110, "low"],
      [111, "normal"],
      [219, "normal"],
      [220, "critical_high"],
    ],
    pulse: [
      [40, "critical_low"],
      [41, "low"],
      [50, "low"],
      [51, "normal"],
      [90, "normal"],
      [91, "high"],
      [110, "high"],
      [111, "high"],
      [130, "high"],
      [131, "critical_high"],
    ],
    temperature: [
      [35.0, "critical_low"],
      [35.1, "low"],
      [36.0, "low"],
      [36.1, "normal"],
      [38.0, "normal"],
      [38.1, "high"],
      [39.0, "high"],
      [39.1, "high"],
      [42.0, "high"],
    ],
  };
  for (const [param, rows] of Object.entries(boundaries)) {
    it.each(rows)(`grades ${param} %s as %s`, (reading, grade) => {
      expect(gradeVital(reading, ADULT_VITAL_BANDS[param as keyof typeof boundaries])).toBe(grade);
    });
  }

  /** 226 real registrations have no SpO2. Absent is not hypoxic. */
  it("says nothing when it was never measured", () => {
    expect(gradeVital(null, ADULT_VITAL_BANDS.spo2)).toBe("normal");
  });

  /** Critical in either direction is danger, and every grade has a word. */
  it("pairs each colour with a word", () => {
    expect([gradeTone("critical_low"), gradeLabel("critical_low")]).toEqual([
      "danger",
      "Critical low",
    ]);
    expect([gradeTone("high"), gradeLabel("high")]).toEqual(["warning", "High"]);
    expect(gradeTone("normal")).toBe("primary");
  });
});
