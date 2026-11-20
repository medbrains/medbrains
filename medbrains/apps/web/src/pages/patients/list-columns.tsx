// The patient list's columns at this hospital: every column, or the basic set.

import type { Patient } from "@medbrains/types";
import type { Column } from "@/components/data-table-types";
import { OpdNumberBadge } from "@/components/Patient/OpdNumberBadge";

/** The basic set: who the patient is and how to reach them, nothing more. */
const BASIC_KEYS = ["uhid", "name", "age_gender", "phone", "opd_number", "actions"];

/** Whole years since a date of birth, or nothing when it is not known. */
function ageYears(dob: string | null | undefined, today = new Date()): number | null {
  if (!dob) return null;
  const born = new Date(`${dob}T00:00:00`);
  let age = today.getFullYear() - born.getFullYear();
  const beforeBirthday =
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return Number.isNaN(age) ? null : age;
}

/** "40y · F", for the basic set's one column in place of age and sex. */
export function ageGender(row: Pick<Patient, "date_of_birth" | "gender">): string {
  const age = ageYears(row.date_of_birth);
  const sex = row.gender ? row.gender.charAt(0).toUpperCase() : "";
  return [age == null ? "" : `${age}y`, sex].filter(Boolean).join(" · ") || "-";
}

const OPD_COLUMN: Column<Patient> = {
  key: "opd_number",
  label: "OPD no.",
  render: (row) => <OpdNumberBadge opd={row} />,
};

const AGE_GENDER_COLUMN: Column<Patient> = {
  key: "age_gender",
  label: "Age / sex",
  render: ageGender,
};

/**
 * The columns to show. The OPD number goes after the phone when the hospital
 * keeps one. `basic` keeps UHID, name, age and sex, phone, OPD number and
 * actions; `full` (every other hospital's default) is unchanged.
 */
export function patientListColumns(
  columns: Column<Patient>[],
  { opdOn, basic }: { opdOn: boolean; basic: boolean },
): Column<Patient>[] {
  const after = (list: Column<Patient>[], key: string, add: Column<Patient>[]) => {
    const at = list.findIndex((c) => c.key === key) + 1;
    return [...list.slice(0, at), ...add, ...list.slice(at)];
  };
  const withAge = after(columns, "name", basic ? [AGE_GENDER_COLUMN] : []);
  const all = after(withAge, "phone", opdOn ? [OPD_COLUMN] : []);
  return basic ? all.filter((c) => BASIC_KEYS.includes(c.key)) : all;
}
