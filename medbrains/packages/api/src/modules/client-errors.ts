/** The `/client-errors` API area. Moved from `client.ts`; one module per first path segment. */
import type { ClientErrorReportRequest, ClientErrorReportResponse } from "@medbrains/types";
import { request } from "../client.js";

export const clientErrorsApi = {
  reportClientError: (data: ClientErrorReportRequest) =>
    request<ClientErrorReportResponse>("/client-errors/report", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
