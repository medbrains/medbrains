/** The `/housekeeping` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  BmwScheduleEntry,
  CleaningSchedule,
  CleaningTask,
  CreateCleaningScheduleRequest,
  CreateCleaningTaskRequest,
  CreateLaundryBatchRequest,
  CreateLinenCondemnationRequest,
  CreateLinenItemRequest,
  CreateLinenMovementRequest,
  CreatePestControlLogRequest,
  CreatePestControlScheduleRequest,
  CreateTurnaroundRequest,
  LaundryBatch,
  LinenCondemnation,
  LinenItem,
  LinenMovement,
  LinenParLevel,
  PestControlLog,
  PestControlSchedule,
  RoomTurnaround,
  SharpReplacementRequest,
  UpdateCleaningScheduleRequest,
  UpdateLinenItemRequest,
  UpdatePestControlScheduleRequest,
  UpdateTaskStatusRequest,
  UpsertParLevelRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const housekeepingApi = {
  // ── Housekeeping ────────────────────────────────────────

  // Cleaning Schedules
  listCleaningSchedules: (areaType?: string) =>
    request<CleaningSchedule[]>(
      `/housekeeping/schedules${areaType ? `?area_type=${areaType}` : ""}`,
    ),

  createCleaningSchedule: (data: CreateCleaningScheduleRequest) =>
    request<CleaningSchedule>("/housekeeping/schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCleaningSchedule: (id: string, data: UpdateCleaningScheduleRequest) =>
    request<CleaningSchedule>(`/housekeeping/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Cleaning Tasks
  listCleaningTasks: (params?: { date?: string; status?: string; area_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set("date", params.date);
    if (params?.status) qs.set("status", params.status);
    if (params?.area_type) qs.set("area_type", params.area_type);
    const q = qs.toString();
    return request<CleaningTask[]>(`/housekeeping/tasks${q ? `?${q}` : ""}`);
  },

  createCleaningTask: (data: CreateCleaningTaskRequest) =>
    request<CleaningTask>("/housekeeping/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCleaningTaskStatus: (id: string, data: UpdateTaskStatusRequest) =>
    request<CleaningTask>(`/housekeeping/tasks/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  verifyCleaningTask: (id: string) =>
    request<CleaningTask>(`/housekeeping/tasks/${id}/verify`, {
      method: "PUT",
    }),

  // Room Turnarounds
  listTurnarounds: (params?: { from_date?: string; to_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from_date) qs.set("from_date", params.from_date);
    if (params?.to_date) qs.set("to_date", params.to_date);
    const q = qs.toString();
    return request<RoomTurnaround[]>(`/housekeeping/turnarounds${q ? `?${q}` : ""}`);
  },

  createTurnaround: (data: CreateTurnaroundRequest) =>
    request<RoomTurnaround>("/housekeeping/turnarounds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeTurnaround: (id: string) =>
    request<RoomTurnaround>(`/housekeeping/turnarounds/${id}/complete`, {
      method: "PUT",
    }),

  // Pest Control
  listPestControlSchedules: () => request<PestControlSchedule[]>("/housekeeping/pest-control"),

  createPestControlSchedule: (data: CreatePestControlScheduleRequest) =>
    request<PestControlSchedule>("/housekeeping/pest-control", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePestControlSchedule: (id: string, data: UpdatePestControlScheduleRequest) =>
    request<PestControlSchedule>(`/housekeeping/pest-control/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPestControlLogs: () => request<PestControlLog[]>("/housekeeping/pest-control-logs"),

  createPestControlLog: (data: CreatePestControlLogRequest) =>
    request<PestControlLog>("/housekeeping/pest-control-logs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Linen Items
  listLinenItems: (params?: { status?: string; item_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.item_type) qs.set("item_type", params.item_type);
    const q = qs.toString();
    return request<LinenItem[]>(`/housekeeping/linen${q ? `?${q}` : ""}`);
  },

  createLinenItem: (data: CreateLinenItemRequest) =>
    request<LinenItem>("/housekeeping/linen", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateLinenItem: (id: string, data: UpdateLinenItemRequest) =>
    request<LinenItem>(`/housekeeping/linen/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Linen Movements
  listLinenMovements: () => request<LinenMovement[]>("/housekeeping/linen-movements"),

  createLinenMovement: (data: CreateLinenMovementRequest) =>
    request<LinenMovement>("/housekeeping/linen-movements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Laundry Batches
  listLaundryBatches: () => request<LaundryBatch[]>("/housekeeping/laundry-batches"),

  createLaundryBatch: (data: CreateLaundryBatchRequest) =>
    request<LaundryBatch>("/housekeeping/laundry-batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeLaundryBatch: (id: string) =>
    request<LaundryBatch>(`/housekeeping/laundry-batches/${id}/complete`, {
      method: "PUT",
    }),

  // Par Levels
  listParLevels: () => request<LinenParLevel[]>("/housekeeping/par-levels"),

  upsertParLevel: (data: UpsertParLevelRequest) =>
    request<LinenParLevel>("/housekeeping/par-levels", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Linen Condemnations
  listLinenCondemnations: () => request<LinenCondemnation[]>("/housekeeping/condemnations"),

  createLinenCondemnation: (data: CreateLinenCondemnationRequest) =>
    request<LinenCondemnation>("/housekeeping/condemnations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getBmwSchedule: (params?: { ward_id?: string }) => {
    const qs = params?.ward_id ? `?ward_id=${params.ward_id}` : "";
    return request<BmwScheduleEntry[]>(`/housekeeping/bmw/schedule${qs}`);
  },
  createSharpReplacement: (data: SharpReplacementRequest) =>
    request<Record<string, unknown>>("/housekeeping/bmw/sharp-replacement", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
