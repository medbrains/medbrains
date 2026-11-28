/** The `/quality` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AuditFinding,
  AutoScheduleRequest,
  CommitteeDashboard,
  CreateAccreditationStandardRequest,
  CreateAuditFindingRequest,
  CreateCapaRequest,
  CreateMeetingRequest,
  CreateMortalityReviewRequest,
  CreateQualityAuditRequest,
  CreateQualityCommitteeRequest,
  CreateQualityDocumentRequest,
  CreateQualityIncidentRequest,
  CreateQualityIndicatorRequest,
  DepartmentScorecard,
  EvidenceCompilation,
  IndicatorDirection,
  PatientSafetyIndicator,
  PendingAckUser,
  QualityAccreditationCompliance,
  QualityAccreditationStandard,
  QualityActionItem,
  QualityAudit,
  QualityCapa,
  QualityCommittee,
  QualityCommitteeMeeting,
  QualityDocument,
  QualityIncident,
  QualityIncidentListItem,
  QualityIndicator,
  QualityIndicatorValue,
  RecordIndicatorValueRequest,
  ScheduleAuditsRequest,
  UpdateComplianceRequest,
  UpdateQualityIncidentRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const qualityApi = {
  // ── Quality Management ──
  listQualityIndicators: (params?: { category?: string }) =>
    request<QualityIndicator[]>(
      `/quality/indicators${params?.category ? `?category=${encodeURIComponent(params.category)}` : ""}`,
    ),

  createQualityIndicator: (data: CreateQualityIndicatorRequest) =>
    request<QualityIndicator>("/quality/indicators", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listIndicatorValues: (params?: { indicator_id?: string; period?: string }) => {
    const qs = new URLSearchParams();
    if (params?.indicator_id) qs.set("indicator_id", params.indicator_id);
    if (params?.period) qs.set("period", params.period);
    const q = qs.toString();
    return request<QualityIndicatorValue[]>(`/quality/indicator-values${q ? `?${q}` : ""}`);
  },

  recordIndicatorValue: (data: RecordIndicatorValueRequest) =>
    request<QualityIndicatorValue>("/quality/indicator-values", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listQualityDocuments: (params?: { status?: string; category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.category) qs.set("category", params.category);
    const q = qs.toString();
    return request<QualityDocument[]>(`/quality/documents${q ? `?${q}` : ""}`);
  },

  getQualityDocument: (id: string) => request<QualityDocument>(`/quality/documents/${id}`),

  createQualityDocument: (data: CreateQualityDocumentRequest) =>
    request<QualityDocument>("/quality/documents", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDocumentStatus: (id: string, data: { status: string }) =>
    request<QualityDocument>(`/quality/documents/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  acknowledgeDocument: (id: string) =>
    request<{ acknowledged: boolean }>(`/quality/documents/${id}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  listQualityIncidents: (params?: { status?: string; severity?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.severity) qs.set("severity", params.severity);
    const q = qs.toString();
    return request<QualityIncidentListItem[]>(`/quality/incidents${q ? `?${q}` : ""}`);
  },

  getQualityIncident: (id: string) => request<QualityIncident>(`/quality/incidents/${id}`),

  createQualityIncident: (data: CreateQualityIncidentRequest) =>
    request<QualityIncident>("/quality/incidents", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateQualityIncident: (id: string, data: UpdateQualityIncidentRequest) =>
    request<QualityIncident>(`/quality/incidents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listCapa: (params?: { incident_id?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.incident_id) qs.set("incident_id", params.incident_id);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<QualityCapa[]>(`/quality/capa${q ? `?${q}` : ""}`);
  },

  createCapa: (data: CreateCapaRequest) =>
    request<QualityCapa>("/quality/capa", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCapa: (id: string, data: { status?: string; effectiveness_check?: string }) =>
    request<QualityCapa>(`/quality/capa/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listQualityCommittees: () => request<QualityCommittee[]>("/quality/committees"),

  createQualityCommittee: (data: CreateQualityCommitteeRequest) =>
    request<QualityCommittee>("/quality/committees", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listCommitteeMeetings: (params?: { committee_id?: string }) =>
    request<QualityCommitteeMeeting[]>(
      `/quality/meetings${params?.committee_id ? `?committee_id=${encodeURIComponent(params.committee_id)}` : ""}`,
    ),

  createCommitteeMeeting: (data: CreateMeetingRequest) =>
    request<QualityCommitteeMeeting>("/quality/meetings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCommitteeMeeting: (id: string, data: Record<string, unknown>) =>
    request<QualityCommitteeMeeting>(`/quality/meetings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listActionItems: (params?: { source_type?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.source_type) qs.set("source_type", params.source_type);
    if (params?.status) qs.set("status", params.status);
    const q = qs.toString();
    return request<QualityActionItem[]>(`/quality/action-items${q ? `?${q}` : ""}`);
  },

  createActionItem: (data: {
    source_type: string;
    source_id: string;
    description?: string;
    assigned_to: string;
    due_date: string;
  }) =>
    request<QualityActionItem>("/quality/action-items", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAccreditationStandards: (params?: { body?: string }) =>
    request<QualityAccreditationStandard[]>(
      `/quality/standards${params?.body ? `?body=${encodeURIComponent(params.body)}` : ""}`,
    ),

  createAccreditationStandard: (data: CreateAccreditationStandardRequest) =>
    request<QualityAccreditationStandard>("/quality/standards", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAccreditationCompliance: (params?: { standard_id?: string }) =>
    request<QualityAccreditationCompliance[]>(
      `/quality/compliance${params?.standard_id ? `?standard_id=${encodeURIComponent(params.standard_id)}` : ""}`,
    ),

  updateAccreditationCompliance: (data: UpdateComplianceRequest) =>
    request<QualityAccreditationCompliance>("/quality/compliance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listQualityAudits: (params?: { status?: string; department_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.department_id) qs.set("department_id", params.department_id);
    const q = qs.toString();
    return request<QualityAudit[]>(`/quality/audits${q ? `?${q}` : ""}`);
  },

  getQualityAudit: (id: string) => request<QualityAudit>(`/quality/audits/${id}`),

  createQualityAudit: (data: CreateQualityAuditRequest) =>
    request<QualityAudit>("/quality/audits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateQualityAudit: (id: string, data: Record<string, unknown>) =>
    request<QualityAudit>(`/quality/audits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  setQualityIndicatorDirection: (id: string, direction: IndicatorDirection) =>
    request<void>(`/quality/indicators/${id}/direction`, {
      method: "PUT",
      body: JSON.stringify({ direction }),
    }),
  listPendingAcks: (documentId: string) =>
    request<PendingAckUser[]>(`/quality/documents/${documentId}/pending-acks`),
  autoScheduleMeetings: (committeeId: string, data: AutoScheduleRequest) =>
    request<Record<string, unknown>>(`/quality/committees/${committeeId}/auto-schedule`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  compileEvidence: (body: string) =>
    request<EvidenceCompilation>(`/quality/accreditation/${body}/evidence`),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Quality Analytics
  // ══════════════════════════════════════════════════════════

  scheduleAudits: (data: ScheduleAuditsRequest) =>
    request<{ count: number }>("/quality/audits/schedule", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAuditFindings: (auditId: string) =>
    request<AuditFinding[]>(`/quality/audits/${auditId}/findings`),

  createAuditFinding: (auditId: string, data: CreateAuditFindingRequest) =>
    request<AuditFinding>(`/quality/audits/${auditId}/findings`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listOverdueCapas: () => request<QualityCapa[]>("/quality/capas/overdue"),

  committeeDashboard: () => request<CommitteeDashboard>("/quality/committees/dashboard"),

  createMortalityReview: (data: CreateMortalityReviewRequest) =>
    request<QualityIncident>("/quality/mortality-reviews", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listSentinelEvents: () => request<QualityIncident[]>("/quality/incidents/sentinel"),

  patientSafetyIndicators: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<PatientSafetyIndicator[]>(`/quality/analytics/psi${qs ? `?${qs}` : ""}`);
  },

  departmentScorecard: () => request<DepartmentScorecard[]>("/quality/analytics/scorecard"),
};
