/** The `/tat` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CompleteTatRecordRequest,
  CreateTatBenchmarkRequest,
  CreateTatRecordRequest,
  TatBenchmark,
  TatDashboard,
  TatQuery,
  TatRecord,
  TatRecordSummary,
} from "@medbrains/types";
import { request } from "../client.js";

export const tatApi = {
  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: TAT TRACKING
  // ══════════════════════════════════════════════════════════════

  listTatBenchmarks: () => request<TatBenchmark[]>("/tat/benchmarks"),

  createTatBenchmark: (data: CreateTatBenchmarkRequest) =>
    request<TatBenchmark>("/tat/benchmarks", { method: "POST", body: JSON.stringify(data) }),

  listTatRecords: (params?: TatQuery) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.status) sp.set("status", params.status);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<TatRecordSummary[]>(`/tat/records${qs ? `?${qs}` : ""}`);
  },

  startTatRecord: (data: CreateTatRecordRequest) =>
    request<TatRecord>("/tat/records", { method: "POST", body: JSON.stringify(data) }),

  completeTatRecord: (id: string, data: CompleteTatRecordRequest) =>
    request<TatRecord>(`/tat/records/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getTatDashboard: () => request<TatDashboard>("/tat/dashboard"),
};
