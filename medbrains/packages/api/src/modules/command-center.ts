/** The `/command-center` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AlertThresholdRow,
  AssignTransportRequest,
  BedTurnaroundRow,
  BottleneckRow,
  CreateAlertThresholdRequest,
  CreateTransportRequest,
  DepartmentAlertRow,
  DepartmentLoadRow,
  HourlyFlowRow,
  KpiTile,
  PatientFlowSnapshot,
  PendingDischargeRow,
  TransportRequestRow,
  TurnaroundStatsRow,
  UpdateAlertThresholdRequest,
  UpdateTransportRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const commandCenterApi = {
  // ══════════════════════════════════════════════════════════
  //  Command Center
  // ══════════════════════════════════════════════════════════

  // Patient Flow
  getPatientFlow: () => request<PatientFlowSnapshot>("/command-center/patient-flow"),

  getHourlyFlow: () => request<HourlyFlowRow[]>("/command-center/patient-flow/hourly"),

  getBottlenecks: () => request<BottleneckRow[]>("/command-center/bottlenecks"),

  // Department Load
  getDepartmentLoad: () => request<DepartmentLoadRow[]>("/command-center/department-load"),

  getActiveAlerts: () => request<DepartmentAlertRow[]>("/command-center/alerts"),

  acknowledgeDeptAlert: (id: string) =>
    request<DepartmentAlertRow>(`/command-center/alerts/${id}/acknowledge`, { method: "POST" }),

  listAlertThresholds: () => request<AlertThresholdRow[]>("/command-center/alert-thresholds"),

  createAlertThreshold: (data: CreateAlertThresholdRequest) =>
    request<AlertThresholdRow>("/command-center/alert-thresholds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAlertThreshold: (id: string, data: UpdateAlertThresholdRequest) =>
    request<AlertThresholdRow>(`/command-center/alert-thresholds/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Discharge Coordinator
  listPendingDischarges: () => request<PendingDischargeRow[]>("/command-center/pending-discharges"),

  getDischargeBlockers: (admissionId: string) =>
    request<Record<string, unknown>>(`/command-center/discharge-blockers/${admissionId}`),

  // Environmental Services
  getBedTurnaround: () => request<BedTurnaroundRow[]>("/command-center/bed-turnaround"),

  getTurnaroundStats: () => request<TurnaroundStatsRow[]>("/command-center/bed-turnaround/stats"),

  // Transport
  listTransportRequests: () => request<TransportRequestRow[]>("/command-center/transport"),

  createTransportRequest: (data: CreateTransportRequest) =>
    request<TransportRequestRow>("/command-center/transport", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTransportRequest: (id: string, data: UpdateTransportRequest) =>
    request<TransportRequestRow>(`/command-center/transport/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  assignTransport: (id: string, data: AssignTransportRequest) =>
    request<TransportRequestRow>(`/command-center/transport/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  completeTransport: (id: string) =>
    request<TransportRequestRow>(`/command-center/transport/${id}/complete`, {
      method: "PUT",
    }),

  // KPIs
  getKpis: () => request<KpiTile[]>("/command-center/kpis"),

  getKpiDetail: (code: string) => request<Record<string, unknown>>(`/command-center/kpis/${code}`),
};
