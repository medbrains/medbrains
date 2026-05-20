import type {
  CssdIndicatorTypeFormValue,
  CssdInstrumentCategoryFormValue,
  CssdMaintenanceTypeFormValue,
  CssdSterilizationMethodFormValue,
  FormNumberValue,
} from "@medbrains/schemas";
import {
  cssdIndicatorTypeValues,
  cssdInstrumentCategoryValues,
  cssdMaintenanceTypeValues,
  cssdSterilizationMethodValues,
  optionalIntegerFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";

const methodLabels: Record<CssdSterilizationMethodFormValue, string> = {
  steam: "Steam (Autoclave)",
  eto: "ETO (Ethylene Oxide)",
  plasma: "Plasma",
  dry_heat: "Dry Heat",
  flash: "Flash",
};

const indicatorTypeLabels: Record<CssdIndicatorTypeFormValue, string> = {
  chemical: "Chemical",
  biological: "Biological",
};

const categoryLabels: Record<CssdInstrumentCategoryFormValue, string> = {
  surgical: "Surgical Instruments",
  diagnostic: "Diagnostic Instruments",
  dental: "Dental Instruments",
  ophthalmic: "Ophthalmic Instruments",
  orthopedic: "Orthopedic Instruments",
  endoscopy: "Endoscopy Equipment",
  laparoscopy: "Laparoscopy Instruments",
  cardiology: "Cardiology Instruments",
  neurology: "Neurology Instruments",
  urology: "Urology Instruments",
  gynecology: "Gynecology Instruments",
  ent: "ENT Instruments",
  other: "Other",
};

const maintenanceTypeLabels: Record<CssdMaintenanceTypeFormValue, string> = {
  preventive: "Preventive Maintenance",
  corrective: "Corrective Maintenance",
  calibration: "Calibration",
  validation: "Validation",
  inspection: "Inspection",
  repair: "Repair",
  replacement: "Part Replacement",
  cleaning: "Deep Cleaning",
  other: "Other",
};

export const cssdMethodOptions = cssdSterilizationMethodValues.map((value) => ({
  value,
  label: methodLabels[value],
}));

export const cssdIndicatorTypeOptions = cssdIndicatorTypeValues.map((value) => ({
  value,
  label: indicatorTypeLabels[value],
}));

export const cssdInstrumentCategoryOptions = cssdInstrumentCategoryValues.map((value) => ({
  value,
  label: categoryLabels[value],
}));

export const cssdMaintenanceTypeOptions = cssdMaintenanceTypeValues.map((value) => ({
  value,
  label: maintenanceTypeLabels[value],
}));

export function cssdOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

export function cssdOptionalInteger(value: FormNumberValue): number | undefined {
  return optionalIntegerFromFormValue(value);
}

export function cssdOptionalNumber(value: FormNumberValue): number | undefined {
  return optionalNumberFromFormValue(value);
}
