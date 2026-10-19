import { describe, expect, it } from "vitest";
import {
  ALERT_THROTTLE_MS,
  alertSoundFor,
  createSoundThrottle,
  effectiveVolume,
  URGENT_VOLUME_FLOOR,
} from "./alert-sounds";

describe("alertSoundFor", () => {
  // Real rows the server writes today (kind, entity_type) and what they must sound like.
  it.each([
    ["critical lab value", { kind: "danger", entity_type: "lab_order" }, "urgent"],
    ["critical imaging finding", { kind: "danger", entity_type: "radiology_order" }, "urgent"],
    ["code blue paged", { kind: "error", entity_type: "code_blue" }, "urgent"],
    [
      "mass casualty (code yellow)",
      { kind: "error", entity_type: "mass_casualty_event" },
      "urgent",
    ],
    ["nurse call overdue", { kind: "sla_breach", entity_type: "bedside_nurse_request" }, "urgent"],
    ["code blue stood down", { kind: "info", entity_type: "code_blue" }, "calm"],
    ["lab results ready", { kind: "info", entity_type: "lab_order" }, "attention"],
    ["imaging report ready", { kind: "info", entity_type: "radiology_order" }, "attention"],
    ["lab sample rejected", { kind: "warning", entity_type: "lab_order" }, "attention"],
    ["break-glass used", { kind: "break_glass", entity_type: "break_glass_event" }, "attention"],
    ["appointment booked", { kind: "info", entity_type: "appointment" }, "calm"],
    ["access granted", { kind: "success", entity_type: "access_request" }, "calm"],
    [
      "restraint observation overdue",
      { kind: "sla_breach", entity_type: "ipd_clinical_documentation" },
      "attention",
    ],
  ] as const)("%s → %s", (_label, event, expected) => {
    expect(alertSoundFor(event, "staff")).toBe(expected);
  });

  it("never rings for a board signal, which is a screen nudge rather than an inbox item", () => {
    expect(alertSoundFor({ kind: "danger", scope: "board" }, "staff")).toBe("none");
  });

  it("gives patient-facing surfaces calm only, even for a critical value", () => {
    for (const kind of ["danger", "error", "warning", "info", "anything"]) {
      expect(alertSoundFor({ kind, entity_type: "code_blue" }, "patient")).toBe("calm");
    }
  });
});

describe("createSoundThrottle", () => {
  it("lets one sound per category through per window", () => {
    const allow = createSoundThrottle();
    expect(allow("attention", 0)).toBe(true);
    expect(allow("attention", 1)).toBe(false);
    expect(allow("attention", ALERT_THROTTLE_MS - 1)).toBe(false);
    expect(allow("attention", ALERT_THROTTLE_MS)).toBe(true);
  });

  it("does not let a burst of one category silence another", () => {
    const allow = createSoundThrottle();
    expect(allow("attention", 0)).toBe(true);
    expect(allow("urgent", 1)).toBe(true);
    expect(allow("calm", 2)).toBe(true);
  });
});

describe("effectiveVolume", () => {
  it("keeps urgent at or above its floor", () => {
    expect(effectiveVolume("urgent", 0)).toBe(URGENT_VOLUME_FLOOR);
    expect(effectiveVolume("urgent", 0.9)).toBe(0.9);
  });

  it("clamps other sounds to 0–1", () => {
    expect(effectiveVolume("calm", 0)).toBe(0);
    expect(effectiveVolume("attention", 3)).toBe(1);
  });
});
