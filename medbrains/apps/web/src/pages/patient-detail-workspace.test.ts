// @vitest-environment node

import {
  buildPatientFlowReadiness,
  type ClinicalJourneyContext,
  type PrescriptionHistoryItem,
  patientJourneyActionRoute,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  isPatientDetailTabValue,
  patientDetailJourneyContext,
  patientDetailOrderBasketRoute,
  patientDetailOrderBasketTabFromSearchParams,
  patientDetailTabForOrderBasket,
  patientDetailWorkspaceTabRoute,
} from "./patient-detail-workspace";

function prescriptionHistory(
  id: string,
  itemStatus = "active",
  pharmacyOrderId: string | null = null,
  pharmacyRxQueueId: string | null = null,
): PrescriptionHistoryItem {
  return {
    doctor_name: null,
    encounter_date: "2026-01-01",
    pharmacy_order_id: pharmacyOrderId,
    pharmacy_rx_queue_id: pharmacyRxQueueId,
    pharmacy_status: pharmacyOrderId ? "dispensing" : "pending_review",
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

describe("patient-detail workspace routing", () => {
  it("routes local order basket actions to the matching patient tabs", () => {
    expect(patientDetailTabForOrderBasket("drug")).toBe("prescriptions");
    expect(patientDetailTabForOrderBasket("lab")).toBe("lab");
    expect(patientDetailTabForOrderBasket("radiology")).toBe("imaging");
  });

  it("keeps patient order basket activation route-addressable", () => {
    expect(patientDetailOrderBasketRoute("patient-1", "drug")).toBe(
      "/patients/patient-1?order=drug#prescriptions",
    );
    expect(patientDetailOrderBasketRoute("patient-1", "lab")).toBe(
      "/patients/patient-1?order=lab#lab",
    );
    expect(patientDetailOrderBasketRoute("patient-1", "radiology")).toBe(
      "/patients/patient-1?order=radiology#imaging",
    );
    expect(patientDetailWorkspaceTabRoute("patient-1", "billing")).toBe(
      "/patients/patient-1#billing",
    );
  });

  it("parses only supported order basket tabs from patient routes", () => {
    expect(patientDetailOrderBasketTabFromSearchParams(new URLSearchParams("order=drug"))).toBe(
      "drug",
    );
    expect(
      patientDetailOrderBasketTabFromSearchParams(new URLSearchParams("order=radiology")),
    ).toBe("radiology");
    expect(patientDetailOrderBasketTabFromSearchParams(new URLSearchParams("order=notes"))).toBe(
      null,
    );
    expect(patientDetailOrderBasketTabFromSearchParams(new URLSearchParams("tab=lab"))).toBe(null);
  });

  it("guards supported patient workspace tab hashes", () => {
    expect(isPatientDetailTabValue("overview")).toBe(true);
    expect(isPatientDetailTabValue("billing")).toBe(true);
    expect(isPatientDetailTabValue("unknown")).toBe(false);
    expect(isPatientDetailTabValue(null)).toBe(false);
  });

  it("routes patient-detail pharmacy handoffs to the active order instead of the generic queue", () => {
    const context = patientDetailJourneyContext({
      patientId: "patient-1",
      completedEvents: ["order.created"],
      prescriptions: [
        prescriptionHistory("old-stopped", "discontinued", "order-old"),
        prescriptionHistory("active-rx", "active", "order-active"),
      ],
    });

    expect(context.activePharmacyOrderId).toBe("order-active");
    expect(patientJourneyActionRoute("pharmacy.open_patient_queue", context)).toBe(
      "/pharmacy/orders/order-active",
    );
    expect(patientJourneyActionRoute("pharmacy.dispense_order", context)).toBe(
      "/pharmacy/orders/order-active?action=dispense",
    );
  });

  it("routes pending prescription handoffs to the pharmacy Rx review queue", () => {
    const context = patientDetailJourneyContext({
      patientId: "patient-1",
      completedEvents: ["order.created"],
      prescriptions: [prescriptionHistory("pending-rx", "active", null, "rx-queue-1")],
    });

    expect(context.activePharmacyOrderId).toBeNull();
    expect(context.activePharmacyRxQueueId).toBe("rx-queue-1");
    expect(patientJourneyActionRoute("pharmacy.open_patient_queue", context)).toBe(
      "/pharmacy?tab=rx-queue&rx_queue_id=rx-queue-1&patient_id=patient-1",
    );
  });
});

describe("patient flow bar for orders raised outside an encounter", () => {
  // No encounter, no admission, no prescription: the patient walked up to the
  // lab, radiology and pharmacy desks directly. Each desk must still show up.
  const walkInContext = () =>
    patientDetailJourneyContext({
      patientId: "patient-1",
      prescriptions: [],
      labOrders: [
        { id: "lab-cancelled", status: "cancelled", collected_at: null, verified_at: null },
        { id: "lab-walk-in", status: "ordered", collected_at: null, verified_at: null },
      ] as never,
      radiologyReports: [],
      radiologyOrders: [
        { id: "rad-cancelled", status: "cancelled" },
        { id: "rad-walk-in", status: "scheduled" },
      ],
      pharmacyOrders: [
        { id: "ph-cancelled", status: "cancelled" },
        { id: "ph-counter-sale", status: "ordered" },
      ],
    });
  const flowItem = (context: ClinicalJourneyContext, id: string) =>
    buildPatientFlowReadiness(context, () => true).items.find((item) => item.id === id);

  it("links lab to the walk-in lab order, skipping the cancelled one", () => {
    const context = walkInContext();
    expect(context.activeLabOrderId).toBe("lab-walk-in");
    expect(flowItem(context, "lab")).toMatchObject({
      enabled: true,
      href: "/lab/orders/lab-walk-in",
    });
  });

  it("links radiology to an order that has no report yet", () => {
    const context = walkInContext();
    expect(context.activeRadiologyOrderId).toBe("rad-walk-in");
    expect(flowItem(context, "radiology")).toMatchObject({
      enabled: true,
      href: "/radiology?tab=orders&order_id=rad-walk-in",
    });
  });

  it("lights pharmacy for a direct counter sale with no prescription", () => {
    const context = walkInContext();
    expect(context.activePharmacyOrderId).toBe("ph-counter-sale");
    expect(flowItem(context, "pharmacy")).toMatchObject({
      enabled: true,
      href: "/pharmacy/orders/ph-counter-sale",
    });
  });

  it("says so plainly when the patient has only cancelled orders", () => {
    const context = patientDetailJourneyContext({
      patientId: "patient-1",
      prescriptions: [],
      labOrders: [
        { id: "lab-cancelled", status: "cancelled", collected_at: null, verified_at: null },
      ] as never,
      radiologyOrders: [{ id: "rad-cancelled", status: "cancelled" }],
    });
    expect(flowItem(context, "lab")).toMatchObject({
      enabled: false,
      blockedReason: "context",
      disabledReasonKey: "patientJourney.blockers.noLabOrder",
      href: "/patients/patient-1#lab",
    });
    expect(flowItem(context, "radiology")).toMatchObject({
      enabled: false,
      blockedReason: "context",
      disabledReasonKey: "patientJourney.blockers.noRadiologyOrder",
      href: "/patients/patient-1#imaging",
    });
  });
});
