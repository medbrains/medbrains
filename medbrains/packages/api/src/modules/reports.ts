/** The `/reports` API area. Moved from `client.ts`; one module per first path segment. */
import type { ReportCatalogResponse, ReportDataResponse } from "@medbrains/types";
import { request } from "../client.js";

export const reportsApi = {
  getReportCatalog: () => request<ReportCatalogResponse>("/reports/catalog"),

  getReportData: <T = unknown>(reportId: string, params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<ReportDataResponse<T>>(
      `/reports/${encodeURIComponent(reportId)}/data${qs ? `?${qs}` : ""}`,
    );
  },
};
