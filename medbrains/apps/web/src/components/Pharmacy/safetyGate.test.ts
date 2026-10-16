import { ApiError } from "@medbrains/api";
import type { MedicationSafetyFinding } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { isSafetyRefusal, overridePermissions, safetyGate } from "./safetyGate";

function finding(
  code: string,
  severity: "warn" | "block",
  override_permission?: string,
): MedicationSafetyFinding {
  return {
    code,
    severity,
    message: `${code} hit`,
    catalog_item_id: null,
    drug_name: "Drug",
    detail: override_permission ? { override_permission } : {},
  };
}

const interaction = finding("DRUG_INTERACTION", "block", "pharmacy.safety.override");
const reserve = finding(
  "RESERVE_ANTIBIOTIC_APPROVAL_REQUIRED",
  "block",
  "pharmacy.stewardship.approve",
);

describe("pharmacy safety gate", () => {
  it("never lets a failed or unfinished check read as clear", () => {
    const gate = safetyGate(undefined, { checked: false, canOverride: true, reason: "" });
    expect(gate.canProceed).toBe(false);
    expect(safetyGate([], { checked: false, canOverride: true, reason: "" }).canProceed).toBe(
      false,
    );
  });

  it("proceeds when the check ran and found only warnings", () => {
    const gate = safetyGate([finding("DRUG_INTERACTION", "warn")], {
      checked: true,
      canOverride: false,
      reason: "",
    });
    expect(gate).toMatchObject({ canProceed: true, needsReason: false });
    expect(gate.warnings).toHaveLength(1);
  });

  it("holds a block until an override holder gives a real reason", () => {
    const base = { checked: true, canOverride: true };
    expect(safetyGate([interaction], { ...base, reason: "ok" }).canProceed).toBe(false);
    expect(safetyGate([interaction], { ...base, reason: "Monitored INR daily" }).canProceed).toBe(
      true,
    );
    expect(
      safetyGate([interaction], { ...base, canOverride: false, reason: "Monitored INR daily" })
        .canProceed,
    ).toBe(false);
  });

  it("asks for each kind of block's own override permission", () => {
    expect(overridePermissions([interaction, reserve, finding("X", "warn", "ignored")])).toEqual([
      "pharmacy.safety.override",
      "pharmacy.stewardship.approve",
    ]);
    expect(overridePermissions([finding("UNKNOWN", "block")])).toEqual([
      "pharmacy.safety.override",
    ]);
  });

  it("tells a safety refusal from any other conflict", () => {
    expect(isSafetyRefusal(new ApiError("Medication safety check: X × Y — major", 409))).toBe(true);
    expect(isSafetyRefusal(new ApiError("Insufficient stock for X", 409))).toBe(false);
    expect(isSafetyRefusal(new ApiError("Medication safety check: X", 403))).toBe(false);
  });
});
