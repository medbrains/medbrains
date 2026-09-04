// @vitest-environment node

import type { ClinicalJourneyContext } from "@medbrains/types";
import {
  activeLabOrderIsCollectedForJourney,
  activePatientLabOrderIdForJourney,
  patientFlowMobileTarget,
  patientJourneyActionRoute,
  patientJourneyMobileActionTarget,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

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
      "/ipd/admissions/admission-1?order=drug#prescriptions",
    );
    expect(patientJourneyActionRoute("orders.lab", context)).toBe(
      "/ipd/admissions/admission-1?order=lab#investigations",
    );
    expect(patientJourneyActionRoute("orders.radiology", context)).toBe(
      "/ipd/admissions/admission-1?order=radiology#investigations",
    );
  });

  it("routes OPD order handoffs to the matching encounter tabs", () => {
    const context: ClinicalJourneyContext = {
      ...baseContext,
      activeEncounterId: "encounter-1",
      activeOrderContext: "opd",
    };

    expect(patientJourneyActionRoute("orders.medication", context)).toBe(
      "/opd/encounters/encounter-1?order=drug#prescriptions",
    );
    expect(patientJourneyActionRoute("orders.lab", context)).toBe(
      "/opd/encounters/encounter-1?order=lab#investigations",
    );
    expect(patientJourneyActionRoute("orders.radiology", context)).toBe(
      "/opd/encounters/encounter-1?order=radiology#investigations",
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

  it("does not route MLC documentation without an active emergency visit", () => {
    expect(patientJourneyActionRoute("emergency.open_mlc", baseContext)).toBeNull();
  });

  it("routes camp context through active camp and registration state", () => {
    expect(
      patientJourneyActionRoute("camp.open_context", {
        ...baseContext,
        activeCampId: "camp-1",
        activeCampRegistrationId: "registration-1",
      }),
    ).toBe(
      "/camp/camp-1/work/registrations/registration-1/clinical-route?patient_id=patient-1#screenings",
    );
    expect(
      patientJourneyActionRoute("camp.open_context", {
        ...baseContext,
        activeCampId: "camp-1",
      }),
    ).toBe("/camp/camp-1/work?patient_id=patient-1#registrations");
    expect(patientJourneyActionRoute("camp.open_context", baseContext)).toBe(
      "/camp?patient_id=patient-1#camps",
    );
  });

  it("routes payment collection to the active invoice when available", () => {
    expect(
      patientJourneyActionRoute("billing.open_ledger", {
        ...baseContext,
        activeInvoiceId: "invoice-1",
      }),
    ).toBe("/billing/invoices/invoice-1");
    expect(
      patientJourneyActionRoute("billing.collect_payment", {
        ...baseContext,
        activeInvoiceId: "invoice-1",
      }),
    ).toBe("/billing/invoices/invoice-1?action=payment");
    expect(patientJourneyActionRoute("billing.collect_payment", baseContext)).toBe(
      "/billing?tab=invoices&patient_id=patient-1&action=payment",
    );
    expect(
      patientJourneyActionRoute("billing.open_ledger", {
        ...baseContext,
        activeEncounterId: "encounter-1",
      }),
    ).toBe("/billing?tab=invoices&patient_id=patient-1&encounter_id=encounter-1");
    expect(
      patientJourneyActionRoute("billing.collect_payment", {
        ...baseContext,
        activeEncounterId: "encounter-1",
      }),
    ).toBe("/billing?tab=invoices&patient_id=patient-1&encounter_id=encounter-1&action=payment");
    expect(
      patientJourneyActionRoute("billing.open_ledger", {
        ...baseContext,
        activeAdmissionId: "admission-1",
      }),
    ).toBe("/billing?tab=invoices&patient_id=patient-1&admission_id=admission-1");
    expect(
      patientJourneyActionRoute("billing.collect_payment", {
        ...baseContext,
        activeAdmissionId: "admission-1",
      }),
    ).toBe("/billing?tab=invoices&patient_id=patient-1&admission_id=admission-1&action=payment");
  });

  it("routes IPD discharge billing through the active admission", () => {
    expect(
      patientJourneyActionRoute("billing.prepare_discharge_bill", {
        ...baseContext,
        activeAdmissionId: "admission-1",
      }),
    ).toBe(
      "/billing?tab=invoices&patient_id=patient-1&admission_id=admission-1&source=ipd_discharge",
    );
    expect(patientJourneyActionRoute("billing.prepare_discharge_bill", baseContext)).toBe(
      "/billing?tab=invoices&patient_id=patient-1&source=ipd_discharge",
    );
  });

  it("routes pharmacy handoffs to the active order when available", () => {
    expect(
      patientJourneyActionRoute("pharmacy.open_patient_queue", {
        ...baseContext,
        activePharmacyOrderId: "order-1",
      }),
    ).toBe("/pharmacy/orders/order-1");
    expect(
      patientJourneyActionRoute("pharmacy.dispense_order", {
        ...baseContext,
        activePharmacyOrderId: "order-1",
      }),
    ).toBe("/pharmacy/orders/order-1?action=dispense");
    expect(
      patientJourneyActionRoute("pharmacy.open_patient_queue", {
        ...baseContext,
        activePharmacyRxQueueId: "rx-queue-1",
      }),
    ).toBe("/pharmacy?tab=rx-queue&rx_queue_id=rx-queue-1&patient_id=patient-1");
    expect(patientJourneyActionRoute("pharmacy.open_patient_queue", baseContext)).toBe(
      "/pharmacy?tab=rx-queue&patient_id=patient-1",
    );
    expect(patientJourneyActionRoute("pharmacy.dispense_order", baseContext)).toBe(
      "/pharmacy?tab=orders&patient_id=patient-1&action=dispense",
    );
  });

  it("routes MRD case sheets through the active clinical source when available", () => {
    expect(
      patientJourneyActionRoute("mrd.open_case_sheet", {
        ...baseContext,
        activeAdmissionId: "admission-1",
      }),
    ).toBe("/mrd?packet_type=ipd&admission_id=admission-1#case-sheets");
    expect(
      patientJourneyActionRoute("mrd.open_case_sheet", {
        ...baseContext,
        activeEncounterId: "encounter-1",
      }),
    ).toBe("/mrd?packet_type=opd&encounter_id=encounter-1#case-sheets");
  });

  it("falls back to a patient-filtered MRD case-sheet list", () => {
    expect(patientJourneyActionRoute("mrd.open_case_sheet", baseContext)).toBe(
      "/mrd?patient_id=patient-1#case-sheets",
    );
  });

  it("resolves mobile action handoffs from the same patient journey context", () => {
    const context: ClinicalJourneyContext = {
      ...baseContext,
      activeAdmissionId: "admission-1",
      activeEncounterId: "encounter-1",
      activeInvoiceId: "invoice-1",
      activeOrderContext: "ipd",
      activePharmacyOrderId: "pharmacy-order-1",
    };

    expect(patientJourneyMobileActionTarget("billing.collect_payment", context)).toEqual({
      screen: "Payment",
      params: { invoiceId: "invoice-1" },
    });
    expect(patientJourneyMobileActionTarget("orders.medication", context)).toEqual({
      screen: "Prescription",
      params: {
        admissionId: "admission-1",
        encounterId: "encounter-1",
        orderContext: "ipd",
        patientId: "patient-1",
      },
    });
    expect(patientJourneyMobileActionTarget("pharmacy.dispense_order", context)).toEqual({
      screen: "PatientPharmacy",
      params: {
        handoff: "dispense",
        patientId: "patient-1",
        pharmacyOrderId: "pharmacy-order-1",
        pharmacyRxQueueId: undefined,
      },
    });
  });

  it("resolves mobile flow rail targets for care, pharmacy and billing modules", () => {
    const context: ClinicalJourneyContext = {
      ...baseContext,
      activeAdmissionId: "admission-1",
      activeCampId: "camp-1",
      activeCampRegistrationId: "registration-1",
      activeEmergencyVisitId: "er-1",
      activeInvoiceId: "invoice-1",
      activePharmacyRxQueueId: "rx-queue-1",
    };

    expect(patientFlowMobileTarget("ipd", context)).toEqual({
      screen: "PatientCareContext",
      params: {
        admissionId: "admission-1",
        campId: undefined,
        campRegistrationId: undefined,
        erVisitId: undefined,
        handoff: "open_admission",
        module: "ipd",
        patientId: "patient-1",
      },
    });
    expect(patientFlowMobileTarget("emergency", context)).toEqual({
      screen: "PatientCareContext",
      params: {
        admissionId: undefined,
        campId: undefined,
        campRegistrationId: undefined,
        erVisitId: "er-1",
        handoff: "open_visit",
        module: "emergency",
        patientId: "patient-1",
      },
    });
    expect(patientFlowMobileTarget("camp", context)).toEqual({
      screen: "PatientCareContext",
      params: {
        admissionId: undefined,
        campId: "camp-1",
        campRegistrationId: "registration-1",
        erVisitId: undefined,
        handoff: "open_context",
        module: "camp",
        patientId: "patient-1",
      },
    });
    expect(patientFlowMobileTarget("pharmacy", context)).toEqual({
      screen: "PatientPharmacy",
      params: {
        handoff: "queue",
        patientId: "patient-1",
        pharmacyOrderId: undefined,
        pharmacyRxQueueId: "rx-queue-1",
      },
    });
    expect(patientFlowMobileTarget("billing", context)).toEqual({
      screen: "BillDetail",
      params: { invoiceId: "invoice-1" },
    });
  });
});

describe("lab journey actions", () => {
  const base = { patientId: "patient-1" };

  it("opens the lab order record rather than the tenant-wide worklist", () => {
    expect(
      patientJourneyActionRoute("lab.open_order", { ...base, activeLabOrderId: "order-9" }),
    ).toBe("/lab/orders/order-9");
  });

  it("carries the record-result action so the panel is open on arrival", () => {
    // The convention pharmacy already set with ?action=dispense. Without it a
    // clinician sent to enter a result lands on a page and must find the
    // control they were sent there to use.
    expect(
      patientJourneyActionRoute("lab.record_result", { ...base, activeLabOrderId: "order-9" }),
    ).toBe("/lab/orders/order-9?action=record_result");
  });

  it("offers nothing when the chart has no lab order, rather than a broken link", () => {
    expect(patientJourneyActionRoute("lab.open_order", base)).toBeNull();
    expect(patientJourneyActionRoute("lab.record_result", base)).toBeNull();
  });
});

describe("which lab order the chart considers active", () => {
  const order = (id: string, collected: string | null, verified: string | null) =>
    ({ id, collected_at: collected, verified_at: verified }) as never;

  it("prefers the one waiting on somebody — drawn but not verified", () => {
    expect(
      activePatientLabOrderIdForJourney([
        order("verified", "2026-09-01", "2026-09-02"),
        order("drawn", "2026-09-03", null),
        order("ordered", null, null),
      ]),
    ).toBe("drawn");
  });

  it("does not claim a sample was drawn because some other order had one", () => {
    // A verified order from last week plus an uncollected one from this
    // morning. Offering "record result" here would file a result against an
    // order that has no sample.
    expect(
      activeLabOrderIsCollectedForJourney([
        order("last-week", "2026-09-01", "2026-09-02"),
        order("this-morning", null, null),
      ]),
    ).toBe(false);
  });

  it("reports collected when the active order is the drawn one", () => {
    expect(activeLabOrderIsCollectedForJourney([order("drawn", "2026-09-03", null)])).toBe(true);
  });
});

describe("consent verification handoff", () => {
  it("names the patient so the verification tab does not ask for the UUID again", () => {
    expect(patientJourneyActionRoute("consent.verify", { patientId: "patient-7" })).toBe(
      "/consent?tab=verification&patient_id=patient-7",
    );
  });

  it("addresses the verification tab, not whichever tab the page opens on", () => {
    // /consent defaults to Templates. A route without tab= would send someone
    // sent to check a consent to the template editor instead.
    const route = patientJourneyActionRoute("consent.verify", { patientId: "patient-7" });
    expect(route).toContain("tab=verification");
  });
});
