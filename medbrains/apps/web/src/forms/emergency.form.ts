import type {
  EmergencyArrivalModeFormValue,
  EmergencyCodeTypeFormValue,
  EmergencyMassCasualtyTypeFormValue,
  EmergencyMlcBroughtByFormValue,
  EmergencyMlcCaseTypeFormValue,
  FormNumberValue,
} from "@medbrains/schemas";
import {
  emergencyArrivalModeValues,
  emergencyCodeTypeValues,
  emergencyMassCasualtyTypeValues,
  emergencyMlcBroughtByValues,
  emergencyMlcCaseTypeValues,
  optionalIntegerFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";

const arrivalModeLabels: Record<EmergencyArrivalModeFormValue, string> = {
  walk_in: "Walk-in",
  ambulance: "Ambulance",
  police: "Police",
  referred: "Referred",
};

const codeTypeLabels: Record<EmergencyCodeTypeFormValue, string> = {
  code_blue: "Code Blue (Cardiac Arrest)",
  code_yellow: "Code Yellow (Mass Casualty)",
  code_pink: "Code Pink (Child Abduction)",
  code_orange: "Code Orange (Hazmat)",
  code_red: "Code Red (Fire)",
  code_silver: "Code Silver (Active Threat)",
  code_black: "Code Black (Bomb Threat)",
};

const mlcCaseTypeLabels: Record<EmergencyMlcCaseTypeFormValue, string> = {
  assault: "Assault",
  rta: "Road Traffic Accident",
  burn: "Burns",
  poisoning: "Poisoning",
  sexual_assault: "Sexual Assault",
  suicide_attempt: "Suicide Attempt",
  unknown: "Unknown",
};

const mlcBroughtByLabels: Record<EmergencyMlcBroughtByFormValue, string> = {
  police: "Police",
  ambulance: "Ambulance",
  bystander: "Bystander",
  self: "Self",
};

const massCasualtyTypeLabels: Record<EmergencyMassCasualtyTypeFormValue, string> = {
  natural_disaster: "Natural Disaster",
  industrial: "Industrial Accident",
  transport: "Transport Accident",
  violence: "Violence",
  other: "Other",
};

export const emergencyArrivalModeOptions = emergencyArrivalModeValues.map((value) => ({
  value,
  label: arrivalModeLabels[value],
}));

export const emergencyCodeTypeOptions = emergencyCodeTypeValues.map((value) => ({
  value,
  label: codeTypeLabels[value],
}));

export const emergencyMlcCaseTypeOptions = emergencyMlcCaseTypeValues.map((value) => ({
  value,
  label: mlcCaseTypeLabels[value],
}));

export const emergencyMlcBroughtByOptions = emergencyMlcBroughtByValues.map((value) => ({
  value,
  label: mlcBroughtByLabels[value],
}));

export const emergencyMassCasualtyTypeOptions = emergencyMassCasualtyTypeValues.map((value) => ({
  value,
  label: massCasualtyTypeLabels[value],
}));

export function emergencyOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

export function emergencyOptionalInteger(value: FormNumberValue): number | undefined {
  return optionalIntegerFromFormValue(value);
}
