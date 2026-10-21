import type {
  ClinicalJourneyActionId,
  ClinicalJourneyActionSignal,
  ClinicalJourneyBlockedReason,
  ClinicalJourneyContext,
  ClinicalJourneyMessageValues,
  ClinicalJourneySurface,
  ClinicalOrderContext,
  ResolvedClinicalJourneyAction,
} from "./event-actions.js";
import { clinicalJourneyActionSignal, resolveClinicalJourneyActions } from "./event-actions.js";
import type {
  ClinicalEventName,
  PatientLabOrderRow,
  PatientRadiologyReport,
  PharmacyOrder,
  PrescriptionHistoryItem,
  RadiologyOrder,
} from "./index.js";
import { patientJourneyActionRoute } from "./patient-journey-routes.js";
import { P } from "./permissions.js";

export type PatientFlowModule =
  | "patient"
  | "opd"
  | "ipd"
  | "emergency"
  | "camp"
  | "lab"
  | "radiology"
  | "pharmacy"
  | "billing";

export interface PatientFlowContextInput {
  patientId: string;
  activeEncounterId?: string | null;
  activeAdmissionId?: string | null;
  activeAdmissionStatus?: string | null;
  activeBedId?: string | null;
  activeEmergencyVisitId?: string | null;
  activeCampId?: string | null;
  activeCampRegistrationId?: string | null;
  activeInvoiceId?: string | null;
  activePharmacyOrderId?: string | null;
  activePharmacyRxQueueId?: string | null;
  activeLabOrderId?: string | null;
  activeRadiologyOrderId?: string | null;
  activeOrderContext?: ClinicalOrderContext | null;
  billingPaymentConfigurationReady?: boolean;
  completedEvents?: readonly ClinicalEventName[];
  hasPendingConsent?: boolean;
  isDeceased?: boolean;
  patientCardMaskingReady?: boolean;
  pharmacyRegulatoryClearanceReady?: boolean;
}

export interface PatientFlowReadinessItem {
  id: PatientFlowModule;
  actionId: ClinicalJourneyActionId | null;
  blockedReason: ClinicalJourneyBlockedReason | null;
  label: string;
  labelKey: string;
  description: string;
  descriptionKey: string;
  href: string;
  enabled: boolean;
  disabledReason: string | null;
  disabledReasonKey: string | null;
  disabledReasonValues: ClinicalJourneyMessageValues | null;
  activationEvents: readonly ClinicalEventName[];
  emittedEvent: ClinicalEventName | null;
  requiredPermissions: readonly string[];
}

export interface PatientFlowReadinessSummary {
  blocked: number;
  blockedModules: readonly PatientFlowModule[];
  configurationBlocked: number;
  configurationBlockedModules: readonly PatientFlowModule[];
  contextBlocked: number;
  contextBlockedModules: readonly PatientFlowModule[];
  enabled: number;
  eventBlocked: number;
  eventBlockedModules: readonly PatientFlowModule[];
  maskingBlocked: number;
  maskingBlockedModules: readonly PatientFlowModule[];
  permissionBlocked: number;
  permissionBlockedModules: readonly PatientFlowModule[];
  readyModules: readonly PatientFlowModule[];
  regulatoryBlocked: number;
  regulatoryBlockedModules: readonly PatientFlowModule[];
  total: number;
}

export interface PatientFlowReadiness {
  items: readonly PatientFlowReadinessItem[];
  summary: PatientFlowReadinessSummary;
}

export function patientFlowReadinessSignal(
  item: Pick<PatientFlowReadinessItem, "blockedReason" | "enabled">,
): ClinicalJourneyActionSignal {
  return clinicalJourneyActionSignal(item);
}

const OPD_FLOW_ACTION = "opd.open_visit" satisfies ClinicalJourneyActionId;
const EMERGENCY_FLOW_ACTION = "emergency.open_visit" satisfies ClinicalJourneyActionId;
const CAMP_FLOW_ACTION = "camp.open_context" satisfies ClinicalJourneyActionId;
const LAB_FLOW_ACTION = "lab.open_order" satisfies ClinicalJourneyActionId;
const RADIOLOGY_FLOW_ACTION = "imaging.open_study" satisfies ClinicalJourneyActionId;
const PHARMACY_FLOW_ACTION = "pharmacy.open_patient_queue" satisfies ClinicalJourneyActionId;
const BILLING_FLOW_ACTION = "billing.open_ledger" satisfies ClinicalJourneyActionId;

function resolvedActionMap(actions: ResolvedClinicalJourneyAction[]) {
  return new Map(actions.map((action) => [action.id, action]));
}

interface PatientFlowItemState {
  activationEvents: readonly ClinicalEventName[];
  blockedReason: ClinicalJourneyBlockedReason | null;
  disabledReason: string | null;
  disabledReasonKey: string | null;
  disabledReasonValues: ClinicalJourneyMessageValues | null;
  emittedEvent: ClinicalEventName | null;
  enabled: boolean;
  requiredPermissions: readonly string[];
}

function itemState(
  action: ResolvedClinicalJourneyAction | undefined,
  fallbackEnabled: boolean,
  fallbackReason = "Permission required",
  fallbackActivationEvents: readonly ClinicalEventName[] = [],
  fallbackPermissions: readonly string[] = [],
  fallbackReasonKey = "patientJourney.blockers.permissionRequired",
): PatientFlowItemState {
  if (!action) {
    return {
      enabled: fallbackEnabled,
      disabledReason: fallbackEnabled ? null : fallbackReason,
      disabledReasonKey: fallbackEnabled ? null : fallbackReasonKey,
      disabledReasonValues: null,
      blockedReason: fallbackEnabled ? null : "permission",
      activationEvents: fallbackActivationEvents,
      emittedEvent: null,
      requiredPermissions: fallbackPermissions,
    };
  }

  return {
    enabled: action.enabled,
    disabledReason: action.enabled ? null : action.disabledReasonText,
    disabledReasonKey: action.enabled ? null : action.disabledReasonKey,
    disabledReasonValues: action.enabled ? null : action.disabledReasonValues,
    blockedReason: action.blockedReason,
    activationEvents: action.activatesAfter,
    emittedEvent: action.emitsEvent ?? null,
    requiredPermissions: action.requiredPermissions,
  };
}

/**
 * Lab and radiology are links to an order, not a place to start one (orders
 * are raised from OPD/IPD or at the desk). Enabled when the patient has an
 * order and the user may list and open it; otherwise blocked on context.
 */
function orderItemState(
  orderId: string | null | undefined,
  allowed: boolean,
  permissions: readonly string[],
  empty: { reason: string; key: string },
): PatientFlowItemState {
  const state = itemState(
    undefined,
    allowed,
    "Permission required",
    ["order.created"],
    permissions,
  );
  if (!state.enabled || orderId) return state;
  return {
    ...state,
    enabled: false,
    blockedReason: "context",
    disabledReason: empty.reason,
    disabledReasonKey: empty.key,
  };
}

function summarizePatientFlow(
  items: readonly PatientFlowReadinessItem[],
): PatientFlowReadinessSummary {
  const readyModules = items.filter((item) => item.enabled).map((item) => item.id);
  const blockedModules = items.filter((item) => !item.enabled).map((item) => item.id);
  const configurationBlockedModules = items
    .filter((item) => item.blockedReason === "configuration")
    .map((item) => item.id);
  const contextBlockedModules = items
    .filter((item) => item.blockedReason === "context")
    .map((item) => item.id);
  const eventBlockedModules = items
    .filter((item) => item.blockedReason === "event")
    .map((item) => item.id);
  const maskingBlockedModules = items
    .filter((item) => item.blockedReason === "masking")
    .map((item) => item.id);
  const permissionBlockedModules = items
    .filter((item) => item.blockedReason === "permission")
    .map((item) => item.id);
  const regulatoryBlockedModules = items
    .filter((item) => item.blockedReason === "regulatory")
    .map((item) => item.id);

  return {
    blocked: blockedModules.length,
    blockedModules,
    configurationBlocked: configurationBlockedModules.length,
    configurationBlockedModules,
    contextBlocked: contextBlockedModules.length,
    contextBlockedModules,
    enabled: readyModules.length,
    eventBlocked: eventBlockedModules.length,
    eventBlockedModules,
    maskingBlocked: maskingBlockedModules.length,
    maskingBlockedModules,
    permissionBlocked: permissionBlockedModules.length,
    permissionBlockedModules,
    readyModules,
    regulatoryBlocked: regulatoryBlockedModules.length,
    regulatoryBlockedModules,
    total: items.length,
  };
}

/**
 * The lab order a clinician on this chart would act on.
 *
 * Drawn but not yet verified first — that is the one waiting on somebody.
 * Then any unverified order, so a chart holding only uncollected orders still
 * offers a way into the record rather than nothing; then the most recent.
 * Returning null leaves the lab journey actions inactive, which is correct for
 * a patient who has never had an investigation.
 */
export function activePatientLabOrderIdForJourney(
  orders: readonly PatientLabOrderRow[],
): string | null {
  // A cancelled order is never "the one waiting on somebody", whether it came
  // from an encounter or straight from the lab desk.
  const live = orders.filter((order) => order.status !== "cancelled");
  return (
    live.find((order) => order.collected_at && !order.verified_at)?.id ??
    live.find((order) => !order.verified_at)?.id ??
    live[0]?.id ??
    null
  );
}

/**
 * Whether the order the lab actions would target has had its sample drawn.
 *
 * Deliberately not "any order on this chart": a patient can hold a verified
 * order from last week and an uncollected one from this morning. Asking
 * whether *any* sample was ever drawn would offer "record result" against the
 * order that has no sample, which is a result belonging to nothing.
 */
export function activeLabOrderIsCollectedForJourney(
  orders: readonly PatientLabOrderRow[],
): boolean {
  const activeId = activePatientLabOrderIdForJourney(orders);
  return activeId != null && orders.some((o) => o.id === activeId && o.collected_at != null);
}

const OPEN_RADIOLOGY_ORDER_STATUSES = new Set<RadiologyOrder["status"]>([
  "ordered",
  "scheduled",
  "in_progress",
  "completed",
]);

/**
 * The radiology order a clinician on this chart would open.
 *
 * A critical finding nobody has acknowledged outranks everything: that is a
 * result somebody is waiting to be told about. Then an unverified report,
 * then an order still waiting for its study or its report, then the most
 * recent. Reports alone miss that third kind entirely — a walk-in X-ray
 * booked at the radiology desk has no encounter and no report yet — so the
 * patient's orders are read too.
 */
export function activePatientRadiologyOrderIdForJourney(
  reports: readonly PatientRadiologyReport[],
  orders: readonly Pick<RadiologyOrder, "id" | "status">[] = [],
): string | null {
  const live = orders.filter((order) => order.status !== "cancelled");
  return (
    reports.find((r) => r.is_critical && !r.alert_acknowledged_at)?.order_id ??
    reports.find((r) => !r.verified_at)?.order_id ??
    live.find((order) => OPEN_RADIOLOGY_ORDER_STATUSES.has(order.status))?.id ??
    reports[0]?.order_id ??
    live[0]?.id ??
    null
  );
}

const OPEN_PHARMACY_ORDER_STATUSES = new Set<PharmacyOrder["status"]>([
  "ordered",
  "partially_dispensed",
]);

/**
 * The pharmacy order this chart points at. Prescriptions only reach pharmacy
 * orders raised from an encounter; a direct counter sale for a registered
 * patient has no prescription, so the patient's pharmacy orders are read too.
 */
export function activePatientPharmacyOrderIdForJourney(
  prescriptions: readonly PrescriptionHistoryItem[],
  orders: readonly Pick<PharmacyOrder, "id" | "status">[] = [],
): string | null {
  const live = orders.filter((order) => order.status !== "cancelled");
  return (
    prescriptions.find((prescription) =>
      prescription.items.some((item) => item.item_status !== "discontinued"),
    )?.pharmacy_order_id ??
    live.find((order) => OPEN_PHARMACY_ORDER_STATUSES.has(order.status))?.id ??
    prescriptions.find((prescription) => prescription.pharmacy_order_id)?.pharmacy_order_id ??
    live[0]?.id ??
    null
  );
}

export function activePatientPharmacyRxQueueIdForJourney(
  prescriptions: readonly PrescriptionHistoryItem[],
): string | null {
  return (
    prescriptions.find(
      (prescription) =>
        !prescription.pharmacy_order_id &&
        prescription.pharmacy_rx_queue_id &&
        prescription.items.some((item) => item.item_status !== "discontinued"),
    )?.pharmacy_rx_queue_id ??
    prescriptions.find(
      (prescription) => !prescription.pharmacy_order_id && prescription.pharmacy_rx_queue_id,
    )?.pharmacy_rx_queue_id ??
    null
  );
}

type PatientPharmacyPrescriptionReviewRow = Pick<
  PrescriptionHistoryItem,
  "pharmacy_order_id" | "pharmacy_status"
>;

const REVIEWED_PHARMACY_STATUSES = new Set<
  NonNullable<PatientPharmacyPrescriptionReviewRow["pharmacy_status"]>
>(["approved", "dispensing", "dispensed", "partially_dispensed"]);

export function patientPharmacyPrescriptionHasReviewedStatus(
  prescription: PatientPharmacyPrescriptionReviewRow,
): boolean {
  return (
    prescription.pharmacy_order_id != null ||
    (prescription.pharmacy_status != null &&
      REVIEWED_PHARMACY_STATUSES.has(prescription.pharmacy_status))
  );
}

export function hasReviewedPatientPharmacyPrescriptionForJourney(
  prescriptions: readonly PatientPharmacyPrescriptionReviewRow[],
): boolean {
  return prescriptions.some((prescription) =>
    patientPharmacyPrescriptionHasReviewedStatus(prescription),
  );
}

export function patientFlowJourneyContext(input: PatientFlowContextInput): ClinicalJourneyContext {
  const {
    activeAdmissionId,
    activeAdmissionStatus,
    activeBedId,
    activeCampId,
    activeCampRegistrationId,
    activeEmergencyVisitId,
    activeEncounterId,
    activeInvoiceId,
    activeLabOrderId,
    activeRadiologyOrderId,
    activeOrderContext,
    activePharmacyOrderId,
    activePharmacyRxQueueId,
    billingPaymentConfigurationReady,
    completedEvents,
    hasPendingConsent,
    isDeceased,
    patientId,
    patientCardMaskingReady,
    pharmacyRegulatoryClearanceReady,
  } = input;

  return {
    patientId,
    isDeceased,
    activeEncounterId,
    activeAdmissionId,
    activeBedId,
    activeEmergencyVisitId,
    activeCampId,
    activeCampRegistrationId,
    activeInvoiceId,
    activeLabOrderId,
    activeRadiologyOrderId,
    activePharmacyOrderId,
    activePharmacyRxQueueId,
    activeAdmissionStatus: activeAdmissionStatus ?? (activeAdmissionId ? "admitted" : null),
    activeOrderContext:
      activeOrderContext ?? (activeEncounterId ? "opd" : activeAdmissionId ? "ipd" : null),
    billingPaymentConfigurationReady,
    completedEvents,
    hasPendingConsent,
    patientCardMaskingReady,
    pharmacyRegulatoryClearanceReady,
  };
}

export function buildPatientFlowReadiness(
  context: ClinicalJourneyContext,
  hasPermission: (code: string) => boolean,
  surface: ClinicalJourneySurface = "web",
): PatientFlowReadiness {
  const actions = resolvedActionMap(
    resolveClinicalJourneyActions(context, hasPermission, surface, {
      includePermissionDenied: true,
    }),
  );
  const { patientId } = context;
  const patientState = itemState(
    undefined,
    hasPermission(P.PATIENTS.VIEW),
    "Permission required",
    ["patient.created"],
    [P.PATIENTS.VIEW],
  );
  const opdState = itemState(
    actions.get(OPD_FLOW_ACTION),
    hasPermission(P.OPD.VISIT_CREATE),
    "Permission required",
    ["patient.created"],
    [P.OPD.VISIT_CREATE],
  );
  const ipdActionId: ClinicalJourneyActionId = context.activeAdmissionId
    ? "ipd.open_admission"
    : "ipd.admit";
  const ipdState = itemState(
    actions.get(ipdActionId),
    context.activeAdmissionId
      ? hasPermission(P.IPD.ADMISSIONS_VIEW)
      : hasPermission(P.IPD.ADMISSIONS_CREATE),
    "Permission required",
    context.activeAdmissionId ? ["ipd.admission.created"] : ["patient.created"],
    context.activeAdmissionId ? [P.IPD.ADMISSIONS_VIEW] : [P.IPD.ADMISSIONS_CREATE],
  );
  const emergencyState = itemState(
    actions.get(EMERGENCY_FLOW_ACTION),
    hasPermission(P.EMERGENCY.VISITS_CREATE),
    "Permission required",
    ["patient.created"],
    [P.EMERGENCY.VISITS_CREATE],
  );
  const campAllowed =
    hasPermission(P.CAMP.LIST) ||
    hasPermission(P.CAMP.REGISTRATIONS_LIST) ||
    hasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const campState = itemState(
    actions.get(CAMP_FLOW_ACTION),
    campAllowed,
    "Permission required",
    ["patient.created", "camp.registration.created", "camp.screening.completed"],
    [P.CAMP.LIST, P.CAMP.REGISTRATIONS_LIST, P.CAMP.REGISTRATIONS_CREATE],
  );
  const labPermissions = [P.LAB.ORDERS_LIST, P.LAB.ORDERS_VIEW];
  const labState = orderItemState(
    context.activeLabOrderId,
    labPermissions.every((code) => hasPermission(code)),
    labPermissions,
    { reason: "No lab order for this patient", key: "patientJourney.blockers.noLabOrder" },
  );
  const radiologyPermissions = [P.RADIOLOGY.ORDERS_LIST, P.RADIOLOGY.ORDERS_VIEW];
  const radiologyState = orderItemState(
    context.activeRadiologyOrderId,
    radiologyPermissions.every((code) => hasPermission(code)),
    radiologyPermissions,
    {
      reason: "No radiology order for this patient",
      key: "patientJourney.blockers.noRadiologyOrder",
    },
  );
  const pharmacyState = itemState(
    actions.get(PHARMACY_FLOW_ACTION),
    hasPermission(P.PHARMACY.PRESCRIPTIONS_LIST),
    "Permission required",
    ["order.created", "pharmacy.prescription.reviewed", "pharmacy.order.dispensed"],
    [P.PHARMACY.PRESCRIPTIONS_LIST],
  );
  const billingState = itemState(
    actions.get(BILLING_FLOW_ACTION),
    hasPermission(P.BILLING.INVOICES_LIST),
    "Permission required",
    ["patient.created", "order.created", "billing.invoice.created"],
    [P.BILLING.INVOICES_LIST],
  );

  const items: PatientFlowReadinessItem[] = [
    {
      id: "patient",
      actionId: null,
      blockedReason: patientState.blockedReason,
      label: "Patient",
      labelKey: "patientJourney.flow.modules.patient.label",
      description: "Open patient registration and longitudinal record.",
      descriptionKey: "patientJourney.flow.modules.patient.description",
      href: `/patients/${patientId}#overview`,
      enabled: patientState.enabled,
      disabledReason: patientState.disabledReason,
      disabledReasonKey: patientState.disabledReasonKey,
      disabledReasonValues: patientState.disabledReasonValues,
      activationEvents: patientState.activationEvents,
      emittedEvent: patientState.emittedEvent,
      requiredPermissions: patientState.requiredPermissions,
    },
    {
      id: "opd",
      actionId: OPD_FLOW_ACTION,
      blockedReason: opdState.blockedReason,
      label: "OPD",
      description: context.activeEncounterId ? "Open active OPD encounter." : "Start an OPD visit.",
      labelKey: "patientJourney.flow.modules.opd.label",
      descriptionKey: context.activeEncounterId
        ? "patientJourney.flow.modules.opd.activeDescription"
        : "patientJourney.flow.modules.opd.startDescription",
      href:
        patientJourneyActionRoute(OPD_FLOW_ACTION, context) ?? `/opd/new?patient_id=${patientId}`,
      enabled: opdState.enabled,
      disabledReason: opdState.disabledReason,
      disabledReasonKey: opdState.disabledReasonKey,
      disabledReasonValues: opdState.disabledReasonValues,
      activationEvents: opdState.activationEvents,
      emittedEvent: opdState.emittedEvent,
      requiredPermissions: opdState.requiredPermissions,
    },
    {
      id: "ipd",
      actionId: ipdActionId,
      blockedReason: ipdState.blockedReason,
      label: "IPD",
      description: context.activeAdmissionId
        ? "Open active IPD admission."
        : "Start an IPD admission.",
      labelKey: "patientJourney.flow.modules.ipd.label",
      descriptionKey: context.activeAdmissionId
        ? "patientJourney.flow.modules.ipd.activeDescription"
        : "patientJourney.flow.modules.ipd.startDescription",
      href: patientJourneyActionRoute(ipdActionId, context) ?? `/ipd/new?patient_id=${patientId}`,
      enabled: ipdState.enabled,
      disabledReason: ipdState.disabledReason,
      disabledReasonKey: ipdState.disabledReasonKey,
      disabledReasonValues: ipdState.disabledReasonValues,
      activationEvents: ipdState.activationEvents,
      emittedEvent: ipdState.emittedEvent,
      requiredPermissions: ipdState.requiredPermissions,
    },
    {
      id: "emergency",
      actionId: EMERGENCY_FLOW_ACTION,
      blockedReason: emergencyState.blockedReason,
      label: "ER",
      description: context.activeEmergencyVisitId
        ? "Open emergency visit."
        : "Register emergency visit.",
      labelKey: "patientJourney.flow.modules.emergency.label",
      descriptionKey: context.activeEmergencyVisitId
        ? "patientJourney.flow.modules.emergency.activeDescription"
        : "patientJourney.flow.modules.emergency.startDescription",
      href:
        patientJourneyActionRoute(EMERGENCY_FLOW_ACTION, context) ??
        `/emergency/visits/new?patient_id=${patientId}`,
      enabled: emergencyState.enabled,
      disabledReason: emergencyState.disabledReason,
      disabledReasonKey: emergencyState.disabledReasonKey,
      disabledReasonValues: emergencyState.disabledReasonValues,
      activationEvents: emergencyState.activationEvents,
      emittedEvent: emergencyState.emittedEvent,
      requiredPermissions: emergencyState.requiredPermissions,
    },
    {
      id: "camp",
      actionId: CAMP_FLOW_ACTION,
      blockedReason: campState.blockedReason,
      label: "Camp",
      labelKey: "patientJourney.flow.modules.camp.label",
      description: "Open camp registration and screening workspace.",
      descriptionKey: "patientJourney.flow.modules.camp.description",
      href: patientJourneyActionRoute(CAMP_FLOW_ACTION, context) ?? `/camp?patient_id=${patientId}`,
      enabled: campState.enabled,
      disabledReason: campState.disabledReason,
      disabledReasonKey: campState.disabledReasonKey,
      disabledReasonValues: campState.disabledReasonValues,
      activationEvents: campState.activationEvents,
      emittedEvent: campState.emittedEvent,
      requiredPermissions: campState.requiredPermissions,
    },
    {
      id: "lab",
      actionId: LAB_FLOW_ACTION,
      blockedReason: labState.blockedReason,
      label: "Lab",
      labelKey: "patientJourney.flow.modules.lab.label",
      description: "Open the patient's current lab order.",
      descriptionKey: "patientJourney.flow.modules.lab.description",
      href: patientJourneyActionRoute(LAB_FLOW_ACTION, context) ?? `/patients/${patientId}#lab`,
      enabled: labState.enabled,
      disabledReason: labState.disabledReason,
      disabledReasonKey: labState.disabledReasonKey,
      disabledReasonValues: labState.disabledReasonValues,
      activationEvents: labState.activationEvents,
      emittedEvent: labState.emittedEvent,
      requiredPermissions: labState.requiredPermissions,
    },
    {
      id: "radiology",
      actionId: RADIOLOGY_FLOW_ACTION,
      blockedReason: radiologyState.blockedReason,
      label: "Radiology",
      labelKey: "patientJourney.flow.modules.radiology.label",
      description: "Open the patient's current radiology order.",
      descriptionKey: "patientJourney.flow.modules.radiology.description",
      href:
        patientJourneyActionRoute(RADIOLOGY_FLOW_ACTION, context) ??
        `/patients/${patientId}#imaging`,
      enabled: radiologyState.enabled,
      disabledReason: radiologyState.disabledReason,
      disabledReasonKey: radiologyState.disabledReasonKey,
      disabledReasonValues: radiologyState.disabledReasonValues,
      activationEvents: radiologyState.activationEvents,
      emittedEvent: radiologyState.emittedEvent,
      requiredPermissions: radiologyState.requiredPermissions,
    },
    {
      id: "pharmacy",
      actionId: PHARMACY_FLOW_ACTION,
      blockedReason: pharmacyState.blockedReason,
      label: "Pharmacy",
      labelKey: "patientJourney.flow.modules.pharmacy.label",
      description: "Open patient pharmacy review, orders, and dispensing queue.",
      descriptionKey: "patientJourney.flow.modules.pharmacy.description",
      href:
        patientJourneyActionRoute(PHARMACY_FLOW_ACTION, context) ??
        `/pharmacy?tab=rx-queue&patient_id=${patientId}`,
      enabled: pharmacyState.enabled,
      disabledReason: pharmacyState.disabledReason,
      disabledReasonKey: pharmacyState.disabledReasonKey,
      disabledReasonValues: pharmacyState.disabledReasonValues,
      activationEvents: pharmacyState.activationEvents,
      emittedEvent: pharmacyState.emittedEvent,
      requiredPermissions: pharmacyState.requiredPermissions,
    },
    {
      id: "billing",
      actionId: BILLING_FLOW_ACTION,
      blockedReason: billingState.blockedReason,
      label: "Billing",
      labelKey: "patientJourney.flow.modules.billing.label",
      description: "Open patient billing ledger and invoice queue.",
      descriptionKey: "patientJourney.flow.modules.billing.description",
      href:
        patientJourneyActionRoute(BILLING_FLOW_ACTION, context) ??
        `/billing?tab=invoices&patient_id=${patientId}`,
      enabled: billingState.enabled,
      disabledReason: billingState.disabledReason,
      disabledReasonKey: billingState.disabledReasonKey,
      disabledReasonValues: billingState.disabledReasonValues,
      activationEvents: billingState.activationEvents,
      emittedEvent: billingState.emittedEvent,
      requiredPermissions: billingState.requiredPermissions,
    },
  ];

  // A surface that never looked the orders up (undefined, not null) has no
  // business claiming the patient has none, so those chips are left out.
  const shown = items.filter(
    (item) =>
      (item.id !== "lab" || context.activeLabOrderId !== undefined) &&
      (item.id !== "radiology" || context.activeRadiologyOrderId !== undefined),
  );

  return {
    items: shown,
    summary: summarizePatientFlow(shown),
  };
}
