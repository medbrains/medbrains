/** The `/bedside` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  BedsideDailyScheduleItem,
  BedsideDietOrderItem,
  BedsideEducationVideoRow,
  BedsideEducationViewRow,
  BedsideLabResultItem,
  BedsideMedicationItem,
  BedsideNurseRequestRow,
  BedsideRealtimeFeedbackRow,
  BedsideSessionRow,
  BedsideVitalReading,
  CreateBedsideNurseRequestPayload,
  CreateBedsideSessionRequest,
  CreateBedsideVideoRequest,
  NurseCallBoard,
  RecordBedsideVideoViewRequest,
  SubmitBedsideFeedbackRequest,
  UpdateBedsideRequestStatusPayload,
  UpdateBedsideVideoRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const bedsideApi = {
  // ══════════════════════════════════════════════════════════
  //  Bedside Portal
  // ══════════════════════════════════════════════════════════

  listBedsideSessions: () => request<BedsideSessionRow[]>("/bedside/sessions"),

  createBedsideSession: (data: CreateBedsideSessionRequest) =>
    request<BedsideSessionRow>("/bedside/sessions", { method: "POST", body: JSON.stringify(data) }),

  endBedsideSession: (id: string) =>
    request<BedsideSessionRow>(`/bedside/sessions/${id}/end`, { method: "PUT" }),

  getBedsideDailySchedule: (admissionId: string) =>
    request<BedsideDailyScheduleItem[]>(`/bedside/${admissionId}/schedule`),

  getBedsideMedications: (admissionId: string) =>
    request<BedsideMedicationItem[]>(`/bedside/${admissionId}/medications`),

  getBedsideVitals: (admissionId: string) =>
    request<BedsideVitalReading[]>(`/bedside/${admissionId}/vitals`),

  getBedsideLabResults: (admissionId: string) =>
    request<BedsideLabResultItem[]>(`/bedside/${admissionId}/lab-results`),

  getBedsideDietOrder: (admissionId: string) =>
    request<BedsideDietOrderItem[]>(`/bedside/${admissionId}/diet-order`),

  createBedsideNurseRequest: (admissionId: string, data: CreateBedsideNurseRequestPayload) =>
    request<BedsideNurseRequestRow>(`/bedside/${admissionId}/nurse-request`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listBedsideNurseRequests: (admissionId: string, params?: { status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<BedsideNurseRequestRow[]>(
      `/bedside/${admissionId}/nurse-requests${qs ? `?${qs}` : ""}`,
    );
  },

  updateBedsideRequestStatus: (id: string, data: UpdateBedsideRequestStatusPayload) =>
    request<BedsideNurseRequestRow>(`/bedside/nurse-requests/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listBedsideVideos: (params?: { category?: string }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set("category", params.category);
    const qs = sp.toString();
    return request<BedsideEducationVideoRow[]>(`/bedside/videos${qs ? `?${qs}` : ""}`);
  },

  createBedsideVideo: (data: CreateBedsideVideoRequest) =>
    request<BedsideEducationVideoRow>("/bedside/videos", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBedsideVideo: (id: string, data: UpdateBedsideVideoRequest) =>
    request<BedsideEducationVideoRow>(`/bedside/videos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  recordBedsideVideoView: (admissionId: string, data: RecordBedsideVideoViewRequest) =>
    request<BedsideEducationViewRow>(`/bedside/${admissionId}/video-view`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  submitBedsideFeedback: (admissionId: string, data: SubmitBedsideFeedbackRequest) =>
    request<BedsideRealtimeFeedbackRow>(`/bedside/${admissionId}/feedback`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listBedsideFeedback: (admissionId: string) =>
    request<BedsideRealtimeFeedbackRow[]>(`/bedside/${admissionId}/feedback`),

  /** Open nurse calls across the ward — the board, not one admission's list. */
  getNurseCallBoard: (wardId?: string) =>
    request<NurseCallBoard>(`/bedside/nurse-calls/active${wardId ? `?ward_id=${wardId}` : ""}`),
};
