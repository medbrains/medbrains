/** The `/bme` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  BmeBreakdown,
  BmeCalibration,
  BmeContract,
  BmeEquipment,
  BmeMtbfRow,
  BmePmSchedule,
  BmeStatsResponse,
  BmeUptimeRow,
  BmeVendorEvaluation,
  BmeWorkOrder,
  CreateBmeBreakdownRequest,
  CreateBmeCalibrationRequest,
  CreateBmeContractRequest,
  CreateBmeEquipmentRequest,
  CreateBmePmScheduleRequest,
  CreateBmeVendorEvaluationRequest,
  CreateBmeWorkOrderRequest,
  UpdateBmeBreakdownStatusRequest,
  UpdateBmeCalibrationRequest,
  UpdateBmeContractRequest,
  UpdateBmeEquipmentRequest,
  UpdateBmePmScheduleRequest,
  UpdateBmeWorkOrderStatusRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const bmeApi = {
  // ═══════════════════════════════════════════════════════
  //  BME / CMMS
  // ═══════════════════════════════════════════════════════

  // Equipment
  listBmeEquipment: (params?: {
    status?: string;
    department_id?: string;
    risk_category?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.risk_category) sp.set("risk_category", params.risk_category);
    const qs = sp.toString();
    return request<BmeEquipment[]>(`/bme/equipment${qs ? `?${qs}` : ""}`);
  },
  getBmeEquipment: (id: string) => request<BmeEquipment>(`/bme/equipment/${id}`),
  createBmeEquipment: (body: CreateBmeEquipmentRequest) =>
    request<BmeEquipment>("/bme/equipment", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBmeEquipment: (id: string, body: UpdateBmeEquipmentRequest) =>
    request<BmeEquipment>(`/bme/equipment/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // PM Schedules
  listBmePmSchedules: (params?: { equipment_id?: string; is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<BmePmSchedule[]>(`/bme/pm-schedules${qs ? `?${qs}` : ""}`);
  },
  createBmePmSchedule: (body: CreateBmePmScheduleRequest) =>
    request<BmePmSchedule>("/bme/pm-schedules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBmePmSchedule: (id: string, body: UpdateBmePmScheduleRequest) =>
    request<BmePmSchedule>(`/bme/pm-schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Work Orders
  listBmeWorkOrders: (params?: { equipment_id?: string; status?: string; order_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.order_type) sp.set("order_type", params.order_type);
    const qs = sp.toString();
    return request<BmeWorkOrder[]>(`/bme/work-orders${qs ? `?${qs}` : ""}`);
  },

  getBmeWorkOrder: (id: string) => request<BmeWorkOrder>(`/bme/work-orders/${id}`),
  createBmeWorkOrder: (body: CreateBmeWorkOrderRequest) =>
    request<BmeWorkOrder>("/bme/work-orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBmeWorkOrderStatus: (id: string, body: UpdateBmeWorkOrderStatusRequest) =>
    request<BmeWorkOrder>(`/bme/work-orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Calibrations
  listBmeCalibrations: (params?: { equipment_id?: string; calibration_status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.calibration_status) sp.set("calibration_status", params.calibration_status);
    const qs = sp.toString();
    return request<BmeCalibration[]>(`/bme/calibrations${qs ? `?${qs}` : ""}`);
  },
  createBmeCalibration: (body: CreateBmeCalibrationRequest) =>
    request<BmeCalibration>("/bme/calibrations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBmeCalibration: (id: string, body: UpdateBmeCalibrationRequest) =>
    request<BmeCalibration>(`/bme/calibrations/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Contracts
  listBmeContracts: (params?: {
    equipment_id?: string;
    contract_type?: string;
    is_active?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.contract_type) sp.set("contract_type", params.contract_type);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<BmeContract[]>(`/bme/contracts${qs ? `?${qs}` : ""}`);
  },
  createBmeContract: (body: CreateBmeContractRequest) =>
    request<BmeContract>("/bme/contracts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBmeContract: (id: string, body: UpdateBmeContractRequest) =>
    request<BmeContract>(`/bme/contracts/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Breakdowns
  listBmeBreakdowns: (params?: { equipment_id?: string; status?: string; priority?: string }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set("equipment_id", params.equipment_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    const qs = sp.toString();
    return request<BmeBreakdown[]>(`/bme/breakdowns${qs ? `?${qs}` : ""}`);
  },
  createBmeBreakdown: (body: CreateBmeBreakdownRequest) =>
    request<BmeBreakdown>("/bme/breakdowns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateBmeBreakdownStatus: (id: string, body: UpdateBmeBreakdownStatusRequest) =>
    request<BmeBreakdown>(`/bme/breakdowns/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Vendor Evaluations
  listBmeVendorEvaluations: (params?: { vendor_id?: string }) =>
    request<BmeVendorEvaluation[]>(
      `/bme/vendor-evaluations${params?.vendor_id ? `?vendor_id=${params.vendor_id}` : ""}`,
    ),
  createBmeVendorEvaluation: (body: CreateBmeVendorEvaluationRequest) =>
    request<BmeVendorEvaluation>("/bme/vendor-evaluations", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Stats
  getBmeStats: () => request<BmeStatsResponse>("/bme/stats"),
  getBmeMtbfAnalytics: () => request<BmeMtbfRow[]>("/bme/analytics/mtbf"),
  getBmeUptimeAnalytics: () => request<BmeUptimeRow[]>("/bme/analytics/uptime"),
};
