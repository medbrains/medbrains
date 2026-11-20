/** The `/uhi` API area. Moved from `client.ts`; one module per first path segment. */
import type { SaveUhiSettings, UhiRequest, UhiSettingsView } from "@medbrains/types";
import { request } from "../client.js";

export const uhiApi = {
  getUhiSettings: () => request<UhiSettingsView>("/uhi/settings"),
  saveUhiSettings: (data: SaveUhiSettings) =>
    request<UhiSettingsView>("/uhi/settings", { method: "PUT", body: JSON.stringify(data) }),
  /** A new signing key pair — generated on the server, or imported from NHA's
   * header generation utility when `privateKey` is given. */
  generateUhiKeys: (privateKey?: string) =>
    request<UhiSettingsView>("/uhi/settings/keys", {
      method: "POST",
      ...(privateKey ? { body: JSON.stringify({ private_key: privateKey }) } : {}),
    }),
  listUhiRequests: (state?: "pending") =>
    request<UhiRequest[]>(state ? `/uhi/requests?state=${state}` : "/uhi/requests"),
  acceptUhiRequest: (id: string) =>
    request<UhiRequest>(`/uhi/requests/${id}/accept`, { method: "POST" }),
  declineUhiRequest: (id: string, reason: string) =>
    request<UhiRequest>(`/uhi/requests/${id}/decline`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
