/** The `/dashboard` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  DashboardStatsResponse,
  WidgetDataResponse,
  WidgetViewFilter,
} from "@medbrains/types";
import { request } from "../client.js";

export const dashboardApi = {
  // ── Dashboards — User-Facing ──────────────────────────
  getDashboardStats: () => request<DashboardStatsResponse>("/dashboard/summary"),
  ssoAuthorizeUrl: (providerId: string, returnTo = "/dashboard") =>
    `/api/auth/sso/${providerId}/authorize?return_to=${encodeURIComponent(returnTo)}`,
  getWidgetData: (widgetId: string) =>
    request<WidgetDataResponse>(`/dashboard/widget-data/${widgetId}`),
  /**
   * `asOf` (YYYY-MM-DD) resolves date-based widgets for that day instead of
   * today; `filters` is what each widget's viewer narrowed it to, by id.
   */
  batchWidgetData: (
    widgetIds: string[],
    asOf?: string,
    filters?: Record<string, WidgetViewFilter>,
  ) =>
    request<WidgetDataResponse[]>("/dashboard/widget-data/batch", {
      method: "POST",
      body: JSON.stringify({ widget_ids: widgetIds, as_of: asOf, filters }),
    }),
};
