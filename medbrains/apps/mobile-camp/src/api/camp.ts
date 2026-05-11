import type {
  Camp,
  CampPacketResponse,
  CampSyncInboundRequest,
  CampSyncInboundResponse,
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
