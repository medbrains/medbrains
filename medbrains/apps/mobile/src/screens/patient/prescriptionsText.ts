type MobilePrescriptionTextValues = Record<string, string | number | boolean>;

const MOBILE_PRESCRIPTION_MESSAGES: Record<string, string> = {
  "patientPrescriptions.action.cancel": "Cancel",
  "patientPrescriptions.action.refill": "Refill",
  "patientPrescriptions.action.submitRequest": "Submit Request",
  "patientPrescriptions.dialog.refillMessage":
    "A refill request will be sent to your prescribing doctor. You will be notified when your prescription is ready for pickup.",
  "patientPrescriptions.dialog.refillTitle": "Request Refill",
  "patientPrescriptions.empty.all": "No prescription history found",
  "patientPrescriptions.empty.recent": "No prescriptions in the last 30 days",
  "patientPrescriptions.empty.title": "No prescriptions",
  "patientPrescriptions.fallback.doctor": "Doctor",
  "patientPrescriptions.filter.all": "All History",
  "patientPrescriptions.filter.recent": "Last 30 Days",
  "patientPrescriptions.loading.list": "Loading prescriptions...",
  "patientPrescriptions.medicationCountPlural": "{{count}} medications",
  "patientPrescriptions.medicationCountSingular": "{{count}} medication",
  "patientPrescriptions.prescriptionCountPlural": "{{count}} prescriptions",
  "patientPrescriptions.prescriptionCountSingular": "{{count}} prescription",
  "patientPrescriptions.search.placeholder": "Search medications or doctors...",
  "patientPrescriptions.summary.title": "Prescription History",
};

function interpolate(template: string, values?: MobilePrescriptionTextValues): string {
  if (!values) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, name) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function mobilePrescriptionText(key: string, values?: MobilePrescriptionTextValues): string {
  const template = MOBILE_PRESCRIPTION_MESSAGES[key];

  return template ? interpolate(template, values) : key;
}

export function mobilePrescriptionCountText(count: number): string {
  return mobilePrescriptionText(
    count === 1
      ? "patientPrescriptions.prescriptionCountSingular"
      : "patientPrescriptions.prescriptionCountPlural",
    { count },
  );
}

export function mobileMedicationCountText(count: number): string {
  return mobilePrescriptionText(
    count === 1
      ? "patientPrescriptions.medicationCountSingular"
      : "patientPrescriptions.medicationCountPlural",
    { count },
  );
}
