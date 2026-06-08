import type { ClinicalJourneyMessageValues, PatientJourneyTranslator } from "@medbrains/types";

export const MOBILE_PATIENT_JOURNEY_BLOCKERS = {
  openActiveIpdEncounterBeforeMobileInpatientOrders:
    "patientJourney.mobile.blockers.openActiveIpdEncounterBeforeMobileInpatientOrders",
  openOpdEncounterBeforeMobileConsultation:
    "patientJourney.mobile.blockers.openOpdEncounterBeforeMobileConsultation",
  openOpdEncounterBeforeMobileOrders:
    "patientJourney.mobile.blockers.openOpdEncounterBeforeMobileOrders",
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
