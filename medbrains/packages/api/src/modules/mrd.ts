/** The `/mrd` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateMrdBirthRequest,
  CreateMrdDeathRequest,
  CreateMrdRecordRequest,
  CreateMrdRetentionPolicyRequest,
  CreateMrdStorageLocationRequest,
  CrsEvent,
  CrsForm,
  FileMrdCaseSheetPacketRequest,
  IssueMrdRecordRequest,
  ListMrdCaseSheetPacketsParams,
  MrdAdmissionDischargeSummary,
  MrdBackscanItem,
  MrdBirthRegister,
  MrdCaseSheetCompletenessResponse,
  MrdCaseSheetPacket,
  MrdCaseSheetPage,
  MrdDeathRegister,
  MrdDeliveryTimeRow,
  MrdDigitalSummary,
  MrdFileRequest,
  MrdFileScanRequest,
  MrdMedicalRecord,
  MrdMorbidityMortalityResponse,
  MrdPullListBuilt,
  MrdRecordMovement,
  MrdRetentionPolicy,
  MrdStorageLocation,
  MrdVisitFileStatus,
  PrintMrdCaseSheetPacketRequest,
  RecordCrsRegistrationRequest,
  UpdateMrdPageStatusInput,
  UpdateMrdRecordRequest,
  UpdateMrdRetentionPolicyRequest,
  UpdateMrdStorageLocationRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const mrdApi = {
  // ── MRD (Medical Records Department) ────────────────────

  // Medical Records
  listMrdRecords: (params?: { status?: string; patient_id?: string; record_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.record_type) sp.set("record_type", params.record_type);
    const qs = sp.toString();
    return request<MrdMedicalRecord[]>(`/mrd/records${qs ? `?${qs}` : ""}`);
  },
  createMrdRecord: (body: CreateMrdRecordRequest) =>
    request<MrdMedicalRecord>("/mrd/records", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMrdRecord: (id: string) => request<MrdMedicalRecord>(`/mrd/records/${id}`),
  updateMrdRecord: (id: string, body: UpdateMrdRecordRequest) =>
    request<MrdMedicalRecord>(`/mrd/records/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // File requests: the paper file a patient waits for
  listMrdFileRequests: (params?: { date?: string }) =>
    request<MrdFileRequest[]>(
      `/mrd/file-requests${params?.date ? `?date=${encodeURIComponent(params.date)}` : ""}`,
    ),
  scanMrdFileRequest: (id: string, body: MrdFileScanRequest) =>
    request<MrdFileRequest>(`/mrd/file-requests/${id}/scan`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  markMrdFileNotFound: (id: string) =>
    request<MrdFileRequest>(`/mrd/file-requests/${id}/not-found`, { method: "POST" }),
  returnMrdFileToShelf: (id: string) =>
    request<MrdFileRequest>(`/mrd/file-requests/${id}/return`, { method: "POST" }),
  buildMrdPullList: (body: { date?: string }) =>
    request<MrdPullListBuilt>("/mrd/file-requests/pull-list", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listMrdBackscanOrder: (days?: number) =>
    request<MrdBackscanItem[]>(`/mrd/file-requests/backscan${days ? `?days=${days}` : ""}`),
  getMrdFileDeliveryTimes: (from: string, to: string) =>
    request<MrdDeliveryTimeRow[]>(
      `/mrd/file-requests/delivery-times?${new URLSearchParams({ from, to })}`,
    ),
  getVisitFileStatus: (encounterId: string) =>
    request<MrdVisitFileStatus>(`/mrd/file-requests/by-encounter/${encounterId}`),
  requestVisitFile: (encounterId: string) =>
    request<MrdVisitFileStatus>(`/mrd/file-requests/by-encounter/${encounterId}/request`, {
      method: "POST",
    }),
  getVisitDigitalSummary: (encounterId: string) =>
    request<MrdDigitalSummary>(`/mrd/file-requests/by-encounter/${encounterId}/summary`),

  // Record Movements
  listMrdMovements: (recordId: string) =>
    request<MrdRecordMovement[]>(`/mrd/records/${recordId}/movements`),
  issueMrdRecord: (recordId: string, body: IssueMrdRecordRequest) =>
    request<MrdRecordMovement>(`/mrd/records/${recordId}/issue`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  returnMrdRecord: (recordId: string, movementId: string) =>
    request<MrdRecordMovement>(`/mrd/records/${recordId}/movements/${movementId}/return`, {
      method: "POST",
    }),

  // Birth Register
  listMrdBirths: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<MrdBirthRegister[]>(`/mrd/births${qs ? `?${qs}` : ""}`);
  },
  createMrdBirth: (body: CreateMrdBirthRequest) =>
    request<MrdBirthRegister>("/mrd/births", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMrdBirth: (id: string) => request<MrdBirthRegister>(`/mrd/births/${id}`),

  // Death Register
  listMrdDeaths: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<MrdDeathRegister[]>(`/mrd/deaths${qs ? `?${qs}` : ""}`);
  },
  createMrdDeath: (body: CreateMrdDeathRequest) =>
    request<MrdDeathRegister>("/mrd/deaths", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMrdDeath: (id: string) => request<MrdDeathRegister>(`/mrd/deaths/${id}`),

  // Civil registration (CRS)
  listCrsEvents: (status?: string) =>
    request<CrsEvent[]>(`/mrd/crs${status ? `?status=${status}` : ""}`),
  getCrsForm: (id: string) => request<CrsForm>(`/mrd/crs/${id}/form`),
  recordCrsRegistration: (id: string, body: RecordCrsRegistrationRequest) =>
    request<CrsEvent>(`/mrd/crs/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  // Retention Policies
  listMrdRetentionPolicies: () => request<MrdRetentionPolicy[]>("/mrd/retention-policies"),
  createMrdRetentionPolicy: (body: CreateMrdRetentionPolicyRequest) =>
    request<MrdRetentionPolicy>("/mrd/retention-policies", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMrdRetentionPolicy: (id: string, body: UpdateMrdRetentionPolicyRequest) =>
    request<MrdRetentionPolicy>(`/mrd/retention-policies/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Storage Locations
  listMrdStorageLocations: () => request<MrdStorageLocation[]>("/mrd/storage-locations"),
  createMrdStorageLocation: (body: CreateMrdStorageLocationRequest) =>
    request<MrdStorageLocation>("/mrd/storage-locations", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMrdStorageLocation: (id: string, body: UpdateMrdStorageLocationRequest) =>
    request<MrdStorageLocation>(`/mrd/storage-locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // Case Sheet Packets
  listMrdCaseSheetPackets: (params?: ListMrdCaseSheetPacketsParams) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.packet_type) sp.set("packet_type", params.packet_type);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.encounter_id) sp.set("encounter_id", params.encounter_id);
    if (params?.admission_id) sp.set("admission_id", params.admission_id);
    const qs = sp.toString();
    return request<MrdCaseSheetPacket[]>(`/mrd/case-sheets${qs ? `?${qs}` : ""}`);
  },
  getMrdCaseSheetPacket: (id: string) => request<MrdCaseSheetPacket>(`/mrd/case-sheets/${id}`),
  listMrdCaseSheetPages: (packetId: string) =>
    request<MrdCaseSheetPage[]>(`/mrd/case-sheets/${packetId}/pages`),
  updateMrdCaseSheetPageStatus: (
    packetId: string,
    pageId: string,
    data: UpdateMrdPageStatusInput,
  ) =>
    request<MrdCaseSheetPage>(`/mrd/case-sheets/${packetId}/pages/${pageId}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getMrdCaseSheetCompleteness: (packetId: string) =>
    request<MrdCaseSheetCompletenessResponse>(`/mrd/case-sheets/${packetId}/completeness`),
  generateOpdCaseSheetPacket: (encounterId: string) =>
    request<MrdCaseSheetPacket>(`/mrd/case-sheets/from-opd/${encounterId}`, {
      method: "POST",
    }),
  generateIpdCaseSheetPacket: (admissionId: string) =>
    request<MrdCaseSheetPacket>(`/mrd/case-sheets/from-ipd/${admissionId}`, {
      method: "POST",
    }),
  printMrdCaseSheetPacket: (id: string, body: PrintMrdCaseSheetPacketRequest) =>
    request<MrdCaseSheetPacket>(`/mrd/case-sheets/${id}/print`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  fileMrdCaseSheetPacket: (id: string, body: FileMrdCaseSheetPacketRequest) =>
    request<MrdCaseSheetPacket>(`/mrd/case-sheets/${id}/file`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // Stats
  getMrdMorbidityMortality: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<MrdMorbidityMortalityResponse>(
      `/mrd/stats/morbidity-mortality${qs ? `?${qs}` : ""}`,
    );
  },
  getMrdAdmissionDischarge: (params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<MrdAdmissionDischargeSummary>(
      `/mrd/stats/admission-discharge${qs ? `?${qs}` : ""}`,
    );
  },
};
