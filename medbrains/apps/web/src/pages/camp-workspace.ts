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
