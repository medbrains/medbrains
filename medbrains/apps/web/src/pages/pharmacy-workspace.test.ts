// @vitest-environment node

import { type PharmacyOrderDetailResponse, patientJourneyActionRoute } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { pharmacyOrderJourneyContext } from "./pharmacy-workspace";

function pharmacyOrderDetail(
  overrides: Partial<PharmacyOrderDetailResponse> = {},
): PharmacyOrderDetailResponse {
  return {
    admission_id: null,
    billing_invoice_id: null,
    items: [],
    order: {
      billing_package_id: null,
      created_at: "2026-01-01T00:00:00.000Z",
      discharge_summary_id: null,
      dispensed_at: null,
      dispensed_by: null,
      dispensing_type: "prescription",
      encounter_id: "encounter-1",
      id: "pharmacy-order-1",
      interaction_check_result: null,
      notes: null,
      ordered_by: "pharmacist-1",
      patient_id: "patient-1",
      prescription_id: "prescription-1",
      status: "ordered",
      store_location_id: null,
      tenant_id: "tenant-1",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("pharmacy workspace journey context", () => {
  it("routes billing handoffs to the invoice created from pharmacy billing indent", () => {
    const context = pharmacyOrderJourneyContext(
      pharmacyOrderDetail({ billing_invoice_id: "invoice-1" }),
    );

    expect(context).toMatchObject({
      activeEncounterId: "encounter-1",
      activeInvoiceId: "invoice-1",
      activeOrderContext: "opd",
      activePharmacyOrderId: "pharmacy-order-1",
      patientId: "patient-1",
    });
    expect(context.completedEvents).toContain("billing.invoice.created");
    expect(patientJourneyActionRoute("billing.open_ledger", context)).toBe(
      "/billing/invoices/invoice-1",
    );
    expect(patientJourneyActionRoute("billing.collect_payment", context)).toBe(
      "/billing/invoices/invoice-1?action=payment",
    );
  });

  it("keeps IPD admission context when no billing invoice has been created yet", () => {
    const baseDetail = pharmacyOrderDetail();
    const context = pharmacyOrderJourneyContext(
      pharmacyOrderDetail({
        admission_id: "admission-1",
        order: {
          ...baseDetail.order,
          encounter_id: "encounter-1",
        },
      }),
    );

    expect(context.activeOrderContext).toBe("ipd");
    expect(context.activeInvoiceId).toBeNull();
    expect(patientJourneyActionRoute("billing.open_ledger", context)).toBe(
      "/billing?tab=invoices&patient_id=patient-1&admission_id=admission-1",
    );
  });
});
