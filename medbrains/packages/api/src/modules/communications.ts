/** The `/communications` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CommClinicalMessageRow,
  CommComplaintRow,
  CommCriticalAlertRow,
  CommFeedbackSurveyRow,
  CommMessageRow,
  CommTemplateRow,
  CreateCommAlertRequest,
  CreateCommClinicalRequest,
  CreateCommComplaintRequest,
  CreateCommFeedbackRequest,
  CreateCommMessageRequest,
  CreateCommTemplateRequest,
  CreateDltTemplateRequest,
  DltTemplate,
  FeedbackStatsResponse,
  ResolveCommAlertRequest,
  ResolveCommComplaintRequest,
  UpdateCommComplaintRequest,
  UpdateCommMessageStatusRequest,
  UpdateCommTemplateRequest,
  UpdateDltTemplateRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const communicationsApi = {
  // ── Communication Hub ──────────────────────────────────

  /** DLT (India SMS) template registry. */
  listDltTemplates: () => request<DltTemplate[]>("/communications/dlt-templates"),
  createDltTemplate: (data: CreateDltTemplateRequest) =>
    request<DltTemplate>("/communications/dlt-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDltTemplate: (id: string, data: UpdateDltTemplateRequest) =>
    request<DltTemplate>(`/communications/dlt-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDltTemplate: (id: string) =>
    request<{ deleted: boolean }>(`/communications/dlt-templates/${id}`, {
      method: "DELETE",
    }),

  listCommTemplates: (params?: {
    channel?: string;
    template_type?: string;
    is_active?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params?.channel) sp.set("channel", params.channel);
    if (params?.template_type) sp.set("template_type", params.template_type);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    const qs = sp.toString();
    return request<CommTemplateRow[]>(`/communications/templates${qs ? `?${qs}` : ""}`);
  },
  createCommTemplate: (data: CreateCommTemplateRequest) =>
    request<CommTemplateRow>("/communications/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCommTemplate: (id: string, data: UpdateCommTemplateRequest) =>
    request<CommTemplateRow>(`/communications/templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listCommMessages: (params?: {
    channel?: string;
    status?: string;
    recipient_type?: string;
    context_type?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.channel) sp.set("channel", params.channel);
    if (params?.status) sp.set("status", params.status);
    if (params?.recipient_type) sp.set("recipient_type", params.recipient_type);
    if (params?.context_type) sp.set("context_type", params.context_type);
    const qs = sp.toString();
    return request<CommMessageRow[]>(`/communications/messages${qs ? `?${qs}` : ""}`);
  },
  getCommMessage: (id: string) => request<CommMessageRow>(`/communications/messages/${id}`),
  createCommMessage: (data: CreateCommMessageRequest) =>
    request<CommMessageRow>("/communications/messages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCommMessageStatus: (id: string, data: UpdateCommMessageStatusRequest) =>
    request<CommMessageRow>(`/communications/messages/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listClinicalMessages: (params?: {
    sender_id?: string;
    recipient_id?: string;
    patient_id?: string;
    priority?: string;
    message_type?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.sender_id) sp.set("sender_id", params.sender_id);
    if (params?.recipient_id) sp.set("recipient_id", params.recipient_id);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.priority) sp.set("priority", params.priority);
    if (params?.message_type) sp.set("message_type", params.message_type);
    const qs = sp.toString();
    return request<CommClinicalMessageRow[]>(`/communications/clinical${qs ? `?${qs}` : ""}`);
  },
  getClinicalMessage: (id: string) =>
    request<CommClinicalMessageRow>(`/communications/clinical/${id}`),
  createClinicalMessage: (data: CreateCommClinicalRequest) =>
    request<CommClinicalMessageRow>("/communications/clinical", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  acknowledgeClinicalMessage: (id: string) =>
    request<CommClinicalMessageRow>(`/communications/clinical/${id}/acknowledge`, {
      method: "PUT",
      body: "{}",
    }),

  listCommAlerts: (params?: { status?: string; priority?: string; alert_source?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    if (params?.alert_source) sp.set("alert_source", params.alert_source);
    const qs = sp.toString();
    return request<CommCriticalAlertRow[]>(`/communications/alerts${qs ? `?${qs}` : ""}`);
  },
  createCommAlert: (data: CreateCommAlertRequest) =>
    request<CommCriticalAlertRow>("/communications/alerts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  acknowledgeCommAlert: (id: string) =>
    request<CommCriticalAlertRow>(`/communications/alerts/${id}/acknowledge`, {
      method: "PUT",
      body: "{}",
    }),
  resolveCommAlert: (id: string, data: ResolveCommAlertRequest) =>
    request<CommCriticalAlertRow>(`/communications/alerts/${id}/resolve`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listComplaints: (params?: {
    status?: string;
    source?: string;
    severity?: string;
    department_id?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.source) sp.set("source", params.source);
    if (params?.severity) sp.set("severity", params.severity);
    if (params?.department_id) sp.set("department_id", params.department_id);
    const qs = sp.toString();
    return request<CommComplaintRow[]>(`/communications/complaints${qs ? `?${qs}` : ""}`);
  },
  createComplaint: (data: CreateCommComplaintRequest) =>
    request<CommComplaintRow>("/communications/complaints", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateComplaint: (id: string, data: UpdateCommComplaintRequest) =>
    request<CommComplaintRow>(`/communications/complaints/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  resolveComplaint: (id: string, data: ResolveCommComplaintRequest) =>
    request<CommComplaintRow>(`/communications/complaints/${id}/resolve`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listCommFeedback: (params?: { feedback_type?: string; department_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.feedback_type) sp.set("feedback_type", params.feedback_type);
    if (params?.department_id) sp.set("department_id", params.department_id);
    const qs = sp.toString();
    return request<CommFeedbackSurveyRow[]>(`/communications/feedback${qs ? `?${qs}` : ""}`);
  },
  createCommFeedback: (data: CreateCommFeedbackRequest) =>
    request<CommFeedbackSurveyRow>("/communications/feedback", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCommFeedbackStats: (params?: { feedback_type?: string; department_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.feedback_type) sp.set("feedback_type", params.feedback_type);
    if (params?.department_id) sp.set("department_id", params.department_id);
    const qs = sp.toString();
    return request<FeedbackStatsResponse>(`/communications/feedback/stats${qs ? `?${qs}` : ""}`);
  },
};
