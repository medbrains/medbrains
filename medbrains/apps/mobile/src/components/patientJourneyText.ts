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
