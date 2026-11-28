/** The `/radiology` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CancelRadiologyOrderRequest,
  ContrastScreeningRequest,
  ContrastScreeningResult,
  CreatedStudyShareLink,
  CreateModalityRequest,
  CreateRadiologyAppointmentRequest,
  CreateRadiologyOrderRequest,
  CreateRadiologyReportRequest,
  CreateStudyShareLink,
  CumulativeDoseResult,
  DiagnosticReferenceLevel,
  Dosimetry,
  DrlAuditReport,
  LinkUnmatchedStudyResult,
  PatientDoseRecord,
  PatientRadiologyReport,
  RadiationDoseRecord,
  RadiationEquipment,
  RadiationSafetyAlert,
  RadiologyAppointment,
  RadiologyDicomStudy,
  RadiologyExam,
  RadiologyExamInput,
  RadiologyExamListItem,
  RadiologyExamListParams,
  RadiologyModality,
  RadiologyOrder,
  RadiologyOrderDetailResponse,
  RadiologyOrderListResponse,
  RadiologyReport,
  RadiologyTatRow,
  RecordDoseRequest,
  RecordDosimetryReading,
  RecordPregnancyCheck,
  SaveRadiationEquipment,
  SaveReferenceLevel,
  StudyShareLink,
  UnmatchedStudy,
  UnmatchedStudyStatus,
  UpdateModalityRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const radiologyApi = {
  // ── Radiology ────────────────────────────────────────

  listRadiologyOrders: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<RadiologyOrderListResponse>(`/radiology/orders${qs}`);
  },

  createRadiologyOrder: (data: CreateRadiologyOrderRequest) =>
    request<RadiologyOrder>("/radiology/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  contrastScreening: (data: ContrastScreeningRequest) =>
    request<ContrastScreeningResult>("/radiology/contrast-screening", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cumulativeDose: (patientId: string) =>
    request<CumulativeDoseResult>(`/radiology/cumulative-dose?patient_id=${patientId}`),

  getRadiologyOrder: (id: string) =>
    request<RadiologyOrderDetailResponse>(`/radiology/orders/${id}`),

  updateRadiologyOrderStatus: (id: string, status: string) =>
    request<RadiologyOrder>(`/radiology/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  cancelRadiologyOrder: (id: string, data: CancelRadiologyOrderRequest) =>
    request<RadiologyOrder>(`/radiology/orders/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createRadiologyReport: (orderId: string, data: CreateRadiologyReportRequest) =>
    request<RadiologyReport>(`/radiology/orders/${orderId}/report`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyRadiologyReport: (id: string) =>
    request<RadiologyReport>(`/radiology/reports/${id}/verify`, {
      method: "PUT",
    }),

  recordRadiationDose: (orderId: string, data: RecordDoseRequest) =>
    request<RadiationDoseRecord>(`/radiology/orders/${orderId}/dose`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  markRadiationDoseEnteredInError: (id: string, reason: string) =>
    request<RadiationDoseRecord>(`/radiology/dose-records/${id}/entered-in-error`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  listUnmatchedStudies: (status: UnmatchedStudyStatus = "open") =>
    request<UnmatchedStudy[]>(`/radiology/unmatched-studies?status=${status}`),
  linkUnmatchedStudy: (id: string, data: { order_id: string; note?: string }) =>
    request<LinkUnmatchedStudyResult>(`/radiology/unmatched-studies/${id}/link`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  dismissUnmatchedStudy: (id: string, reason: string) =>
    request<UnmatchedStudy>(`/radiology/unmatched-studies/${id}/dismiss`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  listPatientDoseRecords: (patientId: string) =>
    request<PatientDoseRecord[]>(`/radiology/patients/${patientId}/dose-records`),

  listRadiologyModalities: () => request<RadiologyModality[]>("/radiology/modalities"),

  listRadiologyExams: (params?: RadiologyExamListParams) => {
    const sp = new URLSearchParams();
    if (params?.modality_id) sp.set("modality_id", params.modality_id);
    if (params?.search) sp.set("search", params.search);
    if (params?.limit) sp.set("limit", String(params.limit));
    if (params?.include_inactive) sp.set("include_inactive", "true");
    const qs = sp.toString();
    return request<RadiologyExamListItem[]>(`/radiology/exams${qs ? `?${qs}` : ""}`);
  },
  createRadiologyExam: (data: RadiologyExamInput) =>
    request<RadiologyExam>("/radiology/exams", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRadiologyExam: (id: string, data: RadiologyExamInput) =>
    request<RadiologyExam>(`/radiology/exams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRadiologyExam: (id: string) =>
    request<{ deleted: boolean }>(`/radiology/exams/${id}`, { method: "DELETE" }),

  createRadiologyModality: (data: CreateModalityRequest) =>
    request<RadiologyModality>("/radiology/modalities", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRadiologyModality: (id: string, data: UpdateModalityRequest) =>
    request<RadiologyModality>(`/radiology/modalities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteRadiologyModality: (id: string) =>
    request<{ deleted: boolean }>(`/radiology/modalities/${id}`, {
      method: "DELETE",
    }),

  listRadiologyAppointments: (params?: { modality_id?: string; date?: string }) => {
    const sp = new URLSearchParams();
    if (params?.modality_id) sp.set("modality_id", params.modality_id);
    if (params?.date) sp.set("date", params.date);
    const qs = sp.toString();
    return request<RadiologyAppointment[]>(`/radiology/appointments${qs ? `?${qs}` : ""}`);
  },
  createRadiologyAppointment: (data: CreateRadiologyAppointmentRequest) =>
    request<Record<string, unknown>>("/radiology/appointments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getRadiologyTat: () => request<RadiologyTatRow[]>("/radiology/analytics/tat"),
  listRadiologyDicomStudies: (params?: { patient_id?: string }) => {
    const qs = params?.patient_id ? `?patient_id=${encodeURIComponent(params.patient_id)}` : "";
    return request<RadiologyDicomStudy[]>(`/radiology/dicom-studies${qs}`);
  },
  getPriorRadiologyDicomStudies: (id: string) =>
    request<RadiologyDicomStudy[]>(`/radiology/dicom-studies/${id}/prior`),
  listPatientRadiologyReports: (patientId: string) =>
    request<PatientRadiologyReport[]>(`/radiology/patients/${patientId}/reports`),
  acknowledgeRadiologyCriticalAlert: (alertId: string) =>
    request<{ id: string; acknowledged_at: string }>(
      `/radiology/critical-alerts/${alertId}/acknowledge`,
      { method: "PUT" },
    ),
  createRadiologyShareLink: (data: CreateStudyShareLink) =>
    request<CreatedStudyShareLink>("/radiology/share-links", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listStudyShareLinks: (studyId: string) =>
    request<StudyShareLink[]>(`/radiology/dicom-studies/${studyId}/share-links`),
  revokeStudyShareLink: (id: string) =>
    request<{ revoked: boolean }>(`/radiology/share-links/${id}/revoke`, { method: "POST" }),
  openStudyViewer: (studyId: string) =>
    request<{ viewer_url: string }>(`/radiology/dicom-studies/${studyId}/view`, {
      method: "POST",
    }),
  getRadiologyPacsConfig: () => request<unknown>("/radiology/pacs-config"),
  updateRadiologyPacsConfig: (data: Record<string, unknown>) =>
    request<unknown>("/radiology/pacs-config", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listRadiologyDosimetry: (year?: number) =>
    request<Dosimetry>(`/radiology/dosimetry${year ? `?year=${year}` : ""}`),
  createRadiologyDosimetry: (data: RecordDosimetryReading) =>
    request<{ id: string; year_msv: number; alerts: RadiationSafetyAlert[] }>(
      "/radiology/dosimetry",
      { method: "POST", body: JSON.stringify(data) },
    ),
  removeRadiologyDosimetry: (id: string) =>
    request<{ removed: boolean }>(`/radiology/dosimetry/${id}`, { method: "DELETE" }),
  recordPregnancyCheck: (orderId: string, data: RecordPregnancyCheck) =>
    request<RadiologyOrder>(`/radiology/orders/${orderId}/pregnancy-check`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listReferenceLevels: () => request<DiagnosticReferenceLevel[]>("/radiology/drls"),
  saveReferenceLevel: (data: SaveReferenceLevel) =>
    request<DiagnosticReferenceLevel>("/radiology/drls", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  removeReferenceLevel: (id: string) =>
    request<{ removed: boolean }>(`/radiology/drls/${id}`, { method: "DELETE" }),
  drlAudit: (from: string, to: string) =>
    request<DrlAuditReport>(`/radiology/drl-audit?from=${from}&to=${to}`),
  listRadiationEquipment: () => request<RadiationEquipment[]>("/radiology/radiation-equipment"),
  saveRadiationEquipment: (data: SaveRadiationEquipment) =>
    request<{ id: string }>("/radiology/radiation-equipment", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  downloadRadiologyPackage: (id: string) => request<unknown>(`/radiology/download-package/${id}`),
};
