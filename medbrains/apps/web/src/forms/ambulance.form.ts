import type {
  AmbulanceFuelTypeFormValue,
  AmbulanceLicenseTypeFormValue,
  AmbulanceMaintenanceTypeFormValue,
  AmbulanceShiftPatternFormValue,
  AmbulanceTripPriorityFormValue,
  AmbulanceTripTypeFormValue,
  AmbulanceTypeFormValue,
  FormNumberValue,
} from "@medbrains/schemas";
import {
  ambulanceFuelTypeValues,
  ambulanceLicenseTypeValues,
  ambulanceMaintenanceTypeValues,
  ambulanceShiftPatternValues,
  ambulanceTripPriorityValues,
  ambulanceTripTypeValues,
  ambulanceTypeValues,
  optionalIntegerFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";

const ambulanceTypeLabels: Record<AmbulanceTypeFormValue, string> = {
  bls: "BLS",
  als: "ALS",
  patient_transport: "Patient Transport",
  mortuary: "Mortuary",
  neonatal: "Neonatal",
};

const tripTypeLabels: Record<AmbulanceTripTypeFormValue, string> = {
  emergency: "Emergency",
  scheduled: "Scheduled",
  inter_facility: "Inter-Facility",
  discharge: "Discharge",
};

const priorityLabels: Record<AmbulanceTripPriorityFormValue, string> = {
  critical: "Critical",
  urgent: "Urgent",
  routine: "Routine",
};

const fuelTypeLabels: Record<AmbulanceFuelTypeFormValue, string> = {
  diesel: "Diesel",
  petrol: "Petrol",
  cng: "CNG",
  electric: "Electric",
};

const licenseTypeLabels: Record<AmbulanceLicenseTypeFormValue, string> = {
  HMV: "HMV",
  LMV: "LMV",
  HPMV: "HPMV",
};

const shiftPatternLabels: Record<AmbulanceShiftPatternFormValue, string> = {
  day: "Day",
  night: "Night",
  rotating: "Rotating",
};

const maintenanceTypeLabels: Record<AmbulanceMaintenanceTypeFormValue, string> = {
  routine_service: "Routine Service",
  repair: "Repair",
  inspection: "Inspection",
  fitness_renewal: "Fitness Renewal",
  insurance_renewal: "Insurance Renewal",
};

export const ambulanceTypeOptions = ambulanceTypeValues.map((value) => ({
  value,
  label: ambulanceTypeLabels[value],
}));

export const ambulanceTripTypeOptions = ambulanceTripTypeValues.map((value) => ({
  value,
  label: tripTypeLabels[value],
}));

export const ambulanceTripPriorityOptions = ambulanceTripPriorityValues.map((value) => ({
  value,
  label: priorityLabels[value],
}));

export const ambulanceFuelTypeOptions = ambulanceFuelTypeValues.map((value) => ({
  value,
  label: fuelTypeLabels[value],
}));

export const ambulanceLicenseTypeOptions = ambulanceLicenseTypeValues.map((value) => ({
  value,
  label: licenseTypeLabels[value],
}));

export const ambulanceShiftPatternOptions = ambulanceShiftPatternValues.map((value) => ({
  value,
  label: shiftPatternLabels[value],
}));

export const ambulanceMaintenanceTypeOptions = ambulanceMaintenanceTypeValues.map((value) => ({
  value,
  label: maintenanceTypeLabels[value],
}));

export function ambulanceOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

export function ambulanceOptionalInteger(value: FormNumberValue): number | undefined {
  return optionalIntegerFromFormValue(value);
}

export function ambulanceOptionalNumber(value: FormNumberValue): number | undefined {
  return optionalNumberFromFormValue(value);
}

export function normalizeAmbulanceFuelType(value: string | null): AmbulanceFuelTypeFormValue | "" {
  return ambulanceFuelTypeValues.find((fuelType) => fuelType === value) ?? "";
}
