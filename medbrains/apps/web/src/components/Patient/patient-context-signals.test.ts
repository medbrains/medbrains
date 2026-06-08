// @vitest-environment node

import { patientContextSignal } from "@medbrains/types";
import { describe, expect, it } from "vitest";

describe("patient context operational signals", () => {
  it("marks safety blockers as critical diamond signals", () => {
    expect(patientContextSignal("deceased")).toEqual({
      severity: "critical",
      shape: "diamond",
      tone: "risk",
    });
    expect(patientContextSignal("drug_allergy")).toEqual({
      severity: "critical",
      shape: "diamond",
      tone: "risk",
    });
    expect(patientContextSignal("medico_legal")).toEqual({
      severity: "critical",
      shape: "diamond",
      tone: "risk",
    });
  });

  it("distinguishes consent and vitals warnings from positive context", () => {
    expect(patientContextSignal("consent_pending")).toEqual({
      severity: "warning",
      shape: "diamond",
      tone: "blocked",
    });
    expect(patientContextSignal("vitals_missing")).toEqual({
      severity: "warning",
      shape: "token",
      tone: "blocked",
    });
    expect(patientContextSignal("no_known_allergies")).toEqual({
      severity: "info",
      shape: "pill",
      tone: "ready",
    });
  });
});
