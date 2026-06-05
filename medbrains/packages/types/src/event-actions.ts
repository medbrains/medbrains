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
  activeOrderContext?: ClinicalOrderContext | null;
  hasPendingConsent?: boolean;
  completedEvents?: readonly string[];
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
  surfaces: readonly ClinicalJourneySurface[];
  activatesAfter: readonly string[];
  emitsEvent?: string;
  standardRefs: readonly string[];
  disabledReason: (context: ClinicalJourneyContext) => string | null;
}

export interface ResolvedClinicalJourneyAction extends ClinicalJourneyActionDefinition {
  enabled: boolean;
  disabledReasonText: string | null;
}

function activeAdmissionIsOpen(context: ClinicalJourneyContext): boolean {
  return Boolean(context.activeAdmissionId && context.activeAdmissionStatus === "admitted");
}

function activeAdmissionHasAssignedBed(context: ClinicalJourneyContext): boolean {
  return context.activeBedId === undefined || Boolean(context.activeBedId);
}

function requireLivingPatient(context: ClinicalJourneyContext): string | null {
  return context.isDeceased ? "Unavailable for deceased patient records" : null;
}

function requireOrderContext(context: ClinicalJourneyContext): string | null {
  const livingReason = requireLivingPatient(context);
  if (livingReason) return livingReason;
  if (context.activeOrderContext === "opd" && context.activeEncounterId) return null;
  if (context.activeOrderContext === "ipd" && activeAdmissionIsOpen(context)) {
    return activeAdmissionHasAssignedBed(context) ? null : "Assign a bed before inpatient orders";
  }
  return "Start an OPD visit or use an active IPD admission before ordering";
}

function eventLabel(eventName: string) {
  return eventName.replace(/\./g, " ");
}

interface CampJourneyRegistration {
  status: string;
}

const CAMP_SCREENING_COMPLETED_STATUSES = new Set(["screened", "referred", "converted"]);

export function deriveCampJourneyCompletedEvents(
  registrations: readonly CampJourneyRegistration[],
) {
  const events: string[] = [];
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

export function inferClinicalJourneyEventNames(context: ClinicalJourneyContext): readonly string[] {
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

  return [...events];
}

function activationDisabledReason(
  action: ClinicalJourneyActionDefinition,
  context: ClinicalJourneyContext,
): string | null {
  if (action.activatesAfter.length === 0) return null;

  const completedEvents = new Set(inferClinicalJourneyEventNames(context));
  if (action.activatesAfter.some((eventName) => completedEvents.has(eventName))) {
    return null;
  }

  return `Available after ${action.activatesAfter.map(eventLabel).join(" or ")}`;
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
    surfaces: ["web", "mobile"],
    activatesAfter: ["opd.encounter.created", "bed.assigned"],
    emitsEvent: "order.created",
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
    surfaces: ["web", "mobile"],
    activatesAfter: ["opd.encounter.created", "bed.assigned"],
    emitsEvent: "order.created",
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
    surfaces: ["web", "mobile"],
    activatesAfter: ["opd.encounter.created", "bed.assigned"],
    emitsEvent: "order.created",
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
    standardRefs: ["NABH AAC", "IPSG patient identification"],
    disabledReason: (context) =>
      activeAdmissionIsOpen(context) ? null : "No active IPD admission for this patient",
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
    standardRefs: ["NABH AAC", "IPSG patient identification"],
    disabledReason: (context) => {
      const livingReason = requireLivingPatient(context);
      if (livingReason) return livingReason;
      return activeAdmissionIsOpen(context) ? "Patient already has an active admission" : null;
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
    standardRefs: ["NABH AAC", "MLC SOP", "CrPC medico-legal reporting"],
    disabledReason: () => null,
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
    standardRefs: ["NABH COP discharge process", "GST healthcare billing controls"],
    disabledReason: () => null,
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
    standardRefs: [
      "NABH PRE financial counselling",
      "PCI DSS scoping if card payments are enabled",
    ],
    disabledReason: () => null,
  },
  {
    id: "pharmacy.dispense_order",
    label: "Dispense medicines",
    shortLabel: "Dispense",
    description: "Open dispensing for medication orders after order or payment events.",
    module: "pharmacy",
    intent: "clinical",
    requiredPermissions: [P.PHARMACY.DISPENSING_CREATE],
    surfaces: ["web", "mobile"],
    activatesAfter: ["order.created", "billing.payment.received"],
    emitsEvent: "pharmacy.order.dispensed",
    standardRefs: ["NABH MOM", "Drugs and Cosmetics Act", "NDPS Act where applicable"],
    disabledReason: requireLivingPatient,
  },
  {
    id: "pharmacy.open_patient_queue",
    label: "Pharmacy",
    shortLabel: "Pharmacy",
    description: "Open pharmacy orders and dispensing context for this patient.",
    module: "pharmacy",
    intent: "clinical",
    requiredPermissions: [P.PHARMACY.PRESCRIPTIONS_LIST],
    surfaces: ["web", "mobile", "tv"],
    activatesAfter: ["order.created", "pharmacy.order.dispensed"],
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
    standardRefs: ["DPDP Act 2023 sections 5, 6, 8, and 11"],
    disabledReason: () => null,
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
    standardRefs: ["NABH AAC", "IPSG patient identification"],
    disabledReason: () => null,
  },
] as const;

export function resolveClinicalJourneyActions(
  context: ClinicalJourneyContext,
  hasPermission: (code: string) => boolean,
  surface: ClinicalJourneySurface = "web",
): ResolvedClinicalJourneyAction[] {
  return CORE_PATIENT_JOURNEY_ACTIONS.filter((action) => action.surfaces.includes(surface))
    .filter((action) =>
      action.permissionMode === "any"
        ? action.requiredPermissions.some((permission) => hasPermission(permission))
        : action.requiredPermissions.every((permission) => hasPermission(permission)),
    )
    .map((action) => {
      const disabledReasonText =
        action.disabledReason(context) ?? activationDisabledReason(action, context);
      return {
        ...action,
        enabled: disabledReasonText === null,
        disabledReasonText,
      };
    });
}
