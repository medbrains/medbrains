// @vitest-environment node

import type { CampRegistration } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import type { ClinicalEventTrace } from "@/components/clinical-events";
import {
  clinicalEventMatchesJourney,
  deriveCampJourneyCompletedEvents,
  mergeJourneyEventNames,
} from "./patient-journey-events";

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
  it("matches recent events by patient, admission, encounter, ER, or camp context", () => {
    const context = {
      patientId: "patient-1",
      activeAdmissionId: "admission-1",
      activeEncounterId: "encounter-1",
      activeEmergencyVisitId: "visit-1",
      activeCampId: "camp-1",
      activeCampRegistrationId: "registration-1",
    };

    expect(clinicalEventMatchesJourney(trace({ patientId: "patient-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ admissionId: "admission-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ encounterId: "encounter-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ sourceRecordId: "visit-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ sourceRecordId: "camp-1" }), context)).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ sourceRecordId: "registration-1" }), context)).toBe(
      true,
    );
    expect(clinicalEventMatchesJourney(trace({ payload: { camp_id: "camp-1" } }), context)).toBe(
      true,
    );
    expect(
      clinicalEventMatchesJourney(
        trace({ payload: { camp_registration_id: "registration-1" } }),
        context,
      ),
    ).toBe(true);
    expect(
      clinicalEventMatchesJourney(
        trace({ payload: { registration_id: "registration-1" } }),
        context,
      ),
    ).toBe(true);
    expect(clinicalEventMatchesJourney(trace({ patientId: "patient-2" }), context)).toBe(false);
  });

  it("merges explicit context events with matching recent event names", () => {
    expect(
      mergeJourneyEventNames(
        {
          patientId: "patient-1",
          activeCampId: "camp-1",
          completedEvents: ["patient.created"],
        },
        [
          trace({ eventName: "order.created", patientId: "patient-1" }),
          trace({ eventName: "billing.invoice.created", patientId: "patient-1" }),
          trace({ eventName: "camp.started", patientId: null, sourceRecordId: "camp-1" }),
          trace({ eventName: "pharmacy.order.dispensed", patientId: "patient-2" }),
          trace({ rawTrigger: "legacy.unmapped", patientId: "patient-1" }),
        ],
      ),
    ).toEqual(["patient.created", "order.created", "billing.invoice.created", "camp.started"]);
  });

  it("derives camp registration and screening events from patient camp history", () => {
    const registration = {
      id: "registration-1",
      tenant_id: "tenant-1",
      camp_id: "camp-1",
      registration_number: "CAMP-1",
      person_name: "Masked Patient",
      age: null,
      gender: null,
      phone: null,
      address: null,
      id_proof_type: null,
      id_proof_number: null,
      patient_id: "patient-1",
      clinical_department_id: null,
      attending_doctor_id: null,
      service_line: null,
      status: "screened",
      chief_complaint: null,
      is_walk_in: true,
      registered_by: null,
      created_at: "2026-05-29T00:00:00.000Z",
      updated_at: "2026-05-29T00:00:00.000Z",
    } satisfies CampRegistration;

    expect(deriveCampJourneyCompletedEvents([registration])).toEqual([
      "camp.registration.created",
      "camp.screening.completed",
    ]);
  });
});
