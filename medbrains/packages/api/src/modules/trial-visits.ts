/** The `/trial-visits` API area. Moved from `client.ts`; one module per first path segment. */
import type { TrialVisit } from "@medbrains/types";
import { request } from "../client.js";

export const trialVisitsApi = {
  updateTrialVisit: (visitId: string, data: { status: string; notes?: string }) =>
    request<TrialVisit>(`/trial-visits/${visitId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
