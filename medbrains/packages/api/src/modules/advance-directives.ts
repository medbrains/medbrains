/** The `/advance-directives` API area. Moved from `client.ts`; one module per first path segment. */
import type { AdvanceDirective } from "@medbrains/types";
import { request } from "../client.js";

export const advanceDirectivesApi = {
  revokeAdvanceDirective: (id: string, data: { reason: string }) =>
    request<AdvanceDirective>(`/advance-directives/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
