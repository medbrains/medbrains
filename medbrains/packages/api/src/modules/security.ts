/** The `/security` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AddIncidentNoteRequest,
  AssessBreachRequest,
  CreateSecurityAccessCardRequest,
  CreateSecurityAccessLogRequest,
  CreateSecurityCameraRequest,
  CreateSecurityCodeDebriefRequest,
  CreateSecurityIncidentRequest,
  CreateSecurityPatientTagRequest,
  CreateSecurityZoneRequest,
  CreateVendorAccessGrant,
  OpenedIncident,
  PostureReport,
  RecordIncidentNoticeRequest,
  RecordSecurityTagEventRequest,
  ResolveSecurityTagAlertRequest,
  SecurityAccessCard,
  SecurityAccessLog,
  SecurityBandMatchResult,
  SecurityCamera,
  SecurityCheckStatus,
  SecurityCodeDebrief,
  SecurityIncident,
  SecurityIncidentUpdate,
  SecurityPatientTag,
  SecurityTagAlert,
  SecurityTagEventResult,
  SecurityZone,
  UpdateSecurityAccessCardRequest,
  UpdateSecurityCameraRequest,
  UpdateSecurityIncidentRequest,
  UpdateSecurityZoneRequest,
  VendorAccessEvent,
  VendorAccessGrant,
  VerifySecurityBandMatchRequest,
} from "@medbrains/types";
import type { Paginated } from "../client.js";
import { request } from "../client.js";

export const securityApi = {
  // ── Security Department ─────────────────────────────────

  // Zones
  listSecurityZones: () => request<SecurityZone[]>("/security/zones"),
  createSecurityZone: (body: CreateSecurityZoneRequest) =>
    request<SecurityZone>("/security/zones", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSecurityZone: (id: string, body: UpdateSecurityZoneRequest) =>
    request<SecurityZone>(`/security/zones/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Access Logs
  listSecurityAccessLogs: (params?: {
    zone_id?: string;
    employee_id?: string;
    is_after_hours?: boolean;
    from?: string;
    to?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.zone_id) sp.set("zone_id", params.zone_id);
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.is_after_hours != null) sp.set("is_after_hours", String(params.is_after_hours));
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<SecurityAccessLog[]>(`/security/access-logs${qs ? `?${qs}` : ""}`);
  },
  createSecurityAccessLog: (body: CreateSecurityAccessLogRequest) =>
    request<SecurityAccessLog>("/security/access-logs", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Access Cards
  listSecurityAccessCards: (params?: { employee_id?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.is_active != null) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<SecurityAccessCard[]>(`/security/cards${qs ? `?${qs}` : ""}`);
  },
  createSecurityAccessCard: (body: CreateSecurityAccessCardRequest) =>
    request<SecurityAccessCard>("/security/cards", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSecurityAccessCard: (id: string, body: UpdateSecurityAccessCardRequest) =>
    request<SecurityAccessCard>(`/security/cards/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deactivateSecurityAccessCard: (id: string, reason?: string) =>
    request<SecurityAccessCard>(`/security/cards/${id}/deactivate`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
    }),

  // Cameras
  listSecurityCameras: (params?: { zone_id?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.zone_id) sp.set("zone_id", params.zone_id);
    if (params?.is_active != null) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<SecurityCamera[]>(`/security/cameras${qs ? `?${qs}` : ""}`);
  },
  createSecurityCamera: (body: CreateSecurityCameraRequest) =>
    request<SecurityCamera>("/security/cameras", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSecurityCamera: (id: string, body: UpdateSecurityCameraRequest) =>
    request<SecurityCamera>(`/security/cameras/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Incidents
  listSecurityIncidents: (params?: { severity?: string; status?: string; category?: string }) => {
    const sp = new URLSearchParams();
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.status) sp.set("status", params.status);
    if (params?.category) sp.set("category", params.category);
    const qs = sp.toString();
    return request<SecurityIncident[]>(`/security/incidents${qs ? `?${qs}` : ""}`);
  },
  getSecurityIncident: (id: string) => request<SecurityIncident>(`/security/incidents/${id}`),
  createSecurityIncident: (body: CreateSecurityIncidentRequest) =>
    request<SecurityIncident>("/security/incidents", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateSecurityIncident: (id: string, body: UpdateSecurityIncidentRequest) =>
    request<SecurityIncident>(`/security/incidents/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Patient Tags
  listSecurityPatientTags: (params?: {
    patient_id?: string;
    tag_type?: string;
    alert_status?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.tag_type) sp.set("tag_type", params.tag_type);
    if (params?.alert_status) sp.set("alert_status", params.alert_status);
    const qs = sp.toString();
    return request<SecurityPatientTag[]>(`/security/patient-tags${qs ? `?${qs}` : ""}`);
  },
  createSecurityPatientTag: (body: CreateSecurityPatientTagRequest) =>
    request<SecurityPatientTag>("/security/patient-tags", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deactivateSecurityPatientTag: (id: string) =>
    request<SecurityPatientTag>(`/security/patient-tags/${id}/deactivate`, {
      method: "PUT",
    }),

  // Tag Alerts
  listSecurityTagAlerts: (params?: { tag_id?: string; is_resolved?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.tag_id) sp.set("tag_id", params.tag_id);
    if (params?.is_resolved != null) sp.set("is_resolved", String(params.is_resolved));
    const qs = sp.toString();
    return request<SecurityTagAlert[]>(`/security/tag-alerts${qs ? `?${qs}` : ""}`);
  },
  resolveSecurityTagAlert: (id: string, body: ResolveSecurityTagAlertRequest) =>
    request<SecurityTagAlert>(`/security/tag-alerts/${id}/resolve`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  verifySecurityBandMatch: (body: VerifySecurityBandMatchRequest) =>
    request<SecurityBandMatchResult>("/security/patient-tags/verify-match", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  recordSecurityTagEvent: (body: RecordSecurityTagEventRequest) =>
    request<SecurityTagEventResult>("/security/tag-events", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Code Debriefs
  listSecurityCodeDebriefs: () => request<SecurityCodeDebrief[]>("/security/debriefs"),
  getSecurityCodeDebrief: (id: string) => request<SecurityCodeDebrief>(`/security/debriefs/${id}`),
  createSecurityCodeDebrief: (body: CreateSecurityCodeDebriefRequest) =>
    request<SecurityCodeDebrief>("/security/debriefs", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  // ── Security → MedBrains access (vendor support access) ──
  listVendorAccessGrants: (page = 1) =>
    request<Paginated<VendorAccessGrant>>(`/security/vendor-access/grants?page=${page}&limit=50`),
  createVendorAccessGrant: (data: CreateVendorAccessGrant) =>
    request<VendorAccessGrant>("/security/vendor-access/grants", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveVendorAccessGrant: (id: string) =>
    request<VendorAccessGrant>(`/security/vendor-access/grants/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  revokeVendorAccessGrant: (id: string, reason?: string) =>
    request<VendorAccessGrant>(`/security/vendor-access/grants/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  listVendorAccessEvents: (id: string, page = 1) =>
    request<Paginated<VendorAccessEvent>>(
      `/security/vendor-access/grants/${id}/events?page=${page}&limit=200`,
    ),

  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: CERT-IN COMPLIANCE
  // ══════════════════════════════════════════════════════════════

  assessIncidentBreach: (id: string, data: AssessBreachRequest) =>
    request<SecurityIncident>(`/security/incidents/${id}/breach`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  recordIncidentNotice: (id: string, data: RecordIncidentNoticeRequest) =>
    request<SecurityIncident>(`/security/incidents/${id}/notices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getIncidentUpdates: (id: string) =>
    request<SecurityIncidentUpdate[]>(`/security/incidents/${id}/updates`),

  addIncidentUpdate: (id: string, data: AddIncidentNoteRequest) =>
    request<SecurityIncidentUpdate>(`/security/incidents/${id}/updates`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Each continuous security check's cadence and latest heartbeat. */
  listSecurityChecks: () => request<SecurityCheckStatus[]>("/security/intel/checks"),

  /** The latest posture run; null when it has never run. */
  getSecurityPosture: () => request<PostureReport | null>("/security/intel/posture"),

  /** Open an incident in the breach register from a finding (once). */
  openIncidentFromFinding: (id: string) =>
    request<OpenedIncident>(`/security/intel/findings/${id}/incident`, { method: "POST" }),
};
