/** The `/app` API area. Moved from `client.ts`; one module per first path segment. */
import type { AppManifest } from "@medbrains/types";
import { request } from "../client.js";

export const appApi = {
  getAppManifest: (params?: { device_id?: string; variant?: string }) => {
    const qs = new URLSearchParams();
    if (params?.device_id) qs.set("device_id", params.device_id);
    if (params?.variant) qs.set("variant", params.variant);
    const q = qs.toString();
    return request<AppManifest>(`/app/manifest${q ? `?${q}` : ""}`);
  },
};
