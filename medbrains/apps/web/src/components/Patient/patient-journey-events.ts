import type { ClinicalEventName, ClinicalJourneyContext } from "@medbrains/types";

export { deriveCampJourneyCompletedEvents } from "@medbrains/types";

import type { ClinicalEventTrace } from "@/components/clinical-events";

function eventName(event: ClinicalEventTrace): ClinicalEventName | null {
  return event.eventName;
}

function eventPayloadString(event: ClinicalEventTrace, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = event.payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function clinicalEventMatchesCampContext(
  event: ClinicalEventTrace,
  context: ClinicalJourneyContext,
) {
  return (
    (context.activeCampId != null &&
      (event.sourceRecordId === context.activeCampId ||
        eventPayloadString(event, ["camp_id", "campId"]) === context.activeCampId)) ||
    (context.activeCampRegistrationId != null &&
      (event.sourceRecordId === context.activeCampRegistrationId ||
        eventPayloadString(event, [
          "camp_registration_id",
          "campRegistrationId",
          "registration_id",
          "registrationId",
        ]) === context.activeCampRegistrationId))
  );
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
      event.sourceRecordId === context.activeEmergencyVisitId) ||
    clinicalEventMatchesCampContext(event, context)
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
