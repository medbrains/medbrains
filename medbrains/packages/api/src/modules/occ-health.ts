/** The `/occ-health` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateDrugScreenRequest,
  CreateInjuryRequest,
  CreateOccHealthHazardRequest,
  CreateOccScreeningRequest,
  CreateStaffExposureRequest,
  CreateVaccinationRequest,
  EmployerViewResponse,
  OccHealthAnalytics,
  OccHealthDrugScreen,
  OccHealthExposure,
  OccHealthHazard,
  OccHealthInjuryReport,
  OccHealthScreening,
  OccHealthVaccination,
  ReturnToWorkClearanceRequest,
  UpdateDrugScreenRequest,
  UpdateInjuryRequest,
  UpdateOccScreeningRequest,
  VaccinationComplianceRow,
} from "@medbrains/types";
import { request } from "../client.js";

export const occHealthApi = {
  // ══════════════════════════════════════════════════════════
  //  Occupational Health
  // ══════════════════════════════════════════════════════════

  listOccScreenings: (params?: { employee_id?: string; screening_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.screening_type) sp.set("screening_type", params.screening_type);
    const qs = sp.toString();
    return request<OccHealthScreening[]>(`/occ-health/screenings${qs ? `?${qs}` : ""}`);
  },

  createOccScreening: (data: CreateOccScreeningRequest) =>
    request<OccHealthScreening>("/occ-health/screenings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listDueScreenings: () => request<OccHealthScreening[]>("/occ-health/screenings/due"),

  getOccScreening: (id: string) => request<OccHealthScreening>(`/occ-health/screenings/${id}`),

  updateOccScreening: (id: string, data: UpdateOccScreeningRequest) =>
    request<OccHealthScreening>(`/occ-health/screenings/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listDrugScreens: (params?: { employee_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<OccHealthDrugScreen[]>(`/occ-health/drug-screens${qs ? `?${qs}` : ""}`);
  },

  createDrugScreen: (data: CreateDrugScreenRequest) =>
    request<OccHealthDrugScreen>("/occ-health/drug-screens", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDrugScreen: (id: string, data: UpdateDrugScreenRequest) =>
    request<OccHealthDrugScreen>(`/occ-health/drug-screens/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listVaccinations: (params?: { employee_id?: string; vaccine_name?: string }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.vaccine_name) sp.set("vaccine_name", params.vaccine_name);
    const qs = sp.toString();
    return request<OccHealthVaccination[]>(`/occ-health/vaccinations${qs ? `?${qs}` : ""}`);
  },

  createVaccination: (data: CreateVaccinationRequest) =>
    request<OccHealthVaccination>("/occ-health/vaccinations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateVaccination: (id: string, data: Partial<CreateVaccinationRequest>) =>
    request<OccHealthVaccination>(`/occ-health/vaccinations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  vaccinationCompliance: () =>
    request<VaccinationComplianceRow[]>("/occ-health/vaccinations/compliance"),

  listInjuries: (params?: {
    employee_id?: string;
    rtw_status?: string;
    is_osha_recordable?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.employee_id) sp.set("employee_id", params.employee_id);
    if (params?.rtw_status) sp.set("rtw_status", params.rtw_status);
    if (params?.is_osha_recordable) sp.set("is_osha_recordable", params.is_osha_recordable);
    const qs = sp.toString();
    return request<OccHealthInjuryReport[]>(`/occ-health/injuries${qs ? `?${qs}` : ""}`);
  },

  createInjury: (data: CreateInjuryRequest) =>
    request<OccHealthInjuryReport>("/occ-health/injuries", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateInjury: (id: string, data: UpdateInjuryRequest) =>
    request<OccHealthInjuryReport>(`/occ-health/injuries/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getEmployerView: (id: string) =>
    request<EmployerViewResponse>(`/occ-health/injuries/${id}/employer-view`),

  listExposures: () => request<OccHealthExposure[]>("/occ-health/exposures"),
  createExposure: (data: CreateStaffExposureRequest) =>
    request<OccHealthExposure>("/occ-health/exposures", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Occupational Health (extended)
  // ══════════════════════════════════════════════════════════

  listOccHealthHazards: () => request<OccHealthHazard[]>("/occ-health/hazards"),

  createOccHealthHazard: (data: CreateOccHealthHazardRequest) =>
    request<OccHealthHazard>("/occ-health/hazards", { method: "POST", body: JSON.stringify(data) }),

  occHealthAnalytics: () => request<OccHealthAnalytics>("/occ-health/analytics"),

  returnToWorkClearance: (data: ReturnToWorkClearanceRequest) =>
    request<OccHealthScreening>("/occ-health/clearance", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
