/** The `/retrospective` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ApproveRejectRequest,
  CreateRetroEncounterRequest,
  RetrospectiveEntry,
  RetrospectiveSettings,
} from "@medbrains/types";
import { request } from "../client.js";

export const retrospectiveApi = {
  // ══════════════════════════════════════════════════════════
  //  Retrospective Data Entry
  // ══════════════════════════════════════════════════════════

  getRetroSettings: () => request<RetrospectiveSettings>("/retrospective/settings"),

  updateRetroSettings: (data: Partial<RetrospectiveSettings>) =>
    request<{ updated: boolean }>("/retrospective/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createRetroEncounter: (data: CreateRetroEncounterRequest) =>
    request<{ encounter_id: string; retrospective_entry_id: string; status: string }>(
      "/retrospective/encounters",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  listRetroEntries: (params?: { status?: string; source_table?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.source_table) sp.set("source_table", params.source_table);
    const qs = sp.toString();
    return request<RetrospectiveEntry[]>(`/retrospective/entries${qs ? `?${qs}` : ""}`);
  },

  getRetroEntry: (id: string) => request<RetrospectiveEntry>(`/retrospective/entries/${id}`),

  approveRetroEntry: (id: string, data?: ApproveRejectRequest) =>
    request<{ approved: boolean }>(`/retrospective/entries/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify(data ?? {}),
    }),

  rejectRetroEntry: (id: string, data?: ApproveRejectRequest) =>
    request<{ rejected: boolean }>(`/retrospective/entries/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify(data ?? {}),
    }),

  retroAuditTrail: (sourceTable: string, sourceId: string) =>
    request<RetrospectiveEntry[]>(`/retrospective/audit/${sourceTable}/${sourceId}`),
};
