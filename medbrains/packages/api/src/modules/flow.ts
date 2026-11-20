/** The `/flow` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  FlowAlert,
  FlowConfigZone,
  FlowDecision,
  FlowFloorLive,
  FlowFloorSetup,
  FlowFloorSummary,
  FlowForecast,
  FlowHistoryPoint,
  FlowRecommendation,
  FlowSourceInput,
  FlowZoneConfigInput,
  FlowZoneDetail,
} from "@medbrains/types";
import { request } from "../client.js";

export const flowApi = {
  // ── MedBrains Flow (#4901) ──────────────────────────────────
  listFlowFloors: () => request<FlowFloorSummary[]>("/flow/floors"),
  getFlowFloorLive: (floorId: string) => request<FlowFloorLive>(`/flow/floors/${floorId}/live`),
  getFlowFloorHistory: (floorId: string) =>
    request<FlowHistoryPoint[]>(`/flow/floors/${floorId}/history`),
  getFlowFloorForecast: (floorId: string, hours = 4) =>
    request<FlowForecast>(`/flow/floors/${floorId}/forecast?hours=${hours}`),
  getFlowZone: (zoneId: string) => request<FlowZoneDetail>(`/flow/zones/${zoneId}`),
  getFlowBoard: (floorId?: string) =>
    request<FlowFloorLive>(`/flow/board${floorId ? `?floor_id=${floorId}` : ""}`),
  decideFlowRecommendation: (
    id: string,
    data: { decision: FlowDecision; snooze_minutes?: number },
  ) =>
    request<FlowRecommendation>(`/flow/recommendations/${id}/decide`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  ackFlowAlert: (id: string) => request<FlowAlert>(`/flow/alerts/${id}/ack`, { method: "POST" }),
  listFlowConfigFloors: () => request<FlowFloorSummary[]>("/flow/config/floors"),
  getFlowFloorSetup: (floorId: string) =>
    request<FlowFloorSetup>(`/flow/config/floors/${floorId}/zones`),
  updateFlowZone: (zoneId: string, data: FlowZoneConfigInput) =>
    request<FlowConfigZone>(`/flow/config/zones/${zoneId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  replaceFlowZoneSources: (zoneId: string, sources: FlowSourceInput[]) =>
    request<FlowConfigZone>(`/flow/config/zones/${zoneId}/sources`, {
      method: "PUT",
      body: JSON.stringify({ sources }),
    }),
};
