/** The `/infection-control` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AntibioticConsumptionRecord,
  AntibioticStewardshipRequest,
  AntibioticTimeoutReviewBody,
  AntimicrobialConsumptionRow,
  BiowasteRecord,
  CreateBiowasteRecordRequest,
  CreateCultureSurveillanceRequest,
  CreateExposureRequest,
  CreateHygieneAuditRequest,
  CreateIcMeetingRequest,
  CreateIndwellingDeviceRequest,
  CreateNeedleStickIncidentRequest,
  CreateOutbreakContactRequest,
  CreateOutbreakRcaRequest,
  CreateOutbreakRequest,
  CreateStewardshipRequest,
  CreateSurveillanceEventRequest,
  CultureSensitivityRow,
  CultureSurveillance,
  DeviceUtilizationRow,
  HaiRateRow,
  HandHygieneAudit,
  IcMeeting,
  IndwellingDevice,
  InfectionDeviceDay,
  InfectionSurveillanceEvent,
  MdroRow,
  MonthlySurveillanceReport,
  NeedleStickIncident,
  OutbreakContact,
  OutbreakEvent,
  RecordDeviceDaysRequest,
  RemoveIndwellingDeviceRequest,
  ReviewIndwellingDeviceRequest,
  ReviewStewardshipRequest,
  SurgicalProphylaxisRow,
  UpdateOutbreakRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const infectionControlApi = {
  // ── Infection Control - Surveillance ──────────────────
  listSurveillanceEvents: (params?: { hai_type?: string; infection_status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.hai_type) qs.set("hai_type", params.hai_type);
    if (params?.infection_status) qs.set("infection_status", params.infection_status);
    const q = qs.toString();
    return request<InfectionSurveillanceEvent[]>(
      `/infection-control/surveillance${q ? `?${q}` : ""}`,
    );
  },

  createSurveillanceEvent: (data: CreateSurveillanceEventRequest) =>
    request<InfectionSurveillanceEvent>("/infection-control/surveillance", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listDeviceDays: (params?: { location_id?: string; record_date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.location_id) qs.set("location_id", params.location_id);
    if (params?.record_date) qs.set("record_date", params.record_date);
    const q = qs.toString();
    return request<InfectionDeviceDay[]>(`/infection-control/device-days${q ? `?${q}` : ""}`);
  },

  recordDeviceDays: (data: RecordDeviceDaysRequest) =>
    request<InfectionDeviceDay>("/infection-control/device-days", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listIndwellingDevices: (params?: { patient_id?: string; active?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.patient_id) qs.set("patient_id", params.patient_id);
    if (params?.active !== undefined) qs.set("active", String(params.active));
    const q = qs.toString();
    return request<IndwellingDevice[]>(`/infection-control/indwelling-devices${q ? `?${q}` : ""}`);
  },
  createIndwellingDevice: (data: CreateIndwellingDeviceRequest) =>
    request<IndwellingDevice>("/infection-control/indwelling-devices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reviewIndwellingDevice: (id: string, data: ReviewIndwellingDeviceRequest) =>
    request<IndwellingDevice>(`/infection-control/indwelling-devices/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeIndwellingDevice: (id: string, data: RemoveIndwellingDeviceRequest) =>
    request<IndwellingDevice>(`/infection-control/indwelling-devices/${id}/remove`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Infection Control - Stewardship ───────────────────
  listStewardshipRequests: (params?: { request_status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.request_status) qs.set("request_status", params.request_status);
    const q = qs.toString();
    return request<AntibioticStewardshipRequest[]>(
      `/infection-control/stewardship${q ? `?${q}` : ""}`,
    );
  },

  createStewardshipRequest: (data: CreateStewardshipRequest) =>
    request<AntibioticStewardshipRequest>("/infection-control/stewardship", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviewStewardshipRequest: (id: string, data: ReviewStewardshipRequest) =>
    request<AntibioticStewardshipRequest>(`/infection-control/stewardship/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  timeoutReviewStewardship: (id: string, data: AntibioticTimeoutReviewBody) =>
    request<AntibioticStewardshipRequest>(`/infection-control/stewardship/${id}/timeout-review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listConsumptionRecords: (params?: { department_id?: string; record_month?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.record_month) qs.set("record_month", params.record_month);
    const q = qs.toString();
    return request<AntibioticConsumptionRecord[]>(
      `/infection-control/consumption${q ? `?${q}` : ""}`,
    );
  },

  recordConsumption: (data: Record<string, unknown>) =>
    request<AntibioticConsumptionRecord>("/infection-control/consumption", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Infection Control - Biowaste ──────────────────────
  listBiowasteRecords: (params?: { department_id?: string; waste_category?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.waste_category) qs.set("waste_category", params.waste_category);
    const q = qs.toString();
    return request<BiowasteRecord[]>(`/infection-control/biowaste${q ? `?${q}` : ""}`);
  },

  createBiowasteRecord: (data: CreateBiowasteRecordRequest) =>
    request<BiowasteRecord>("/infection-control/biowaste", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listNeedleStickIncidents: (params?: { department_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    const q = qs.toString();
    return request<NeedleStickIncident[]>(`/infection-control/needle-stick${q ? `?${q}` : ""}`);
  },

  createNeedleStickIncident: (data: CreateNeedleStickIncidentRequest) =>
    request<NeedleStickIncident>("/infection-control/needle-stick", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Infection Control - Hygiene ───────────────────────
  listHygieneAudits: (params?: { department_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    const q = qs.toString();
    return request<HandHygieneAudit[]>(`/infection-control/hygiene-audits${q ? `?${q}` : ""}`);
  },

  createHygieneAudit: (data: CreateHygieneAuditRequest) =>
    request<HandHygieneAudit>("/infection-control/hygiene-audits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listCultureSurveillance: (params?: { department_id?: string; culture_type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.department_id) qs.set("department_id", params.department_id);
    if (params?.culture_type) qs.set("culture_type", params.culture_type);
    const q = qs.toString();
    return request<CultureSurveillance[]>(`/infection-control/cultures${q ? `?${q}` : ""}`);
  },

  createCultureSurveillance: (data: CreateCultureSurveillanceRequest) =>
    request<CultureSurveillance>("/infection-control/cultures", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Infection Control - Outbreaks ─────────────────────
  listOutbreaks: (params?: { outbreak_status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.outbreak_status) qs.set("outbreak_status", params.outbreak_status);
    const q = qs.toString();
    return request<OutbreakEvent[]>(`/infection-control/outbreaks${q ? `?${q}` : ""}`);
  },

  createOutbreak: (data: CreateOutbreakRequest) =>
    request<OutbreakEvent>("/infection-control/outbreaks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOutbreak: (id: string, data: UpdateOutbreakRequest) =>
    request<OutbreakEvent>(`/infection-control/outbreaks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  listOutbreakContacts: (id: string) =>
    request<OutbreakContact[]>(`/infection-control/outbreaks/${id}/contacts`),

  addOutbreakContact: (id: string, data: CreateOutbreakContactRequest) =>
    request<OutbreakContact>(`/infection-control/outbreaks/${id}/contacts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Infection Control Analytics
  // ══════════════════════════════════════════════════════════

  icHaiRates: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<HaiRateRow[]>(`/infection-control/analytics/hai-rates${qs ? `?${qs}` : ""}`);
  },

  icDeviceUtilization: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<DeviceUtilizationRow[]>(
      `/infection-control/analytics/device-utilization${qs ? `?${qs}` : ""}`,
    );
  },

  icAntimicrobialConsumption: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<AntimicrobialConsumptionRow[]>(
      `/infection-control/analytics/antimicrobial-consumption${qs ? `?${qs}` : ""}`,
    );
  },

  icSurgicalProphylaxis: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<SurgicalProphylaxisRow[]>(
      `/infection-control/analytics/surgical-prophylaxis${qs ? `?${qs}` : ""}`,
    );
  },

  icCultureSensitivityReport: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<CultureSensitivityRow[]>(
      `/infection-control/reports/culture-sensitivity${qs ? `?${qs}` : ""}`,
    );
  },

  icMdroTracking: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<MdroRow[]>(`/infection-control/analytics/mdro${qs ? `?${qs}` : ""}`);
  },

  createIcExposure: (data: CreateExposureRequest) =>
    request<InfectionSurveillanceEvent>("/infection-control/exposures", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listIcMeetings: () => request<IcMeeting[]>("/infection-control/meetings"),

  createIcMeeting: (data: CreateIcMeetingRequest) =>
    request<IcMeeting>("/infection-control/meetings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  icMonthlySurveillance: (params?: { month?: string }) => {
    const sp = new URLSearchParams();
    if (params?.month) sp.set("month", params.month);
    const qs = sp.toString();
    return request<MonthlySurveillanceReport>(
      `/infection-control/reports/monthly${qs ? `?${qs}` : ""}`,
    );
  },

  createOutbreakRca: (outbreakId: string, data: CreateOutbreakRcaRequest) =>
    request<{ success: true }>(`/infection-control/outbreaks/${outbreakId}/rca`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
