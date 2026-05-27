import type {
  EmergencyArrivalModeFormValue,
  EmergencyCodeDeactivateOutcomeFormValue,
  EmergencyCodeTypeFormValue,
  EmergencyMassCasualtyStatusFormValue,
  EmergencyMassCasualtyTypeFormValue,
  EmergencyMlcBroughtByFormValue,
  EmergencyMlcCaseTypeFormValue,
  EmergencyMlcPoliceSentViaFormValue,
  EmergencyMlcStatusFormValue,
  EmergencyResuscitationLogTypeFormValue,
  FormNumberValue,
} from "@medbrains/schemas";
import {
  emergencyArrivalModeValues,
  emergencyCodeDeactivateOutcomeValues,
  emergencyCodeTypeValues,
  emergencyMassCasualtyStatusValues,
  emergencyMassCasualtyTypeValues,
  emergencyMlcBroughtByValues,
  emergencyMlcCaseTypeValues,
  emergencyMlcPoliceSentViaValues,
  emergencyMlcStatusValues,
  emergencyResuscitationLogTypeValues,
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

const codeDeactivateOutcomeLabels: Record<EmergencyCodeDeactivateOutcomeFormValue, string> = {
  resolved: "Resolved / all clear",
  stable: "Patient stabilized",
  rosc: "ROSC achieved",
  transferred: "Transferred",
  expired: "Patient expired",
  false_alarm: "False alarm / drill closed",
  escalated: "Escalated",
};

const resuscitationLogTypeLabels: Record<EmergencyResuscitationLogTypeFormValue, string> = {
  medication: "Medication",
  fluid: "Fluid",
  procedure: "Procedure",
  airway: "Airway",
  cpr: "CPR",
  defibrillation: "Defibrillation",
  vitals: "Vitals",
  note: "Note",
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

const mlcPoliceSentViaLabels: Record<EmergencyMlcPoliceSentViaFormValue, string> = {
  phone: "Phone",
  written_memo: "Written memo",
  email: "Email",
  police_portal: "Police portal",
  in_person: "In person",
};

const mlcStatusLabels: Record<EmergencyMlcStatusFormValue, string> = {
  registered: "Registered",
  under_investigation: "Under investigation",
  opinion_given: "Opinion given",
  court_pending: "Court pending",
  closed: "Closed",
};

const massCasualtyTypeLabels: Record<EmergencyMassCasualtyTypeFormValue, string> = {
  natural_disaster: "Natural Disaster",
  industrial: "Industrial Accident",
  transport: "Transport Accident",
  violence: "Violence",
  other: "Other",
};

const massCasualtyStatusLabels: Record<EmergencyMassCasualtyStatusFormValue, string> = {
  activated: "Activated",
  ongoing: "Ongoing response",
  scaling_down: "Scaling down",
};

export const emergencyArrivalModeOptions = emergencyArrivalModeValues.map((value) => ({
  value,
  label: arrivalModeLabels[value],
}));

export const emergencyCodeTypeOptions = emergencyCodeTypeValues.map((value) => ({
  value,
  label: codeTypeLabels[value],
}));

export const emergencyCodeDeactivateOutcomeOptions = emergencyCodeDeactivateOutcomeValues.map(
  (value) => ({
    value,
    label: codeDeactivateOutcomeLabels[value],
  }),
);

export const emergencyResuscitationLogTypeOptions = emergencyResuscitationLogTypeValues.map(
  (value) => ({
    value,
    label: resuscitationLogTypeLabels[value],
  }),
);

export const emergencyMlcCaseTypeOptions = emergencyMlcCaseTypeValues.map((value) => ({
  value,
  label: mlcCaseTypeLabels[value],
}));

export const emergencyMlcBroughtByOptions = emergencyMlcBroughtByValues.map((value) => ({
  value,
  label: mlcBroughtByLabels[value],
}));

export const emergencyMlcPoliceSentViaOptions = emergencyMlcPoliceSentViaValues.map((value) => ({
  value,
  label: mlcPoliceSentViaLabels[value],
}));

export const emergencyMlcStatusOptions = emergencyMlcStatusValues.map((value) => ({
  value,
  label: mlcStatusLabels[value],
}));

export const emergencyMassCasualtyTypeOptions = emergencyMassCasualtyTypeValues.map((value) => ({
  value,
  label: massCasualtyTypeLabels[value],
}));

export const emergencyMassCasualtyStatusOptions = emergencyMassCasualtyStatusValues.map(
  (value) => ({
    value,
    label: massCasualtyStatusLabels[value],
  }),
);

export function emergencyOptionalText(value: string): string | undefined {
  return optionalTextFromFormValue(value);
}

export function emergencyOptionalInteger(value: FormNumberValue): number | undefined {
  return optionalIntegerFromFormValue(value);
}
