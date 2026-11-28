/** The `/audit` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AccessLogEntry,
  AccessLogQuery,
  AuditChainVerification,
  AuditLogEntry,
  AuditLogQuery,
  AuditLogSummary,
  AuditStats,
  LogAccessRequest,
} from "@medbrains/types";
import { request } from "../client.js";
import { getApiBase } from "../config.js";

export const auditApi = {
  // ══════════════════════════════════════════════════════════
  //  Audit Trail
  // ══════════════════════════════════════════════════════════

  listAuditLog: (params?: AuditLogQuery) => {
    const sp = new URLSearchParams();
    if (params?.module) sp.set("module", params.module);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.entity_id) sp.set("entity_id", params.entity_id);
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.action) sp.set("action", params.action);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<AuditLogSummary[]>(`/audit/log${qs ? `?${qs}` : ""}`);
  },

  getAuditEntry: (id: string) => request<AuditLogEntry>(`/audit/log/${id}`),

  getEntityAuditTrail: (entityType: string, entityId: string) =>
    request<AuditLogEntry[]>(`/audit/log/entity/${entityType}/${entityId}`),

  getAuditStats: () => request<AuditStats>("/audit/stats"),
  listAuditChainVerifications: () =>
    request<AuditChainVerification[]>("/audit/chain-verifications"),

  listAccessLog: (params?: AccessLogQuery) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.module) sp.set("module", params.module);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<AccessLogEntry[]>(`/audit/access-log${qs ? `?${qs}` : ""}`);
  },

  logAccess: (data: LogAccessRequest) =>
    request<{ ok: boolean }>("/audit/access-log", { method: "POST", body: JSON.stringify(data) }),

  getPatientAccessLog: (patientId: string) =>
    request<AccessLogEntry[]>(`/audit/access-log/patient/${patientId}`),

  listAuditModules: () => request<string[]>("/audit/modules"),

  listAuditEntityTypes: () => request<string[]>("/audit/entity-types"),

  exportAuditLogUrl: (params?: AuditLogQuery & { format?: string }) => {
    const sp = new URLSearchParams();
    if (params?.module) sp.set("module", params.module);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.entity_id) sp.set("entity_id", params.entity_id);
    if (params?.user_id) sp.set("user_id", params.user_id);
    if (params?.action) sp.set("action", params.action);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.format) sp.set("format", params.format);
    const qs = sp.toString();
    return `${getApiBase()}/audit/export${qs ? `?${qs}` : ""}`;
  },

  getUserActivity: (userId: string) => request<AuditLogSummary[]>(`/audit/user/${userId}/activity`),

  getEntityTimeline: (entityType: string, entityId: string) =>
    request<AuditLogEntry[]>(`/audit/timeline/${entityType}/${entityId}`),
  exportAuditLog: () => request<unknown>("/audit/export"),
};
