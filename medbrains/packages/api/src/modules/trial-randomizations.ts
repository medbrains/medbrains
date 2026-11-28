/** The `/trial-randomizations` API area. Moved from `client.ts`; one module per first path segment. */
import type { TrialRandomization } from "@medbrains/types";
import { request } from "../client.js";

export const trialRandomizationsApi = {
  unblindRandomization: (id: string, data: { reason: string }) =>
    request<TrialRandomization>(`/trial-randomizations/${id}/unblind`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
