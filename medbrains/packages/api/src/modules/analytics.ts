/** The `/analytics` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AnalyticsDoctorRevenueRow,
  BedOccupancyRow,
  ClinicalIndicatorRow,
  DeptRevenueRow,
  ErVolumeRow,
  IpdCensusRow,
  LabTatRow,
  OpdFootfallRow,
  OtUtilizationRow,
  PaperlessQuery,
  PaperlessRebuilt,
  PaperlessReport,
  PharmacySalesRow,
} from "@medbrains/types";
import { request } from "../client.js";

export const analyticsApi = {
  /** The paperless meter for a range of days (default: the last 30). */
  getPaperless: (params?: PaperlessQuery) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) qs.set(k, String(v));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<PaperlessReport>(`/analytics/paperless${suffix}`);
  },
  /** Recount the paperless meter's last `days` days now. */
  refreshPaperless: (days?: number) =>
    request<PaperlessRebuilt>("/analytics/paperless/refresh", {
      method: "POST",
      body: JSON.stringify({ days }),
    }),

  // ══════════════════════════════════════════════════════════
  //  Analytics & Dashboards
  // ══════════════════════════════════════════════════════════

  getDeptRevenue: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<DeptRevenueRow[]>(`/analytics/revenue/department${qs ? `?${qs}` : ""}`);
  },

  getDoctorRevenue: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<AnalyticsDoctorRevenueRow[]>(`/analytics/revenue/doctor${qs ? `?${qs}` : ""}`);
  },

  getIpdCensus: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<IpdCensusRow[]>(`/analytics/ipd/census${qs ? `?${qs}` : ""}`);
  },

  getLabTat: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<LabTatRow[]>(`/analytics/lab/tat${qs ? `?${qs}` : ""}`);
  },

  getPharmacySales: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<PharmacySalesRow[]>(`/analytics/pharmacy/sales${qs ? `?${qs}` : ""}`);
  },

  getOtUtilization: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<OtUtilizationRow[]>(`/analytics/ot/utilization${qs ? `?${qs}` : ""}`);
  },

  getErVolume: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<ErVolumeRow[]>(`/analytics/er/volume${qs ? `?${qs}` : ""}`);
  },

  getClinicalIndicators: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<ClinicalIndicatorRow[]>(`/analytics/clinical/indicators${qs ? `?${qs}` : ""}`);
  },

  getOpdFootfall: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<OpdFootfallRow[]>(`/analytics/opd/footfall${qs ? `?${qs}` : ""}`);
  },

  getBedOccupancy: () => request<BedOccupancyRow[]>("/analytics/bed/occupancy"),

  exportAnalytics: (params: { report: string; from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    sp.set("report", params.report);
    if (params.from) sp.set("from", params.from);
    if (params.to) sp.set("to", params.to);
    return request<string>(`/analytics/export?${sp.toString()}`);
  },
};
