// @vitest-environment node

import type {
  Admission,
  Invoice,
  IpdDischargeSummary,
  PharmacyOrder,
  PrescriptionWithItems,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";
import {
  activeIpdInvoiceIdForJourney,
  activeIpdPharmacyOrderIdForJourney,
  deriveIpdJourneyCompletedEvents,
  IPD_ACTION_RAIL_ACTIONS,
  type IpdActionRailContext,
  ipdActionRailAction,
  ipdActionRailSectionsForTab,
  ipdAdmissionOrderBasketRoute,
  ipdAdmissionWorkspaceTabRoute,
  ipdOrderBasketTabFromSearchParams,
  ipdWorkspaceTabForOrderBasket,
  resolveIpdActionRailActions,
  summarizeIpdActionRailSections,
  summarizeIpdWorkspaceTabReadiness,
} from "./ipd-workspace";

const activeContext: IpdActionRailContext = {
  admissionHasAssignedBed: true,
  admissionIsActive: true,
  canCreateDischargeSummary: true,
  canCreateTransfer: true,
  canDischarge: true,
  canGenerateMrdCaseSheet: true,
  canManageDeathRecords: true,
  canOrder: true,
  canPrintWristband: true,
  canViewBillingLedger: true,
  canViewDischargeTat: true,
  canViewMrdCaseSheets: true,
  hasMrdCaseSheet: true,
};

function admission(overrides: Partial<Admission> = {}): Admission {
  return {
    admission_height_cm: null,
    admission_source: "opd",
    admission_weight_kg: null,
    admitted_at: "2026-01-01T00:00:00Z",
    admitting_doctor: "doctor-1",
    bed_id: "bed-1",
    comorbidities: [],
    created_at: "2026-01-01T00:00:00Z",
    deposit_amount: null,
    deposit_paid: false,
    discharge_summary: null,
    discharge_type: null,
    discharged_at: null,
    encounter_id: "encounter-1",
    estimated_cost: null,
    estimated_los_days: null,
    expected_discharge_date: null,
    id: "admission-1",
    ip_type: "general",
    is_critical: false,
    isolation_reason: null,
    isolation_required: false,
    mlc_case_id: null,
    patient_id: "patient-1",
    primary_nurse_id: null,
    priority: "routine",
    provisional_diagnosis: null,
    referral_doctor: null,
    referral_from: null,
    referral_notes: null,
    status: "admitted",
    tenant_id: "tenant-1",
    updated_at: "2026-01-01T00:00:00Z",
    ward_id: "ward-1",
    ...overrides,
  };
}

function dischargeSummary(overrides: Partial<IpdDischargeSummary> = {}): IpdDischargeSummary {
  return {
    activity_restrictions: null,
    admission_id: "admission-1",
    condition_at_discharge: null,
    course_in_hospital: null,
    created_at: "2026-01-01T00:00:00Z",
    dietary_advice: null,
    emergency_contact_info: null,
    final_diagnosis: null,
    finalized_at: null,
    follow_up_date: null,
    follow_up_instructions: null,
    id: "summary-1",
    investigation_summary: null,
    medications_on_discharge: [],
    prepared_by: null,
    procedures_performed: [],
    status: "draft",
    template_id: null,
    tenant_id: "tenant-1",
    treatment_given: null,
    updated_at: "2026-01-01T00:00:00Z",
    verified_by: null,
    warning_signs: null,
    ...overrides,
  };
}

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
    admission_id: null,
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
    expect(ipdAdmissionOrderBasketRoute("admission-1", "drug")).toBe(
      "/ipd/admissions/admission-1?order=drug#prescriptions",
    );
    expect(ipdAdmissionOrderBasketRoute("admission-1", "lab")).toBe(
      "/ipd/admissions/admission-1?order=lab#investigations",
    );
    expect(ipdAdmissionWorkspaceTabRoute("admission-1", "investigations")).toBe(
      "/ipd/admissions/admission-1#investigations",
    );
    expect(ipdOrderBasketTabFromSearchParams(new URLSearchParams("order=radiology"))).toBe(
      "radiology",
    );
    expect(ipdOrderBasketTabFromSearchParams(new URLSearchParams("order=notes"))).toBeNull();
  });

  it("describes action activation events and permission contracts", () => {
    expect(IPD_ACTION_RAIL_ACTIONS.map((action) => action.id)).toEqual([
      "order_medicines",
      "order_lab",
      "order_imaging",
      "open_patient_ledger",
      "generate_mrd_case_sheet",
      "open_mrd_packet",
      "print_wristband",
      "refer_out",
      "dama_lama",
      "mark_death",
      "create_discharge_summary",
      "discharge_patient",
      "view_discharge_tat",
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

  it("models finance, MRD, wristband, and discharge readiness with reasons", () => {
    const withoutMrdPacket = resolveIpdActionRailActions({
      ...activeContext,
      hasMrdCaseSheet: false,
    });
    expect(ipdActionRailAction(withoutMrdPacket, "open_patient_ledger").enabled).toBe(true);
    expect(ipdActionRailAction(withoutMrdPacket, "generate_mrd_case_sheet").enabled).toBe(true);
    expect(ipdActionRailAction(withoutMrdPacket, "open_mrd_packet").enabled).toBe(false);
    expect(ipdActionRailAction(withoutMrdPacket, "open_mrd_packet").disabledReasonText).toBe(
      "Generate an MRD case-sheet packet before opening it",
    );
    expect(ipdActionRailAction(withoutMrdPacket, "print_wristband").enabled).toBe(true);
    expect(ipdActionRailAction(withoutMrdPacket, "create_discharge_summary").enabled).toBe(true);
    expect(ipdActionRailAction(withoutMrdPacket, "discharge_patient").enabled).toBe(true);
    expect(ipdActionRailAction(withoutMrdPacket, "view_discharge_tat").enabled).toBe(true);

    const denied = resolveIpdActionRailActions({
      ...activeContext,
      canGenerateMrdCaseSheet: false,
      canPrintWristband: false,
      canViewBillingLedger: false,
      canViewDischargeTat: false,
    });
    expect(ipdActionRailAction(denied, "open_patient_ledger").disabledReasonText).toBe(
      "Requires billing.invoices.list",
    );
    expect(ipdActionRailAction(denied, "generate_mrd_case_sheet").disabledReasonText).toBe(
      "Requires mrd.case_sheets.generate",
    );
    expect(ipdActionRailAction(denied, "print_wristband").disabledReasonText).toBe(
      "Requires ipd.wristband.print",
    );
    expect(ipdActionRailAction(denied, "view_discharge_tat").disabledReasonText).toBe(
      "Requires ipd.discharge_tat.view",
    );
  });

  it("summarizes focused command sections by enabled and blocked local actions", () => {
    const withoutBed = resolveIpdActionRailActions({
      ...activeContext,
      admissionHasAssignedBed: false,
    });
    const summaries = summarizeIpdActionRailSections(withoutBed, ["orders", "handoffs"]);
    const orders = summaries.find((summary) => summary.section === "orders");
    const handoffs = summaries.find((summary) => summary.section === "handoffs");
    const admission = summaries.find((summary) => summary.section === "admission");

    expect(orders).toMatchObject({
      blockedActions: 3,
      enabledActions: 0,
      focused: true,
      totalActions: 3,
    });
    expect(handoffs).toMatchObject({
      blockedActions: 0,
      enabledActions: 0,
      focused: true,
      totalActions: 0,
    });
    expect(admission).toMatchObject({
      blockedActions: 0,
      enabledActions: 4,
      focused: false,
      totalActions: 4,
    });
  });

  it("derives workspace tab readiness from focused action rail sections", () => {
    const actions = resolveIpdActionRailActions({
      ...activeContext,
      admissionHasAssignedBed: false,
    });
    const sectionSummaries = summarizeIpdActionRailSections(actions, []);
    const summaries = summarizeIpdWorkspaceTabReadiness(
      [
        { value: "prescriptions", section: "Command" },
        { value: "billing-tab", section: "Finance & Admin" },
        { value: "clinical-docs", section: "Care Context" },
        { value: "discharge-summary", section: "Discharge" },
        { value: "overview", section: "Command" },
      ],
      sectionSummaries,
      actions,
    );

    expect(summaries.find((summary) => summary.tab === "prescriptions")).toMatchObject({
      blockedReasons: ["Assign a bed before inpatient orders"],
      blockedActions: 3,
      enabledActions: 0,
      primaryBlockedReason: "Assign a bed before inpatient orders",
      totalActions: 3,
    });
    expect(summaries.find((summary) => summary.tab === "billing-tab")).toMatchObject({
      blockedReasons: [],
      blockedActions: 0,
      enabledActions: 1,
      primaryBlockedReason: null,
      totalActions: 1,
    });
    expect(summaries.find((summary) => summary.tab === "clinical-docs")).toMatchObject({
      blockedActions: 0,
      enabledActions: 2,
      totalActions: 2,
    });
    expect(summaries.find((summary) => summary.tab === "discharge-summary")).toMatchObject({
      blockedActions: 0,
      enabledActions: 7,
      totalActions: 7,
    });
    expect(summaries.find((summary) => summary.tab === "overview")).toMatchObject({
      blockedActions: 0,
      enabledActions: 4,
      totalActions: 4,
    });
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

  it("derives admission, bed, transfer and discharge events for rail activation", () => {
    expect(
      deriveIpdJourneyCompletedEvents({
        admission: admission({
          discharged_at: "2026-01-05T10:00:00Z",
          status: "transferred",
        }),
        dischargeSummary: dischargeSummary({ status: "draft" }),
        investigations: null,
        invoices: [],
        mrdCaseSheetPackets: [],
        pharmacyOrders: [],
        prescriptions: [],
      }),
    ).toEqual([
      "ipd.admission.created",
      "bed.assigned",
      "bed.transferred",
      "ipd.discharge.completed",
      "ipd.discharge.initiated",
    ]);
  });

  it("derives billing, payment, and pharmacy completion events for handoff activation", () => {
    expect(
      deriveIpdJourneyCompletedEvents({
        admission: null,
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
