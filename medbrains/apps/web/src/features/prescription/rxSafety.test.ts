import { describe, expect, it } from "vitest";
import { renalRow } from "./rxSafety";

describe("renalRow", () => {
  it("flags an eGFR under the threshold, with its date", () => {
    const row = renalRow(
      [
        {
          drug_name: "Metformin",
          egfr: 28,
          egfr_measured_on: "2026-11-12",
          threshold: 30,
          rule: "Avoid",
        },
      ],
      [],
    );
    expect(row.state).toBe("flag");
    expect(row.detail).toMatch(/Metformin: Avoid \(eGFR 28, .*12.* < 30\)/);
  });

  it("warns, never reads as no adjustment, when there was no recent eGFR", () => {
    const row = renalRow([], [{ drug_name: "Metformin", reason: "No verified eGFR" }]);
    expect(row.state).toBe("warn");
    expect(row.detail).toContain("not checked");
  });

  it("is ok only when every renal rule was checked", () => {
    expect(renalRow([], []).state).toBe("ok");
  });
});
