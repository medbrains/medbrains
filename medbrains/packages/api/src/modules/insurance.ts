/** The `/insurance` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AnswerPayerQueryRequest,
  AttachDocumentRequest,
  CheckNhcxEligibilityRequest,
  CheckPaRequiredRequest,
  CreateAppealRequest,
  CreatePaRuleRequest,
  CreatePriorAuthRequestBody,
  InsuranceDashboard,
  InsuranceVerification,
  NhcxEligibilityCheck,
  NhcxPayerQuery,
  NhcxPayment,
  NhcxQueuedResponse,
  NhcxSearchRequest,
  NhcxSlaReport,
  NhcxTask,
  PaCheckResult,
  PaRequirementRule,
  PostNhcxPaymentRequest,
  PreauthNhcxView,
  PriorAuthAppeal,
  PriorAuthDetail,
  PriorAuthDocument,
  PriorAuthRequestRow,
  RespondPriorAuthRequest,
  RunVerificationRequest,
  SubmitPreauthToNhcxRequest,
  UpdateAppealRequest,
  UpdatePaRuleRequest,
  UpdatePriorAuthRequestBody,
} from "@medbrains/types";
import { request } from "../client.js";

export const insuranceApi = {
  /** Ask the payer where a pre-authorisation stands (`hcx/status`). */
  checkPreauthNhcxStatus: (id: string) =>
    request<NhcxQueuedResponse>(`/insurance/prior-auths/${id}/nhcx/status`, {
      method: "POST",
    }),

  /** Ask a payer for its claims from this hospital in a date range (`hcx/search`). */
  searchNhcxClaims: (data: NhcxSearchRequest) =>
    request<NhcxQueuedResponse>("/insurance/nhcx/search", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** The latest searches sent to payers, with what each payer listed. */
  listNhcxSearches: () => request<NhcxTask[]>("/insurance/nhcx/searches"),

  /** Payments payers reported through NHCX — `open` (unmatched or mismatched) or `all`. */
  listNhcxPayments: (filter: "open" | "all" = "open") =>
    request<NhcxPayment[]>(`/insurance/nhcx/payments?filter=${filter}`),

  /** Post a payment that named no claim here to the claim it pays. */
  postNhcxPayment: (id: string, data: PostNhcxPaymentRequest) =>
    request<NhcxPayment>(`/insurance/nhcx/payments/${id}/post`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Ask the payer through NHCX whether the patient's policy is in force. */
  checkNhcxEligibility: (data: CheckNhcxEligibilityRequest) =>
    request<NhcxEligibilityCheck>("/insurance/verifications/nhcx", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** The patient's latest NHCX eligibility checks, newest first. */
  listNhcxEligibility: (patientId: string) =>
    request<NhcxEligibilityCheck[]>(
      `/insurance/nhcx/eligibility?patient_id=${encodeURIComponent(patientId)}`,
    ),

  /** Send a pre-authorisation to the payer through NHCX. */
  submitPreauthToNhcx: (id: string, data: SubmitPreauthToNhcxRequest) =>
    request<NhcxQueuedResponse>(`/insurance/prior-auths/${id}/submit-to-nhcx`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** A pre-authorisation's NHCX timeline, payer queries and IRDAI clock. */
  getPreauthNhcx: (id: string) => request<PreauthNhcxView>(`/insurance/prior-auths/${id}/nhcx`),

  /** Answer a payer's query through NHCX. */
  answerNhcxPayerQuery: (id: string, data: AnswerPayerQueryRequest) =>
    request<NhcxPayerQuery>(`/insurance/nhcx/queries/${id}/answer`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Pre-authorisations against the IRDAI clock, and breaches by payer. */
  getNhcxSla: (patientId?: string) =>
    request<NhcxSlaReport>(
      `/insurance/nhcx/sla${patientId ? `?patient_id=${encodeURIComponent(patientId)}` : ""}`,
    ),

  // ── Insurance & TPA ─────────────────────────────────────

  // Verification
  listVerifications: (params?: {
    patient_id?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<InsuranceVerification[]>(`/insurance/verifications${qs ? `?${qs}` : ""}`);
  },

  runVerification: (data: RunVerificationRequest) =>
    request<InsuranceVerification>("/insurance/verifications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getVerification: (id: string) => request<InsuranceVerification>(`/insurance/verifications/${id}`),

  getPatientBenefits: (patientId: string) =>
    request<InsuranceVerification>(`/insurance/verifications/patient/${patientId}/benefits`),

  // Prior Auth
  listPriorAuths: (params?: {
    patient_id?: string;
    status?: string;
    urgency?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.urgency) sp.set("urgency", params.urgency);
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<PriorAuthRequestRow[]>(`/insurance/prior-auths${qs ? `?${qs}` : ""}`);
  },

  getPriorAuth: (id: string) => request<PriorAuthDetail>(`/insurance/prior-auths/${id}`),

  createPriorAuth: (data: CreatePriorAuthRequestBody) =>
    request<PriorAuthRequestRow>("/insurance/prior-auths", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePriorAuth: (id: string, data: UpdatePriorAuthRequestBody) =>
    request<PriorAuthRequestRow>(`/insurance/prior-auths/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  submitPriorAuth: (id: string) =>
    request<PriorAuthRequestRow>(`/insurance/prior-auths/${id}/submit`, {
      method: "POST",
    }),

  respondPriorAuth: (id: string, data: RespondPriorAuthRequest) =>
    request<PriorAuthRequestRow>(`/insurance/prior-auths/${id}/respond`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  cancelPriorAuth: (id: string) =>
    request<PriorAuthRequestRow>(`/insurance/prior-auths/${id}/cancel`, {
      method: "POST",
    }),

  checkPaRequired: (data: CheckPaRequiredRequest) =>
    request<PaCheckResult>("/insurance/check-pa", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Documents
  listPaDocuments: (paId: string) =>
    request<PriorAuthDocument[]>(`/insurance/prior-auths/${paId}/documents`),

  attachPaDocument: (paId: string, data: AttachDocumentRequest) =>
    request<PriorAuthDocument>(`/insurance/prior-auths/${paId}/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removePaDocument: (paId: string, docId: string) =>
    request<{ deleted: boolean }>(`/insurance/prior-auths/${paId}/documents/${docId}`, {
      method: "DELETE",
    }),

  // Appeals
  listAppeals: (params?: { prior_auth_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.prior_auth_id) sp.set("prior_auth_id", params.prior_auth_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<PriorAuthAppeal[]>(`/insurance/appeals${qs ? `?${qs}` : ""}`);
  },

  createAppeal: (data: CreateAppealRequest) =>
    request<PriorAuthAppeal>("/insurance/appeals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAppeal: (id: string, data: UpdateAppealRequest) =>
    request<PriorAuthAppeal>(`/insurance/appeals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // PA Rules
  listPaRules: () => request<PaRequirementRule[]>("/insurance/rules"),

  createPaRule: (data: CreatePaRuleRequest) =>
    request<PaRequirementRule>("/insurance/rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePaRule: (id: string, data: UpdatePaRuleRequest) =>
    request<PaRequirementRule>(`/insurance/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Dashboard
  getInsuranceDashboard: () => request<InsuranceDashboard>("/insurance/dashboard"),
};
