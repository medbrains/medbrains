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
  public_certificate_path: string;
  login_request_otp_path: string;
  login_verify_path: string;
}

export interface AbhaStatusResponse {
  environment: AbdmEnvironment;
  configured: boolean;
  source: string;
  readiness: AbhaIntegrationReadiness;
}

export interface AbhaProviderResponse<TResponse> {
  environment: AbdmEnvironment;
  request_id: string;
  response: TResponse;
}

export interface AbhaSessionTokenRequest {
  clientId: string;
  clientSecret: string;
}

export interface AbhaSessionTokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  tokenType: string;
}

export interface AbhaSessionRequest {
  environment?: AbdmEnvironment;
  credentials?: AbhaSessionTokenRequest;
}

export interface AbhaAuthenticatedRequest<TRequest> {
  environment?: AbdmEnvironment;
  access_token: string;
  request: TRequest;
}

export interface AbhaPublicCertificateRequest {
  environment?: AbdmEnvironment;
  access_token: string;
}

export interface AbhaPublicCertificateResponse {
  publicKey: string;
  encryptionAlgorithm?: string;
  kid?: string;
}

export type AbhaLoginHint = "abha-number" | "abha-address" | "mobile";
export type AbhaOtpSystem = "aadhaar" | "abdm";
export type AbhaAuthMethod = "otp";

export interface AbhaRequestOtpRequest {
  scope: string[];
  loginHint: AbhaLoginHint;
  loginId: string;
  otpSystem: AbhaOtpSystem;
}

export interface AbhaRequestOtpResponse {
  txnId: string;
  message?: string;
}

export interface AbhaVerifyOtpPayload {
  txnId: string;
  otpValue: string;
}

export interface AbhaVerifyOtpAuthData {
  authMethods: AbhaAuthMethod[];
  otp: AbhaVerifyOtpPayload;
}

export interface AbhaVerifyOtpRequest {
  scope: string[];
  authData: AbhaVerifyOtpAuthData;
}

export interface AbhaAuthToken {
  token: string;
  expiresIn: number;
  refreshToken?: string;
  refreshExpiresIn?: number;
}

export interface AbhaAccountSummary {
  ABHANumber?: string;
  preferredAbhaAddress?: string;
  name?: string;
  status?: string;
  profilePhoto?: string;
}

export interface AbhaVerifyOtpResponse {
  txnId: string;
  authResult?: string;
  message?: string;
  token?: AbhaAuthToken;
  accounts: AbhaAccountSummary[];
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
