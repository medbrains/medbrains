/** The `/home-visits` API area. Moved from `client.ts`; one module per first path segment. */
import type { HomeVisit } from "@medbrains/types";
import { request } from "../client.js";

export const homeVisitsApi = {
  billHomeVisit: (id: string) =>
    request<{ invoice_id: string }>(`/home-visits/${id}/bill`, { method: "POST" }),
  updateHomeVisit: (
    id: string,
    data: { status?: string; nurse_id?: string; visit_order?: number },
  ) => request<HomeVisit>(`/home-visits/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  documentHomeVisit: (
    id: string,
    data: { vitals?: unknown; wound_photo_url?: string; medication_compliance?: string },
  ) =>
    request<HomeVisit>(`/home-visits/${id}/document`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
