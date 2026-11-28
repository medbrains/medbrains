/** The `/orchestration` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ConnectorHealthCheckResponse,
  ConnectorRow,
  CreateConnectorRequest,
  EventListResponse,
  JobListResponse,
  JobStats,
  UpdateConnectorRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const orchestrationApi = {
  // ── Orchestration Engine ────────────────────────────────
  listOrchestrationEvents: (params?: { module?: string }) => {
    const qs = params?.module ? `?module=${params.module}` : "";
    return request<EventListResponse>(`/orchestration/events${qs}`);
  },
  listConnectors: () => request<ConnectorRow[]>("/orchestration/connectors"),
  createConnector: (data: CreateConnectorRequest) =>
    request<ConnectorRow>("/orchestration/connectors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateConnector: (id: string, data: UpdateConnectorRequest) =>
    request<ConnectorRow>(`/orchestration/connectors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  testConnector: (id: string) =>
    request<ConnectorHealthCheckResponse>(`/orchestration/connectors/${id}/test`, {
      method: "POST",
    }),
  listJobs: (params?: { status?: string; page?: string; per_page?: string }) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return request<JobListResponse>(`/orchestration/jobs${qs}`);
  },
  getJobStats: () => request<JobStats>("/orchestration/jobs/stats"),
};
