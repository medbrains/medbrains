/** The `/vulnerabilities` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateVulnerabilityRequest,
  UpdateVulnerabilityRequest,
  Vulnerability,
  VulnerabilityQuery,
} from "@medbrains/types";
import { request } from "../client.js";

export const vulnerabilitiesApi = {
  listVulnerabilities: (params?: VulnerabilityQuery) => {
    const qs = new URLSearchParams();
    if (params?.severity) qs.set("severity", params.severity);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<Vulnerability[]>(`/vulnerabilities${suffix}`);
  },

  createVulnerability: (data: CreateVulnerabilityRequest) =>
    request<Vulnerability>("/vulnerabilities", { method: "POST", body: JSON.stringify(data) }),

  updateVulnerability: (id: string, data: UpdateVulnerabilityRequest) =>
    request<Vulnerability>(`/vulnerabilities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
