import { describe, expect, it } from "vitest";
import { EMPTY_SAFETY, maxDoseRow, weightDoseRow } from "./rxSafety";

describe("maxDoseRow", () => {
  it("flags a line over its maximum", () => {
    const row = maxDoseRow({
      ...EMPTY_SAFETY,
      dose_alerts: [
        {
          drug_name: "Paracetamol",
          per_dose: "1 g",
          doses_per_day: 4,
          total_per_day_label: "4000 mg",
          max_per_day_label: "3000 mg",
        },
      ],
    });
    expect(row.state).toBe("flag");
    expect(row.detail).toBe("Paracetamol: 4000 mg/day > max 3000 mg");
  });

  it("warns, never reads as within, when a line was not checked", () => {
    const row = maxDoseRow({
      ...EMPTY_SAFETY,
      dose_not_checked: [
        {
          drug_name: "Syrup X",
          per_dose: "5 ml",
          frequency: "QID",
          reason: "Dose is in ml, the catalogue maximum is in mg",
        },
      ],
    });
    expect(row.state).toBe("warn");
    expect(row.detail).toContain("Not checked");
    expect(row.count).toBe(1);
  });

  it("is ok only when nothing was over or unchecked", () => {
    expect(maxDoseRow(EMPTY_SAFETY).state).toBe("ok");
  });
});

describe("weightDoseRow", () => {
  it("warns, never passes, when a child's weight is missing or stale", () => {
    const row = weightDoseRow({
      ...EMPTY_SAFETY,
      weight_not_checked: [
        { drug_name: "Paracetamol", reason: "No weight recorded for this child" },
      ],
    });
    expect(row.state).toBe("warn");
    expect(row.detail).toContain("Not checked — Paracetamol: No weight recorded");
    expect(row.count).toBe(1);
  });

  it("flags an overdose and labels a per-dose rule per dose", () => {
    const row = weightDoseRow({
      ...EMPTY_SAFETY,
      weight_alerts: [
        {
          drug_name: "Gentamicin",
          direction: "over",
          prescribed_per_day_label: "12 mg",
          recommended_per_day_label: "6 mg",
          basis: "dose",
          weight_kg: 1.2,
        },
      ],
    });
    expect(row.state).toBe("flag");
    expect(row.detail).toBe("Gentamicin: 12 mg/dose is over the ~6 mg/dose for 1.2 kg");
  });
});
