// @vitest-environment node

import { type PrescriptionWithItems, patientJourneyActionRoute } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  activeOpdPharmacyOrderIdForJourney,
  isOpdEncounterTabValue,
  opdEncounterOrderBasketRoute,
  opdEncounterTabForOrderBasket,
  opdEncounterWorkspaceTabRoute,
  opdOrderBasketTabFromSearchParams,
} from "./opd-workspace";

function prescriptionWithItems(
  id: string,
  itemStatus = "active",
  pharmacyOrderId: string | null = null,
): PrescriptionWithItems {
  return {
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

describe("OPD encounter workspace routing", () => {
  it("routes local order basket actions to the matching encounter tabs", () => {
    expect(opdEncounterTabForOrderBasket("drug")).toBe("prescriptions");
    expect(opdEncounterTabForOrderBasket("lab")).toBe("investigations");
    expect(opdEncounterTabForOrderBasket("radiology")).toBe("investigations");
  });

  it("keeps OPD order basket activation route-addressable", () => {
    expect(opdEncounterOrderBasketRoute("encounter-1", "drug")).toBe(
      "/opd/encounters/encounter-1?order=drug#prescriptions",
    );
    expect(opdEncounterOrderBasketRoute("encounter-1", "lab")).toBe(
      "/opd/encounters/encounter-1?order=lab#investigations",
    );
    expect(opdEncounterWorkspaceTabRoute("encounter-1", "consultation")).toBe(
      "/opd/encounters/encounter-1#consultation",
    );
  });

  it("parses only supported order basket tabs from OPD routes", () => {
    expect(opdOrderBasketTabFromSearchParams(new URLSearchParams("order=drug"))).toBe("drug");
    expect(opdOrderBasketTabFromSearchParams(new URLSearchParams("order=radiology"))).toBe(
      "radiology",
    );
    expect(opdOrderBasketTabFromSearchParams(new URLSearchParams("order=notes"))).toBeNull();
    expect(opdOrderBasketTabFromSearchParams(new URLSearchParams("tab=lab"))).toBeNull();
  });

  it("guards supported OPD encounter tab hashes", () => {
    expect(isOpdEncounterTabValue("consultation")).toBe(true);
    expect(isOpdEncounterTabValue("pharmacy-dispatch")).toBe(true);
    expect(isOpdEncounterTabValue("unknown")).toBe(false);
    expect(isOpdEncounterTabValue(null)).toBe(false);
  });

  it("routes OPD pharmacy handoffs only when a real pharmacy order exists", () => {
    expect(
      activeOpdPharmacyOrderIdForJourney([
        prescriptionWithItems("old-rx", "discontinued", "order-old"),
        prescriptionWithItems("active-rx", "active", "order-active"),
      ]),
    ).toBe("order-active");
    expect(activeOpdPharmacyOrderIdForJourney([prescriptionWithItems("pending-rx")])).toBeNull();

    expect(
      patientJourneyActionRoute("pharmacy.open_patient_queue", {
        patientId: "patient-1",
        activeEncounterId: "encounter-1",
        activePharmacyOrderId: "order-active",
        completedEvents: ["order.created"],
      }),
    ).toBe("/pharmacy/orders/order-active");
  });
});
