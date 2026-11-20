/** The `/facilities` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateFmsEnergyReadingRequest,
  CreateFmsFireDrillRequest,
  CreateFmsFireEquipmentRequest,
  CreateFmsFireInspectionRequest,
  CreateFmsFireNocRequest,
  CreateFmsGasComplianceRequest,
  CreateFmsGasReadingRequest,
  CreateFmsWaterScheduleRequest,
  CreateFmsWaterTestRequest,
  CreateFmsWorkOrderRequest,
  EnergyAnalytics,
  FmsEnergyReading,
  FmsFireDrill,
  FmsFireEquipment,
  FmsFireInspection,
  FmsFireNoc,
  FmsGasCompliance,
  FmsGasReading,
  FmsStatsResponse,
  FmsWaterSchedule,
  FmsWaterTest,
  FmsWorkOrder,
  SchedulePmRequest,
  UpdateFmsFireEquipmentRequest,
  UpdateFmsFireNocRequest,
  UpdateFmsGasComplianceRequest,
  UpdateFmsWaterScheduleRequest,
  UpdateFmsWorkOrderStatusRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const facilitiesApi = {
  // ── Facilities Management ─────────────────────────────────

  // Gas Readings
  listFmsGasReadings: (params?: {
    gas_type?: string;
    source_type?: string;
    location_id?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.gas_type) sp.set("gas_type", params.gas_type);
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.location_id) sp.set("location_id", params.location_id);
    const qs = sp.toString();
    return request<FmsGasReading[]>(`/facilities/gas-readings${qs ? `?${qs}` : ""}`);
  },
  createFmsGasReading: (body: CreateFmsGasReadingRequest) =>
    request<FmsGasReading>("/facilities/gas-readings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Gas Compliance
  listFmsGasCompliance: () => request<FmsGasCompliance[]>("/facilities/gas-compliance"),
  createFmsGasCompliance: (body: CreateFmsGasComplianceRequest) =>
    request<FmsGasCompliance>("/facilities/gas-compliance", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateFmsGasCompliance: (id: string, body: UpdateFmsGasComplianceRequest) =>
    request<FmsGasCompliance>(`/facilities/gas-compliance/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Fire Equipment
  listFmsFireEquipment: (params?: {
    equipment_type?: string;
    location_id?: string;
    is_active?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_type) sp.set("equipment_type", params.equipment_type);
    if (params?.location_id) sp.set("location_id", params.location_id);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<FmsFireEquipment[]>(`/facilities/fire-equipment${qs ? `?${qs}` : ""}`);
  },
  createFmsFireEquipment: (body: CreateFmsFireEquipmentRequest) =>
    request<FmsFireEquipment>("/facilities/fire-equipment", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateFmsFireEquipment: (id: string, body: UpdateFmsFireEquipmentRequest) =>
    request<FmsFireEquipment>(`/facilities/fire-equipment/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Fire Inspections
  listFmsFireInspections: (params?: { equipment_id?: string }) =>
    request<FmsFireInspection[]>(
      `/facilities/fire-inspections${params?.equipment_id ? `?equipment_id=${params.equipment_id}` : ""}`,
    ),
  createFmsFireInspection: (body: CreateFmsFireInspectionRequest) =>
    request<FmsFireInspection>("/facilities/fire-inspections", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Fire Drills
  listFmsFireDrills: () => request<FmsFireDrill[]>("/facilities/fire-drills"),
  createFmsFireDrill: (body: CreateFmsFireDrillRequest) =>
    request<FmsFireDrill>("/facilities/fire-drills", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Fire NOC
  listFmsFireNoc: () => request<FmsFireNoc[]>("/facilities/fire-noc"),
  createFmsFireNoc: (body: CreateFmsFireNocRequest) =>
    request<FmsFireNoc>("/facilities/fire-noc", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateFmsFireNoc: (id: string, body: UpdateFmsFireNocRequest) =>
    request<FmsFireNoc>(`/facilities/fire-noc/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Water Tests
  listFmsWaterTests: (params?: { source_type?: string; test_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.test_type) sp.set("test_type", params.test_type);
    const qs = sp.toString();
    return request<FmsWaterTest[]>(`/facilities/water-tests${qs ? `?${qs}` : ""}`);
  },
  createFmsWaterTest: (body: CreateFmsWaterTestRequest) =>
    request<FmsWaterTest>("/facilities/water-tests", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Water Schedules
  listFmsWaterSchedules: () => request<FmsWaterSchedule[]>("/facilities/water-schedules"),
  createFmsWaterSchedule: (body: CreateFmsWaterScheduleRequest) =>
    request<FmsWaterSchedule>("/facilities/water-schedules", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateFmsWaterSchedule: (id: string, body: UpdateFmsWaterScheduleRequest) =>
    request<FmsWaterSchedule>(`/facilities/water-schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Energy Readings
  listFmsEnergyReadings: (params?: { source_type?: string; location_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.source_type) sp.set("source_type", params.source_type);
    if (params?.location_id) sp.set("location_id", params.location_id);
    const qs = sp.toString();
    return request<FmsEnergyReading[]>(`/facilities/energy-readings${qs ? `?${qs}` : ""}`);
  },
  createFmsEnergyReading: (body: CreateFmsEnergyReadingRequest) =>
    request<FmsEnergyReading>("/facilities/energy-readings", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Work Orders
  listFmsWorkOrders: (params?: {
    status?: string;
    priority?: string;
    department_id?: string;
    category?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    if (params?.department_id) sp.set("department_id", params.department_id);
    if (params?.category) sp.set("category", params.category);
    const qs = sp.toString();
    return request<FmsWorkOrder[]>(`/facilities/work-orders${qs ? `?${qs}` : ""}`);
  },
  getFmsWorkOrder: (id: string) => request<FmsWorkOrder>(`/facilities/work-orders/${id}`),
  createFmsWorkOrder: (body: CreateFmsWorkOrderRequest) =>
    request<FmsWorkOrder>("/facilities/work-orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateFmsWorkOrderStatus: (id: string, body: UpdateFmsWorkOrderStatusRequest) =>
    request<FmsWorkOrder>(`/facilities/work-orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Stats
  getFmsStats: () => request<FmsStatsResponse>("/facilities/stats"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Facilities (extended)
  // ══════════════════════════════════════════════════════════

  schedulePm: (data: SchedulePmRequest) =>
    request<{ created: number }>("/facilities/pm/schedule", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  energyAnalytics: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<EnergyAnalytics>(`/facilities/energy/analytics${qs ? `?${qs}` : ""}`);
  },
};
