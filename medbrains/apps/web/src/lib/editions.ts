import type { HospitalType } from "@medbrains/types";

/**
 * The kinds of facility MedBrains is set up for (`hospital_type`). Each one
 * seeds a preset bundle of modules; sign-up, onboarding and the Modules
 * settings all offer this one list.
 */
export const EDITIONS: { value: HospitalType; label: string }[] = [
  { value: "standalone_clinic", label: "Clinic" },
  { value: "multi_specialty", label: "Multi-specialty hospital" },
  { value: "medical_college", label: "Medical college & hospital" },
  { value: "eye_hospital", label: "Eye hospital" },
  { value: "dental_college", label: "Dental college / clinic" },
  { value: "district_hospital", label: "District / government hospital" },
  { value: "community_health", label: "Community health centre" },
  { value: "primary_health", label: "Primary health centre" },
];
