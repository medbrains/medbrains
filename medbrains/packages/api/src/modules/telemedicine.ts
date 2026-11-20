/** The `/telemedicine` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateTeleConsultationRequest,
  TeleChatMessage,
  TeleConfig,
  TeleConsultation,
  TeleConsultationListItem,
  TeleJoinInfo,
  TeleTriage,
  TriageResearchRow,
  TriageResearchSummary,
  UpdateTeleStatusRequest,
  WaitingRoomItem,
} from "@medbrains/types";
import { request } from "../client.js";

export const telemedicineApi = {
  // Telemedicine
  listTeleConsultations: (params?: {
    status?: string;
    doctor_id?: string;
    patient_id?: string;
  }) => {
    const qs = params
      ? `?${new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
        )}`
      : "";
    return request<TeleConsultationListItem[]>(`/telemedicine/consultations${qs}`);
  },
  createTeleConsultation: (data: CreateTeleConsultationRequest) =>
    request<TeleConsultation>("/telemedicine/consultations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTeleConsultation: (id: string) =>
    request<TeleConsultation>(`/telemedicine/consultations/${id}`),
  getTeleJoinInfo: (id: string) => request<TeleJoinInfo>(`/telemedicine/consultations/${id}/join`),
  getTeleWaitingRoom: (doctorId?: string) =>
    request<WaitingRoomItem[]>(
      `/telemedicine/waiting-room${doctorId ? `?doctor_id=${doctorId}` : ""}`,
    ),
  updateTeleRecording: (
    id: string,
    data: { recording_consent?: boolean; is_recording?: boolean; recording_url?: string },
  ) =>
    request<{ recording_consent: boolean; is_recording: boolean; recording_url: string | null }>(
      `/telemedicine/consultations/${id}/recording`,
      { method: "PUT", body: JSON.stringify(data) },
    ),
  scheduleTeleFollowUp: (id: string, data: { scheduled_at: string }) =>
    request<TeleConsultation>(`/telemedicine/consultations/${id}/follow-up`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getTeleConfig: () => request<TeleConfig>("/telemedicine/config"),
  updateTeleConfig: (data: { video_base?: string; default_provider?: string }) =>
    request<TeleConfig>("/telemedicine/config", { method: "PUT", body: JSON.stringify(data) }),
  listTeleChat: (id: string) =>
    request<TeleChatMessage[]>(`/telemedicine/consultations/${id}/chat`),
  getTriage: (id: string) => request<TeleTriage | null>(`/telemedicine/consultations/${id}/triage`),
  getTriageResearchSummary: () =>
    request<TriageResearchSummary>("/telemedicine/triage-research/summary"),
  getTriageResearchDataset: () =>
    request<TriageResearchRow[]>("/telemedicine/triage-research/dataset"),
  submitTriage: (
    id: string,
    data: {
      chief_complaint?: string;
      symptoms?: string[];
      duration_hours?: number;
      severity?: number;
      vitals?: Record<string, number>;
    },
  ) =>
    request<TeleTriage>(`/telemedicine/consultations/${id}/triage`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  postTeleChat: (id: string, data: { body: string; sender_role?: string }) =>
    request<TeleChatMessage>(`/telemedicine/consultations/${id}/chat`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTeleStatus: (id: string, data: UpdateTeleStatusRequest) =>
    request<TeleConsultation>(`/telemedicine/consultations/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
