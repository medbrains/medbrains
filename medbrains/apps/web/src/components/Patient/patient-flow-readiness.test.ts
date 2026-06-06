// @vitest-environment node

import { P } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { buildPatientFlowReadiness, patientFlowJourneyContext } from "./patient-flow-readiness";

const allowAll = () => true;
const allowPermissions = (permissions: readonly string[]) => {
  const allowed = new Set(permissions);
  return (permission: string) => allowed.has(permission);
};

describe("patient flow readiness", () => {
  it("summarizes the core module handoffs from a registered patient", () => {
    const readiness = buildPatientFlowReadiness(
      patientFlowJourneyContext({ patientId: "patient-1" }),
      allowAll,
    );

    expect(readiness.items.map((item) => item.id)).toEqual([
      "patient",
      "opd",
      "ipd",
      "emergency",
      "camp",
      "pharmacy",
      "billing",
    ]);
    expect(readiness.summary).toMatchObject({
      blocked: 1,
      blockedModules: ["pharmacy"],
      enabled: 6,
      readyModules: ["patient", "opd", "ipd", "emergency", "camp", "billing"],
      total: 7,
    });
    expect(readiness.items.find((item) => item.id === "pharmacy")?.disabledReason).toBe(
      "Available after order created or pharmacy order dispensed",
    );
  });

  it("keeps permission-denied modules visible with reasons", () => {
    const readiness = buildPatientFlowReadiness(
      patientFlowJourneyContext({ patientId: "patient-1" }),
      allowPermissions([]),
    );

    expect(readiness.summary).toMatchObject({
      blocked: 7,
      enabled: 0,
      total: 7,
    });
    expect(readiness.items.find((item) => item.id === "patient")?.disabledReason).toBe(
      "Permission required",
    );
    expect(readiness.items.find((item) => item.id === "camp")?.disabledReason).toBe(
      "Requires one of camp.list / camp.registrations.list / camp.registrations.create",
    );
  });

  it("routes active IPD, pharmacy and billing contexts without re-searching the patient", () => {
    const readiness = buildPatientFlowReadiness(
      patientFlowJourneyContext({
        patientId: "patient-1",
        activeAdmissionId: "admission-1",
        activeAdmissionStatus: "admitted",
        activeInvoiceId: "invoice-1",
        activePharmacyOrderId: "pharmacy-order-1",
        completedEvents: ["order.created"],
      }),
      allowAll,
    );

    expect(readiness.summary).toMatchObject({
      blocked: 0,
      enabled: 7,
      total: 7,
    });
    expect(readiness.items.find((item) => item.id === "ipd")).toMatchObject({
      actionId: "ipd.open_admission",
      href: "/ipd/admissions/admission-1#overview",
    });
    expect(readiness.items.find((item) => item.id === "pharmacy")?.href).toBe(
      "/pharmacy/orders/pharmacy-order-1",
    );
    expect(readiness.items.find((item) => item.id === "billing")?.href).toBe(
      "/billing/invoices/invoice-1",
    );
  });

  it("supports partial permissions while preserving workflow route hints", () => {
    const readiness = buildPatientFlowReadiness(
      patientFlowJourneyContext({
        patientId: "patient-1",
        completedEvents: ["order.created"],
      }),
      allowPermissions([P.PATIENTS.VIEW, P.PHARMACY.PRESCRIPTIONS_LIST, P.BILLING.INVOICES_LIST]),
    );

    expect(readiness.summary).toMatchObject({
      blocked: 4,
      enabled: 3,
      readyModules: ["patient", "pharmacy", "billing"],
      total: 7,
    });
    expect(readiness.items.find((item) => item.id === "pharmacy")).toMatchObject({
      enabled: true,
      href: "/pharmacy?tab=orders&patient_id=patient-1",
    });
    expect(readiness.items.find((item) => item.id === "opd")?.disabledReason).toBe(
      "Requires opd.visit.create",
    );
  });
});
