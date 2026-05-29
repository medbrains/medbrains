// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { ClinicalEventTrace } from "@/components/clinical-events";
import { clinicalEventMatchesJourney, mergeJourneyEventNames } from "./patient-journey-events";

function trace(input: Partial<ClinicalEventTrace>): ClinicalEventTrace {
  return {
    admissionId: null,
    contextCode: "test",
    encounterId: null,
    eventName: null,
    id: "event-1",
    missingPayloadKeys: [],
    occurredAt: "2026-05-29T00:00:00.000Z",
    patientId: null,
    payload: {},
    rawTrigger: "order.created",
    sourceModule: "opd",
    sourceRecordId: null,
    ...input,
  };
}

describe("patient journey event matching", () => {
  it("matches recent events by patient, admission, encounter, or ER source record", () => {
    const context = {
      patientId: "patient-1",
      activeAdmissionId: "admission-1",
      activeEncounterId: "encounter-1",
      activeEmergencyVisitId: "visit-1",
    };

    expect(clinicalEventMatchesJourney(trace({ patientId: "patient-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ admissionId: "admission-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ encounterId: "encounter-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ sourceRecordId: "visit-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ patientId: "patient-2" }), context)).toBe(false);
  });

  it("merges explicit context events with matching recent event names", () => {
    expect(
      mergeJourneyEventNames({ patientId: "patient-1", completedEvents: ["patient.created"] }, [
        trace({ eventName: "order.created", patientId: "patient-1" }),
        trace({ rawTrigger: "billing.invoice.created", patientId: "patient-1" }),
        trace({ eventName: "pharmacy.order.dispensed", patientId: "patient-2" }),
      ]),
    ).toEqual(["patient.created", "order.created", "billing.invoice.created"]);
  });
});
