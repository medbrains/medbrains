/** The `/dashboards` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  DashboardSummary,
  DashboardWithWidgets,
  PersonalizeDashboardRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const dashboardsApi = {
  listDashboards: () => request<DashboardSummary[]>("/dashboards"),
  getMyDashboard: () => request<DashboardWithWidgets>("/dashboards/my"),
  getDashboard: (id: string) => request<DashboardWithWidgets>(`/dashboards/${id}`),
  personalizeDashboard: (data: PersonalizeDashboardRequest) =>
    request<DashboardWithWidgets>("/dashboards/my/personalize", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Show or hide a report's chart on my own dashboard. */
  setMyReportWidget: (reportId: string, visible: boolean) =>
    request<{ report_id: string; visible: boolean }>(
      `/dashboards/my/report-widgets/${encodeURIComponent(reportId)}`,
      { method: "PUT", body: JSON.stringify({ visible }) },
    ),
  /** Show or hide a catalogue widget on my own dashboard, by its code. */
  setMyWidget: (code: string, visible: boolean) =>
    request<{ code: string; visible: boolean }>(
      `/dashboards/my/widgets/${encodeURIComponent(code)}`,
      { method: "PUT", body: JSON.stringify({ visible }) },
    ),
};
