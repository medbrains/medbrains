import type { Patient } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import type { Column } from "@/components/data-table-types";
import { ageGender, patientListColumns } from "./list-columns";

const FULL = [
  "uhid",
  "name",
  "phone",
  "gender",
  "blood_group",
  "category",
  "registration_type",
  "payment_pending",
  "next_actions",
  "actions",
].map((key) => ({ key, label: key }) as Column<Patient>);

const keys = (opdOn: boolean, basic: boolean) =>
  patientListColumns(FULL, { opdOn, basic }).map((c) => c.key);

describe("the patient list's columns", () => {
  it("are unchanged for a hospital that keeps no OPD number and the full list", () => {
    expect(keys(false, false)).toEqual(FULL.map((c) => c.key));
  });

  it("put the OPD number after the phone when the hospital keeps one", () => {
    expect(keys(true, false).slice(2, 4)).toEqual(["phone", "opd_number"]);
  });

  it("show only the basic set when the hospital chose it", () => {
    expect(keys(true, true)).toEqual([
      "uhid",
      "name",
      "age_gender",
      "phone",
      "opd_number",
      "actions",
    ]);
    expect(keys(false, true)).not.toContain("opd_number");
  });

  it("show age and sex together", () => {
    const year = new Date().getFullYear();
    expect(ageGender({ date_of_birth: `${year - 40}-01-01`, gender: "female" } as Patient)).toBe(
      "40y · F",
    );
    expect(ageGender({ date_of_birth: null, gender: "male" } as Patient)).toBe("M");
  });
});
