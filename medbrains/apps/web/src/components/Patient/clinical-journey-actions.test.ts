// @vitest-environment node

import {
  CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS,
  CORE_PATIENT_JOURNEY_ACTIONS,
  inferClinicalJourneyEventNames,
  resolveClinicalJourneyActions,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

const allowAll = () => true;

describe("clinical journey event activation", () => {
  it("declares only canonical emitted clinical events", () => {
    const canonicalEvents = new Set(Object.keys(CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS));

    expect(
      CORE_PATIENT_JOURNEY_ACTIONS.filter(
        (action) => action.emitsEvent && !canonicalEvents.has(action.emitsEvent),
      ),
    ).toEqual([]);
  });

  it("infers completed events from active patient, OPD, IPD, and ER context", () => {
    expect(
      inferClinicalJourneyEventNames({
        patientId: "patient-1",
        activeEncounterId: "encounter-1",
        activeAdmissionId: "admission-1",
        activeEmergencyVisitId: "visit-1",
      }),
    ).toEqual([
      "patient.created",
      "opd.encounter.created",
      "bed.assigned",
      "emergency.visit.created",
    ]);
  });

  it("keeps downstream actions disabled until their activating event exists", () => {
    const actions = resolveClinicalJourneyActions({ patientId: "patient-1" }, allowAll, "web");

    expect(actions.find((action) => action.id === "billing.open_ledger")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "billing.collect_payment")?.enabled).toBe(false);
    expect(actions.find((action) => action.id === "emergency.open_mlc")?.enabled).toBe(false);
    expect(actions.find((action) => action.id === "mrd.open_case_sheet")?.enabled).toBe(false);
    expect(actions.find((action) => action.id === "pharmacy.open_patient_queue")?.enabled).toBe(
      false,
    );
    expect(
      actions.find((action) => action.id === "pharmacy.open_patient_queue")?.disabledReasonText,
    ).toContain("order created");
  });

  it("enables clinical and fulfillment actions when the care event chain is present", () => {
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        activeEncounterId: "encounter-1",
        activeOrderContext: "opd",
        completedEvents: ["order.created"],
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "orders.medication")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "pharmacy.dispense_order")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "pharmacy.open_patient_queue")?.enabled).toBe(
      true,
    );
  });

  it("enables emergency, discharge, billing, payment, and MRD handoffs from canonical events", () => {
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        activeEmergencyVisitId: "visit-1",
        completedEvents: [
          "ipd.discharge.finalized",
          "billing.invoice.finalized",
          "billing.payment.received",
          "mrd.case_sheet.generated",
        ],
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "emergency.open_mlc")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "billing.prepare_discharge_bill")?.enabled).toBe(
      true,
    );
    expect(actions.find((action) => action.id === "billing.collect_payment")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "pharmacy.dispense_order")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "mrd.open_case_sheet")?.enabled).toBe(true);
  });
});
