// @vitest-environment node

import type { ClinicalJourneyContext } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { patientJourneyActionRoute } from "./patient-journey-routes";

const baseContext: ClinicalJourneyContext = {
  patientId: "patient-1",
};

describe("patient journey action routes", () => {
  it("routes IPD order handoffs to the matching admission workspace tabs", () => {
    const context: ClinicalJourneyContext = {
      ...baseContext,
      activeAdmissionId: "admission-1",
      activeAdmissionStatus: "admitted",
      activeBedId: "bed-1",
      activeOrderContext: "ipd",
    };

    expect(patientJourneyActionRoute("orders.medication", context)).toBe(
      "/ipd/admissions/admission-1#prescriptions",
    );
    expect(patientJourneyActionRoute("orders.lab", context)).toBe(
      "/ipd/admissions/admission-1#investigations",
    );
    expect(patientJourneyActionRoute("orders.radiology", context)).toBe(
      "/ipd/admissions/admission-1#investigations",
    );
  });

  it("routes OPD order handoffs to the matching encounter tabs", () => {
    const context: ClinicalJourneyContext = {
      ...baseContext,
      activeEncounterId: "encounter-1",
      activeOrderContext: "opd",
    };

    expect(patientJourneyActionRoute("orders.medication", context)).toBe(
      "/opd/encounters/encounter-1#prescriptions",
    );
    expect(patientJourneyActionRoute("orders.lab", context)).toBe(
      "/opd/encounters/encounter-1#investigations",
    );
  });

  it("routes active emergency MLC handoffs to the emergency visit workspace", () => {
    expect(
      patientJourneyActionRoute("emergency.open_mlc", {
        ...baseContext,
        activeEmergencyVisitId: "visit-1",
      }),
    ).toBe("/emergency/visits/visit-1#mlc");
  });

  it("falls back to filtered MLC list when no active emergency visit exists", () => {
    expect(patientJourneyActionRoute("emergency.open_mlc", baseContext)).toBe(
      "/emergency?tab=mlc&patient_id=patient-1",
    );
  });
});
