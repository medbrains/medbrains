// @vitest-environment node

import type { Invoice, PharmacyOrder, PrescriptionWithItems } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  activeIpdInvoiceIdForJourney,
  activeIpdPharmacyOrderIdForJourney,
  deriveIpdJourneyCompletedEvents,
  IPD_ACTION_RAIL_ACTIONS,
  type IpdActionRailContext,
  ipdActionRailAction,
  ipdActionRailSectionsForTab,
  ipdWorkspaceTabForOrderBasket,
  resolveIpdActionRailActions,
} from "./ipd-workspace";

const activeContext: IpdActionRailContext = {
  admissionHasAssignedBed: true,
  admissionIsActive: true,
  canCreateTransfer: true,
  canDischarge: true,
  canManageDeathRecords: true,
  canOrder: true,
};

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    billing_period_end: null,
    billing_period_start: null,
    cess_amount: "0",
    cgst_amount: "0",
    cloned_from_id: null,
    corporate_id: null,
    created_at: "2026-01-01T00:00:00Z",
    discount_amount: "0",
    encounter_id: null,
    id: "invoice-1",
    igst_amount: "0",
    invoice_number: "INV-1",
    is_er_deferred: false,
    is_interim: false,
    issued_at: null,
    notes: null,
    paid_amount: "0",
    patient_id: "patient-1",
    place_of_supply: null,
    sequence_number: null,
    sgst_amount: "0",
    status: "draft",
    subtotal: "100",
    tax_amount: "0",
    tenant_id: "tenant-1",
    total_amount: "100",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function pharmacyOrder(overrides: Partial<PharmacyOrder> = {}): PharmacyOrder {
  return {
    billing_package_id: null,
    created_at: "2026-01-01T00:00:00Z",
    discharge_summary_id: null,
    dispensed_at: null,
    dispensed_by: null,
    dispensing_type: "prescription",
    encounter_id: "encounter-1",
    id: "order-1",
    interaction_check_result: null,
    notes: null,
    ordered_by: "doctor-1",
    patient_id: "patient-1",
    prescription_id: null,
    status: "ordered",
    store_location_id: null,
    tenant_id: "tenant-1",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function prescriptionWithPharmacyOrder(pharmacyOrderId: string): PrescriptionWithItems {
  return {
    items: [],
    pharmacy_order_id: pharmacyOrderId,
    pharmacy_status: null,
    prescription: {
      created_at: "2026-01-01T00:00:00Z",
      doctor_id: "doctor-1",
      encounter_id: "encounter-1",
      id: "prescription-1",
      notes: null,
      tenant_id: "tenant-1",
      updated_at: "2026-01-01T00:00:00Z",
    },
  };
}

describe("IPD workspace action rail focus", () => {
  it("focuses order actions for medication and investigation tabs", () => {
    expect(ipdActionRailSectionsForTab("prescriptions")).toEqual(["orders", "handoffs"]);
    expect(ipdActionRailSectionsForTab("investigations")).toEqual(["orders", "handoffs"]);
  });

  it("focuses finance actions for billing and insurance tabs", () => {
    expect(ipdActionRailSectionsForTab("billing-tab")).toEqual(["finance", "handoffs"]);
    expect(ipdActionRailSectionsForTab("insurance-pa")).toEqual(["finance", "handoffs"]);
  });

  it("focuses discharge actions for discharge workflow tabs", () => {
    expect(ipdActionRailSectionsForTab("discharge-summary")).toEqual([
      "discharge",
      "admission",
      "handoffs",
    ]);
  });

  it("keeps handoffs visible for unknown or overview tabs", () => {
    expect(ipdActionRailSectionsForTab("overview")).toEqual(["handoffs", "admission"]);
    expect(ipdActionRailSectionsForTab("unknown")).toEqual(["handoffs", "admission"]);
  });

  it("routes local order basket actions to the matching workspace tabs", () => {
    expect(ipdWorkspaceTabForOrderBasket("drug")).toBe("prescriptions");
    expect(ipdWorkspaceTabForOrderBasket("lab")).toBe("investigations");
    expect(ipdWorkspaceTabForOrderBasket("radiology")).toBe("investigations");
  });

  it("describes action activation events and permission contracts", () => {
    expect(IPD_ACTION_RAIL_ACTIONS.map((action) => action.id)).toEqual([
      "order_medicines",
      "order_lab",
      "order_imaging",
      "refer_out",
      "dama_lama",
      "mark_death",
    ]);
    for (const action of IPD_ACTION_RAIL_ACTIONS) {
      expect(action.activatesAfter.length).toBeGreaterThan(0);
      expect(action.requiredPermissions.length).toBeGreaterThan(0);
    }
  });

  it("requires an active admission and assigned bed before inpatient orders", () => {
    const withoutBed = resolveIpdActionRailActions({
      ...activeContext,
      admissionHasAssignedBed: false,
    });
    const labOrder = ipdActionRailAction(withoutBed, "order_lab");
    expect(labOrder.enabled).toBe(false);
    expect(labOrder.disabledReasonText).toBe("Assign a bed before inpatient orders");

    const active = resolveIpdActionRailActions(activeContext);
    expect(ipdActionRailAction(active, "order_lab").enabled).toBe(true);
  });

  it("keeps admission actions explainably disabled after discharge or permission loss", () => {
    const discharged = resolveIpdActionRailActions({
      ...activeContext,
      admissionIsActive: false,
    });
    expect(ipdActionRailAction(discharged, "refer_out").disabledReasonText).toBe(
      "Refer or transfer the patient out needs an active admission",
    );

    const denied = resolveIpdActionRailActions({
      ...activeContext,
      canDischarge: false,
    });
    expect(ipdActionRailAction(denied, "dama_lama").enabled).toBe(false);
    expect(ipdActionRailAction(denied, "dama_lama").disabledReasonText).toBe(
      "Requires ipd.discharge.create",
    );
  });
});

describe("IPD journey handoff context", () => {
  it("selects the outstanding patient invoice before closed invoices", () => {
    expect(
      activeIpdInvoiceIdForJourney([
        invoice({ id: "invoice-paid", paid_amount: "100", status: "paid" }),
        invoice({ id: "invoice-due", paid_amount: "25", status: "partially_paid" }),
      ]),
    ).toBe("invoice-due");
  });

  it("selects a pharmacy order from the prescription before queue fallbacks", () => {
    expect(
      activeIpdPharmacyOrderIdForJourney({
        pharmacyOrders: [pharmacyOrder({ id: "queue-order" })],
        prescriptions: [prescriptionWithPharmacyOrder("rx-order")],
      }),
    ).toBe("rx-order");
  });

  it("derives billing, payment, and pharmacy completion events for handoff activation", () => {
    expect(
      deriveIpdJourneyCompletedEvents({
        dischargeSummary: null,
        investigations: null,
        invoices: [invoice({ paid_amount: "50", status: "partially_paid" })],
        mrdCaseSheetPackets: [],
        pharmacyOrders: [pharmacyOrder({ status: "dispensed" })],
        prescriptions: [],
      }),
    ).toEqual([
      "order.created",
      "billing.invoice.created",
      "billing.invoice.finalized",
      "billing.payment.received",
      "pharmacy.order.dispensed",
    ]);
  });
});
