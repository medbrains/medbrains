/** The `/trial-irb` API area. Moved from `client.ts`; one module per first path segment. */
import type { TrialIrbSubmission } from "@medbrains/types";
import { request } from "../client.js";

export const trialIrbApi = {
  updateIrbSubmission: (
    id: string,
    data: { status: string; decision_date?: string; notes?: string },
  ) =>
    request<TrialIrbSubmission>(`/trial-irb/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
