import type {
  ClinicalJourneyActionId,
  ClinicalJourneyContext,
  ClinicalJourneySurface,
  ClinicalOrderContext,
  ResolvedClinicalJourneyAction,
} from "./event-actions.js";
import { resolveClinicalJourneyActions } from "./event-actions.js";
import type { ClinicalEventName } from "./index.js";
import { patientJourneyActionRoute } from "./patient-journey-routes.js";
import { P } from "./permissions.js";

export type PatientFlowModule =
  | "patient"
  | "opd"
  | "ipd"
  | "emergency"
  | "camp"
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
  activeOrderContext?: ClinicalOrderContext | null;
  completedEvents?: readonly ClinicalEventName[];
  isDeceased?: boolean;
}

export interface PatientFlowReadinessItem {
  id: PatientFlowModule;
  actionId: ClinicalJourneyActionId | null;
  label: string;
  description: string;
  href: string;
  enabled: boolean;
  disabledReason: string | null;
  activationEvents: readonly ClinicalEventName[];
  emittedEvent: ClinicalEventName | null;
  requiredPermissions: readonly string[];
}

export interface PatientFlowReadinessSummary {
  blocked: number;
  blockedModules: readonly PatientFlowModule[];
  enabled: number;
  readyModules: readonly PatientFlowModule[];
  total: number;
}

export interface PatientFlowReadiness {
  items: readonly PatientFlowReadinessItem[];
  summary: PatientFlowReadinessSummary;
}

const OPD_FLOW_ACTION = "opd.open_visit" satisfies ClinicalJourneyActionId;
const EMERGENCY_FLOW_ACTION = "emergency.open_visit" satisfies ClinicalJourneyActionId;
const CAMP_FLOW_ACTION = "camp.open_context" satisfies ClinicalJourneyActionId;
const PHARMACY_FLOW_ACTION = "pharmacy.open_patient_queue" satisfies ClinicalJourneyActionId;
const BILLING_FLOW_ACTION = "billing.open_ledger" satisfies ClinicalJourneyActionId;

function resolvedActionMap(actions: ResolvedClinicalJourneyAction[]) {
  return new Map(actions.map((action) => [action.id, action]));
}

function itemState(
  action: ResolvedClinicalJourneyAction | undefined,
  fallbackEnabled: boolean,
  fallbackReason = "Permission required",
  fallbackActivationEvents: readonly ClinicalEventName[] = [],
  fallbackPermissions: readonly string[] = [],
) {
  if (!action) {
    return {
      enabled: fallbackEnabled,
      disabledReason: fallbackEnabled ? null : fallbackReason,
      activationEvents: fallbackActivationEvents,
      emittedEvent: null,
      requiredPermissions: fallbackPermissions,
    };
  }

  return {
    enabled: action.enabled,
    disabledReason: action.enabled ? null : action.disabledReasonText,
    activationEvents: action.activatesAfter,
    emittedEvent: action.emitsEvent ?? null,
    requiredPermissions: action.requiredPermissions,
  };
}

function summarizePatientFlow(
  items: readonly PatientFlowReadinessItem[],
): PatientFlowReadinessSummary {
  const readyModules = items.filter((item) => item.enabled).map((item) => item.id);
  const blockedModules = items.filter((item) => !item.enabled).map((item) => item.id);

  return {
    blocked: blockedModules.length,
    blockedModules,
    enabled: readyModules.length,
    readyModules,
    total: items.length,
  };
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
    activeOrderContext,
    activePharmacyOrderId,
    completedEvents,
    isDeceased,
    patientId,
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
    activePharmacyOrderId,
    activeAdmissionStatus: activeAdmissionStatus ?? (activeAdmissionId ? "admitted" : null),
    activeOrderContext:
      activeOrderContext ?? (activeEncounterId ? "opd" : activeAdmissionId ? "ipd" : null),
    completedEvents,
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
  const pharmacyState = itemState(
    actions.get(PHARMACY_FLOW_ACTION),
    hasPermission(P.PHARMACY.PRESCRIPTIONS_LIST),
    "Permission required",
    ["order.created", "pharmacy.order.dispensed"],
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
      label: "Patient",
      description: "Open patient registration and longitudinal record.",
      href: `/patients/${patientId}#overview`,
      enabled: patientState.enabled,
      disabledReason: patientState.disabledReason,
      activationEvents: patientState.activationEvents,
      emittedEvent: patientState.emittedEvent,
      requiredPermissions: patientState.requiredPermissions,
    },
    {
      id: "opd",
      actionId: OPD_FLOW_ACTION,
      label: "OPD",
      description: context.activeEncounterId ? "Open active OPD encounter." : "Start an OPD visit.",
      href:
        patientJourneyActionRoute(OPD_FLOW_ACTION, context) ?? `/opd/new?patient_id=${patientId}`,
      enabled: opdState.enabled,
      disabledReason: opdState.disabledReason,
      activationEvents: opdState.activationEvents,
      emittedEvent: opdState.emittedEvent,
      requiredPermissions: opdState.requiredPermissions,
    },
    {
      id: "ipd",
      actionId: ipdActionId,
      label: "IPD",
      description: context.activeAdmissionId
        ? "Open active IPD admission."
        : "Start an IPD admission.",
      href: patientJourneyActionRoute(ipdActionId, context) ?? `/ipd/new?patient_id=${patientId}`,
      enabled: ipdState.enabled,
      disabledReason: ipdState.disabledReason,
      activationEvents: ipdState.activationEvents,
      emittedEvent: ipdState.emittedEvent,
      requiredPermissions: ipdState.requiredPermissions,
    },
    {
      id: "emergency",
      actionId: EMERGENCY_FLOW_ACTION,
      label: "ER",
      description: context.activeEmergencyVisitId
        ? "Open emergency visit."
        : "Register emergency visit.",
      href:
        patientJourneyActionRoute(EMERGENCY_FLOW_ACTION, context) ??
        `/emergency/visits/new?patient_id=${patientId}`,
      enabled: emergencyState.enabled,
      disabledReason: emergencyState.disabledReason,
      activationEvents: emergencyState.activationEvents,
      emittedEvent: emergencyState.emittedEvent,
      requiredPermissions: emergencyState.requiredPermissions,
    },
    {
      id: "camp",
      actionId: CAMP_FLOW_ACTION,
      label: "Camp",
      description: "Open camp registration and screening workspace.",
      href: patientJourneyActionRoute(CAMP_FLOW_ACTION, context) ?? `/camp?patient_id=${patientId}`,
      enabled: campState.enabled,
      disabledReason: campState.disabledReason,
      activationEvents: campState.activationEvents,
      emittedEvent: campState.emittedEvent,
      requiredPermissions: campState.requiredPermissions,
    },
    {
      id: "pharmacy",
      actionId: PHARMACY_FLOW_ACTION,
      label: "Pharmacy",
      description: "Open patient pharmacy orders and dispensing queue.",
      href:
        patientJourneyActionRoute(PHARMACY_FLOW_ACTION, context) ??
        `/pharmacy?tab=orders&patient_id=${patientId}`,
      enabled: pharmacyState.enabled,
      disabledReason: pharmacyState.disabledReason,
      activationEvents: pharmacyState.activationEvents,
      emittedEvent: pharmacyState.emittedEvent,
      requiredPermissions: pharmacyState.requiredPermissions,
    },
    {
      id: "billing",
      actionId: BILLING_FLOW_ACTION,
      label: "Billing",
      description: "Open patient billing ledger and invoice queue.",
      href:
        patientJourneyActionRoute(BILLING_FLOW_ACTION, context) ??
        `/billing?tab=invoices&patient_id=${patientId}`,
      enabled: billingState.enabled,
      disabledReason: billingState.disabledReason,
      activationEvents: billingState.activationEvents,
      emittedEvent: billingState.emittedEvent,
      requiredPermissions: billingState.requiredPermissions,
    },
  ];

  return {
    items,
    summary: summarizePatientFlow(items),
  };
}
