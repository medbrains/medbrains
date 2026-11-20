/** The `/front-office` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateEnquiryRequest,
  CreateVisitorPassRequest,
  CreateVisitorRequest,
  FrontOfficeEnquiryLog,
  QueueDisplayConfig,
  QueueMetrics,
  QueuePriorityRule,
  QueueStatsResponse,
  RevokePassRequest,
  UpsertDisplayConfigRequest,
  UpsertQueuePriorityRequest,
  UpsertVisitingHoursRequest,
  VisitingHours,
  VisitorAnalytics,
  VisitorLog,
  VisitorPass,
  VisitorPassCheck,
  VisitorRegistration,
} from "@medbrains/types";
import { request } from "../client.js";

export const frontOfficeApi = {
  // ══════════════════════════════════════════════════════════
  //  Front Office & Reception
  // ══════════════════════════════════════════════════════════

  // Visiting Hours
  listVisitingHours: () => request<VisitingHours[]>("/front-office/visiting-hours"),

  upsertVisitingHours: (data: UpsertVisitingHoursRequest) =>
    request<VisitingHours>("/front-office/visiting-hours", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Visitor Registrations
  listVisitors: (params?: { patient_id?: string; category?: string }) =>
    request<VisitorRegistration[]>(
      `/front-office/visitors${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
    ),

  createVisitor: (data: CreateVisitorRequest) =>
    request<VisitorRegistration>("/front-office/visitors", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Visitor Passes
  /** The gate: is this pass (its QR carries the pass number) valid now? */
  scanVisitorPass: (code: string) =>
    request<VisitorPassCheck>(`/front-office/passes/scan?code=${encodeURIComponent(code)}`),
  listVisitorPasses: (params?: { status?: string; registration_id?: string }) =>
    request<VisitorPass[]>(
      `/front-office/passes${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
    ),

  createVisitorPass: (data: CreateVisitorPassRequest) =>
    request<VisitorPass>("/front-office/passes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  revokeVisitorPass: (id: string, data: RevokePassRequest) =>
    request<VisitorPass>(`/front-office/passes/${id}/revoke`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Visitor Logs
  listVisitorLogs: (params?: { pass_id?: string; active_only?: string }) =>
    request<VisitorLog[]>(
      `/front-office/visitor-logs${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
    ),

  checkInVisitor: (passId: string) =>
    request<VisitorLog>(`/front-office/visitor-logs/${passId}/check-in`, {
      method: "POST",
    }),

  checkOutVisitor: (passId: string) =>
    request<VisitorLog>(`/front-office/visitor-logs/${passId}/check-out`, {
      method: "PUT",
    }),

  // Queue Priority Rules
  listQueuePriorityRules: () => request<QueuePriorityRule[]>("/front-office/queue-priority"),

  upsertQueuePriorityRule: (data: UpsertQueuePriorityRequest) =>
    request<QueuePriorityRule>("/front-office/queue-priority", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Queue Display Config
  listQueueDisplayConfig: () => request<QueueDisplayConfig[]>("/front-office/display-config"),

  upsertQueueDisplayConfig: (data: UpsertDisplayConfigRequest) =>
    request<QueueDisplayConfig>("/front-office/display-config", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Enquiries
  listEnquiries: (params?: { enquiry_type?: string; resolved?: string }) =>
    request<FrontOfficeEnquiryLog[]>(
      `/front-office/enquiries${params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : ""}`,
    ),

  createEnquiry: (data: CreateEnquiryRequest) =>
    request<FrontOfficeEnquiryLog>("/front-office/enquiries", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  resolveEnquiry: (id: string) =>
    request<FrontOfficeEnquiryLog>(`/front-office/enquiries/${id}/resolve`, {
      method: "PUT",
    }),

  // Queue Stats
  getQueueStats: (params?: { department_id?: string }) =>
    request<QueueStatsResponse[]>(
      `/front-office/queue-stats${params?.department_id ? `?department_id=${params.department_id}` : ""}`,
    ),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Front Office (extended)
  // ══════════════════════════════════════════════════════════

  visitorAnalytics: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<VisitorAnalytics>(`/front-office/analytics${qs ? `?${qs}` : ""}`);
  },

  queueMetrics: () => request<QueueMetrics[]>("/front-office/queue/metrics"),
};
