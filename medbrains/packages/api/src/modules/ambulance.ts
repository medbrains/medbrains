/** The `/ambulance` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AddAmbulanceTripLogRequest,
  AmbulanceDriverRow,
  AmbulanceMaintenanceRow,
  AmbulanceRow,
  AmbulanceTripLogRow,
  AmbulanceTripRow,
  CreateAmbulanceDriverRequest,
  CreateAmbulanceMaintenanceRequest,
  CreateAmbulanceRequest,
  CreateAmbulanceTripRequest,
  UpdateAmbulanceDriverRequest,
  UpdateAmbulanceLocationRequest,
  UpdateAmbulanceMaintenanceRequest,
  UpdateAmbulanceRequest,
  UpdateAmbulanceTripRequest,
  UpdateAmbulanceTripStatusRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const ambulanceApi = {
  // ── Ambulance Fleet Management ─────────────────────────

  listAmbulances: (params?: { status?: string; ambulance_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.ambulance_type) sp.set("ambulance_type", params.ambulance_type);
    const qs = sp.toString();
    return request<AmbulanceRow[]>(`/ambulance/fleet${qs ? `?${qs}` : ""}`);
  },
  getAmbulance: (id: string) => request<AmbulanceRow>(`/ambulance/fleet/${id}`),
  createAmbulance: (data: CreateAmbulanceRequest) =>
    request<AmbulanceRow>("/ambulance/fleet", { method: "POST", body: JSON.stringify(data) }),
  updateAmbulance: (id: string, data: UpdateAmbulanceRequest) =>
    request<AmbulanceRow>(`/ambulance/fleet/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateAmbulanceLocation: (id: string, data: UpdateAmbulanceLocationRequest) =>
    request<AmbulanceRow>(`/ambulance/fleet/${id}/location`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listAmbulanceDrivers: (params?: { is_active?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<AmbulanceDriverRow[]>(`/ambulance/drivers${qs ? `?${qs}` : ""}`);
  },
  createAmbulanceDriver: (data: CreateAmbulanceDriverRequest) =>
    request<AmbulanceDriverRow>("/ambulance/drivers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAmbulanceDriver: (id: string, data: UpdateAmbulanceDriverRequest) =>
    request<AmbulanceDriverRow>(`/ambulance/drivers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listAmbulanceTrips: (params?: {
    status?: string;
    trip_type?: string;
    ambulance_id?: string;
    priority?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.trip_type) sp.set("trip_type", params.trip_type);
    if (params?.ambulance_id) sp.set("ambulance_id", params.ambulance_id);
    if (params?.priority) sp.set("priority", params.priority);
    const qs = sp.toString();
    return request<AmbulanceTripRow[]>(`/ambulance/trips${qs ? `?${qs}` : ""}`);
  },
  getAmbulanceTrip: (id: string) => request<AmbulanceTripRow>(`/ambulance/trips/${id}`),
  createAmbulanceTrip: (data: CreateAmbulanceTripRequest) =>
    request<AmbulanceTripRow>("/ambulance/trips", { method: "POST", body: JSON.stringify(data) }),
  updateAmbulanceTrip: (id: string, data: UpdateAmbulanceTripRequest) =>
    request<AmbulanceTripRow>(`/ambulance/trips/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updateAmbulanceTripStatus: (id: string, data: UpdateAmbulanceTripStatusRequest) =>
    request<AmbulanceTripRow>(`/ambulance/trips/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listAmbulanceTripLogs: (tripId: string) =>
    request<AmbulanceTripLogRow[]>(`/ambulance/trips/${tripId}/logs`),
  addAmbulanceTripLog: (tripId: string, data: AddAmbulanceTripLogRequest) =>
    request<AmbulanceTripLogRow>(`/ambulance/trips/${tripId}/logs`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAmbulanceMaintenance: (params?: { ambulance_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.ambulance_id) sp.set("ambulance_id", params.ambulance_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<AmbulanceMaintenanceRow[]>(`/ambulance/maintenance${qs ? `?${qs}` : ""}`);
  },
  createAmbulanceMaintenance: (data: CreateAmbulanceMaintenanceRequest) =>
    request<AmbulanceMaintenanceRow>("/ambulance/maintenance", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAmbulanceMaintenance: (id: string, data: UpdateAmbulanceMaintenanceRequest) =>
    request<AmbulanceMaintenanceRow>(`/ambulance/maintenance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
