// Generated from crates/medbrains-core/src/app_screens.rs; do not edit.
// Regenerate: UPDATE_APP_SCREENS=1 cargo test -p medbrains-core app_screens

/** One entry in an app's side panel. */
export interface AppScreen {
  brick: string;
  path: string;
  labelKey: string;
  icon: string;
  permission: string;
}

/** Every screen of every converted app, in panel order. */
export const APP_SCREENS: readonly AppScreen[] = [
  { brick: "opd", path: "/opd", labelKey: "opdQueue", icon: "IconStethoscope", permission: "opd.queue.list" },
  { brick: "opd", path: "/opd/appointments", labelKey: "appointments", icon: "IconCalendar", permission: "opd.appointment.list" },
  { brick: "opd", path: "/telemedicine", labelKey: "telemedicine", icon: "IconVideo", permission: "opd.queue.view" },
  { brick: "opd", path: "/doctor/signoffs", labelKey: "doctorSignoffs", icon: "IconSignature", permission: "doctor.signoffs.view_own" },
  { brick: "opd", path: "/order-sets", labelKey: "orderSets", icon: "IconListDetails", permission: "order_sets.templates.list" },
  { brick: "opd", path: "/chronic-care", labelKey: "chronicCare", icon: "IconReportMedical", permission: "chronic.enrollments.list" },
];

/** Each app brick's display name, by `module_config.code`. */
export const BRICK_NAMES: Readonly<Record<string, string>> = {
  registration: "Patient Registration",
  billing: "Billing & Finance",
  opd: "OPD / Outpatient",
  ipd: "IPD / Inpatient",
  lab: "Laboratory (LIS)",
  pharmacy: "Pharmacy",
  radiology: "Radiology (RIS)",
  blood_bank: "Blood Bank",
  ot: "Operation Theatre",
  emergency: "Emergency / Casualty",
  nursing: "Nursing Station",
  diet: "Diet & Nutrition",
  hr: "Human Resources",
  inventory: "Inventory & Stores",
  reports: "Reports & Analytics",
  maternity: "Maternity",
  ophthalmology: "Ophthalmology",
  dental: "Dental",
  cath_lab: "Cath Lab",
  endoscopy: "Endoscopy",
  psychiatry: "Psychiatry",
  palliative: "Palliative Care",
  pmr: "Physical Medicine & Rehabilitation",
  specialty_other: "Other Specialties",
  flow: "MedBrains Flow",
  companion: "Patient Companion",
};
