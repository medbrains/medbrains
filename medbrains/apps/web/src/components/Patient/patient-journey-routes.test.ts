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

  it("falls back to filtered MLC list when no active emergency visit exists", () => {
    expect(patientJourneyActionRoute("emergency.open_mlc", baseContext)).toBe(
      "/emergency?tab=mlc&patient_id=patient-1",
    );
  });

  it("routes camp context through active camp and registration state", () => {
    expect(
      patientJourneyActionRoute("camp.open_context", {
        ...baseContext,
        activeCampId: "camp-1",
        activeCampRegistrationId: "registration-1",
      }),
    ).toBe("/camp/camp-1/work/registrations/registration-1/clinical-route?patient_id=patient-1");
    expect(
      patientJourneyActionRoute("camp.open_context", {
        ...baseContext,
        activeCampId: "camp-1",
      }),
    ).toBe("/camp/camp-1/work?patient_id=patient-1");
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
});
