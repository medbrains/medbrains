// Documents shared helpers — split from documents.tsx (pure move).

import {
  documentPrintFormatValues,
  logicalPrinterProfileValues,
  printCopyModeValues,
  printerConnectionTypeValues,
} from "@medbrains/schemas";

export const TEMPLATE_CATEGORIES: { value: string; label: string }[] = [
  { value: "prescription", label: "Prescription" },
  { value: "consultation_summary", label: "Consultation Summary" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "death_certificate", label: "Death Certificate" },
  { value: "consent_form", label: "Consent Form" },
  { value: "lab_report", label: "Lab Report" },
  { value: "radiology_report", label: "Radiology Report" },
  { value: "opd_bill", label: "OPD Bill" },
  { value: "ipd_bill", label: "IPD Bill" },
  { value: "receipt", label: "Receipt" },
  { value: "case_sheet_cover", label: "Case Sheet Cover" },
  { value: "progress_note", label: "Progress Note" },
  { value: "nursing_assessment", label: "Nursing Assessment" },
  { value: "mar_chart", label: "MAR Chart" },
  { value: "vitals_chart", label: "Vitals Chart" },
  { value: "surgical_checklist", label: "Surgical Checklist" },
  { value: "anesthesia_record", label: "Anesthesia Record" },
  { value: "operation_note", label: "Operation Note" },
  { value: "employee_id_card", label: "Employee ID Card" },
  { value: "purchase_order", label: "Purchase Order" },
  { value: "patient_card", label: "Patient Card" },
  { value: "wristband", label: "Wristband" },
  { value: "queue_token", label: "Queue Token" },
  { value: "bmw_manifest", label: "BMW Manifest" },
  { value: "pcpndt_form_f", label: "PCPNDT Form F" },
  { value: "mlc_certificate", label: "MLC Certificate" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "transfer_summary", label: "Transfer Summary" },
  { value: "custom", label: "Custom" },
];

const PRINT_FORMAT_LABELS: Record<(typeof documentPrintFormatValues)[number], string> = {
  a4_portrait: "A4 Portrait",
  a4_landscape: "A4 Landscape",
  a5_portrait: "A5 Portrait",
  a5_landscape: "A5 Landscape",
  thermal_80mm: "Thermal 80mm",
  thermal_58mm: "Thermal 58mm",
  label_50x25mm: "Label 50x25mm",
  wristband: "Wristband",
  custom: "Custom",
};

export const PRINT_FORMATS = documentPrintFormatValues.map((value) => ({
  value,
  label: PRINT_FORMAT_LABELS[value],
}));

const CONNECTION_TYPE_LABELS: Record<(typeof printerConnectionTypeValues)[number], string> = {
  network: "Network / IP",
  usb: "USB",
  agent: "Local print agent",
  browser: "Browser dialog",
};

const LOGICAL_PRINTER_PROFILE_LABELS: Record<(typeof logicalPrinterProfileValues)[number], string> =
  {
    "registration-a4": "Registration A4",
    "patient-card": "Patient card",
    "opd-token-thermal": "OPD token thermal",
    "opd-a4": "OPD A4 summary",
    "opd-summary": "OPD visit summary",
    "opd-certificate-a4": "OPD certificate A4",
    "consent-a4": "Consent form A4",
    "ipd-a4": "IPD A4 case sheet",
    "ipd-discharge-a4": "IPD discharge A4",
    "wristband-label": "Wristband label",
    "emergency-a4": "Emergency A4",
    "mlc-secure-printer": "MLC secure printer",
    "camp-token-thermal": "Camp token thermal",
    "camp-a4": "Camp A4",
    "pharmacy-receipt-80mm": "Pharmacy receipt 80mm",
    "pharmacy-drug-label": "Pharmacy drug label",
    "lab-report-a4": "Lab report A4",
    "radiology-report-a4": "Radiology report A4",
    "billing-receipt-80mm": "Billing receipt 80mm",
    "billing-a4": "Billing A4",
    "mrd-a4": "MRD A4",
    "mrd-record-room": "MRD record room",
  };

const PRINT_COPY_MODE_LABELS: Record<(typeof printCopyModeValues)[number], string> = {
  customer: "Customer copy",
  office: "Office copy",
  clinical: "Clinical copy",
  mrd: "MRD copy",
  lab: "Lab copy",
  pharmacy: "Pharmacy copy",
  police: "Police copy",
  duplicate: "Duplicate/reprint",
};

export const CONNECTION_TYPES = printerConnectionTypeValues.map((value) => ({
  value,
  label: CONNECTION_TYPE_LABELS[value],
}));

export const LOGICAL_PRINTER_PROFILES = logicalPrinterProfileValues.map((value) => ({
  value,
  label: LOGICAL_PRINTER_PROFILE_LABELS[value],
}));

export const PRINT_COPY_MODES = printCopyModeValues.map((value) => ({
  value,
  label: PRINT_COPY_MODE_LABELS[value],
}));

export function capabilityString(
  capabilities: Record<string, unknown> | null | undefined,
  key: "copy_modes" | "profile_code",
) {
  const value = capabilities?.[key];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

export function optionLabel(
  options: { value: string; label: string }[],
  value: string | null | undefined,
) {
  if (!value) return "—";
  return options.find((option) => option.value === value)?.label ?? value;
}
