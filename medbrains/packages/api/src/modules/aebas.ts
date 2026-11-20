/** The `/aebas` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AebasImportResponse,
  AebasPeriodImportRequest,
  AebasStatusResponse,
} from "@medbrains/types";
import { request } from "../client.js";

export const aebasApi = {
  getAebasStatus: () => request<AebasStatusResponse>("/aebas/status"),
  importAebasPeriodSummary: (data: AebasPeriodImportRequest) =>
    request<AebasImportResponse>("/aebas/period-summary", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
