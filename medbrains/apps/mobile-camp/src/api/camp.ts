import type {
  Camp,
  CampPacketResponse,
  CampSyncInboundRequest,
  CampSyncInboundResponse,
  PatientContext,
  PatientListResponse,
} from "@medbrains/types";
import { request } from "./client.js";
import { apiConfig } from "./config.js";

export function listCamps(status?: string): Promise<Camp[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return request(apiConfig, "GET", `/api/camp/camps${qs}`);
}

export function getCampPacket(
  campId: string,
  deviceId = "mobile-camp-preview",
): Promise<CampPacketResponse> {
  const qs = `?device_id=${encodeURIComponent(deviceId)}`;
  return request(apiConfig, "GET", `/api/camp/camps/${campId}/packet${qs}`);
}

export function syncCampInbound(data: CampSyncInboundRequest): Promise<CampSyncInboundResponse> {
  return request(apiConfig, "POST", "/api/camp/sync/inbound", data);
}

export function listPatients(params?: {
  page?: number;
  per_page?: number;
  search?: string;
}): Promise<PatientListResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.per_page) qs.set("per_page", String(params.per_page));
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return request(apiConfig, "GET", `/api/patients${query ? `?${query}` : ""}`);
}

export function getPatientContext(patientId: string): Promise<PatientContext> {
  return request(apiConfig, "GET", `/api/patients/${patientId}/context`);
}
