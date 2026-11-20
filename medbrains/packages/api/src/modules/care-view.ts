/** The `/care-view` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ClinicalScoreRow,
  DischargeReadinessRow,
  HandoverSummaryResponse,
  MyTasksResponse,
  RecordScoreRequest,
  UpdatePrimaryNurseRequest,
  VitalsChecklistRow,
  WardGridResponse,
} from "@medbrains/types";
import { request } from "../client.js";

export const careViewApi = {
  // ── Care View / Ward Dashboard ──────────────────────────

  wardPatientGrid: (wardId?: string) =>
    request<WardGridResponse>(`/care-view/ward-grid${wardId ? `?ward_id=${wardId}` : ""}`),

  careViewMyTasks: (params?: { ward_id?: string; category?: string }) => {
    const sp = new URLSearchParams();
    if (params?.ward_id) sp.set("ward_id", params.ward_id);
    if (params?.category) sp.set("category", params.category);
    const qs = sp.toString();
    return request<MyTasksResponse>(`/care-view/my-tasks${qs ? `?${qs}` : ""}`);
  },

  vitalsChecklist: (wardId?: string) =>
    request<VitalsChecklistRow[]>(
      `/care-view/vitals-checklist${wardId ? `?ward_id=${wardId}` : ""}`,
    ),

  handoverSummary: (wardId: string, shift: string) =>
    request<HandoverSummaryResponse>(`/care-view/handover?ward_id=${wardId}&shift=${shift}`),

  dischargeReadiness: (wardId?: string) =>
    request<DischargeReadinessRow[]>(
      `/care-view/discharge-tracker${wardId ? `?ward_id=${wardId}` : ""}`,
    ),

  completeCareViewTask: (taskId: string) =>
    request<{ completed: boolean }>(`/care-view/tasks/${taskId}/complete`, {
      method: "POST",
    }),

  listPatientScores: (admissionId: string) =>
    request<ClinicalScoreRow[]>(`/care-view/scores/${admissionId}`),

  recordPatientScore: (admissionId: string, body: RecordScoreRequest) =>
    request<ClinicalScoreRow>(`/care-view/scores/${admissionId}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updatePrimaryNurse: (admissionId: string, body: UpdatePrimaryNurseRequest) =>
    request<{ updated: boolean }>(`/care-view/admissions/${admissionId}/primary-nurse`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
