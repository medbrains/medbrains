/** The `/chronic-care` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AdherenceRow,
  AdherenceSummaryResponse,
  ChronicEnrollmentRow,
  ChronicProgram,
  CreateChronicEnrollmentRequest,
  CreateChronicProgramRequest,
  CreateOutcomeTargetRequest,
  CreateTimelineEventRequest,
  DrugTimelineWithLabsResponse,
  MedicationTimelineEvent,
  OutcomeDashboardResponse,
  PatientOutcomeTarget,
  PolypharmacyInteractionAlert,
  RecordAdherenceRequest,
  TreatmentSummaryResponse,
  UpdateEnrollmentStatusRequest,
  UpdateOutcomeTargetRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const chronicCareApi = {
  // ── Chronic Care / Drug-o-gram ──────────────────────────

  listChronicPrograms: (params?: {
    program_type?: string;
    is_active?: boolean;
    search?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.program_type) sp.set("program_type", params.program_type);
    if (params?.is_active !== undefined) sp.set("is_active", String(params.is_active));
    if (params?.search) sp.set("search", params.search);
    const qs = sp.toString();
    return request<ChronicProgram[]>(`/chronic-care/programs${qs ? `?${qs}` : ""}`);
  },

  createChronicProgram: (data: CreateChronicProgramRequest) =>
    request<ChronicProgram>("/chronic-care/programs", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateChronicProgram: (
    id: string,
    data: Partial<CreateChronicProgramRequest> & { is_active?: boolean },
  ) =>
    request<ChronicProgram>(`/chronic-care/programs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteChronicProgram: (id: string) =>
    request<{ deleted: boolean }>(`/chronic-care/programs/${id}`, {
      method: "DELETE",
    }),

  listChronicEnrollments: (params?: {
    program_type?: string;
    status?: string;
    doctor_id?: string;
    search?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.program_type) sp.set("program_type", params.program_type);
    if (params?.status) sp.set("status", params.status);
    if (params?.doctor_id) sp.set("doctor_id", params.doctor_id);
    if (params?.search) sp.set("search", params.search);
    const qs = sp.toString();
    return request<ChronicEnrollmentRow[]>(`/chronic-care/enrollments${qs ? `?${qs}` : ""}`);
  },

  patientEnrollments: (patientId: string) =>
    request<ChronicEnrollmentRow[]>(`/chronic-care/patients/${patientId}/enrollments`),

  createEnrollment: (data: CreateChronicEnrollmentRequest) =>
    request<{ id: string }>("/chronic-care/enrollments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEnrollment: (
    id: string,
    data: {
      primary_doctor_id?: string;
      expected_end_date?: string;
      target_overrides?: unknown;
      notes?: string;
    },
  ) =>
    request<{ updated: boolean }>(`/chronic-care/enrollments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  updateEnrollmentStatus: (id: string, data: UpdateEnrollmentStatusRequest) =>
    request<{ updated: boolean }>(`/chronic-care/enrollments/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  drugTimeline: (
    patientId: string,
    params?: { from_date?: string; to_date?: string; enrollment_id?: string },
  ) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    if (params?.enrollment_id) sp.set("enrollment_id", params.enrollment_id);
    const qs = sp.toString();
    return request<MedicationTimelineEvent[]>(
      `/chronic-care/patients/${patientId}/drug-timeline${qs ? `?${qs}` : ""}`,
    );
  },

  drugTimelineWithLabs: (patientId: string, params?: { from_date?: string; to_date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<DrugTimelineWithLabsResponse>(
      `/chronic-care/patients/${patientId}/drug-timeline/with-labs${qs ? `?${qs}` : ""}`,
    );
  },

  createTimelineEvent: (data: CreateTimelineEventRequest) =>
    request<{ id: string }>("/chronic-care/timeline-events", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listAdherence: (
    enrollmentId: string,
    params?: { event_type?: string; from_date?: string; to_date?: string },
  ) => {
    const sp = new URLSearchParams();
    if (params?.event_type) sp.set("event_type", params.event_type);
    if (params?.from_date) sp.set("from_date", params.from_date);
    if (params?.to_date) sp.set("to_date", params.to_date);
    const qs = sp.toString();
    return request<AdherenceRow[]>(
      `/chronic-care/enrollments/${enrollmentId}/adherence${qs ? `?${qs}` : ""}`,
    );
  },

  recordAdherence: (data: RecordAdherenceRequest) =>
    request<{ id: string }>("/chronic-care/adherence", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adherenceSummary: (enrollmentId: string) =>
    request<AdherenceSummaryResponse>(
      `/chronic-care/enrollments/${enrollmentId}/adherence-summary`,
    ),

  listOutcomeTargets: (patientId: string) =>
    request<PatientOutcomeTarget[]>(`/chronic-care/patients/${patientId}/targets`),

  createOutcomeTarget: (data: CreateOutcomeTargetRequest) =>
    request<{ id: string }>("/chronic-care/targets", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateOutcomeTarget: (id: string, data: UpdateOutcomeTargetRequest) =>
    request<{ updated: boolean }>(`/chronic-care/targets/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  outcomeDashboard: (patientId: string) =>
    request<OutcomeDashboardResponse>(`/chronic-care/patients/${patientId}/outcome-dashboard`),

  listInteractionAlerts: (patientId: string) =>
    request<PolypharmacyInteractionAlert[]>(
      `/chronic-care/patients/${patientId}/interaction-alerts`,
    ),

  checkPolypharmacy: (patientId: string) =>
    request<PolypharmacyInteractionAlert[]>(
      `/chronic-care/patients/${patientId}/check-interactions`,
      {
        method: "POST",
      },
    ),

  acknowledgeAlert: (id: string, data: { status: string; override_reason?: string }) =>
    request<{ updated: boolean }>(`/chronic-care/interaction-alerts/${id}/acknowledge`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  treatmentSummary: (patientId: string) =>
    request<TreatmentSummaryResponse>(`/chronic-care/patients/${patientId}/treatment-summary`),
};
