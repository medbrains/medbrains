import type {
  ClinicalEventName,
  ClinicalJourneyActionId,
  ClinicalJourneyBlockedReason,
  ClinicalJourneyMessageValues,
  PatientFlowReadinessItem,
  ResolvedClinicalJourneyAction,
} from "@medbrains/types";

const AVAILABLE_AFTER_EVENTS_KEY = "patientJourney.blockers.availableAfterEvents";

export type PatientJourneyTranslator = (
  key: string,
  values?: ClinicalJourneyMessageValues | Record<string, string | number | boolean>,
) => unknown;

export const CLINICAL_EVENT_I18N_KEYS = {
  "patient.created": "patientJourney.events.patient.created",
  "patient.updated": "patientJourney.events.patient.updated",
  "patient.merged": "patientJourney.events.patient.merged",
  "patient.access_shared": "patientJourney.events.patient.accessShared",
  "patient.card_printed": "patientJourney.events.patient.cardPrinted",
  "patient.search.completed": "patientJourney.events.patient.searchCompleted",
  "visit.created": "patientJourney.events.visit.created",
  "emergency.visit.created": "patientJourney.events.emergency.visitCreated",
  "mlc.created": "patientJourney.events.mlc.created",
  "emergency.mlc_police_intimation.created":
    "patientJourney.events.emergency.mlcPoliceIntimationCreated",
  "opd.encounter.created": "patientJourney.events.opd.encounterCreated",
  "opd.queue.called": "patientJourney.events.opd.queueCalled",
  "opd.consultation.started": "patientJourney.events.opd.consultationStarted",
  "opd.vitals.recorded": "patientJourney.events.opd.vitalsRecorded",
  "opd.consultation.saved": "patientJourney.events.opd.consultationSaved",
  "opd.encounter.completed": "patientJourney.events.opd.encounterCompleted",
  "opd.followup.scheduled": "patientJourney.events.opd.followupScheduled",
  "opd.prescription.updated": "patientJourney.events.opd.prescriptionUpdated",
  "opd.certificate.created": "patientJourney.events.opd.certificateCreated",
  "opd.consent.signed": "patientJourney.events.opd.consentSigned",
  "camp.started": "patientJourney.events.camp.started",
  "camp.registration.created": "patientJourney.events.camp.registrationCreated",
  "camp.screening.completed": "patientJourney.events.camp.screeningCompleted",
  "order.created": "patientJourney.events.order.created",
  "order.cancelled": "patientJourney.events.order.cancelled",
  "lab.sample_collected": "patientJourney.events.lab.sampleCollected",
  "lab.result.posted": "patientJourney.events.lab.resultPosted",
  "lab.result.verified": "patientJourney.events.lab.resultVerified",
  "lab.order.completed": "patientJourney.events.lab.orderCompleted",
  "radiology.report.created": "patientJourney.events.radiology.reportCreated",
  "radiology.report.verified": "patientJourney.events.radiology.reportVerified",
  "radiology.order.completed": "patientJourney.events.radiology.orderCompleted",
  "billing.invoice.created": "patientJourney.events.billing.invoiceCreated",
  "billing.invoice.finalized": "patientJourney.events.billing.invoiceFinalized",
  "billing.payment.received": "patientJourney.events.billing.paymentReceived",
  "pharmacy.order.dispensed": "patientJourney.events.pharmacy.orderDispensed",
  "pharmacy.prescription.reviewed": "patientJourney.events.pharmacy.prescriptionReviewed",
  "pharmacy.stock.movement.created": "patientJourney.events.pharmacy.stockMovementCreated",
  "pharmacy.ndps.movement.created": "patientJourney.events.pharmacy.ndpsMovementCreated",
  "indent.requisition.submitted": "patientJourney.events.indent.requisitionSubmitted",
  "indent.requisition.approved": "patientJourney.events.indent.requisitionApproved",
  "indent.requisition.issued": "patientJourney.events.indent.requisitionIssued",
  "ipd.admission.created": "patientJourney.events.ipd.admissionCreated",
  "bed.assigned": "patientJourney.events.bed.assigned",
  "bed.transferred": "patientJourney.events.bed.transferred",
  "ipd.discharge.initiated": "patientJourney.events.ipd.dischargeInitiated",
  "ipd.discharge.completed": "patientJourney.events.ipd.dischargeCompleted",
  "ipd.discharge.finalized": "patientJourney.events.ipd.dischargeFinalized",
  "mrd.case_sheet.generated": "patientJourney.events.mrd.caseSheetGenerated",
  "mrd.case_sheet.printed": "patientJourney.events.mrd.caseSheetPrinted",
  "quality.incident.reported": "patientJourney.events.quality.incidentReported",
  "emergency.code_blue.activated": "patientJourney.events.emergency.codeBlueActivated",
  "emergency.code_blue.completed": "patientJourney.events.emergency.codeBlueCompleted",
  "blood.transfusion_reaction.reported": "patientJourney.events.blood.transfusionReactionReported",
  "bme.equipment_downtime.recorded": "patientJourney.events.bme.equipmentDowntimeRecorded",
  "housekeeping.bmw_disposal.recorded": "patientJourney.events.housekeeping.bmwDisposalRecorded",
} satisfies Record<ClinicalEventName, string>;

type JourneyActionTextField = "description" | "label" | "shortLabel";

function translate(
  t: PatientJourneyTranslator,
  key: string,
  values?: ClinicalJourneyMessageValues | Record<string, string | number | boolean>,
): string {
  const translated = t(key, values);
  return typeof translated === "string" ? translated : String(translated);
}

function journeyActionTextKey(actionId: ClinicalJourneyActionId, field: JourneyActionTextField) {
  return `patientJourney.actions.${actionId}.${field}`;
}

function joinWithOr(t: PatientJourneyTranslator, values: readonly string[]): string {
  if (values.length === 0) return "";

  return values
    .slice(1)
    .reduce(
      (left, right) => translate(t, "patientJourney.lists.orJoin", { left, right }),
      values[0] ?? "",
    );
}

export function clinicalEventLabel(
  t: PatientJourneyTranslator,
  eventName: ClinicalEventName,
): string {
  return translate(t, CLINICAL_EVENT_I18N_KEYS[eventName]);
}

export function clinicalEventList(
  t: PatientJourneyTranslator,
  eventNames: readonly ClinicalEventName[],
): string {
  return joinWithOr(
    t,
    eventNames.map((eventName) => clinicalEventLabel(t, eventName)),
  );
}

export function journeyActionLabel(
  t: PatientJourneyTranslator,
  actionId: ClinicalJourneyActionId,
): string {
  return translate(t, journeyActionTextKey(actionId, "label"));
}

export function journeyActionShortLabel(
  t: PatientJourneyTranslator,
  actionId: ClinicalJourneyActionId,
): string {
  return translate(t, journeyActionTextKey(actionId, "shortLabel"));
}

export function journeyActionDescription(
  t: PatientJourneyTranslator,
  actionId: ClinicalJourneyActionId,
): string {
  return translate(t, journeyActionTextKey(actionId, "description"));
}

export function journeyBlockedReasonLabel(
  t: PatientJourneyTranslator,
  reason: ClinicalJourneyBlockedReason | null,
): string | null {
  return reason ? translate(t, `patientJourney.blockedReasons.${reason}`) : null;
}

export function journeyMessage(
  t: PatientJourneyTranslator,
  key: string | null,
  values: ClinicalJourneyMessageValues | null,
  activationEvents: readonly ClinicalEventName[],
  fallbackText: string | null,
): string | null {
  if (!key) return fallbackText;

  if (key === AVAILABLE_AFTER_EVENTS_KEY) {
    return translate(t, key, { events: clinicalEventList(t, activationEvents) });
  }

  return translate(t, key, values ?? undefined);
}

export function journeyActionDisabledReason(
  t: PatientJourneyTranslator,
  action: ResolvedClinicalJourneyAction,
): string | null {
  return journeyMessage(
    t,
    action.disabledReasonKey,
    action.disabledReasonValues,
    action.activatesAfter,
    action.disabledReasonText,
  );
}

export function journeyActionAvailability(
  t: PatientJourneyTranslator,
  action: ResolvedClinicalJourneyAction,
) {
  if (!action.enabled) return journeyActionDisabledReason(t, action);
  if (action.activatesAfter.length === 0) return translate(t, "patientJourney.status.available");

  return translate(t, "patientJourney.status.afterEvents", {
    events: clinicalEventList(t, action.activatesAfter),
  });
}

export function patientFlowItemLabel(
  t: PatientJourneyTranslator,
  item: PatientFlowReadinessItem,
): string {
  return translate(t, item.labelKey);
}

export function patientFlowItemDescription(
  t: PatientJourneyTranslator,
  item: PatientFlowReadinessItem,
): string {
  return translate(t, item.descriptionKey);
}

export function patientFlowItemDisabledReason(
  t: PatientJourneyTranslator,
  item: PatientFlowReadinessItem,
): string | null {
  return journeyMessage(
    t,
    item.disabledReasonKey,
    item.disabledReasonValues,
    item.activationEvents,
    item.disabledReason,
  );
}
