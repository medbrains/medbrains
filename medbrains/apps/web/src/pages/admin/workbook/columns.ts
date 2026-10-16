/**
 * The workbook's sheets and columns, once: writing the file and reading it
 * back both come from here, so a downloaded workbook uploads unchanged.
 * Columns are found by their header, not their position — a hospital that
 * reorders or adds its own columns still uploads cleanly.
 */
import type { OnboardingWorkbook, WorkbookSheets } from "@medbrains/types";

type SheetKey = keyof WorkbookSheets;

export interface SheetDef {
  key: SheetKey;
  title: string;
  columns: Array<{ field: string; header: string; width: number }>;
  example: Record<string, string>;
}

export const SHEETS: SheetDef[] = [
  {
    key: "departments",
    title: "Departments",
    columns: [
      { field: "code", header: "Code", width: 14 },
      { field: "name", header: "Name", width: 30 },
      { field: "type", header: "Type", width: 16 },
      { field: "parent_code", header: "Parent code", width: 14 },
    ],
    example: { code: "MED", name: "General Medicine", type: "clinical", parent_code: "" },
  },
  {
    key: "wards",
    title: "Wards",
    columns: [
      { field: "code", header: "Code", width: 12 },
      { field: "name", header: "Name", width: 28 },
      { field: "ward_type", header: "Ward type", width: 14 },
      { field: "gender", header: "Admits", width: 10 },
      { field: "department_code", header: "Department code", width: 16 },
    ],
    example: {
      code: "W1",
      name: "Medical Ward 1",
      ward_type: "general",
      gender: "any",
      department_code: "MED",
    },
  },
  {
    key: "beds",
    title: "Beds",
    columns: [
      { field: "code", header: "Bed code", width: 12 },
      { field: "ward_code", header: "Ward code", width: 12 },
      { field: "room", header: "Room", width: 12 },
    ],
    example: { code: "W1-B01", ward_code: "W1", room: "W1-R1" },
  },
  {
    key: "staff",
    title: "Staff",
    columns: [
      { field: "username", header: "Username", width: 16 },
      { field: "full_name", header: "Full name", width: 24 },
      { field: "email", header: "Email", width: 28 },
      { field: "phone", header: "Phone", width: 14 },
      { field: "role", header: "Role", width: 16 },
      { field: "departments", header: "Departments", width: 18 },
      { field: "designation", header: "Designation", width: 18 },
      { field: "employee_code", header: "Employee code", width: 14 },
      { field: "registration_number", header: "Registration no.", width: 16 },
      { field: "specialization", header: "Specialization", width: 18 },
      { field: "qualification", header: "Qualification", width: 18 },
      { field: "consultation_fee", header: "Consultation fee", width: 14 },
    ],
    example: {
      username: "dr_kavya",
      full_name: "Dr Kavya Iyer",
      email: "kavya@yourhospital.in",
      phone: "",
      role: "doctor",
      departments: "MED, CAR",
      designation: "Consultant",
      employee_code: "E0012",
      registration_number: "TN-12345",
      specialization: "General Medicine",
      qualification: "MBBS, MD",
      consultation_fee: "500",
    },
  },
];

const normal = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** A sheet's rows as objects, numbered as Excel numbers them (header = 1). */
export function rowsFromSheet(
  def: SheetDef,
  rows: unknown[][],
): Record<string, string | number | null>[] {
  const [header = [], ...body] = rows;
  const index = new Map(header.map((h, i) => [normal(String(h ?? "")), i]));
  const out: Record<string, string | number | null>[] = [];
  body.forEach((cells, i) => {
    const entry: Record<string, string | number | null> = { row: i + 2 };
    let filled = false;
    for (const col of def.columns) {
      const at = index.get(normal(col.header));
      const raw = at === undefined ? null : cells[at];
      const value = raw === null || raw === undefined ? null : String(raw).trim() || null;
      if (value !== null) filled = true;
      entry[col.field] = value;
    }
    if (filled) out.push(entry);
  });
  return out;
}

/** The instructions sheet: what each sheet is for and what its cells may hold. */
export function instructions(book: OnboardingWorkbook): string[][] {
  const { allowed } = book;
  return [
    [`${book.hospital_name} — onboarding workbook (hospital code ${book.hospital_code})`],
    [""],
    ["Fill one row per item. Keep the header row. Rows are matched by code (username for staff),"],
    [
      "so uploading the same workbook again updates rather than duplicates. Delete the example rows.",
    ],
    ["Passwords are never put in this file: new staff are emailed how to set theirs."],
    [""],
    ["Department type", allowed.department_types.join(", ")],
    ["Ward type", allowed.ward_types.join(", ")],
    ["Admits", allowed.genders.join(", ")],
    ["Role", allowed.roles.join(", ")],
    ["Departments (staff)", "Department codes separated by commas; the first is their own"],
  ];
}

/** Every sheet's rows for the file: the hospital's data, or one example row. */
export function sheetRows(def: SheetDef, book: OnboardingWorkbook, filled: boolean): string[][] {
  const data = filled ? (book[def.key] as unknown as Record<string, unknown>[]) : [];
  const source = data.length > 0 ? data : [def.example];
  return [
    def.columns.map((c) => c.header),
    ...source.map((r) => def.columns.map((c) => (r[c.field] == null ? "" : String(r[c.field])))),
  ];
}
