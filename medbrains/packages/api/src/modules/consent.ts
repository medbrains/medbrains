/** The `/consent` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ConsentAuditEntry,
  ConsentSignatureMetadata,
  ConsentSummaryItem,
  ConsentTemplate,
  ConsentTemplateListItem,
  CreateConsentSignatureRequest,
  CreateConsentTemplateRequest,
  RevokeConsentRequest,
  UpdateConsentTemplateRequest,
  VerifyConsentRequest,
  VerifyConsentResponse,
} from "@medbrains/types";
import { request } from "../client.js";

export const consentApi = {
  // ── Consent Management ─────────────────────────────────

  listConsentTemplates: (params?: { category?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<ConsentTemplateListItem[]>(`/consent/templates${qs ? `?${qs}` : ""}`);
  },
  getConsentTemplate: (id: string) => request<ConsentTemplate>(`/consent/templates/${id}`),
  createConsentTemplate: (data: CreateConsentTemplateRequest) =>
    request<ConsentTemplate>("/consent/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateConsentTemplate: (id: string, data: UpdateConsentTemplateRequest) =>
    request<ConsentTemplate>(`/consent/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteConsentTemplate: (id: string) =>
    request<{ deleted: boolean }>(`/consent/templates/${id}`, {
      method: "DELETE",
    }),
  listConsentAudit: (params?: {
    patient_id?: string;
    consent_source?: string;
    action?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.consent_source) sp.set("consent_source", params.consent_source);
    if (params?.action) sp.set("action", params.action);
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<ConsentAuditEntry[]>(`/consent/audit${qs ? `?${qs}` : ""}`);
  },
  listPatientConsentAudit: (patientId: string) =>
    request<ConsentAuditEntry[]>(`/consent/audit/patient/${patientId}`),
  verifyConsent: (data: VerifyConsentRequest) =>
    request<VerifyConsentResponse>("/consent/verify", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPatientConsentSummary: (patientId: string) =>
    request<ConsentSummaryItem[]>(`/consent/verify/patient/${patientId}`),
  revokeConsent: (data: RevokeConsentRequest) =>
    request<{ revoked: boolean }>("/consent/revoke", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listConsentSignatures: (params?: { consent_source?: string; consent_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.consent_source) sp.set("consent_source", params.consent_source);
    if (params?.consent_id) sp.set("consent_id", params.consent_id);
    const qs = sp.toString();
    return request<ConsentSignatureMetadata[]>(`/consent/signatures${qs ? `?${qs}` : ""}`);
  },
  getConsentSignature: (id: string) =>
    request<ConsentSignatureMetadata>(`/consent/signatures/${id}`),
  createConsentSignature: (data: CreateConsentSignatureRequest) =>
    request<ConsentSignatureMetadata>("/consent/signatures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteConsentSignature: (id: string) =>
    request<{ deleted: boolean }>(`/consent/signatures/${id}`, {
      method: "DELETE",
    }),
};
