/** The `/regulatory` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AdrReport,
  AutoPopulateRequest,
  ChecklistItemInput,
  CompletePcpndtFormRequest,
  ComplianceCalendarEvent,
  ComplianceChecklist,
  ComplianceChecklistItem,
  ComplianceChecklistWithItems,
  ComplianceDashboard,
  ComplianceDrill,
  ComplianceGap,
  CompliancePolicy,
  CompliancePolicyKind,
  CompliancePolicyTemplate,
  CreateAdrRequest,
  CreateCalendarEventRequest,
  CreateChecklistRequest,
  CreateMvRequest,
  CreatePcpndtRequest,
  CreateRegulatorySubmissionRequest,
  DpdpDashboard,
  LicenseDashboardItem,
  MateriovigilanceReport,
  NablDocumentSummary,
  PcpndtForm,
  PcpndtQuarterlySummary,
  PrivacyOfficer,
  PrivacyOfficerRole,
  PublicPrivacyContact,
  RecordDrillRequest,
  RegulatorySubmission,
  SetPrivacyOfficerRequest,
  StaffCredentialSummary,
  UpdateAdrRequest,
  UpdateCalendarEventRequest,
  UpdateChecklistItemRequest,
  UpdateChecklistRequest,
  UpdateMvRequest,
  UpdatePcpndtRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const regulatoryApi = {
  // ── Regulatory & Compliance ──────────────────────────────

  // Dashboard
  getRegulatoryDashboard: () => request<ComplianceDashboard>("/regulatory/dashboard"),

  getDepartmentCompliance: (deptId: string) =>
    request<ComplianceChecklist[]>(`/regulatory/dashboard/department/${deptId}`),

  getComplianceGaps: () => request<ComplianceGap[]>("/regulatory/dashboard/gaps"),

  // Checklists
  listChecklists: (params?: {
    department_id?: string;
    accreditation_body?: string;
    status?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.accreditation_body) sp.set("accreditation_body", params.accreditation_body);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<ComplianceChecklist[]>(`/regulatory/checklists${qs ? `?${qs}` : ""}`);
  },

  createChecklist: (data: CreateChecklistRequest) =>
    request<ComplianceChecklist>("/regulatory/checklists", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getChecklist: (id: string) =>
    request<ComplianceChecklistWithItems>(`/regulatory/checklists/${id}`),

  updateChecklist: (id: string, data: UpdateChecklistRequest) =>
    request<ComplianceChecklist>(`/regulatory/checklists/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  batchChecklistItems: (checklistId: string, items: ChecklistItemInput[]) =>
    request<ComplianceChecklistItem[]>(`/regulatory/checklists/${checklistId}/items`, {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  updateChecklistItem: (checklistId: string, itemId: string, data: UpdateChecklistItemRequest) =>
    request<ComplianceChecklistItem>(`/regulatory/checklists/${checklistId}/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteChecklistItem: (checklistId: string, itemId: string) =>
    request<{ removed: string }>(`/regulatory/checklists/${checklistId}/items/${itemId}`, {
      method: "DELETE",
    }),

  // ADR Reports
  listAdrReports: (params?: { status?: string; severity?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.severity) sp.set("severity", params.severity);
    const qs = sp.toString();
    return request<AdrReport[]>(`/regulatory/adr-reports${qs ? `?${qs}` : ""}`);
  },

  createAdrReport: (data: CreateAdrRequest) =>
    request<AdrReport>("/regulatory/adr-reports", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getAdrReport: (id: string) => request<AdrReport>(`/regulatory/adr-reports/${id}`),

  updateAdrReport: (id: string, data: UpdateAdrRequest) =>
    request<AdrReport>(`/regulatory/adr-reports/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  submitAdrToPvpi: (id: string) =>
    request<AdrReport>(`/regulatory/adr-reports/${id}/submit`, {
      method: "POST",
    }),

  // Materiovigilance
  listMvReports: (params?: { status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<MateriovigilanceReport[]>(`/regulatory/materiovigilance${qs ? `?${qs}` : ""}`);
  },

  createMvReport: (data: CreateMvRequest) =>
    request<MateriovigilanceReport>("/regulatory/materiovigilance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMvReport: (id: string) =>
    request<MateriovigilanceReport>(`/regulatory/materiovigilance/${id}`),

  updateMvReport: (id: string, data: UpdateMvRequest) =>
    request<MateriovigilanceReport>(`/regulatory/materiovigilance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  submitMvToCdsco: (id: string) =>
    request<MateriovigilanceReport>(`/regulatory/materiovigilance/${id}/submit`, {
      method: "POST",
    }),

  // PCPNDT Forms
  listPcpndtForms: (params?: { status?: string; radiology_order_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.radiology_order_id) sp.set("radiology_order_id", params.radiology_order_id);
    const qs = sp.toString();
    return request<PcpndtForm[]>(`/regulatory/pcpndt-forms${qs ? `?${qs}` : ""}`);
  },

  createPcpndtForm: (data: CreatePcpndtRequest) =>
    request<PcpndtForm>("/regulatory/pcpndt-forms", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPcpndtForm: (id: string) => request<PcpndtForm>(`/regulatory/pcpndt-forms/${id}`),

  completePcpndtForm: (id: string, data: CompletePcpndtFormRequest) =>
    request<PcpndtForm>(`/regulatory/pcpndt-forms/${id}/complete`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updatePcpndtForm: (id: string, data: UpdatePcpndtRequest) =>
    request<PcpndtForm>(`/regulatory/pcpndt-forms/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getPcpndtQuarterly: () => request<PcpndtQuarterlySummary>("/regulatory/pcpndt-forms/quarterly"),

  // Compliance Calendar
  listCalendarEvents: (params?: {
    status?: string;
    department_id?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<ComplianceCalendarEvent[]>(`/regulatory/calendar${qs ? `?${qs}` : ""}`);
  },

  createCalendarEvent: (data: CreateCalendarEventRequest) =>
    request<ComplianceCalendarEvent>("/regulatory/calendar", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCalendarEvent: (id: string, data: UpdateCalendarEventRequest) =>
    request<ComplianceCalendarEvent>(`/regulatory/calendar/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getOverdueCalendarEvents: () =>
    request<ComplianceCalendarEvent[]>("/regulatory/calendar/overdue"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Regulatory
  // ══════════════════════════════════════════════════════════

  autoPopulateChecklist: (checklistId: string, data?: AutoPopulateRequest) =>
    request<{ items_auto_populated: number }>(
      `/regulatory/checklists/${checklistId}/auto-populate`,
      {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      },
    ),

  listRegulatorySubmissions: () => request<RegulatorySubmission[]>("/regulatory/submissions"),

  createRegulatorySubmission: (data: CreateRegulatorySubmissionRequest) =>
    request<RegulatorySubmission>("/regulatory/submissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listMockSurveys: () => request<ComplianceChecklist[]>("/regulatory/mock-surveys"),

  createMockSurvey: (data: CreateChecklistRequest) =>
    request<ComplianceChecklist>("/regulatory/mock-surveys", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  staffCredentials: () => request<StaffCredentialSummary[]>("/regulatory/staff-credentials"),

  licenseDashboard: () => request<LicenseDashboardItem[]>("/regulatory/licenses/dashboard"),

  nablDocumentTracking: () => request<NablDocumentSummary[]>("/regulatory/nabl/documents"),
  // DPDP Act 2023 / Rules 2025 and CERT-In 2022 compliance pack
  getDpdpDashboard: () => request<DpdpDashboard>("/regulatory/dpdp/dashboard"),
  listPrivacyOfficers: () => request<PrivacyOfficer[]>("/regulatory/dpdp/officers"),
  setPrivacyOfficer: (role: PrivacyOfficerRole, data: SetPrivacyOfficerRequest) =>
    request<PrivacyOfficer[]>(`/regulatory/dpdp/officers/${role}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  publishPrivacyOfficer: (role: PrivacyOfficerRole) =>
    request<PrivacyOfficer[]>(`/regulatory/dpdp/officers/${role}/publish`, { method: "PUT" }),
  getDpdpPublicNotice: () => request<PublicPrivacyContact>("/regulatory/dpdp/public-notice"),
  listCompliancePolicyTemplates: () =>
    request<CompliancePolicyTemplate[]>("/regulatory/dpdp/templates"),
  listCompliancePolicies: (kind?: CompliancePolicyKind) =>
    request<CompliancePolicy[]>(`/regulatory/dpdp/policies${kind ? `?kind=${kind}` : ""}`),
  startCompliancePolicyDraft: (data: { kind: CompliancePolicyKind; language: string }) =>
    request<CompliancePolicy>("/regulatory/dpdp/policies", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  editCompliancePolicy: (id: string, data: { title: string; body: string }) =>
    request<CompliancePolicy>(`/regulatory/dpdp/policies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  submitCompliancePolicy: (id: string) =>
    request<CompliancePolicy>(`/regulatory/dpdp/policies/${id}/submit`, { method: "PUT" }),
  approveCompliancePolicy: (id: string) =>
    request<CompliancePolicy>(`/regulatory/dpdp/policies/${id}/approve`, { method: "PUT" }),
  returnCompliancePolicy: (id: string, reason: string) =>
    request<CompliancePolicy>(`/regulatory/dpdp/policies/${id}/return`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    }),
  listComplianceDrills: () => request<ComplianceDrill[]>("/regulatory/dpdp/drills"),
  recordComplianceDrill: (data: RecordDrillRequest) =>
    request<ComplianceDrill[]>("/regulatory/dpdp/drills", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
