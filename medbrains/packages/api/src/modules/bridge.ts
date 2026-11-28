/** The `/bridge` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const bridgeApi = {
  registerBridge: (data: Record<string, unknown>) =>
    request<unknown>("/bridge/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  postBridgeHeartbeat: (data: Record<string, unknown>) =>
    request<unknown>("/bridge/heartbeat", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
