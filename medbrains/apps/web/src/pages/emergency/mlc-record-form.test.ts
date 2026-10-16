import { describe, expect, it } from "vitest";
import {
  isCertifiedMlc,
  type MlcRecordFormInput,
  mlcRecordPayload,
  validateMlcRecord,
} from "./mlc-record-form";

const blank: MlcRecordFormInput = {
  examining_doctor_id: "",
  examined_at: "",
  date_time_of_incident: "",
  place_of_incident: "",
  weapon_used: "",
  police_officer_name: "",
  police_officer_rank: "",
  police_dd_number: "",
  condition_on_arrival: "",
  treatment_given: "",
  samples_handed_to: "",
  patient_condition_at_discharge: "",
  amendment_reason: "",
};

const now = new Date("2026-10-12T12:00:00");
const registeredAt = new Date("2026-10-12T10:00:00").toISOString();

describe("MLC record form", () => {
  it("refuses an incident after registration and an examination before the incident", () => {
    const errors = validateMlcRecord(
      {
        ...blank,
        date_time_of_incident: "2026-10-12 11:00:00",
        examined_at: "2026-10-12 09:00:00",
      },
      { registeredAt, certified: false, now },
    );
    expect(errors.date_time_of_incident).toMatch(/after the MLC was registered/);
    expect(errors.examined_at).toMatch(/before the incident/);
  });

  it("refuses a future examination", () => {
    const errors = validateMlcRecord(
      { ...blank, examined_at: "2026-10-12 15:00:00" },
      { registeredAt, certified: false, now },
    );
    expect(errors.examined_at).toMatch(/future/);
  });

  it("asks a certified case for a reason, and only then", () => {
    expect(isCertifiedMlc("opinion_given")).toBe(true);
    expect(isCertifiedMlc("under_investigation")).toBe(false);
    const ctx = { registeredAt, now };
    expect(validateMlcRecord(blank, { ...ctx, certified: true }).amendment_reason).toBeDefined();
    expect(validateMlcRecord(blank, { ...ctx, certified: false }).amendment_reason).toBeUndefined();
    expect(
      validateMlcRecord(
        { ...blank, amendment_reason: "Re-examined wound edges" },
        { ...ctx, certified: true },
      ).amendment_reason,
    ).toBeUndefined();
  });

  it("sends only what was filled, never a blank that would erase", () => {
    const payload = mlcRecordPayload(
      { ...blank, weapon_used: "  Blunt object ", place_of_incident: "   " },
      { certified: false, editable: () => true },
    );
    expect(payload.weapon_used).toBe("Blunt object");
    expect(payload).not.toHaveProperty("place_of_incident");
    expect(payload.amendment_reason).toBeUndefined();
    expect(payload.examined_at).toBeUndefined();
  });

  it("never sends a group the user may not edit (its masked value is not a change)", () => {
    const payload = mlcRecordPayload(
      { ...blank, police_dd_number: "DD-****", treatment_given: "Sutured" },
      { certified: false, editable: (g) => g !== "emergency.mlc.police_officer" },
    );
    expect(payload).not.toHaveProperty("police_dd_number");
    expect(payload.treatment_given).toBe("Sutured");
  });
});

describe("police intimation delivery label", () => {
  it("never shows an unconfigured send as sent", async () => {
    const { deliveryLabel } = await import("./police-intimation-delivery");
    expect(deliveryLabel({ channel: "sms", status: "not_configured" })).toBe(
      "SMS · Not sent — SMS not configured",
    );
    expect(deliveryLabel({ channel: "email", status: "sent" })).toBe("Email · Sent");
  });
});
