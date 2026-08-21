import { describe, expect, it } from "vitest";
import type { BarcodeVerifyResult, WardOnDutyRow } from "../../api/ipd.js";
import { canRecordGiven, eligibleWitnesses, scanRightsSummary } from "./bcma.js";

function nurse(id: string, name: string): WardOnDutyRow {
  return {
    is_charge: false,
    nurse_name: name,
    nurse_user_id: id,
    patient_count: 3,
    primary_assigned: true,
    shift_type: "day",
  };
}

describe("who may witness a high-alert dose", () => {
  it("never offers the nurse giving it", () => {
    // A second check by the same pair of eyes is not a second check, and the
    // server rejects it — so offering the name only produces a refusal after
    // the nurse has already committed to the dose.
    const onDuty = [nurse("me", "Asha"), nurse("other", "Bilal")];
    expect(eligibleWitnesses(onDuty, "me").map((n) => n.nurse_user_id)).toEqual(["other"]);
  });

  it("returns nobody rather than everybody when the ward is a single nurse", () => {
    expect(eligibleWitnesses([nurse("me", "Asha")], "me")).toEqual([]);
  });
});

describe("when Give may be pressed", () => {
  it("blocks a high-alert dose with no witness named", () => {
    expect(canRecordGiven({ isHighAlert: true, witnessId: null })).toBe(false);
  });

  it("allows a high-alert dose once a witness is named", () => {
    expect(canRecordGiven({ isHighAlert: true, witnessId: "other" })).toBe(true);
  });

  it("does not demand a witness for an ordinary dose", () => {
    // Requiring one everywhere would look safer and would teach nurses to name
    // whoever is nearest, which is how the high-alert witness stops meaning
    // anything.
    expect(canRecordGiven({ isHighAlert: false, witnessId: null })).toBe(true);
  });
});

describe("what the nurse is told after a refused scan", () => {
  const result = (patient: boolean, drug: boolean): BarcodeVerifyResult => ({
    reason: "…",
    right_drug: drug,
    right_patient: patient,
    verified: patient && drug,
  });

  it("names both rights, including the one that passed", () => {
    expect(scanRightsSummary(result(true, false))).toBe("Wristband matched. Drug did not match.");
    expect(scanRightsSummary(result(false, true))).toBe("Wristband did not match. Drug matched.");
  });
});
