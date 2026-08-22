/**
 * What survives between two walk-ins at the same desk.
 *
 * A front-office clerk on a Monday morning registers forty people in a row.
 * They are all arriving at the same desk, for the same department, from the
 * same source, referred the same way — the only thing that changes is the
 * person. Clearing the whole form after each save makes the clerk re-enter the
 * unchanging half forty times; keeping the whole form risks the previous
 * patient's phone number silently becoming this one's.
 *
 * So the split is deliberate: identity and anything clinical is cleared,
 * because carrying it over is a patient-safety hazard, and the desk context is
 * kept, because re-typing it is the drudgery this exists to remove.
 */

import type { MobileStaffPatientRegistrationFormInput } from "@medbrains/schemas";

/** Fields describing the person in front of the desk. Never carried over. */
const PERSON_FIELDS = {
  first_name: "",
  last_name: "",
  gender: "male",
  phone: "",
  date_of_birth: "",
  age: "",
} as const;

/**
 * Fields describing this visit's clinical content. Never carried over either:
 * a diagnosis or an MLC flag inherited by the next patient is a wrong record,
 * not a saved keystroke.
 */
const VISIT_FIELDS = {
  diagnosis_text: "",
  icd11_code: "",
  is_medico_legal: false,
  mlc_number: "",
  is_vip: false,
} as const;

/**
 * The form the clerk should see for the next walk-in: this one cleared of the
 * person and their complaint, with the desk left as they set it.
 */
export function nextPatientDefaults(
  current: MobileStaffPatientRegistrationFormInput,
): MobileStaffPatientRegistrationFormInput {
  return { ...current, ...PERSON_FIELDS, ...VISIT_FIELDS };
}

/** Fields `nextPatientDefaults` clears, for tests and for reading. */
export const CLEARED_ON_NEXT: ReadonlyArray<keyof MobileStaffPatientRegistrationFormInput> = [
  ...(Object.keys(PERSON_FIELDS) as Array<keyof MobileStaffPatientRegistrationFormInput>),
  ...(Object.keys(VISIT_FIELDS) as Array<keyof MobileStaffPatientRegistrationFormInput>),
];
