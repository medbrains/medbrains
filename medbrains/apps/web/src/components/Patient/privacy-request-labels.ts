import type { PrivacyRequestChannel, PrivacyRequestType } from "@medbrains/types";

export const PRIVACY_REQUEST_TYPES: Array<{ value: PrivacyRequestType; label: string }> = [
  { value: "access", label: "See what the hospital holds" },
  { value: "correction", label: "Correct or complete their data" },
  { value: "erasure", label: "Erase their data" },
  { value: "nominee", label: "Name a nominee" },
  { value: "grievance", label: "Privacy complaint" },
];

export const PRIVACY_CHANNELS: Array<{ value: PrivacyRequestChannel; label: string }> = [
  { value: "desk", label: "At the desk" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "letter", label: "Letter" },
];

export const PRIVACY_TYPE_LABEL = new Map(PRIVACY_REQUEST_TYPES.map((t) => [t.value, t.label]));

/** Days until a request is due; negative when overdue. */
export function daysLeft(dueAt: string): number {
  return Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000);
}
