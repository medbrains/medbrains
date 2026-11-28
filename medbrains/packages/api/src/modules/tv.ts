/** The `/tv` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  BedAvailabilityDisplay,
  BillingQueueDisplay,
  BroadcastAnnouncementRequest,
  CreateQueueTokenRequest,
  CreateQueueTokenResponse,
  CreateTvDisplayRequest,
  DepartmentQueueState,
  ErQueueDisplay,
  LabQueueDisplay,
  ListQueueTokensQuery,
  PharmacyQueueDisplay,
  QueueAnalytics,
  QueueMetricsRealtime,
  QueueToken,
  RadiologyQueueDisplay,
  TvAnnouncement,
  TvDisplay,
  UpdateTvDisplayRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const tvApi = {
  // ══════════════════════════════════════════════════════════════════════════════
  // TV Displays & Queue
  // ══════════════════════════════════════════════════════════════════════════════

  listTvDisplays: () => request<TvDisplay[]>("/tv/displays"),

  createTvDisplay: (data: CreateTvDisplayRequest) =>
    request<TvDisplay>("/tv/displays", { method: "POST", body: JSON.stringify(data) }),

  getTvDisplay: (id: string) => request<TvDisplay>(`/tv/displays/${id}`),

  updateTvDisplay: (id: string, data: UpdateTvDisplayRequest) =>
    request<TvDisplay>(`/tv/displays/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteTvDisplay: (id: string) => request<void>(`/tv/displays/${id}`, { method: "DELETE" }),

  listQueueTokens: (params?: ListQueueTokensQuery) => {
    const sp = new URLSearchParams();
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.date) sp.set("date", params.date);
    const qs = sp.toString();
    return request<QueueToken[]>(`/tv/tokens${qs ? `?${qs}` : ""}`);
  },

  createQueueToken: (data: CreateQueueTokenRequest) =>
    request<CreateQueueTokenResponse>("/tv/tokens", { method: "POST", body: JSON.stringify(data) }),

  callQueueToken: (id: string) => request<QueueToken>(`/tv/tokens/${id}/call`, { method: "POST" }),

  completeQueueToken: (id: string) =>
    request<QueueToken>(`/tv/tokens/${id}/complete`, { method: "POST" }),

  noShowQueueToken: (id: string) =>
    request<QueueToken>(`/tv/tokens/${id}/no-show`, { method: "POST" }),

  getQueueState: (departmentId: string) =>
    request<DepartmentQueueState>(`/tv/queue/${departmentId}`),

  broadcastAnnouncement: (data: BroadcastAnnouncementRequest) =>
    request<TvAnnouncement>("/tv/announcements", { method: "POST", body: JSON.stringify(data) }),

  // ── Specialty Queue Displays ─────────────────────────────────────────────
  getPharmacyQueueDisplay: () => request<PharmacyQueueDisplay>("/tv/queue/pharmacy"),

  getLabQueueDisplay: () => request<LabQueueDisplay>("/tv/queue/lab"),

  getRadiologyQueueDisplay: (modality: string) =>
    request<RadiologyQueueDisplay>(`/tv/queue/radiology/${modality}`),

  getErQueueDisplay: () => request<ErQueueDisplay>("/tv/queue/er"),

  getBillingQueueDisplay: () => request<BillingQueueDisplay>("/tv/queue/billing"),

  getBedAvailabilityDisplay: (wardType: string) =>
    request<BedAvailabilityDisplay>(`/tv/queue/beds/${wardType}`),

  getQueueAnalytics: (departmentId: string) =>
    request<QueueAnalytics>(`/tv/queue/analytics/${departmentId}`),

  getQueueMetricsRealtime: (departmentId: string) =>
    request<QueueMetricsRealtime>(`/tv/queue/metrics/${departmentId}`),
};
