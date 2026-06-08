import type { ClinicalEventName } from "./index.js";
import { P } from "./permissions.js";

export type ClinicalJourneySurface = "web" | "mobile" | "tv" | "kiosk";

export type ClinicalJourneyActionIntent =
  | "primary"
  | "secondary"
  | "clinical"
  | "finance"
  | "warning"
  | "danger";

export type ClinicalJourneyActionId =
  | "patient.edit"
  | "patient.share"
  | "patient.print_card"
  | "opd.open_visit"
  | "orders.medication"
  | "orders.lab"
  | "orders.radiology"
  | "ipd.open_admission"
  | "ipd.admit"
  | "billing.prepare_discharge_bill"
  | "billing.collect_payment"
  | "pharmacy.dispense_order"
  | "emergency.open_visit"
  | "emergency.open_mlc"
  | "camp.open_context"
  | "billing.open_ledger"
  | "pharmacy.open_patient_queue"
  | "mrd.open_case_sheet";

export type ClinicalOrderContext = "opd" | "ipd";

export interface ClinicalJourneyContext {
  patientId: string;
  isDeceased?: boolean;
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
  activeOrderContext?: ClinicalOrderContext | null;
  billingPaymentConfigurationReady?: boolean;
  hasPendingConsent?: boolean;
  patientCardMaskingReady?: boolean;
  pharmacyRegulatoryClearanceReady?: boolean;
  completedEvents?: readonly ClinicalEventName[];
}

export interface ClinicalJourneyActionDefinition {
  id: ClinicalJourneyActionId;
  label: string;
  shortLabel: string;
  description: string;
  module:
    | "patients"
    | "opd"
    | "orders"
    | "ipd"
    | "emergency"
    | "camp"
    | "billing"
    | "pharmacy"
    | "mrd";
  intent: ClinicalJourneyActionIntent;
  requiredPermissions: readonly string[];
  permissionMode?: "all" | "any";
  surfacePermissions?: Partial<
    Record<
      ClinicalJourneySurface,
      {
        requiredPermissions: readonly string[];
        permissionMode?: "all" | "any";
      }
    >
  >;
  surfaces: readonly ClinicalJourneySurface[];
  activatesAfter: readonly ClinicalEventName[];
  emitsEvent?: ClinicalEventName;
  blockingControls?: readonly ClinicalJourneyBlockingControl[];
  standardRefs: readonly string[];
  disabledReason: (context: ClinicalJourneyContext) => ClinicalJourneyActionDisabledReason;
}

export type ClinicalJourneyBlockedReason =
  | "configuration"
  | "context"
  | "event"
  | "masking"
  | "permission"
  | "regulatory";

export type ClinicalJourneyBlockingControl = Exclude<
  ClinicalJourneyBlockedReason,
  "event" | "permission"
>;

export type ClinicalJourneyMessageValues = Readonly<Record<string, string | number | boolean>>;

export interface ClinicalJourneyActionMessage {
  key: string;
  message: string;
  values?: ClinicalJourneyMessageValues;
}

export interface ClinicalJourneyActionBlocker {
  key: string;
  message: string;
  values?: ClinicalJourneyMessageValues;
  reason: ClinicalJourneyBlockingControl;
}

export type ClinicalJourneyActionDisabledReason =
  | ClinicalJourneyActionBlocker
  | ClinicalJourneyActionMessage
  | string
  | null;

export interface ResolvedClinicalJourneyAction extends ClinicalJourneyActionDefinition {
  enabled: boolean;
  disabledReasonKey: string | null;
  disabledReasonText: string | null;
  disabledReasonValues: ClinicalJourneyMessageValues | null;
  permissionDisabledReasonKey: string | null;
  permissionAllowed: boolean;
  permissionDisabledReasonText: string | null;
  permissionDisabledReasonValues: ClinicalJourneyMessageValues | null;
  contextDisabledReasonKey: string | null;
  contextDisabledReasonText: string | null;
  contextDisabledReasonValues: ClinicalJourneyMessageValues | null;
  activationDisabledReasonKey: string | null;
  activationDisabledReasonText: string | null;
  activationDisabledReasonValues: ClinicalJourneyMessageValues | null;
  blockedReason: ClinicalJourneyBlockedReason | null;
}

export interface ResolveClinicalJourneyActionsOptions {
  includePermissionDenied?: boolean;
}

export interface ClinicalJourneyActionReadinessSummary {
  blocked: number;
  blockedActionIds: readonly ClinicalJourneyActionId[];
  configurationBlocked: number;
  configurationBlockedActionIds: readonly ClinicalJourneyActionId[];
  contextBlocked: number;
  contextBlockedActionIds: readonly ClinicalJourneyActionId[];
  enabled: number;
  eventBlocked: number;
  eventBlockedActionIds: readonly ClinicalJourneyActionId[];
  maskingBlocked: number;
  maskingBlockedActionIds: readonly ClinicalJourneyActionId[];
  permissionBlocked: number;
  permissionBlockedActionIds: readonly ClinicalJourneyActionId[];
  readyActionIds: readonly ClinicalJourneyActionId[];
  regulatoryBlocked: number;
  regulatoryBlockedActionIds: readonly ClinicalJourneyActionId[];
  total: number;
}

export type ClinicalJourneyActionSignalPhase =
  | "blocked_by_configuration"
  | "blocked_by_context"
  | "blocked_by_masking"
  | "blocked_by_permission"
  | "blocked_by_regulatory"
  | "blocked"
  | "ready"
  | "waiting_for_event";

export type ClinicalJourneyActionSignalShape = "diamond" | "pill" | "token";
export type ClinicalJourneyActionSignalTone = "active" | "blocked" | "neutral" | "ready" | "risk";

export interface ClinicalJourneyActionSignal {
  emphasis: "high" | "standard";
  phase: ClinicalJourneyActionSignalPhase;
  shape: ClinicalJourneyActionSignalShape;
  tone: ClinicalJourneyActionSignalTone;
}

export function clinicalJourneyActionSignal(
  action: Pick<ResolvedClinicalJourneyAction, "blockedReason" | "enabled">,
): ClinicalJourneyActionSignal {
  if (action.enabled) {
    return {
      emphasis: "standard",
      phase: "ready",
      shape: "pill",
      tone: "ready",
    };
  }

  switch (action.blockedReason) {
    case "configuration":
      return {
        emphasis: "standard",
        phase: "blocked_by_configuration",
        shape: "diamond",
        tone: "blocked",
      };
    case "context":
      return {
        emphasis: "standard",
        phase: "blocked_by_context",
        shape: "diamond",
        tone: "blocked",
      };
    case "event":
      return {
        emphasis: "standard",
        phase: "waiting_for_event",
        shape: "token",
        tone: "active",
      };
    case "masking":
      return {
        emphasis: "high",
        phase: "blocked_by_masking",
        shape: "diamond",
        tone: "risk",
      };
    case "permission":
      return {
        emphasis: "high",
        phase: "blocked_by_permission",
        shape: "diamond",
        tone: "risk",
      };
    case "regulatory":
      return {
        emphasis: "high",
        phase: "blocked_by_regulatory",
        shape: "diamond",
        tone: "risk",
      };
    default:
      return {
        emphasis: "standard",
        phase: "blocked",
        shape: "token",
        tone: "neutral",
      };
  }
}

interface NormalizedActionBlocker {
  key: string | null;
  message: string | null;
  values: ClinicalJourneyMessageValues | null;
  reason: ClinicalJourneyBlockingControl | null;
}

function activeAdmissionIsOpen(context: ClinicalJourneyContext): boolean {
  return Boolean(context.activeAdmissionId && context.activeAdmissionStatus === "admitted");
}

function activeAdmissionHasAssignedBed(context: ClinicalJourneyContext): boolean {
  return context.activeBedId === undefined || Boolean(context.activeBedId);
}

function actionMessage(
  key: string,
  message: string,
  values?: ClinicalJourneyMessageValues,
): ClinicalJourneyActionMessage {
  return values ? { key, message, values } : { key, message };
}

function requireLivingPatient(
  context: ClinicalJourneyContext,
): ClinicalJourneyActionDisabledReason {
  return context.isDeceased
    ? actionMessage(
        "patientJourney.blockers.unavailableForDeceasedPatientRecords",
        "Unavailable for deceased patient records",
      )
    : null;
}

function actionBlocker(
  reason: ClinicalJourneyActionBlocker["reason"],
  key: string,
  message: string,
  values?: ClinicalJourneyMessageValues,
): ClinicalJourneyActionBlocker {
  return values ? { key, message, values, reason } : { key, message, reason };
}

function normalizeActionBlocker(
  disabledReason: ClinicalJourneyActionDisabledReason,
): NormalizedActionBlocker {
  if (!disabledReason) {
    return { key: null, message: null, values: null, reason: null };
  }

  if (typeof disabledReason === "string") {
    return { key: null, message: disabledReason, values: null, reason: "context" };
  }

  if ("reason" in disabledReason) {
    return {
      key: disabledReason.key,
      message: disabledReason.message,
      values: disabledReason.values ?? null,
      reason: disabledReason.reason,
    };
  }

  return {
    key: disabledReason.key,
    message: disabledReason.message,
    values: disabledReason.values ?? null,
    reason: "context",
  };
}

function requireOrderContext(context: ClinicalJourneyContext): ClinicalJourneyActionDisabledReason {
  const livingReason = requireLivingPatient(context);
  if (livingReason) return livingReason;
  if (context.activeOrderContext === "opd" && context.activeEncounterId) return null;
  if (context.activeOrderContext === "ipd" && activeAdmissionIsOpen(context)) {
    return activeAdmissionHasAssignedBed(context)
      ? null
      : actionMessage(
          "patientJourney.blockers.assignBedBeforeInpatientOrders",
          "Assign a bed before inpatient orders",
        );
  }
  return actionMessage(
    "patientJourney.blockers.startOpdOrIpdBeforeOrdering",
    "Start an OPD visit or use an active IPD admission before ordering",
  );
}

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

function actionPermissionsForSurface(
  action: ClinicalJourneyActionDefinition,
  surface: ClinicalJourneySurface,
): Pick<ClinicalJourneyActionDefinition, "permissionMode" | "requiredPermissions"> {
  const surfacePermissions = action.surfacePermissions?.[surface];

  return {
    permissionMode: surfacePermissions?.permissionMode ?? action.permissionMode,
    requiredPermissions: surfacePermissions?.requiredPermissions ?? action.requiredPermissions,
  };
}

function permissionDisabledReason(
  permissionMode: "all" | "any" | undefined,
  requiredPermissions: readonly string[],
): ClinicalJourneyActionMessage | null {
  if (requiredPermissions.length === 0) {
    return null;
  }

  const permissions = requiredPermissions.join(permissionMode === "any" ? " / " : " + ");
  if (permissionMode === "any") {
    return actionMessage(
      "patientJourney.blockers.requiresOneOfPermissions",
      `Requires one of ${permissions}`,
      { permissions },
    );
  }

  return actionMessage("patientJourney.blockers.requiresPermissions", `Requires ${permissions}`, {
    permissions,
  });
}

interface CampJourneyRegistration {
  status: string;
}

const CAMP_SCREENING_COMPLETED_STATUSES = new Set(["screened", "referred", "converted"]);

export function deriveCampJourneyCompletedEvents(
  registrations: readonly CampJourneyRegistration[],
): readonly ClinicalEventName[] {
  const events: ClinicalEventName[] = [];
  if (registrations.length > 0) {
    events.push("camp.registration.created");
  }
  if (
    registrations.some((registration) => CAMP_SCREENING_COMPLETED_STATUSES.has(registration.status))
  ) {
    events.push("camp.screening.completed");
  }
  return events;
}

export function inferClinicalJourneyEventNames(
  context: ClinicalJourneyContext,
): readonly ClinicalEventName[] {
  const events = new Set(context.completedEvents ?? []);
  const hasExplicitBedState = context.activeBedId !== undefined;
  const hasAssignedBed = Boolean(context.activeBedId);

  if (context.activeAdmissionId && hasExplicitBedState && !hasAssignedBed) {
    events.delete("bed.assigned");
  }

  if (context.patientId) {
    events.add("patient.created");
  }
  if (context.activeEncounterId) {
    events.add("opd.encounter.created");
  }
  if (context.activeAdmissionId) {
    events.add("ipd.admission.created");
  }
  if (context.activeAdmissionId && (!hasExplicitBedState || hasAssignedBed)) {
    events.add("bed.assigned");
  }
  if (context.activeEmergencyVisitId) {
    events.add("emergency.visit.created");
  }
  if (context.activeCampId) {
    events.add("camp.started");
  }
  if (context.activeCampRegistrationId) {
    events.add("camp.registration.created");
  }
  if (context.activePharmacyOrderId || context.activePharmacyRxQueueId) {
    events.add("order.created");
  }
  if (context.activePharmacyOrderId) {
    events.add("pharmacy.prescription.reviewed");
  }
  if (context.activeInvoiceId) {
    events.add("billing.invoice.created");
  }

  return [...events];
}

function activationDisabledReason(
  action: ClinicalJourneyActionDefinition,
  context: ClinicalJourneyContext,
): ClinicalJourneyActionMessage | null {
  if (action.activatesAfter.length === 0) return null;

  const completedEvents = new Set(inferClinicalJourneyEventNames(context));
  if (action.activatesAfter.some((eventName) => completedEvents.has(eventName))) {
    return null;
  }

  return actionMessage(
    "patientJourney.blockers.availableAfterEvents",
    `Available after ${action.activatesAfter.map(eventLabel).join(" or ")}`,
  );
}

function hasAnyCompletedJourneyEvent(
  context: ClinicalJourneyContext,
  eventNames: readonly ClinicalEventName[],
): boolean {
  const completedEvents = new Set(inferClinicalJourneyEventNames(context));
  return eventNames.some((eventName) => completedEvents.has(eventName));
}

function requireLinkedContextAfterActivation(
  context: ClinicalJourneyContext,
  activationEvents: readonly ClinicalEventName[],
  key: string,
  reason: string,
): ClinicalJourneyActionDisabledReason {
  return hasAnyCompletedJourneyEvent(context, activationEvents) ? actionMessage(key, reason) : null;
}

function requireActiveAdmissionForDischargeBill(
  context: ClinicalJourneyContext,
): ClinicalJourneyActionDisabledReason {
  if (context.activeAdmissionId) return null;
  return requireLinkedContextAfterActivation(
    context,
    ["ipd.discharge.finalized"],
    "patientJourney.blockers.linkFinalizedIpdAdmissionBeforeDischargeBill",
    "Link the finalized IPD admission before preparing the discharge bill",
  );
}

function requireActiveInvoiceForPayment(
  context: ClinicalJourneyContext,
): ClinicalJourneyActionDisabledReason {
  if (context.activeInvoiceId) return null;
  return requireLinkedContextAfterActivation(
    context,
    ["billing.invoice.created", "billing.invoice.finalized"],
    "patientJourney.blockers.linkInvoiceBeforeCollectingPayment",
    "Link an invoice before collecting payment",
  );
}

function requirePaymentConfiguration(
  context: ClinicalJourneyContext,
): ClinicalJourneyActionDisabledReason {
  if (context.billingPaymentConfigurationReady === false) {
    return actionBlocker(
      "configuration",
      "patientJourney.blockers.configureActivePaymentMethodsBeforeCollectingPayment",
      "Configure active payment methods before collecting payment",
    );
  }

  return requireActiveInvoiceForPayment(context);
}

function requireActivePharmacyOrderForDispense(
  context: ClinicalJourneyContext,
): ClinicalJourneyActionDisabledReason {
  const livingReason = requireLivingPatient(context);
  if (livingReason) return livingReason;
  if (context.activePharmacyOrderId) {
    if (context.pharmacyRegulatoryClearanceReady === false) {
      return actionBlocker(
        "regulatory",
        "patientJourney.blockers.completePharmacyRegulatoryClearanceBeforeDispensingMedicines",
        "Complete pharmacy regulatory clearance before dispensing medicines",
      );
    }

    return null;
  }
  return requireLinkedContextAfterActivation(
    context,
    ["order.created", "pharmacy.prescription.reviewed", "billing.payment.received"],
    "patientJourney.blockers.linkPharmacyOrderBeforeDispensingMedicines",
    "Link the pharmacy order before dispensing medicines",
  );
}

function requireActiveEmergencyVisitForMlc(
  context: ClinicalJourneyContext,
): ClinicalJourneyActionDisabledReason {
  if (context.activeEmergencyVisitId) return null;
  return requireLinkedContextAfterActivation(
    context,
    ["emergency.visit.created"],
    "patientJourney.blockers.linkActiveErVisitBeforeMlc",
    "Link the active ER visit before opening MLC documentation",
  );
}

function requireShareConsentClearance(
  context: ClinicalJourneyContext,
): ClinicalJourneyActionDisabledReason {
  if (context.hasPendingConsent) {
    return actionBlocker(
      "regulatory",
      "patientJourney.blockers.resolvePendingPatientConsentBeforeSharingRecords",
      "Resolve pending patient consent before sharing records",
    );
  }

  return null;
}

function requirePatientCardMasking(
  context: ClinicalJourneyContext,
): ClinicalJourneyActionDisabledReason {
  if (context.patientCardMaskingReady === false) {
    return actionBlocker(
      "masking",
      "patientJourney.blockers.configurePatientCardMaskingBeforePrintingIdentifiers",
      "Configure patient-card masking before printing identifiers",
    );
  }

  return null;
}

export const CORE_PATIENT_JOURNEY_ACTIONS: readonly ClinicalJourneyActionDefinition[] = [
  {
    id: "patient.edit",
    label: "Edit patient",
    shortLabel: "Edit",
    description: "Update patient demographics and identity data.",
    module: "patients",
    intent: "secondary",
    requiredPermissions: [P.PATIENTS.UPDATE],
    surfaces: ["web", "mobile"],
    activatesAfter: ["patient.created"],
    emitsEvent: "patient.updated",
    blockingControls: ["context"],
    standardRefs: ["DPDP Act 2023 sections 8 and 12", "NABH IMS"],
    disabledReason: requireLivingPatient,
  },
  {
    id: "opd.open_visit",
    label: "New OPD visit",
    shortLabel: "OPD",
    description: "Open a new OPD encounter for the registered patient.",
    module: "opd",
    intent: "primary",
    requiredPermissions: [P.OPD.VISIT_CREATE],
    surfaces: ["web", "mobile", "kiosk"],
    activatesAfter: ["patient.created"],
    emitsEvent: "opd.encounter.created",
    blockingControls: ["context"],
    standardRefs: ["NABH AAC"],
    disabledReason: requireLivingPatient,
  },
  {
    id: "orders.medication",
    label: "Order medicines",
    shortLabel: "Medicines",
    description: "Create a medication order in the current OPD or IPD care context.",
    module: "orders",
    intent: "clinical",
    requiredPermissions: [P.ORDER_BASKET.SIGN],
    surfacePermissions: {
      mobile: { requiredPermissions: [P.OPD.VISIT_UPDATE] },
    },
    surfaces: ["web", "mobile"],
    activatesAfter: ["opd.encounter.created", "bed.assigned"],
    emitsEvent: "order.created",
    blockingControls: ["context"],
    standardRefs: ["NABH MOM", "IPSG medication safety"],
    disabledReason: requireOrderContext,
  },
  {
    id: "orders.lab",
    label: "Order lab tests",
    shortLabel: "Lab",
    description: "Create a lab order in the current OPD or IPD care context.",
    module: "orders",
    intent: "clinical",
    requiredPermissions: [P.ORDER_BASKET.SIGN],
    surfacePermissions: {
      mobile: { requiredPermissions: [P.LAB.ORDERS_CREATE] },
    },
    surfaces: ["web", "mobile"],
    activatesAfter: ["opd.encounter.created", "bed.assigned"],
    emitsEvent: "order.created",
    blockingControls: ["context"],
    standardRefs: ["NABH AAC", "NABL traceability"],
    disabledReason: requireOrderContext,
  },
  {
    id: "orders.radiology",
    label: "Order imaging",
    shortLabel: "Imaging",
    description: "Create a radiology order in the current OPD or IPD care context.",
    module: "orders",
    intent: "clinical",
    requiredPermissions: [P.ORDER_BASKET.SIGN],
    surfacePermissions: {
      mobile: { requiredPermissions: [P.RADIOLOGY.ORDERS_CREATE, P.RADIOLOGY.ORDERS_LIST] },
    },
    surfaces: ["web", "mobile"],
    activatesAfter: ["opd.encounter.created", "bed.assigned"],
    emitsEvent: "order.created",
    blockingControls: ["context"],
    standardRefs: ["NABH AAC", "DICOM integration"],
    disabledReason: requireOrderContext,
  },
  {
    id: "ipd.open_admission",
    label: "Open IPD admission",
    shortLabel: "IPD",
    description: "Open the current active inpatient workspace.",
    module: "ipd",
    intent: "clinical",
    requiredPermissions: [P.IPD.ADMISSIONS_VIEW],
    surfaces: ["web", "mobile"],
    activatesAfter: ["ipd.admission.created"],
    blockingControls: ["context"],
    standardRefs: ["NABH AAC", "IPSG patient identification"],
    disabledReason: (context) =>
      activeAdmissionIsOpen(context)
        ? null
        : actionMessage(
            "patientJourney.blockers.noActiveIpdAdmission",
            "No active IPD admission for this patient",
          ),
  },
  {
    id: "ipd.admit",
    label: "Admit to IPD",
    shortLabel: "Admit",
    description: "Start inpatient admission from the patient context.",
    module: "ipd",
    intent: "primary",
    requiredPermissions: [P.IPD.ADMISSIONS_CREATE],
    surfaces: ["web", "mobile"],
    activatesAfter: ["patient.created", "opd.encounter.created", "emergency.visit.created"],
    emitsEvent: "ipd.admission.created",
    blockingControls: ["context"],
    standardRefs: ["NABH AAC", "IPSG patient identification"],
    disabledReason: (context) => {
      const livingReason = requireLivingPatient(context);
      if (livingReason) return livingReason;
      return activeAdmissionIsOpen(context)
        ? actionMessage(
            "patientJourney.blockers.patientAlreadyHasActiveAdmission",
            "Patient already has an active admission",
          )
        : null;
    },
  },
  {
    id: "emergency.open_visit",
    label: "Emergency visit",
    shortLabel: "ER",
    description: "Open an emergency visit using this patient's registration record.",
    module: "emergency",
    intent: "danger",
    requiredPermissions: [P.EMERGENCY.VISITS_CREATE],
    surfaces: ["web", "mobile", "kiosk"],
    activatesAfter: ["patient.created"],
    emitsEvent: "emergency.visit.created",
    blockingControls: ["context"],
    standardRefs: ["NABH AAC", "MLC SOP"],
    disabledReason: requireLivingPatient,
  },
  {
    id: "emergency.open_mlc",
    label: "Open MLC",
    shortLabel: "MLC",
    description: "Open medico-legal case documentation from the emergency visit context.",
    module: "emergency",
    intent: "warning",
    requiredPermissions: [P.EMERGENCY.MLC_CREATE],
    surfaces: ["web", "mobile"],
    activatesAfter: ["emergency.visit.created"],
    emitsEvent: "mlc.created",
    blockingControls: ["context", "regulatory"],
    standardRefs: ["NABH AAC", "MLC SOP", "CrPC medico-legal reporting"],
    disabledReason: requireActiveEmergencyVisitForMlc,
  },
  {
    id: "camp.open_context",
    label: "Camp context",
    shortLabel: "Camp",
    description:
      "Open outreach camp registration, screening, and follow-up context for this patient.",
    module: "camp",
    intent: "clinical",
    requiredPermissions: [P.CAMP.LIST, P.CAMP.REGISTRATIONS_LIST, P.CAMP.REGISTRATIONS_CREATE],
    permissionMode: "any",
    surfaces: ["web", "mobile"],
    activatesAfter: ["patient.created", "camp.registration.created", "camp.screening.completed"],
    blockingControls: ["context"],
    standardRefs: ["NABH AAC", "Continuity of care for outreach services"],
    disabledReason: requireLivingPatient,
  },
  {
    id: "billing.open_ledger",
    label: "Billing ledger",
    shortLabel: "Billing",
    description: "Open the patient billing ledger and payment context.",
    module: "billing",
    intent: "finance",
    requiredPermissions: [P.BILLING.INVOICES_LIST],
    surfaces: ["web", "mobile", "kiosk"],
    activatesAfter: ["patient.created", "order.created", "billing.invoice.created"],
    standardRefs: ["DPDP Act 2023 section 8", "PCI DSS scoping if card payments are enabled"],
    disabledReason: () => null,
  },
  {
    id: "billing.prepare_discharge_bill",
    label: "Prepare discharge bill",
    shortLabel: "Discharge Bill",
    description: "Open billing with this patient filtered after discharge summary finalization.",
    module: "billing",
    intent: "finance",
    requiredPermissions: [P.BILLING.INVOICES_CREATE],
    surfaces: ["web", "mobile"],
    activatesAfter: ["ipd.discharge.finalized"],
    emitsEvent: "billing.invoice.created",
    blockingControls: ["context"],
    standardRefs: ["NABH COP discharge process", "GST healthcare billing controls"],
    disabledReason: requireActiveAdmissionForDischargeBill,
  },
  {
    id: "billing.collect_payment",
    label: "Collect payment",
    shortLabel: "Payment",
    description: "Open payment collection for the patient's finalized or created invoice.",
    module: "billing",
    intent: "finance",
    requiredPermissions: [P.BILLING.PAYMENTS_CREATE],
    surfaces: ["web", "mobile", "kiosk"],
    activatesAfter: ["billing.invoice.created", "billing.invoice.finalized"],
    emitsEvent: "billing.payment.received",
    blockingControls: ["configuration", "context"],
    standardRefs: [
      "NABH PRE financial counselling",
      "PCI DSS scoping if card payments are enabled",
    ],
    disabledReason: requirePaymentConfiguration,
  },
  {
    id: "pharmacy.dispense_order",
    label: "Dispense medicines",
    shortLabel: "Dispense",
    description: "Open dispensing for medication orders after pharmacy review or payment events.",
    module: "pharmacy",
    intent: "clinical",
    requiredPermissions: [P.PHARMACY.DISPENSING_CREATE],
    surfaces: ["web", "mobile"],
    activatesAfter: ["order.created", "pharmacy.prescription.reviewed", "billing.payment.received"],
    emitsEvent: "pharmacy.order.dispensed",
    blockingControls: ["context", "regulatory"],
    standardRefs: ["NABH MOM", "Drugs and Cosmetics Act", "NDPS Act where applicable"],
    disabledReason: requireActivePharmacyOrderForDispense,
  },
  {
    id: "pharmacy.open_patient_queue",
    label: "Pharmacy",
    shortLabel: "Pharmacy",
    description:
      "Open pharmacy prescription review, orders, and dispensing context for this patient.",
    module: "pharmacy",
    intent: "clinical",
    requiredPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST],
    surfaces: ["web", "mobile", "tv"],
    activatesAfter: ["order.created", "pharmacy.prescription.reviewed", "pharmacy.order.dispensed"],
    standardRefs: ["NABH MOM", "Drugs and Cosmetics Act", "NDPS Act where applicable"],
    disabledReason: () => null,
  },
  {
    id: "mrd.open_case_sheet",
    label: "MRD case sheet",
    shortLabel: "MRD",
    description: "Open the MRD case-sheet packet generated from the clinical workspace.",
    module: "mrd",
    intent: "secondary",
    requiredPermissions: [P.MRD.CASE_SHEETS_VIEW],
    surfaces: ["web"],
    activatesAfter: ["mrd.case_sheet.generated", "mrd.case_sheet.printed"],
    standardRefs: ["NABH IMS", "clinical record continuity"],
    disabledReason: () => null,
  },
  {
    id: "patient.share",
    label: "Share record",
    shortLabel: "Share",
    description: "Grant time-bound patient record access.",
    module: "patients",
    intent: "warning",
    requiredPermissions: [P.PATIENTS.VIEW],
    surfaces: ["web", "mobile"],
    activatesAfter: ["patient.created"],
    emitsEvent: "patient.access_shared",
    blockingControls: ["regulatory"],
    standardRefs: ["DPDP Act 2023 sections 5, 6, 8, and 11"],
    disabledReason: requireShareConsentClearance,
  },
  {
    id: "patient.print_card",
    label: "Print patient card",
    shortLabel: "Print",
    description: "Print a patient card with UHID and approved identifiers.",
    module: "patients",
    intent: "secondary",
    requiredPermissions: [P.PATIENTS.VIEW],
    surfaces: ["web", "kiosk"],
    activatesAfter: ["patient.created"],
    emitsEvent: "patient.card_printed",
    blockingControls: ["masking"],
    standardRefs: ["NABH AAC", "IPSG patient identification"],
    disabledReason: requirePatientCardMasking,
  },
] as const;

export function resolveClinicalJourneyActions(
  context: ClinicalJourneyContext,
  hasPermission: (code: string) => boolean,
  surface: ClinicalJourneySurface = "web",
  options: ResolveClinicalJourneyActionsOptions = {},
): ResolvedClinicalJourneyAction[] {
  return CORE_PATIENT_JOURNEY_ACTIONS.filter((action) => action.surfaces.includes(surface)).reduce<
    ResolvedClinicalJourneyAction[]
  >((resolved, action) => {
    const { permissionMode, requiredPermissions } = actionPermissionsForSurface(action, surface);
    const permissionAllowed =
      permissionMode === "any"
        ? requiredPermissions.some((permission) => hasPermission(permission))
        : requiredPermissions.every((permission) => hasPermission(permission));

    if (!permissionAllowed && !options.includePermissionDenied) {
      return resolved;
    }

    const permissionReason = permissionAllowed
      ? null
      : permissionDisabledReason(permissionMode, requiredPermissions);
    const contextBlocker = normalizeActionBlocker(action.disabledReason(context));
    const activationReason = activationDisabledReason(action, context);
    const disabledReasonText =
      permissionReason?.message ?? contextBlocker.message ?? activationReason?.message ?? null;
    const disabledReasonKey =
      permissionReason?.key ?? contextBlocker.key ?? activationReason?.key ?? null;
    const disabledReasonValues =
      permissionReason?.values ?? contextBlocker.values ?? activationReason?.values ?? null;
    const blockedReason: ClinicalJourneyBlockedReason | null = permissionReason
      ? "permission"
      : contextBlocker.reason
        ? contextBlocker.reason
        : activationReason
          ? "event"
          : null;

    resolved.push({
      ...action,
      permissionMode,
      requiredPermissions,
      enabled: permissionAllowed && disabledReasonText === null,
      disabledReasonKey,
      disabledReasonText,
      disabledReasonValues,
      permissionDisabledReasonKey: permissionReason?.key ?? null,
      permissionAllowed,
      permissionDisabledReasonText: permissionReason?.message ?? null,
      permissionDisabledReasonValues: permissionReason?.values ?? null,
      contextDisabledReasonKey: contextBlocker.key,
      contextDisabledReasonText: contextBlocker.message,
      contextDisabledReasonValues: contextBlocker.values,
      activationDisabledReasonKey: activationReason?.key ?? null,
      activationDisabledReasonText: activationReason?.message ?? null,
      activationDisabledReasonValues: activationReason?.values ?? null,
      blockedReason,
    });

    return resolved;
  }, []);
}

export function summarizeClinicalJourneyActions(
  actions: readonly ResolvedClinicalJourneyAction[],
): ClinicalJourneyActionReadinessSummary {
  const blockedActionIds: ClinicalJourneyActionId[] = [];
  const configurationBlockedActionIds: ClinicalJourneyActionId[] = [];
  const contextBlockedActionIds: ClinicalJourneyActionId[] = [];
  const eventBlockedActionIds: ClinicalJourneyActionId[] = [];
  const maskingBlockedActionIds: ClinicalJourneyActionId[] = [];
  const permissionBlockedActionIds: ClinicalJourneyActionId[] = [];
  const regulatoryBlockedActionIds: ClinicalJourneyActionId[] = [];
  const readyActionIds: ClinicalJourneyActionId[] = [];

  for (const action of actions) {
    if (action.enabled) {
      readyActionIds.push(action.id);
    } else {
      blockedActionIds.push(action.id);
    }

    if (action.blockedReason === "context") {
      contextBlockedActionIds.push(action.id);
    } else if (action.blockedReason === "event") {
      eventBlockedActionIds.push(action.id);
    } else if (action.blockedReason === "permission") {
      permissionBlockedActionIds.push(action.id);
    } else if (action.blockedReason === "configuration") {
      configurationBlockedActionIds.push(action.id);
    } else if (action.blockedReason === "masking") {
      maskingBlockedActionIds.push(action.id);
    } else if (action.blockedReason === "regulatory") {
      regulatoryBlockedActionIds.push(action.id);
    }
  }

  return {
    blocked: blockedActionIds.length,
    blockedActionIds,
    configurationBlocked: configurationBlockedActionIds.length,
    configurationBlockedActionIds,
    contextBlocked: contextBlockedActionIds.length,
    contextBlockedActionIds,
    enabled: readyActionIds.length,
    eventBlocked: eventBlockedActionIds.length,
    eventBlockedActionIds,
    maskingBlocked: maskingBlockedActionIds.length,
    maskingBlockedActionIds,
    permissionBlocked: permissionBlockedActionIds.length,
    permissionBlockedActionIds,
    readyActionIds,
    regulatoryBlocked: regulatoryBlockedActionIds.length,
    regulatoryBlockedActionIds,
    total: actions.length,
  };
}
