import type { ClinicalEventName, ClinicalJourneyContext } from "@medbrains/types";

export { deriveCampJourneyCompletedEvents } from "@medbrains/types";

import type { ClinicalEventTrace } from "@/components/clinical-events";

function eventName(event: ClinicalEventTrace): ClinicalEventName | null {
  return event.eventName;
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
): readonly ClinicalEventName[] {
  const matchedEvents = events
    .filter((event) => clinicalEventMatchesJourney(event, context))
    .map(eventName)
    .filter((name): name is ClinicalEventName => name !== null);
  const completedEvents = new Set<ClinicalEventName>(context.completedEvents ?? []);

  for (const name of matchedEvents) {
    completedEvents.add(name);
  }

  return [...completedEvents];
}
