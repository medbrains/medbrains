/** The `/roi-requests` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateRoiInput,
  ReviewRoiInput,
  RoiAccessInput,
  RoiAccessLogRow,
  RoiRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const roiRequestsApi = {
  // Release of Information (ROI)
  listRoiRequests: (status?: string) =>
    request<RoiRequest[]>(`/roi-requests${status ? `?status=${status}` : ""}`),
  createRoiRequest: (data: CreateRoiInput) =>
    request<RoiRequest>("/roi-requests", { method: "POST", body: JSON.stringify(data) }),
  reviewRoiRequest: (id: string, data: ReviewRoiInput) =>
    request<RoiRequest>(`/roi-requests/${id}/review`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  recordRoiAccess: (id: string, data: RoiAccessInput) =>
    request<RoiAccessLogRow>(`/roi-requests/${id}/access`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listRoiAccessLog: (id: string) => request<RoiAccessLogRow[]>(`/roi-requests/${id}/access-log`),
};
