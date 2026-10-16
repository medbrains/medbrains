const CONSENT_TYPE_LABELS: Record<string, string> = {
  surgery: "Surgical",
  procedure: "Procedure",
  anesthesia: "Anaesthesia",
};

export function consentTypeLabel(type: string): string {
  return CONSENT_TYPE_LABELS[type] ?? type;
}
