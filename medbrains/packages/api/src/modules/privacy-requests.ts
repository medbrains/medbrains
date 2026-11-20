/** The `/privacy-requests` API area. Moved from `client.ts`; one module per first path segment. */
import type { CreatePrivacyRequest, DecidePrivacyRequest, PrivacyRequest } from "@medbrains/types";
import { request } from "../client.js";

export const privacyRequestsApi = {
  listPrivacyRequests: (params?: { status?: string; patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<PrivacyRequest[]>(`/privacy-requests${qs ? `?${qs}` : ""}`);
  },
  createPrivacyRequest: (data: CreatePrivacyRequest) =>
    request<PrivacyRequest>("/privacy-requests", { method: "POST", body: JSON.stringify(data) }),
  decidePrivacyRequest: (id: string, data: DecidePrivacyRequest) =>
    request<PrivacyRequest>(`/privacy-requests/${id}/decide`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
