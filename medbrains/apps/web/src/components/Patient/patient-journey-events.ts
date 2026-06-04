import type { CampRegistration, ClinicalJourneyContext } from "@medbrains/types";
import type { ClinicalEventTrace } from "@/components/clinical-events";

const CAMP_SCREENING_COMPLETED_STATUSES = new Set<CampRegistration["status"]>([
  "screened",
  "referred",
  "converted",
]);

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

export function deriveCampJourneyCompletedEvents(registrations: readonly CampRegistration[]) {
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
