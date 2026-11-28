/** The `/cds` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CheckDrugInteractionsRequest,
  ClinicalProtocol,
  CoSignatureRequest,
  CreateClinicalProtocolRequest,
  CreateCoSignatureRequest,
  CreateCriticalValueRuleRequest,
  CreateDrugInteractionRequest,
  CreatePgLogbookRequest,
  CreatePreAuthRequest,
  CreateRestrictedDrugApprovalRequest,
  CriticalValueRule,
  DrugInteraction,
  DrugSafetyCheckResult,
  PgLogbookEntry,
  PreAuthorizationRequest,
  RestrictedDrugApproval,
  UpdatePreAuthRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const cdsApi = {
  // ── Clinical Decision Support ─────────────────────────────

  checkDrugSafety: (data: CheckDrugInteractionsRequest) =>
    request<DrugSafetyCheckResult>("/cds/drug-safety-check", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listDrugInteractions: () => request<DrugInteraction[]>("/cds/drug-interactions"),
  createDrugInteraction: (data: CreateDrugInteractionRequest) =>
    request<DrugInteraction>("/cds/drug-interactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteDrugInteraction: (id: string) =>
    request<DrugInteraction>(`/cds/drug-interactions/${id}`, {
      method: "DELETE",
    }),
  listCriticalValueRules: () => request<CriticalValueRule[]>("/cds/critical-value-rules"),
  createCriticalValueRule: (data: CreateCriticalValueRuleRequest) =>
    request<CriticalValueRule>("/cds/critical-value-rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCriticalValueRule: (id: string) =>
    request<CriticalValueRule>(`/cds/critical-value-rules/${id}`, {
      method: "DELETE",
    }),
  listClinicalProtocols: () => request<ClinicalProtocol[]>("/cds/protocols"),
  createClinicalProtocol: (data: CreateClinicalProtocolRequest) =>
    request<ClinicalProtocol>("/cds/protocols", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteClinicalProtocol: (id: string) =>
    request<ClinicalProtocol>(`/cds/protocols/${id}`, {
      method: "DELETE",
    }),
  listRestrictedDrugApprovals: () =>
    request<RestrictedDrugApproval[]>("/cds/restricted-drug-approvals"),
  createRestrictedDrugApproval: (data: CreateRestrictedDrugApprovalRequest) =>
    request<RestrictedDrugApproval>("/cds/restricted-drug-approvals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRestrictedDrugApproval: (id: string, data: { status: string; denied_reason?: string }) =>
    request<RestrictedDrugApproval>(`/cds/restricted-drug-approvals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listPreAuthRequests: (patientId?: string) =>
    request<PreAuthorizationRequest[]>(
      `/cds/pre-auth-requests${patientId ? `?patient_id=${patientId}` : ""}`,
    ),
  createPreAuthRequest: (data: CreatePreAuthRequest) =>
    request<PreAuthorizationRequest>("/cds/pre-auth-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePreAuthRequest: (id: string, data: UpdatePreAuthRequest) =>
    request<PreAuthorizationRequest>(`/cds/pre-auth-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listPgLogbook: (params?: {
    user_id?: string;
    supervisor_id?: string;
    pending_verification?: boolean;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    if (params?.supervisor_id) searchParams.set("supervisor_id", params.supervisor_id);
    if (params?.pending_verification) searchParams.set("pending_verification", "true");
    const qs = searchParams.toString();
    return request<PgLogbookEntry[]>(`/cds/pg-logbook${qs ? `?${qs}` : ""}`);
  },
  createPgLogbookEntry: (data: CreatePgLogbookRequest) =>
    request<PgLogbookEntry>("/cds/pg-logbook", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyPgLogbookEntry: (id: string) =>
    request<PgLogbookEntry>(`/cds/pg-logbook/${id}/verify`, {
      method: "PUT",
    }),
  listCoSignatures: () => request<CoSignatureRequest[]>("/cds/co-signatures"),
  createCoSignature: (data: CreateCoSignatureRequest) =>
    request<CoSignatureRequest>("/cds/co-signatures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCoSignature: (id: string, data: { status: string; denied_reason?: string }) =>
    request<CoSignatureRequest>(`/cds/co-signatures/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
