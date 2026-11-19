/** The `/iam` API area. Moved from `client.ts`; one module per first path segment. */
import type { CreateIamAccessRequest, IamAccessRequest } from "@medbrains/types";
import { request } from "../client.js";

export const iamApi = {
  listIamAccessRequests: (params?: { status?: string }) => {
    const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : "";
    return request<IamAccessRequest[]>(`/iam/access-requests${qs}`);
  },
  createIamAccessRequest: (data: CreateIamAccessRequest) =>
    request<IamAccessRequest>("/iam/access-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveIamAccessRequest: (id: string, data?: { note?: string }) =>
    request<IamAccessRequest>(`/iam/access-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  rejectIamAccessRequest: (id: string, data?: { note?: string }) =>
    request<IamAccessRequest>(`/iam/access-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  revokeIamAccessRequest: (id: string, data?: { reason?: string }) =>
    request<IamAccessRequest>(`/iam/access-requests/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
};
