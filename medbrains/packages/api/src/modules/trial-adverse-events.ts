/** The `/trial-adverse-events` API area. Moved from `client.ts`; one module per first path segment. */
import type { TrialAdverseEvent } from "@medbrains/types";
import { request } from "../client.js";

export const trialAdverseEventsApi = {
  updateAdverseEvent: (
    aeId: string,
    data: { outcome?: string; relatedness?: string; description?: string },
  ) =>
    request<TrialAdverseEvent>(`/trial-adverse-events/${aeId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
