// Integration + health types (health check, ABDM/ABHA, AEBAS/BAS biometric attendance) — split from index.ts, barrel-re-exported.

// Health
export interface HealthResponse {
  status: string;
  postgres: string;
}

// ABDM ABHA
export type AbdmEnvironment = "sandbox" | "production";

export interface AbhaIntegrationReadiness {
  environment: AbdmEnvironment;
  abha_base_url: string;
  session_url: string;
}

export interface AbhaStatusResponse {
  environment: AbdmEnvironment;
  configured: boolean;
  source: string;
  readiness: AbhaIntegrationReadiness;
}

/** Settings → ABDM. The client secret is never returned. */
export interface AbdmSettingsView {
  environment: AbdmEnvironment;
  client_id: string | null;
  has_secret: boolean;
  /** "settings" when saved here, "env" when the server holds the keys, "none". */
  source: "settings" | "env" | "none";
}

export interface SaveAbdmSettings {
  environment: AbdmEnvironment;
  client_id: string;
  /** Blank keeps the saved secret. */
  client_secret?: string;
}

export interface AbdmConnectionTest {
  ok: boolean;
  message: string;
}

/** How the desk finds the person's ABHA. */
export type AbhaVerifyMethod = "abha_number" | "mobile";
/** Where ABDM sends the OTP for an ABHA-number lookup. */
export type AbhaOtpVia = "aadhaar" | "abdm";

export interface StartAbhaVerification {
  method: AbhaVerifyMethod;
  value: string;
  otp_via?: AbhaOtpVia;
}

export interface AbhaAccountChoice {
  abha_number: string;
  abha_address: string | null;
  name: string | null;
  gender: string | null;
  year_of_birth: string | null;
}

/** What ABDM holds for the person, in our patient shape. */
export interface AbhaVerifiedProfile {
  abha_number: string;
  abha_address: string | null;
  full_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  /** YYYY-MM-DD when ABDM has the whole date. */
  date_of_birth: string | null;
  year_of_birth: string | null;
  gender: "male" | "female" | "other" | null;
  mobile_masked: string | null;
  email: string | null;
  address: string | null;
  pincode: string | null;
  state: string | null;
  district: string | null;
  kyc_verified: boolean;
  /** Base64 JPEG, shown to confirm the person; never stored. */
  photo?: string;
}

export interface AbhaLinkedPatient {
  patient_id: string;
  uhid: string;
  name: string;
}

export interface StartAbhaEnrolment {
  /** Sent once, encrypted to ABDM on the server; never stored. */
  aadhaar: string;
  /** The patient agreed to create an ABHA with their Aadhaar. */
  consent: boolean;
}

export interface AbhaVerificationStep {
  id: string;
  stage: "otp_sent" | "mobile_otp_sent" | "choose_account" | "choose_address" | "verified";
  /** ABDM's note, e.g. which masked mobile the OTP went to. */
  message: string | null;
  resend_after_seconds: number | null;
  accounts: AbhaAccountChoice[];
  profile: AbhaVerifiedProfile | null;
  /** Another patient here already carries this ABHA. */
  already_linked: AbhaLinkedPatient | null;
  /** ABHA addresses ABDM suggests, when creating an ABHA. */
  suggestions: string[];
}

/** Demographics staff may take from ABHA onto an existing patient. */
export type AbhaField = "name" | "date_of_birth" | "gender";

export interface LinkAbhaToPatient {
  patient_id: string;
  apply: AbhaField[];
}

// AEBAS / BAS
export interface AebasDepartmentImport {
  department_name: string;
  total_employees: number;
  average_present: number;
  average_absent: number;
  average_leave: number;
  attendance_percentage?: number;
}

export interface AebasPeriodImportRequest {
  period: string;
  total_employees: number;
  average_attendance_percentage?: number;
  total_working_days: number;
  holidays: number;
  departments: AebasDepartmentImport[];
}

export interface AebasStatusResponse {
  configured: boolean;
  source?: string;
  organization_id?: string;
  unit_code?: string;
  api_base_url?: string;
  surfaces: string[];
}

export interface AebasImportResponse {
  period: string;
  department_rows: number;
  status: string;
}
