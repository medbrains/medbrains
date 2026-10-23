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

/** The bridge as the ABDM gateway holds it. */
export interface AbdmGatewayBridge {
  /** "ok" — the gateway answered; "unknown" — it could not be asked. */
  state: "ok" | "unknown";
  message: string | null;
  url: string | null;
  active: boolean | null;
  blocklisted: boolean | null;
}

/** One campus and whether its HFR ID is bound to the bridge. */
export interface AbdmCampusBridge {
  facility_id: string;
  name: string;
  hfr_facility_id: string;
  /**
   * The bridge service id ABDM issued (`<HFR ID>_<n>`), sent as X-HIP-ID; null
   * until ABDM lists one. With the bare HFR ID ABDM never calls back.
   */
  service_id: string | null;
  /** The name patients see in their PHR app (HFR: at most 15 letters/digits). */
  hip_name: string;
  /** null when the gateway could not be asked. */
  bound: boolean | null;
  types: string[];
}

export interface AbdmBridgeStatus {
  configured: boolean;
  environment: AbdmEnvironment | null;
  /** The hospital's ABDM client ID. */
  bridge_id: string | null;
  suggested_url: string | null;
  gateway: AbdmGatewayBridge;
  campuses: AbdmCampusBridge[];
}

export interface RegisterAbdmBridge {
  url: string;
  /** Per campus (facility id): the PHR app name. */
  hip_names?: Record<string, string>;
}

export interface AbdmStepOutcome {
  ok: boolean;
  message: string;
}

export interface AbdmBridgeRegistration {
  url: AbdmStepOutcome;
  campuses: (AbdmStepOutcome & { facility_id: string; hfr_facility_id: string })[];
}

/** How the desk finds the person's ABHA. */
export type AbhaVerifyMethod = "abha_number" | "mobile" | "abha_address";
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
  /** Resends still allowed for this OTP (ABDM allows two); null when none is waiting. */
  resends_left: number | null;
  accounts: AbhaAccountChoice[];
  profile: AbhaVerifiedProfile | null;
  /** Another patient here already carries this ABHA. */
  already_linked: AbhaLinkedPatient | null;
  /** ABHA addresses ABDM suggests, when creating an ABHA. */
  suggestions: string[];
}

/** ABDM's reply to an ABHA mobile or email change — where the OTP or link went. */
export interface AbhaAccountChange {
  message: string | null;
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
