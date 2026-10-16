/**
 * The onboarding workbook — mirrors `crates/medbrains-setup/src/workbook`.
 * Every cell is text as typed; the server validates and names each problem.
 */
export interface WorkbookDepartment {
  row?: number;
  code: string | null;
  name: string | null;
  type: string | null;
  parent_code: string | null;
}

export interface WorkbookWard {
  row?: number;
  code: string | null;
  name: string | null;
  ward_type: string | null;
  gender: string | null;
  department_code: string | null;
}

export interface WorkbookBed {
  row?: number;
  code: string | null;
  ward_code: string | null;
  room: string | null;
}

export interface WorkbookStaff {
  row?: number;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  departments: string | null;
  designation: string | null;
  employee_code: string | null;
  registration_number: string | null;
  specialization: string | null;
  qualification: string | null;
  consultation_fee: string | null;
}

export interface WorkbookSheets {
  departments: WorkbookDepartment[];
  wards: WorkbookWard[];
  beds: WorkbookBed[];
  staff: WorkbookStaff[];
}

export interface OnboardingWorkbook extends WorkbookSheets {
  hospital_name: string;
  hospital_code: string;
  allowed: {
    department_types: string[];
    ward_types: string[];
    genders: string[];
    roles: string[];
  };
}

export interface WorkbookProblem {
  sheet: string;
  row: number;
  column: string;
  message: string;
}

export interface WorkbookImportResult {
  applied: boolean;
  sheets: Array<{ sheet: string; added: number; updated: number }>;
  problems: WorkbookProblem[];
  welcomed: number;
}
