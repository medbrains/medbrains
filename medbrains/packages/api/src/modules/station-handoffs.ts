/** The `/station-handoffs` API area. Moved from `client.ts`; one module per first path segment. */
import type { CreateStationHandoffInput, StationHandoff } from "@medbrains/types";
import { request } from "../client.js";

export const stationHandoffsApi = {
  // Station handoffs (generic location-based, open-pickup)
  listStationHandoffs: (params: {
    module: string;
    station_type: string;
    station_key: string;
    status?: string;
  }) => {
    const qs = new URLSearchParams({
      module: params.module,
      station_type: params.station_type,
      station_key: params.station_key,
    });
    if (params.status) qs.set("status", params.status);
    return request<StationHandoff[]>(`/station-handoffs?${qs.toString()}`);
  },
  createStationHandoff: (data: CreateStationHandoffInput) =>
    request<StationHandoff>("/station-handoffs", { method: "POST", body: JSON.stringify(data) }),
  acknowledgeStationHandoff: (id: string) =>
    request<StationHandoff>(`/station-handoffs/${id}/acknowledge`, { method: "PUT" }),
};
