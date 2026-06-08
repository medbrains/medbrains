// @vitest-environment node

import {
  CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS,
  CORE_PATIENT_JOURNEY_ACTIONS,
  inferClinicalJourneyEventNames,
  P,
  resolveClinicalJourneyActions,
} from "@medbrains/types";
import { describe, expect, it } from "vitest";

const allowAll = () => true;
const allowPermissions = (permissions: readonly string[]) => {
  const allowed = new Set(permissions);
  return (permission: string) => allowed.has(permission);
};

describe("clinical journey event activation", () => {
  it("declares only canonical emitted clinical events", () => {
    const canonicalEvents = new Set(Object.keys(CLINICAL_EVENT_REQUIRED_PAYLOAD_KEYS));

    expect(
      CORE_PATIENT_JOURNEY_ACTIONS.filter(
        (action) => action.emitsEvent && !canonicalEvents.has(action.emitsEvent),
      ),
    ).toEqual([]);
  });

  it("declares blocker controls for governed masking, configuration, and regulatory actions", () => {
    expect(
      CORE_PATIENT_JOURNEY_ACTIONS.find((action) => action.id === "patient.share"),
    ).toMatchObject({
      blockingControls: ["regulatory"],
    });
    expect(
      CORE_PATIENT_JOURNEY_ACTIONS.find((action) => action.id === "patient.print_card"),
    ).toMatchObject({
      blockingControls: ["masking"],
    });
    expect(
      CORE_PATIENT_JOURNEY_ACTIONS.find((action) => action.id === "billing.collect_payment"),
    ).toMatchObject({
      blockingControls: ["configuration", "context"],
    });
    expect(
      CORE_PATIENT_JOURNEY_ACTIONS.find((action) => action.id === "pharmacy.dispense_order"),
    ).toMatchObject({
      blockingControls: ["context", "regulatory"],
    });
    expect(
      CORE_PATIENT_JOURNEY_ACTIONS.find((action) => action.id === "emergency.open_mlc"),
    ).toMatchObject({
      blockingControls: ["context", "regulatory"],
    });
  });

  it("infers completed events from active patient, OPD, IPD, and ER context", () => {
    expect(
      inferClinicalJourneyEventNames({
        patientId: "patient-1",
        activeEncounterId: "encounter-1",
        activeAdmissionId: "admission-1",
        activeEmergencyVisitId: "visit-1",
      }),
    ).toEqual([
      "patient.created",
      "opd.encounter.created",
      "ipd.admission.created",
      "bed.assigned",
      "emergency.visit.created",
    ]);
  });

  it("does not infer bed assignment from an active admission that is still waiting for a bed", () => {
    expect(
      inferClinicalJourneyEventNames({
        patientId: "patient-1",
        activeAdmissionId: "admission-1",
        activeAdmissionStatus: "admitted",
        activeBedId: null,
        completedEvents: ["bed.assigned", "order.created"],
      }),
    ).toEqual(["order.created", "patient.created", "ipd.admission.created"]);
  });

  it("keeps downstream actions disabled until their activating event exists", () => {
    const actions = resolveClinicalJourneyActions({ patientId: "patient-1" }, allowAll, "web");

    expect(actions.find((action) => action.id === "billing.open_ledger")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "billing.collect_payment")?.enabled).toBe(false);
    expect(actions.find((action) => action.id === "emergency.open_mlc")?.enabled).toBe(false);
    expect(actions.find((action) => action.id === "mrd.open_case_sheet")?.enabled).toBe(false);
    expect(actions.find((action) => action.id === "pharmacy.open_patient_queue")?.enabled).toBe(
      false,
    );
    expect(
      actions.find((action) => action.id === "pharmacy.open_patient_queue")?.disabledReasonText,
    ).toContain("order created");
  });

  it("can include permission-denied actions as disabled explainable handoffs", () => {
    const defaultActions = resolveClinicalJourneyActions(
      { patientId: "patient-1" },
      allowPermissions([]),
      "web",
    );
    const explainableActions = resolveClinicalJourneyActions(
      { patientId: "patient-1" },
      allowPermissions([]),
      "web",
      { includePermissionDenied: true },
    );

    expect(defaultActions.some((action) => action.id === "billing.open_ledger")).toBe(false);
    expect(explainableActions.find((action) => action.id === "billing.open_ledger")).toMatchObject({
      disabledReasonText: "Requires billing.invoices.list",
      enabled: false,
    });
    expect(explainableActions.find((action) => action.id === "camp.open_context")).toMatchObject({
      disabledReasonText:
        "Requires one of camp.list / camp.registrations.list / camp.registrations.create",
      enabled: false,
    });
  });

  it("enables clinical and fulfillment actions when the care event chain is present", () => {
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        activeEncounterId: "encounter-1",
        activePharmacyOrderId: "pharmacy-order-1",
        activeOrderContext: "opd",
        completedEvents: ["order.created"],
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "orders.medication")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "pharmacy.dispense_order")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "pharmacy.open_patient_queue")?.enabled).toBe(
      true,
    );
  });

  it("enables pharmacy review when a prescription queue row exists before order creation", () => {
    const events = inferClinicalJourneyEventNames({
      patientId: "patient-1",
      activePharmacyRxQueueId: "rx-queue-1",
    });
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        activePharmacyRxQueueId: "rx-queue-1",
      },
      allowAll,
      "web",
    );

    expect(events).toContain("order.created");
    expect(actions.find((action) => action.id === "pharmacy.open_patient_queue")?.enabled).toBe(
      true,
    );
    expect(actions.find((action) => action.id === "pharmacy.dispense_order")?.enabled).toBe(false);
  });

  it("requires linked downstream records once billing, discharge, or pharmacy events exist", () => {
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        completedEvents: [
          "billing.invoice.created",
          "billing.invoice.finalized",
          "ipd.discharge.finalized",
          "order.created",
        ],
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "billing.collect_payment")).toMatchObject({
      blockedReason: "context",
      disabledReasonText: "Link an invoice before collecting payment",
      enabled: false,
    });
    expect(actions.find((action) => action.id === "billing.prepare_discharge_bill")).toMatchObject({
      blockedReason: "context",
      disabledReasonText: "Link the finalized IPD admission before preparing the discharge bill",
      enabled: false,
    });
    expect(actions.find((action) => action.id === "pharmacy.dispense_order")).toMatchObject({
      blockedReason: "context",
      disabledReasonText: "Link the pharmacy order before dispensing medicines",
      enabled: false,
    });
  });

  it("requires the active ER visit context before opening MLC documentation", () => {
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        completedEvents: ["emergency.visit.created"],
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "emergency.open_mlc")).toMatchObject({
      blockedReason: "context",
      disabledReasonText: "Link the active ER visit before opening MLC documentation",
      enabled: false,
    });
  });

  it("classifies configuration, masking, and regulatory blockers on operational handoffs", () => {
    const actions = resolveClinicalJourneyActions(
      {
        activeInvoiceId: "invoice-1",
        activePharmacyOrderId: "pharmacy-order-1",
        billingPaymentConfigurationReady: false,
        completedEvents: ["billing.invoice.created", "order.created"],
        hasPendingConsent: true,
        patientCardMaskingReady: false,
        patientId: "patient-1",
        pharmacyRegulatoryClearanceReady: false,
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "billing.collect_payment")).toMatchObject({
      blockedReason: "configuration",
      disabledReasonText: "Configure active payment methods before collecting payment",
      enabled: false,
    });
    expect(actions.find((action) => action.id === "patient.print_card")).toMatchObject({
      blockedReason: "masking",
      disabledReasonText: "Configure patient-card masking before printing identifiers",
      enabled: false,
    });
    expect(actions.find((action) => action.id === "patient.share")).toMatchObject({
      blockedReason: "regulatory",
      disabledReasonText: "Resolve pending patient consent before sharing records",
      enabled: false,
    });
    expect(actions.find((action) => action.id === "pharmacy.dispense_order")).toMatchObject({
      blockedReason: "regulatory",
      disabledReasonText: "Complete pharmacy regulatory clearance before dispensing medicines",
      enabled: false,
    });
  });

  it("keeps inpatient orders disabled while an admitted patient is waiting for a bed", () => {
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        activeAdmissionId: "admission-1",
        activeAdmissionStatus: "admitted",
        activeBedId: null,
        activeOrderContext: "ipd",
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "orders.medication")?.enabled).toBe(false);
    expect(actions.find((action) => action.id === "orders.medication")?.disabledReasonText).toBe(
      "Assign a bed before inpatient orders",
    );
  });

  it("enables inpatient orders once the active admission has a bed", () => {
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        activeAdmissionId: "admission-1",
        activeAdmissionStatus: "admitted",
        activeBedId: "bed-1",
        activeOrderContext: "ipd",
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "orders.medication")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "orders.lab")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "orders.radiology")?.enabled).toBe(true);
  });

  it("uses direct endpoint permissions for mobile order handoffs", () => {
    const context = {
      patientId: "patient-1",
      activeEncounterId: "encounter-1",
      activeOrderContext: "opd" as const,
    };
    const webActions = resolveClinicalJourneyActions(
      context,
      allowPermissions([P.ORDER_BASKET.SIGN]),
      "web",
    );
    const mobileBasketOnlyActions = resolveClinicalJourneyActions(
      context,
      allowPermissions([P.ORDER_BASKET.SIGN]),
      "mobile",
    );
    const mobileDirectActions = resolveClinicalJourneyActions(
      context,
      allowPermissions([
        P.OPD.VISIT_UPDATE,
        P.LAB.ORDERS_CREATE,
        P.RADIOLOGY.ORDERS_CREATE,
        P.RADIOLOGY.ORDERS_LIST,
      ]),
      "mobile",
    );

    expect(
      webActions.find((action) => action.id === "orders.medication")?.requiredPermissions,
    ).toEqual([P.ORDER_BASKET.SIGN]);
    expect(mobileBasketOnlyActions.some((action) => action.id === "orders.medication")).toBe(false);
    expect(
      mobileDirectActions.find((action) => action.id === "orders.medication")?.requiredPermissions,
    ).toEqual([P.OPD.VISIT_UPDATE]);
    expect(
      mobileDirectActions.find((action) => action.id === "orders.lab")?.requiredPermissions,
    ).toEqual([P.LAB.ORDERS_CREATE]);
    expect(
      mobileDirectActions.find((action) => action.id === "orders.radiology")?.requiredPermissions,
    ).toEqual([P.RADIOLOGY.ORDERS_CREATE, P.RADIOLOGY.ORDERS_LIST]);
  });

  it("enables emergency, discharge, billing, payment, and MRD handoffs from canonical events", () => {
    const actions = resolveClinicalJourneyActions(
      {
        patientId: "patient-1",
        activeAdmissionId: "admission-1",
        activeEmergencyVisitId: "visit-1",
        activeInvoiceId: "invoice-1",
        activePharmacyOrderId: "pharmacy-order-1",
        completedEvents: [
          "ipd.discharge.finalized",
          "billing.invoice.finalized",
          "billing.payment.received",
          "mrd.case_sheet.generated",
        ],
      },
      allowAll,
      "web",
    );

    expect(actions.find((action) => action.id === "emergency.open_mlc")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "billing.prepare_discharge_bill")?.enabled).toBe(
      true,
    );
    expect(actions.find((action) => action.id === "billing.collect_payment")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "pharmacy.dispense_order")?.enabled).toBe(true);
    expect(actions.find((action) => action.id === "mrd.open_case_sheet")?.enabled).toBe(true);
  });
});
