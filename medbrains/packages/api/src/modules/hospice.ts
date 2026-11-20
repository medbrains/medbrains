/** The `/hospice` API area. Moved from `client.ts`; one module per first path segment. */
import type { HospiceEnrollment } from "@medbrains/types";
import { request } from "../client.js";

export const hospiceApi = {
  updateHospice: (
    id: string,
    data: { status?: string; comfort_care_plan?: string; prognosis?: string; notes?: string },
  ) => request<HospiceEnrollment>(`/hospice/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};
