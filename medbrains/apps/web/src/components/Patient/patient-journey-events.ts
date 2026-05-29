import type { ClinicalJourneyContext } from "@medbrains/types";
import type { ClinicalEventTrace } from "@/components/clinical-events";

function eventName(event: ClinicalEventTrace) {
  return event.eventName ?? event.rawTrigger;
}

export function clinicalEventMatchesJourney(
  event: ClinicalEventTrace,
  context: ClinicalJourneyContext,
) {
  return (
    event.patientId === context.patientId ||
    (context.activeAdmissionId != null && event.admissionId === context.activeAdmissionId) ||
    (context.activeEncounterId != null && event.encounterId === context.activeEncounterId) ||
    (context.activeEmergencyVisitId != null &&
      event.sourceRecordId === context.activeEmergencyVisitId)
  );
}

export function mergeJourneyEventNames(
  context: ClinicalJourneyContext,
  events: readonly ClinicalEventTrace[],
) {
  return [
    ...new Set([
      ...(context.completedEvents ?? []),
      ...events.filter((event) => clinicalEventMatchesJourney(event, context)).map(eventName),
    ]),
  ];
}
