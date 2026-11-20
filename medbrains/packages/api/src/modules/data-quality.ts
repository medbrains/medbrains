/** The `/data-quality` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateDataQualityRuleRequest,
  DataQualityDashboard,
  DataQualityIssue,
  DataQualityQuery,
  DataQualityRule,
  ResolveIssueRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const dataQualityApi = {
  // ══════════════════════════════════════════════════════════════
  // IT SECURITY: DATA QUALITY
  // ══════════════════════════════════════════════════════════════

  listDataQualityRules: () => request<DataQualityRule[]>("/data-quality/rules"),

  createDataQualityRule: (data: CreateDataQualityRuleRequest) =>
    request<DataQualityRule>("/data-quality/rules", { method: "POST", body: JSON.stringify(data) }),

  listDataQualityIssues: (params?: DataQualityQuery) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    if (params?.entity_type) sp.set("entity_type", params.entity_type);
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.is_resolved !== undefined) sp.set("is_resolved", String(params.is_resolved));
    if (params?.page) sp.set("page", String(params.page));
    if (params?.per_page) sp.set("per_page", String(params.per_page));
    const qs = sp.toString();
    return request<DataQualityIssue[]>(`/data-quality/issues${qs ? `?${qs}` : ""}`);
  },

  resolveDataQualityIssue: (id: string, data: ResolveIssueRequest) =>
    request<DataQualityIssue>(`/data-quality/issues/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getDataQualityDashboard: () => request<DataQualityDashboard>("/data-quality/dashboard"),
};
