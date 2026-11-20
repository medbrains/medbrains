/** The `/compliance-requirements` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ComplianceRequirement,
  UpdateComplianceRequest as UpdateCertInComplianceRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const complianceRequirementsApi = {
  listComplianceRequirements: () => request<ComplianceRequirement[]>("/compliance-requirements"),

  updateComplianceRequirement: (id: string, data: UpdateCertInComplianceRequest) =>
    request<ComplianceRequirement>(`/compliance-requirements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
