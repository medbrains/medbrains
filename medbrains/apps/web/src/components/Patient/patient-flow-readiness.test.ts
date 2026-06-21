// @vitest-environment node

import {
  activePatientPharmacyOrderIdForJourney,
  activePatientPharmacyRxQueueIdForJourney,
  buildPatientFlowReadiness,
  hasReviewedPatientPharmacyPrescriptionForJourney,
  P,
  type PatientFlowModule,
  type PatientFlowReadiness,
  type PrescriptionHistoryItem,
  patientFlowJourneyContext,
  patientFlowReadinessSignal,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

const allowAll = () => true;
const allowPermissions = (permissions: readonly string[]) => {
  const allowed = new Set(permissions);
  return (permission: string) => allowed.has(permission);
};

function prescriptionHistory(
  id: string,
  itemStatus = "active",
  pharmacyOrderId: string | null = null,
  pharmacyRxQueueId: string | null = null,
  pharmacyStatus: PrescriptionHistoryItem["pharmacy_status"] = null,
): PrescriptionHistoryItem {
  return {
    doctor_name: null,
    encounter_date: "2026-01-01",
    pharmacy_order_id: pharmacyOrderId,
    pharmacy_rx_queue_id: pharmacyRxQueueId,
    pharmacy_status: pharmacyStatus ?? (pharmacyOrderId ? "dispensing" : "pending_review"),
    items: [
      {
        catalog_item_id: null,
        created_at: "2026-01-01T00:00:00.000Z",
        discontinued_at: null,
        discontinued_by: null,
        discontinue_reason: null,
        dosage: "1 tab",
        drug_name: "Paracetamol",
        duration: "3 days",
        frequency: "BD",
        id: `${id}-item`,
        instructions: null,
        item_status: itemStatus,
        prescription_id: id,
        route: "oral",
        tenant_id: "tenant-1",
      },
    ],
    prescription: {
      created_at: "2026-01-01T00:00:00.000Z",
      doctor_id: "doctor-1",
      encounter_id: "encounter-1",
      id,
      notes: null,
      order_mode: "written",
      transcribed_by: null,
      read_back_confirmed: false,
      countersign_due_at: null,
      is_signed: false,
      tenant_id: "tenant-1",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

function flowItem(readiness: PatientFlowReadiness, module: PatientFlowModule) {
  const item = readiness.items.find((candidate) => candidate.id === module);
  if (!item) {
    throw new Error(`Missing patient flow module: ${module}`);
  }
  return item;
}

describe("patient flow readiness", () => {
  it("selects the active prescription target for pharmacy handoffs", () => {
    expect(
      activePatientPharmacyOrderIdForJourney([
        prescriptionHistory("old-stopped", "discontinued", "order-old"),
        prescriptionHistory("active-rx", "active", "order-active"),
      ]),
    ).toBe("order-active");
    expect(
      activePatientPharmacyOrderIdForJourney([
        prescriptionHistory("stopped", "discontinued", "order-stopped"),
      ]),
    ).toBe("order-stopped");
    expect(activePatientPharmacyOrderIdForJourney([prescriptionHistory("pending-rx")])).toBeNull();
    expect(activePatientPharmacyOrderIdForJourney([])).toBeNull();
    expect(
      activePatientPharmacyRxQueueIdForJourney([
        prescriptionHistory("old-stopped", "discontinued", null, "rx-queue-old"),
        prescriptionHistory("active-rx", "active", null, "rx-queue-active"),
      ]),
    ).toBe("rx-queue-active");
    expect(
      activePatientPharmacyRxQueueIdForJourney([
        prescriptionHistory("ordered-rx", "active", "order-active", "rx-queue-active"),
      ]),
    ).toBeNull();
    expect(
      hasReviewedPatientPharmacyPrescriptionForJourney([
        prescriptionHistory("pending-rx", "active", null, "rx-queue-active", "pending_review"),
      ]),
    ).toBe(false);
    expect(
      hasReviewedPatientPharmacyPrescriptionForJourney([
        prescriptionHistory("approved-rx", "active", null, "rx-queue-active", "approved"),
      ]),
    ).toBe(true);
    expect(
      hasReviewedPatientPharmacyPrescriptionForJourney([
        prescriptionHistory("ordered-rx", "active", "order-active", "rx-queue-active"),
      ]),
    ).toBe(true);
  });

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
    expect(readiness.items.find((item) => item.id === "patient")).toMatchObject({
      descriptionKey: "patientJourney.flow.modules.patient.description",
      labelKey: "patientJourney.flow.modules.patient.label",
    });
    expect(readiness.summary).toMatchObject({
      blocked: 1,
      blockedModules: ["pharmacy"],
      eventBlocked: 1,
      eventBlockedModules: ["pharmacy"],
      enabled: 6,
      permissionBlocked: 0,
      readyModules: ["patient", "opd", "ipd", "emergency", "camp", "billing"],
      total: 7,
    });
    expect(readiness.items.find((item) => item.id === "pharmacy")).toMatchObject({
      blockedReason: "event",
      disabledReasonKey: "patientJourney.blockers.availableAfterEvents",
      disabledReason:
        "Available after order created or pharmacy prescription reviewed or pharmacy order dispensed",
      labelKey: "patientJourney.flow.modules.pharmacy.label",
    });
    expect(patientFlowReadinessSignal(flowItem(readiness, "patient"))).toMatchObject({
      phase: "ready",
      shape: "pill",
      tone: "ready",
    });
    expect(patientFlowReadinessSignal(flowItem(readiness, "pharmacy"))).toMatchObject({
      phase: "waiting_for_event",
      shape: "token",
      tone: "active",
    });
  });

  it("keeps permission-denied modules visible with reasons", () => {
    const readiness = buildPatientFlowReadiness(
      patientFlowJourneyContext({ patientId: "patient-1" }),
      allowPermissions([]),
    );

    expect(readiness.summary).toMatchObject({
      blocked: 7,
      contextBlocked: 0,
      enabled: 0,
      permissionBlocked: 7,
      permissionBlockedModules: [
        "patient",
        "opd",
        "ipd",
        "emergency",
        "camp",
        "pharmacy",
        "billing",
      ],
      total: 7,
    });
    expect(readiness.items.find((item) => item.id === "patient")).toMatchObject({
      blockedReason: "permission",
      disabledReason: "Permission required",
      disabledReasonKey: "patientJourney.blockers.permissionRequired",
    });
    expect(patientFlowReadinessSignal(flowItem(readiness, "patient"))).toMatchObject({
      emphasis: "high",
      phase: "blocked_by_permission",
      shape: "diamond",
      tone: "risk",
    });
    expect(readiness.items.find((item) => item.id === "camp")).toMatchObject({
      disabledReason:
        "Requires one of camp.list / camp.registrations.list / camp.registrations.create",
      disabledReasonKey: "patientJourney.blockers.requiresOneOfPermissions",
    });
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

  it("routes pending medication work to the pharmacy review queue before an order exists", () => {
    const readiness = buildPatientFlowReadiness(
      patientFlowJourneyContext({
        patientId: "patient-1",
        activePharmacyRxQueueId: "rx-queue-1",
      }),
      allowAll,
    );

    expect(readiness.items.find((item) => item.id === "pharmacy")).toMatchObject({
      enabled: true,
      href: "/pharmacy?tab=rx-queue&rx_queue_id=rx-queue-1&patient_id=patient-1",
    });
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
      href: "/pharmacy?tab=rx-queue&patient_id=patient-1",
    });
    expect(readiness.items.find((item) => item.id === "opd")?.disabledReason).toBe(
      "Requires opd.visit.create",
    );
  });

  it("classifies patient-state blockers separately from permission and event blockers", () => {
    const readiness = buildPatientFlowReadiness(
      patientFlowJourneyContext({
        patientId: "patient-1",
        completedEvents: ["order.created"],
        isDeceased: true,
      }),
      allowAll,
    );

    expect(readiness.summary).toMatchObject({
      contextBlocked: 4,
      contextBlockedModules: ["opd", "ipd", "emergency", "camp"],
      eventBlocked: 0,
      eventBlockedModules: [],
      permissionBlocked: 0,
    });
    expect(readiness.items.find((item) => item.id === "opd")).toMatchObject({
      blockedReason: "context",
      disabledReason: "Unavailable for deceased patient records",
    });
    expect(patientFlowReadinessSignal(flowItem(readiness, "opd"))).toMatchObject({
      phase: "blocked_by_context",
      shape: "diamond",
      tone: "blocked",
    });
  });
});
