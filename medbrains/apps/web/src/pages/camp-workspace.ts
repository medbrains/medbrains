import type {
  CampRegistrationStatus,
  ClinicalEventName,
  ClinicalJourneyContext,
} from "@medbrains/types";

export const CAMP_LANDING_TAB_VALUES = ["camps", "analytics"] as const;
export const CAMP_WORK_TAB_VALUES = [
  "registrations",
  "screenings",
  "followups",
  "analytics",
] as const;

export type CampWorkTabValue = (typeof CAMP_WORK_TAB_VALUES)[number];

export function campWorkTabFromString(value: string | null | undefined): CampWorkTabValue | null {
  switch (value) {
    case "registrations":
    case "screenings":
    case "followups":
    case "analytics":
      return value;
    default:
      return null;
  }
}

export function campWorkDefaultTab(initialTab: string, registrationId?: string): CampWorkTabValue {
  if (registrationId) return "screenings";
  return campWorkTabFromString(initialTab) ?? "registrations";
}

interface CampRegistrationJourneyRow {
  id: string;
  status: CampRegistrationStatus;
}

export function activeCampRegistrationIdForJourney(
  registrations: readonly CampRegistrationJourneyRow[],
  focusedRegistrationId?: string | null,
): string | null {
  if (focusedRegistrationId) return focusedRegistrationId;

  return registrations.find((registration) => registration.status !== "no_show")?.id ?? null;
}

export function campJourneyContext(input: {
  patientId: string;
  activeCampId?: string | null;
  activeCampRegistrationId?: string | null;
  completedEvents?: readonly ClinicalEventName[];
}): ClinicalJourneyContext {
  return {
    patientId: input.patientId,
    activeCampId: input.activeCampId ?? null,
    activeCampRegistrationId: input.activeCampRegistrationId ?? null,
    completedEvents: input.completedEvents,
  };
}
