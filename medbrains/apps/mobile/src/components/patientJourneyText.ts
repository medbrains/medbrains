import type { ClinicalJourneyMessageValues, PatientJourneyTranslator } from "@medbrains/types";

export const MOBILE_PATIENT_JOURNEY_BLOCKERS = {
  openActiveIpdEncounterBeforeMobileInpatientOrders:
    "patientJourney.mobile.blockers.openActiveIpdEncounterBeforeMobileInpatientOrders",
  openOpdEncounterBeforeMobileConsultation:
    "patientJourney.mobile.blockers.openOpdEncounterBeforeMobileConsultation",
  openOpdEncounterBeforeMobileOrders:
    "patientJourney.mobile.blockers.openOpdEncounterBeforeMobileOrders",
} as const;

export const MOBILE_PATIENT_JOURNEY_TEXT = {
  actionPanel: {
    title: "patientJourney.mobile.actionPanel.title",
    subtitle: "patientJourney.mobile.actionPanel.subtitle",
  },
  flow: {
    title: "patientJourney.mobile.flow.title",
    handoffs: {
      billing: "patientJourney.mobile.flow.handoffs.billing",
      camp: "patientJourney.mobile.flow.handoffs.camp",
      emergency: "patientJourney.mobile.flow.handoffs.emergency",
      ipd: "patientJourney.mobile.flow.handoffs.ipd",
      opd: "patientJourney.mobile.flow.handoffs.opd",
      patient: "patientJourney.mobile.flow.handoffs.patient",
      pharmacy: "patientJourney.mobile.flow.handoffs.pharmacy",
    },
  },
  status: {
    blocked: "patientJourney.mobile.status.blocked",
    emitsEvent: "patientJourney.mobile.status.emitsEvent",
    ready: "patientJourney.mobile.status.ready",
  },
  summary: {
    awaitingEventCount: "patientJourney.mobile.summary.awaitingEventCount",
    blockedCount: "patientJourney.mobile.summary.blockedCount",
    configCount: "patientJourney.mobile.summary.configCount",
    maskingCount: "patientJourney.mobile.summary.maskingCount",
    permissionCount: "patientJourney.mobile.summary.permissionCount",
    readyCount: "patientJourney.mobile.summary.readyCount",
    regulatoryCount: "patientJourney.mobile.summary.regulatoryCount",
  },
} as const;

export const MOBILE_CARE_CONTEXT_TEXT = {
  common: {
    activeCount: "patientJourney.mobile.careContext.common.activeCount",
    hiddenField: "patientJourney.mobile.careContext.common.hiddenField",
    linked: "patientJourney.mobile.careContext.common.linked",
    noUhid: "patientJourney.mobile.careContext.common.noUhid",
    notRecorded: "patientJourney.mobile.careContext.common.notRecorded",
    patient: "patientJourney.mobile.careContext.common.patient",
    patientContext: "patientJourney.mobile.careContext.common.patientContext",
    patientIdentity: "patientJourney.mobile.careContext.common.patientIdentity",
    restricted: "patientJourney.mobile.careContext.common.restricted",
    selected: "patientJourney.mobile.careContext.common.selected",
  },
  camp: {
    chiefComplaint: "patientJourney.mobile.careContext.camp.chiefComplaint",
    registeredAt: "patientJourney.mobile.careContext.camp.registeredAt",
    serviceLine: "patientJourney.mobile.careContext.camp.serviceLine",
  },
  empty: {
    contextUnavailableTitle: "patientJourney.mobile.careContext.empty.contextUnavailableTitle",
    noCampMessage: "patientJourney.mobile.careContext.empty.noCampMessage",
    noCampTitle: "patientJourney.mobile.careContext.empty.noCampTitle",
    noEmergencyMessage: "patientJourney.mobile.careContext.empty.noEmergencyMessage",
    noEmergencyTitle: "patientJourney.mobile.careContext.empty.noEmergencyTitle",
    noIpdMessage: "patientJourney.mobile.careContext.empty.noIpdMessage",
    noIpdTitle: "patientJourney.mobile.careContext.empty.noIpdTitle",
    restrictedTitle: "patientJourney.mobile.careContext.empty.restrictedTitle",
  },
  emergency: {
    arrivedAt: "patientJourney.mobile.careContext.emergency.arrivedAt",
    bay: "patientJourney.mobile.careContext.emergency.bay",
    chiefComplaint: "patientJourney.mobile.careContext.emergency.chiefComplaint",
    mlc: "patientJourney.mobile.careContext.emergency.mlc",
    triage: "patientJourney.mobile.careContext.emergency.triage",
    unassigned: "patientJourney.mobile.careContext.emergency.unassigned",
  },
  identity: {
    loadingPatient: "patientJourney.mobile.careContext.identity.loadingPatient",
    patientIdentityUnavailable:
      "patientJourney.mobile.careContext.identity.patientIdentityUnavailable",
    uhidUnavailable: "patientJourney.mobile.careContext.identity.uhidUnavailable",
  },
  ipd: {
    admittedAt: "patientJourney.mobile.careContext.ipd.admittedAt",
    admittingDoctor: "patientJourney.mobile.careContext.ipd.admittingDoctor",
    bedAssigned: "patientJourney.mobile.careContext.ipd.bedAssigned",
    bedPending: "patientJourney.mobile.careContext.ipd.bedPending",
    bedPendingDescription: "patientJourney.mobile.careContext.ipd.bedPendingDescription",
    recordVitals: "patientJourney.mobile.careContext.ipd.recordVitals",
    wardPending: "patientJourney.mobile.careContext.ipd.wardPending",
  },
  loading: {
    handoffContext: "patientJourney.mobile.careContext.loading.handoffContext",
  },
  modules: {
    campTitle: "patientJourney.mobile.careContext.modules.campTitle",
    campSubtitle: "patientJourney.mobile.careContext.modules.campSubtitle",
    campPermission: "patientJourney.mobile.careContext.modules.campPermission",
    campUnavailable: "patientJourney.mobile.careContext.modules.campUnavailable",
    emergencyTitle: "patientJourney.mobile.careContext.modules.emergencyTitle",
    emergencyMlcTitle: "patientJourney.mobile.careContext.modules.emergencyMlcTitle",
    emergencySubtitle: "patientJourney.mobile.careContext.modules.emergencySubtitle",
    emergencyPermission: "patientJourney.mobile.careContext.modules.emergencyPermission",
    emergencyUnavailable: "patientJourney.mobile.careContext.modules.emergencyUnavailable",
    ipdTitle: "patientJourney.mobile.careContext.modules.ipdTitle",
    ipdAdmitTitle: "patientJourney.mobile.careContext.modules.ipdAdmitTitle",
    ipdSubtitle: "patientJourney.mobile.careContext.modules.ipdSubtitle",
    ipdPermission: "patientJourney.mobile.careContext.modules.ipdPermission",
    ipdUnavailable: "patientJourney.mobile.careContext.modules.ipdUnavailable",
  },
} as const;

const MOBILE_PATIENT_JOURNEY_MESSAGES: Record<string, string> = {
  "patientJourney.blockedReasons.configuration": "Configuration",
  "patientJourney.blockedReasons.context": "Context",
  "patientJourney.blockedReasons.event": "Event",
  "patientJourney.blockedReasons.masking": "Masking",
  "patientJourney.blockedReasons.permission": "Permission",
  "patientJourney.blockedReasons.regulatory": "Regulatory",
  "patientJourney.events.bed.assigned": "bed assigned",
  "patientJourney.events.billing.invoiceCreated": "billing invoice created",
  "patientJourney.events.billing.invoiceFinalized": "billing invoice finalized",
  "patientJourney.events.billing.paymentReceived": "billing payment received",
  "patientJourney.events.camp.started": "camp started",
  "patientJourney.events.camp.registrationCreated": "camp registration created",
  "patientJourney.events.camp.screeningCompleted": "camp screening completed",
  "patientJourney.events.emergency.visitCreated": "emergency visit created",
  "patientJourney.events.ipd.admissionCreated": "IPD admission created",
  "patientJourney.events.ipd.dischargeFinalized": "IPD discharge finalized",
  "patientJourney.events.opd.encounterCreated": "OPD encounter created",
  "patientJourney.events.order.created": "order created",
  "patientJourney.events.patient.created": "patient created",
  "patientJourney.events.pharmacy.orderDispensed": "pharmacy order dispensed",
  "patientJourney.events.pharmacy.prescriptionReviewed": "pharmacy prescription reviewed",
  "patientJourney.lists.orJoin": "{{left}} or {{right}}",
  "patientJourney.mobile.blockers.openActiveIpdEncounterBeforeMobileInpatientOrders":
    "Open an active IPD encounter before mobile inpatient orders",
  "patientJourney.mobile.blockers.openOpdEncounterBeforeMobileConsultation":
    "Open an OPD encounter before mobile consultation",
  "patientJourney.mobile.blockers.openOpdEncounterBeforeMobileOrders":
    "Open an OPD encounter before mobile orders",
  "patientJourney.mobile.actionPanel.title": "Patient Flow",
  "patientJourney.mobile.actionPanel.subtitle": "Event and permission driven mobile handoffs",
  "patientJourney.mobile.flow.title": "Flow Handoffs",
  "patientJourney.mobile.flow.handoffs.billing": "Bill",
  "patientJourney.mobile.flow.handoffs.camp": "Camp",
  "patientJourney.mobile.flow.handoffs.emergency": "ER",
  "patientJourney.mobile.flow.handoffs.ipd": "Ward",
  "patientJourney.mobile.flow.handoffs.opd": "Clinic",
  "patientJourney.mobile.flow.handoffs.patient": "Record",
  "patientJourney.mobile.flow.handoffs.pharmacy": "Rx",
  "patientJourney.mobile.status.blocked": "Blocked",
  "patientJourney.mobile.status.emitsEvent": "Emits {{event}}",
  "patientJourney.mobile.status.ready": "Ready",
  "patientJourney.mobile.summary.awaitingEventCount": "{{count}} awaiting event",
  "patientJourney.mobile.summary.blockedCount": "{{count}} blocked",
  "patientJourney.mobile.summary.configCount": "{{count}} config",
  "patientJourney.mobile.summary.maskingCount": "{{count}} masking",
  "patientJourney.mobile.summary.permissionCount": "{{count}} permission",
  "patientJourney.mobile.summary.readyCount": "{{enabled}}/{{total}} ready",
  "patientJourney.mobile.summary.regulatoryCount": "{{count}} regulatory",
  "patientJourney.mobile.careContext.common.activeCount": "{{count}} active",
  "patientJourney.mobile.careContext.common.hiddenField": "Restricted",
  "patientJourney.mobile.careContext.common.linked": "Linked",
  "patientJourney.mobile.careContext.common.noUhid": "No UHID",
  "patientJourney.mobile.careContext.common.notRecorded": "Not recorded",
  "patientJourney.mobile.careContext.common.patient": "Patient",
  "patientJourney.mobile.careContext.common.patientContext": "Patient context",
  "patientJourney.mobile.careContext.common.patientIdentity": "Patient identity",
  "patientJourney.mobile.careContext.common.restricted": "Restricted",
  "patientJourney.mobile.careContext.common.selected": "Selected",
  "patientJourney.mobile.careContext.camp.chiefComplaint": "Chief complaint",
  "patientJourney.mobile.careContext.camp.registeredAt": "Registered {{date}}",
  "patientJourney.mobile.careContext.camp.serviceLine": "Service line",
  "patientJourney.mobile.careContext.empty.contextUnavailableTitle": "Context unavailable",
  "patientJourney.mobile.careContext.empty.noCampMessage":
    "No outreach registrations match this patient.",
  "patientJourney.mobile.careContext.empty.noCampTitle": "No camp records",
  "patientJourney.mobile.careContext.empty.noEmergencyMessage": "No ER visits match this patient.",
  "patientJourney.mobile.careContext.empty.noEmergencyTitle": "No emergency records",
  "patientJourney.mobile.careContext.empty.noIpdMessage": "No admissions match this patient.",
  "patientJourney.mobile.careContext.empty.noIpdTitle": "No IPD records",
  "patientJourney.mobile.careContext.empty.restrictedTitle": "Restricted context",
  "patientJourney.mobile.careContext.emergency.arrivedAt": "Arrived {{date}}",
  "patientJourney.mobile.careContext.emergency.bay": "Bay",
  "patientJourney.mobile.careContext.emergency.chiefComplaint": "Chief complaint",
  "patientJourney.mobile.careContext.emergency.mlc": "MLC",
  "patientJourney.mobile.careContext.emergency.triage": "Triage",
  "patientJourney.mobile.careContext.emergency.unassigned": "Unassigned",
  "patientJourney.mobile.careContext.identity.loadingPatient": "Loading patient...",
  "patientJourney.mobile.careContext.identity.patientIdentityUnavailable":
    "Patient identity unavailable",
  "patientJourney.mobile.careContext.identity.uhidUnavailable": "UHID unavailable",
  "patientJourney.mobile.careContext.ipd.admittedAt": "Admitted {{date}}",
  "patientJourney.mobile.careContext.ipd.admittingDoctor": "Admitting doctor",
  "patientJourney.mobile.careContext.ipd.bedAssigned": "Bed assigned",
  "patientJourney.mobile.careContext.ipd.bedPending": "Bed pending",
  "patientJourney.mobile.careContext.ipd.bedPendingDescription":
    "Admission cannot proceed to bedside orders yet",
  "patientJourney.mobile.careContext.ipd.recordVitals": "Record vitals",
  "patientJourney.mobile.careContext.ipd.wardPending": "Ward pending",
  "patientJourney.mobile.careContext.loading.handoffContext": "Loading handoff context...",
  "patientJourney.mobile.careContext.modules.campPermission":
    "Camp registration list permission is required to show outreach records.",
  "patientJourney.mobile.careContext.modules.campSubtitle":
    "Review outreach registration and screening continuity for this patient.",
  "patientJourney.mobile.careContext.modules.campTitle": "Camp continuity handoff",
  "patientJourney.mobile.careContext.modules.campUnavailable":
    "The latest camp records could not be loaded.",
  "patientJourney.mobile.careContext.modules.emergencyMlcTitle": "MLC handoff",
  "patientJourney.mobile.careContext.modules.emergencyPermission":
    "Emergency visit list permission is required to show ER records.",
  "patientJourney.mobile.careContext.modules.emergencySubtitle":
    "Review emergency visits, triage state, and MLC-sensitive context.",
  "patientJourney.mobile.careContext.modules.emergencyTitle": "Emergency handoff",
  "patientJourney.mobile.careContext.modules.emergencyUnavailable":
    "The latest emergency records could not be loaded.",
  "patientJourney.mobile.careContext.modules.ipdAdmitTitle": "IPD admission handoff",
  "patientJourney.mobile.careContext.modules.ipdPermission":
    "IPD admission list permission is required to show inpatient records.",
  "patientJourney.mobile.careContext.modules.ipdSubtitle":
    "Review admission status, bed state, and inpatient handoff details.",
  "patientJourney.mobile.careContext.modules.ipdTitle": "IPD care context",
  "patientJourney.mobile.careContext.modules.ipdUnavailable":
    "The latest IPD records could not be loaded.",
  "patientJourney.status.available": "Available",
  "patientJourney.status.afterEvents": "After {{events}}",
};

function interpolate(
  template: string,
  values?: ClinicalJourneyMessageValues | Record<string, string | number | boolean>,
): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export const mobilePatientJourneyTranslator: PatientJourneyTranslator = (key, values) => {
  const template = MOBILE_PATIENT_JOURNEY_MESSAGES[key];

  return template ? interpolate(template, values) : key;
};

export function mobilePatientJourneyText(
  key: string,
  values?: ClinicalJourneyMessageValues | Record<string, string | number | boolean>,
): string {
  const translated = mobilePatientJourneyTranslator(key, values);
  return typeof translated === "string" ? translated : key;
}
