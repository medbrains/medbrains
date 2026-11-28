/** The `/abdm` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AbdmBridgeRegistration,
  AbdmBridgeStatus,
  AbdmCareContext,
  AbdmConnectionTest,
  AbdmConsentRequest,
  AbdmDashboard,
  AbdmHiuPatientView,
  AbdmPatientRecords,
  AbdmProfileShare,
  AbdmReceivedRecord,
  AbdmScanShareCounters,
  AbdmSettingsView,
  AbdmSharingSummary,
  AbdmSmsLink,
  AbhaAccountChange,
  AbhaCardQr,
  AbhaClosed,
  AbhaOptedOut,
  AbhaStatusResponse,
  AbhaVerificationStep,
  CloseAbha,
  CompleteAbdmProfileShare,
  DoctorHpr,
  FacilityHfr,
  FacilityHfrList,
  HfrRegistration,
  HprCoverage,
  LinkAbhaToPatient,
  LinkHfrRequest,
  MentalHealthSharing,
  RaiseAbdmConsentRequest,
  RegisterAbdmBridge,
  RegisterHfrRequest,
  SaveAbdmSettings,
  SetHprRequest,
  StartAbhaEnrolment,
  StartAbhaVerification,
} from "@medbrains/types";
import { request } from "../client.js";
import { getApiBase } from "../config.js";

export const abdmApi = {
  getAbdmMentalHealthSharing: () =>
    request<MentalHealthSharing>("/abdm/settings/mental-health-sharing"),
  saveAbdmMentalHealthSharing: (data: MentalHealthSharing) =>
    request<MentalHealthSharing>("/abdm/settings/mental-health-sharing", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getAbhaStatus: () => request<AbhaStatusResponse>("/abdm/abha/status"),
  getAbdmSettings: () => request<AbdmSettingsView>("/abdm/settings"),
  saveAbdmSettings: (data: SaveAbdmSettings) =>
    request<AbdmSettingsView>("/abdm/settings", { method: "PUT", body: JSON.stringify(data) }),
  testAbdmConnection: () => request<AbdmConnectionTest>("/abdm/settings/test", { method: "POST" }),
  getAbdmBridge: () => request<AbdmBridgeStatus>("/abdm/bridge"),
  registerAbdmBridge: (data: RegisterAbdmBridge) =>
    request<AbdmBridgeRegistration>("/abdm/bridge/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  startAbhaVerification: (data: StartAbhaVerification) =>
    request<AbhaVerificationStep>("/abdm/abha/verifications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** An Aadhaar login needs the Aadhaar number again; it is never stored. */
  resendAbhaOtp: (id: string, value?: string) =>
    request<AbhaVerificationStep>(`/abdm/abha/verifications/${id}/resend`, {
      method: "POST",
      body: JSON.stringify({ value }),
    }),
  submitAbhaOtp: (id: string, otp: string) =>
    request<AbhaVerificationStep>(`/abdm/abha/verifications/${id}/otp`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  chooseAbhaAccount: (id: string, abhaNumber: string) =>
    request<AbhaVerificationStep>(`/abdm/abha/verifications/${id}/account`, {
      method: "POST",
      body: JSON.stringify({ abha_number: abhaNumber }),
    }),
  startAbhaEnrolment: (data: StartAbhaEnrolment) =>
    request<AbhaVerificationStep>("/abdm/abha/enrolments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  submitAbhaEnrolmentOtp: (id: string, otp: string, mobile: string) =>
    request<AbhaVerificationStep>(`/abdm/abha/enrolments/${id}/otp`, {
      method: "POST",
      body: JSON.stringify({ otp, mobile }),
    }),
  /** The Aadhaar OTP needs the Aadhaar number again; the mobile OTP does not. */
  resendAbhaEnrolmentOtp: (id: string, aadhaar?: string) =>
    request<AbhaVerificationStep>(`/abdm/abha/enrolments/${id}/resend`, {
      method: "POST",
      body: JSON.stringify({ aadhaar }),
    }),
  submitAbhaEnrolmentMobileOtp: (id: string, otp: string) =>
    request<AbhaVerificationStep>(`/abdm/abha/enrolments/${id}/mobile-otp`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  /** Create the chosen ABHA address; `keepExisting` finishes on the one the ABHA already has. */
  chooseAbhaAddress: (id: string, abhaAddress: string, keepExisting = false) =>
    request<AbhaVerificationStep>(`/abdm/abha/enrolments/${id}/address`, {
      method: "POST",
      body: JSON.stringify({ abha_address: abhaAddress, keep_existing: keepExisting }),
    }),
  /** The ABHA QR image, for showing on screen (cookie-authenticated GET). */
  abhaQrUrl: (id: string) => `${getApiBase()}/abdm/abha/verifications/${id}/qr`,
  requestAbhaMobileChange: (id: string, mobile: string) =>
    request<AbhaAccountChange>(`/abdm/abha/verifications/${id}/mobile`, {
      method: "POST",
      body: JSON.stringify({ mobile }),
    }),
  verifyAbhaMobileChange: (id: string, otp: string) =>
    request<AbhaAccountChange>(`/abdm/abha/verifications/${id}/mobile/verify`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  requestAbhaEmailLink: (id: string, email: string) =>
    request<AbhaAccountChange>(`/abdm/abha/verifications/${id}/email`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  requestAbhaReKyc: (id: string) =>
    request<AbhaAccountChange>(`/abdm/abha/verifications/${id}/re-kyc`, { method: "POST" }),
  verifyAbhaReKyc: (id: string, otp: string) =>
    request<AbhaVerificationStep>(`/abdm/abha/verifications/${id}/re-kyc/verify`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  /** `photo`: base64 JPEG or PNG, under 1 MB. */
  updateAbhaPhoto: (id: string, photo: string) =>
    request<AbhaAccountChange>(`/abdm/abha/verifications/${id}/photo`, {
      method: "POST",
      body: JSON.stringify({ photo }),
    }),
  requestAbhaClose: (id: string, data: CloseAbha) =>
    request<AbhaAccountChange>(`/abdm/abha/verifications/${id}/close`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyAbhaClose: (id: string, otp: string) =>
    request<AbhaClosed>(`/abdm/abha/verifications/${id}/close/verify`, {
      method: "POST",
      body: JSON.stringify({ otp }),
    }),
  readAbhaQr: (payload: string) =>
    request<AbhaCardQr>("/abdm/abha/qr", { method: "POST", body: JSON.stringify({ payload }) }),
  optOutAbha: (patientId: string, reason: string) =>
    request<AbhaOptedOut>(`/abdm/patients/${patientId}/abha/opt-out`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  /** The ABHA card image, for opening in a tab to print (cookie-authenticated GET). */
  abhaCardUrl: (id: string) => `${getApiBase()}/abdm/abha/verifications/${id}/card`,
  linkAbhaToPatient: (id: string, data: LinkAbhaToPatient) =>
    request<{ linked: boolean }>(`/abdm/abha/verifications/${id}/link`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAbdmHfr: () => request<HfrRegistration[]>("/abdm/hfr"),
  listFacilityHfr: () => request<FacilityHfrList>("/abdm/hfr/facilities"),
  linkFacilityHfr: (id: string, data: LinkHfrRequest) =>
    request<FacilityHfr>(`/abdm/hfr/facilities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  registerFacilityHfr: (id: string, data: RegisterHfrRequest) =>
    request<FacilityHfr>(`/abdm/hfr/facilities/${id}/register`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getHprCoverage: () => request<HprCoverage>("/abdm/hpr/coverage"),
  setDoctorHprId: (id: string, data: SetHprRequest) =>
    request<DoctorHpr>(`/abdm/hpr/doctors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  verifyDoctorHprId: (id: string) =>
    request<DoctorHpr>(`/abdm/hpr/doctors/${id}/verify`, { method: "POST" }),
  getAbdmPatientRecords: (patientId: string) =>
    request<AbdmPatientRecords>(`/abdm/patients/${patientId}/records`),
  linkAbdmCareContext: (id: string) =>
    request<AbdmCareContext>(`/abdm/care-contexts/${id}/link`, { method: "POST" }),
  /** Ask ABDM to text the patient the ABHA app link (no ABHA here yet). */
  sendAbdmSmsLink: (patientId: string) =>
    request<AbdmSmsLink | null>(`/abdm/patients/${patientId}/sms-link`, { method: "POST" }),
  getAbdmSharingSummary: (month?: string) =>
    request<AbdmSharingSummary>(
      `/abdm/sharing/summary${month ? `?month=${encodeURIComponent(month)}` : ""}`,
    ),
  getAbdmDashboard: (month?: string) =>
    request<AbdmDashboard>(`/abdm/dashboard${month ? `?month=${encodeURIComponent(month)}` : ""}`),
  getAbdmScanShareCounters: () => request<AbdmScanShareCounters>("/abdm/scan-share/counters"),
  listAbdmScanShares: () => request<AbdmProfileShare[]>("/abdm/scan-share/queue"),
  createAbdmScanShareVerification: (id: string) =>
    request<AbhaVerificationStep>(`/abdm/scan-share/${id}/verification`, { method: "POST" }),
  completeAbdmScanShare: (id: string, data: CompleteAbdmProfileShare) =>
    request<AbdmProfileShare>(`/abdm/scan-share/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  dismissAbdmScanShare: (id: string) =>
    request<AbdmProfileShare>(`/abdm/scan-share/${id}/dismiss`, { method: "POST" }),
  raiseAbdmConsentRequest: (patientId: string, data: RaiseAbdmConsentRequest) =>
    request<AbdmConsentRequest>(`/abdm/patients/${patientId}/consent-requests`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  checkAbdmConsentRequestStatus: (id: string) =>
    request<AbdmConsentRequest>(`/abdm/consent-requests/${id}/check-status`, { method: "POST" }),
  getAbdmReceivedRecords: (patientId: string) =>
    request<AbdmHiuPatientView>(`/abdm/patients/${patientId}/received-records`),
  getAbdmReceivedRecord: (id: string) =>
    request<AbdmReceivedRecord>(`/abdm/received-records/${id}`),
  receiveAbdmGatewayCallback: (data: Record<string, unknown>) =>
    request<unknown>("/abdm/gateway/callback", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPendingAbdmGatewayCallbacks: () => request<unknown>("/abdm/gateway/callbacks/pending"),
  acknowledgeAbdmGatewayCallback: (id: string, data: Record<string, unknown>) =>
    request<unknown>(`/abdm/gateway/callbacks/${id}/ack`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
