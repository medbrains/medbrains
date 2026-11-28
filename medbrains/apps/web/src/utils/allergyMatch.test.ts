import type { AllergyConflict } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { allergyScreenDetail } from "./allergyMatch";

/** A server conflict for `drug` against `allergen`. */
function conflict(drug: string, allergen: string, cls: string | null): AllergyConflict {
  return {
    drug_name: drug,
    allergen_name: allergen,
    allergy_type: "drug",
    severity: "severe",
    reaction: null,
    cross_reactive_class: cls,
  };
}

describe("allergyScreenDetail", () => {
  it("names the class of a cross-reactive match", () => {
    const detail = allergyScreenDetail([conflict("Amoxicillin", "Penicillin", "beta-lactam")], []);
    expect(detail).toBe("Amoxicillin × Penicillin (cross-reactive beta-lactam)");
  });

  it("shows a direct match plainly", () => {
    expect(allergyScreenDetail([conflict("Aspirin", "Aspirin", null)], [])).toBe(
      "Aspirin × Aspirin",
    );
  });

  it("says what was screened when nothing conflicts", () => {
    expect(allergyScreenDetail([], ["Penicillin"])).toBe(
      "On file: Penicillin · no conflict in order",
    );
    expect(allergyScreenDetail([], [])).toBe("No allergies on file");
  });
});
