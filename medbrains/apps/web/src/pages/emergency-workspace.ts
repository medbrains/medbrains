export const EMERGENCY_TAB_VALUES = [
  "visits",
  "triage",
  "resuscitation",
  "codes",
  "mlc",
  "mass-casualty",
] as const;

export type EmergencyTabKey = (typeof EMERGENCY_TAB_VALUES)[number];

export function emergencyTabFromSearch(value: string | null): EmergencyTabKey | null {
  switch (value) {
    case "visits":
    case "triage":
    case "resuscitation":
    case "codes":
    case "mlc":
    case "mass-casualty":
      return value;
    default:
      return null;
  }
}

export function emergencyVisibleTab(
  requestedTab: EmergencyTabKey | null,
  availableTabs: readonly EmergencyTabKey[],
  fallbackTab: EmergencyTabKey,
): EmergencyTabKey {
  if (requestedTab && availableTabs.includes(requestedTab)) return requestedTab;
  return fallbackTab;
}
