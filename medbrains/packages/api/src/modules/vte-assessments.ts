/** The `/vte-assessments` API area. Moved from `client.ts`; one module per first path segment. */
import type { CreateVteRequest, VteRiskAssessment } from "@medbrains/types";
import { request } from "../client.js";

export const vteAssessmentsApi = {
  createVteAssessment: (data: CreateVteRequest) =>
    request<VteRiskAssessment>("/vte-assessments", { method: "POST", body: JSON.stringify(data) }),
};
