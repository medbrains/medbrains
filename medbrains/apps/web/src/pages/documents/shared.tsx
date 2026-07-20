// Documents shared helpers — split from documents.tsx (pure move).

import { documentPrintFormatValues } from "@medbrains/schemas";

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
