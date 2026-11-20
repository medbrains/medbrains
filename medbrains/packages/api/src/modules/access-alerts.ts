/** The `/access-alerts` API area. Moved from `client.ts`; one module per first path segment. */
import type { AccessAlert, AcknowledgeAlertRequest } from "@medbrains/types";
import { request } from "../client.js";

export const accessAlertsApi = {
  listAccessAlerts: () => request<AccessAlert[]>("/access-alerts"),

  acknowledgeAccessAlert: (id: string, data: AcknowledgeAlertRequest) =>
    request<AccessAlert>(`/access-alerts/${id}/acknowledge`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
