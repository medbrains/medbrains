/** The `/stations` API area. Moved from `client.ts`; one module per first path segment. */
import type { Station } from "@medbrains/types";
import { request } from "../client.js";

export const stationsApi = {
  listStations: () => request<Station[]>("/stations"),
  createStation: (data: {
    department_id?: string | null;
    // The room the counter sits in. Null is meaningful: a camp counter has no
    // room, and guessing one would put a patient in a building that is shut.
    location_id?: string | null;
    code: string;
    name: string;
    station_type?: string;
    location_scope?: Record<string, unknown>;
  }) => request<Station>("/stations", { method: "POST", body: JSON.stringify(data) }),
  updateStation: (
    id: string,
    data: {
      department_id?: string | null;
      location_id?: string | null;
      name?: string;
      station_type?: string;
      location_scope?: Record<string, unknown>;
      is_active?: boolean;
    },
  ) => request<Station>(`/stations/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteStation: (id: string) =>
    request<{ deleted: boolean }>(`/stations/${id}`, { method: "DELETE" }),
};
