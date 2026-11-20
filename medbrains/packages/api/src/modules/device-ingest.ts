/** The `/device-ingest` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const deviceIngestApi = {
  ingestDevicePayload: (deviceId: string, data: Record<string, unknown>) =>
    request<unknown>(`/device-ingest/${deviceId}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
