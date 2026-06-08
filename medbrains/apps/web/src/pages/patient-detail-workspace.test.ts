// @vitest-environment node

import { type PrescriptionHistoryItem, patientJourneyActionRoute } from "@medbrains/types";
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
): PrescriptionHistoryItem {
  return {
    doctor_name: null,
    encounter_date: "2026-01-01",
    pharmacy_order_id: pharmacyOrderId,
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

  it("keeps pending prescription handoffs out of invalid pharmacy order detail routes", () => {
    const context = patientDetailJourneyContext({
      patientId: "patient-1",
      completedEvents: ["order.created"],
      prescriptions: [prescriptionHistory("pending-rx")],
    });

    expect(context.activePharmacyOrderId).toBeNull();
    expect(patientJourneyActionRoute("pharmacy.open_patient_queue", context)).toBe(
      "/pharmacy?tab=orders&patient_id=patient-1",
    );
  });
});
