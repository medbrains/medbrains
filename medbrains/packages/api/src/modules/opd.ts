/** The `/opd` API area. Moved from `client.ts`; one module per first path segment. */

import { opdReportResponseSchema } from "@medbrains/schemas";
import type {
  AdmitFromOpdRequest,
  AdmitFromOpdResponse,
  Appointment,
  AppointmentWithPatient,
  AvailableSlot,
  BookAppointmentGroupRequest,
  BookAppointmentRequest,
  CancelAppointmentRequest,
  ChiefComplaintMaster,
  ClinicalCorpusEntry,
  CompleteReferralRequest,
  Consultation,
  ConsultationTemplate,
  CreateClinicalCorpusEntryRequest,
  CreateConsentRequest,
  CreateConsultationTemplateRequest,
  CreateDiagnosisRequest,
  CreateEncounterRequest,
  CreateEncounterResponse,
  CreateFeedbackRequest,
  CreateMedicalCertificateRequest,
  CreatePrescriptionRequest,
  CreatePrescriptionTemplateRequest,
  CreateProcedureOrderRequest,
  CreateReferralRequest,
  CreateReminderRequest,
  CreateScheduleExceptionRequest,
  CreateScheduleRequest,
  CreateVitalRequest,
  CsvImportRequest,
  CsvImportResult,
  DeclineReferralRequest,
  Diagnosis,
  DoctorDocket,
  DoctorSchedule,
  DoctorScheduleException,
  DuplicateOrderInfo,
  Encounter,
  EncounterListResponse,
  FollowupComplianceRow,
  LastOpdVisit,
  LiveStewardshipRequest,
  MedicalCertificate,
  OpdAutoCloseSetting,
  OpdRegistrationPolicy,
  OpdReportResponse,
  PatientDiagnosisRow,
  PatientFeedback,
  PatientReminder,
  PharmacyDispatchStatus,
  PrescriptionHistoryItem,
  PrescriptionTemplate,
  PrescriptionWithItems,
  ProcedureCatalog,
  ProcedureConsent,
  ProcedureOrderWithName,
  PublicTokenLink,
  QueueEntry,
  ReferralStep,
  ReferralWithNames,
  RescheduleAppointmentRequest,
  ReviewRequest,
  ReviewSummary,
  RevokeProcedureConsentRequest,
  SearchClinicalCorpusParams,
  SessionView,
  SnomedCode,
  TransferVisitRequest,
  TransferVisitResponse,
  UpdateClinicalCorpusEntryRequest,
  UpdateDiagnosisRequest,
  UpdateEncounterRequest,
  UpdatePrescriptionRequest,
  UpdateScheduleRequest,
  VerbalOrderEntry,
  Vital,
  VitalHistoryPoint,
  VoidMedicalCertificateRequest,
  WaitEstimate,
} from "@medbrains/types";
import { checkedRequest, request } from "../client.js";

export const opdApi = {
  // ── OPD ──────────────────────────────────────────────

  listEncounters: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<EncounterListResponse>(`/opd/encounters${qs}`);
  },
  createEncounter: (data: CreateEncounterRequest) =>
    request<CreateEncounterResponse>("/opd/encounters", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLastOpdVisit: (patientId: string) =>
    request<LastOpdVisit | null>(`/opd/patients/${patientId}/last-visit`),
  getOpdAutoClose: () => request<OpdAutoCloseSetting>("/opd/auto-close"),
  updateOpdAutoClose: (data: OpdAutoCloseSetting) =>
    request<OpdAutoCloseSetting>("/opd/auto-close", { method: "PUT", body: JSON.stringify(data) }),
  getRegistrationPolicy: () => request<OpdRegistrationPolicy>("/opd/registration-policy"),
  updateRegistrationPolicy: (data: OpdRegistrationPolicy) =>
    request<OpdRegistrationPolicy>("/opd/registration-policy", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getEncounter: (id: string) => request<Encounter>(`/opd/encounters/${id}`),
  transferEncounter: (id: string, data: TransferVisitRequest) =>
    request<TransferVisitResponse>(`/opd/encounters/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEncounter: (id: string, data: UpdateEncounterRequest) =>
    request<Encounter>(`/opd/encounters/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listQueue: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<QueueEntry[]>(`/opd/queue${qs}`);
  },
  callQueueEntry: (id: string) =>
    request<{ status: string }>(`/opd/queue/${id}/call`, { method: "PUT" }),
  startConsultation: (id: string) =>
    request<{ status: string }>(`/opd/queue/${id}/start`, { method: "PUT" }),
  completeQueueEntry: (id: string) =>
    request<{ status: string }>(`/opd/queue/${id}/complete`, { method: "PUT" }),
  markNoShow: (id: string) =>
    request<{ status: string }>(`/opd/queue/${id}/no-show`, { method: "PUT" }),
  listVitals: (encounterId: string) => request<Vital[]>(`/opd/encounters/${encounterId}/vitals`),
  createVital: (encounterId: string, data: CreateVitalRequest) =>
    request<Vital>(`/opd/encounters/${encounterId}/vitals`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getConsultation: (encounterId: string) =>
    request<Consultation>(`/opd/encounters/${encounterId}/consultation`),
  listDiagnoses: (encounterId: string) =>
    request<Diagnosis[]>(`/opd/encounters/${encounterId}/diagnoses`),
  createDiagnosis: (encounterId: string, data: CreateDiagnosisRequest) =>
    request<Diagnosis>(`/opd/encounters/${encounterId}/diagnoses`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDiagnosis: (encounterId: string, diagnosisId: string, data: UpdateDiagnosisRequest) =>
    request<Diagnosis>(`/opd/encounters/${encounterId}/diagnoses/${diagnosisId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteDiagnosis: (encounterId: string, diagnosisId: string) =>
    request<{ status: string }>(`/opd/encounters/${encounterId}/diagnoses/${diagnosisId}`, {
      method: "DELETE",
    }),
  listPrescriptions: (encounterId: string) =>
    request<PrescriptionWithItems[]>(`/opd/encounters/${encounterId}/prescriptions`),
  getPrescription: (prescriptionId: string) =>
    request<PrescriptionWithItems>(`/opd/prescriptions/${prescriptionId}`),
  createPrescription: (encounterId: string, data: CreatePrescriptionRequest) =>
    request<PrescriptionWithItems>(`/opd/encounters/${encounterId}/prescriptions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePrescription: (prescriptionId: string, data: UpdatePrescriptionRequest) =>
    request<PrescriptionWithItems>(`/opd/prescriptions/${prescriptionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── Prescription Templates ──────────────────────────────
  listPrescriptionTemplates: () => request<PrescriptionTemplate[]>("/opd/prescription-templates"),
  createPrescriptionTemplate: (data: CreatePrescriptionTemplateRequest) =>
    request<PrescriptionTemplate>("/opd/prescription-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePrescriptionTemplate: (id: string) =>
    request<{ status: string }>(`/opd/prescription-templates/${id}`, {
      method: "DELETE",
    }),

  // ── Patient Prescription History ───────────────────────
  listPatientPrescriptions: (patientId: string) =>
    request<PrescriptionHistoryItem[]>(`/opd/patients/${patientId}/prescriptions`),
  /** The patient's pending or approved, unexpired antimicrobial stewardship requests. */
  listLiveStewardshipRequests: (patientId: string) =>
    request<LiveStewardshipRequest[]>(`/opd/patients/${patientId}/stewardship-requests`),

  // ── Patient Diagnoses (cross-encounter) ────────────────
  listPatientDiagnoses: (patientId: string) =>
    request<PatientDiagnosisRow[]>(`/opd/patients/${patientId}/diagnoses`),

  // ── Medical Certificates ───────────────────────────────
  listCertificates: (patientId: string) =>
    request<MedicalCertificate[]>(`/opd/patients/${patientId}/certificates`),
  createCertificate: (data: CreateMedicalCertificateRequest) =>
    request<MedicalCertificate>("/opd/certificates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  voidCertificate: (id: string, data: VoidMedicalCertificateRequest) =>
    request<MedicalCertificate>(`/opd/certificates/${id}/void`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── Vitals History (Trend Charts) ─────────────────────
  listPatientVitalsHistory: (patientId: string) =>
    request<VitalHistoryPoint[]>(`/opd/patients/${patientId}/vitals-history`),

  // ── Referrals ───────────────────────────────────────────
  listPatientReferrals: (patientId: string) =>
    request<ReferralWithNames[]>(`/opd/patients/${patientId}/referrals`),
  createReferral: (data: CreateReferralRequest) =>
    request<ReferralWithNames>("/opd/referrals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  acceptReferral: (id: string) =>
    request<ReferralStep>(`/opd/referrals/${id}/accept`, { method: "PUT", body: "{}" }),
  declineReferral: (id: string, data: DeclineReferralRequest) =>
    request<ReferralStep>(`/opd/referrals/${id}/decline`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  completeReferral: (id: string, data: CompleteReferralRequest) =>
    request<ReferralStep>(`/opd/referrals/${id}/complete`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  cancelReferral: (id: string) =>
    request<ReferralStep>(`/opd/referrals/${id}/cancel`, { method: "PUT", body: "{}" }),

  // ── AI notes from dictation (RFC-MODULE-ai-dictation) ──
  /** The recording is the body; the server transcribes it and drafts the note. */
  createDictation: (
    encounterId: string,
    audio: Blob,
    durationMs: number,
    source: "recorded" | "uploaded",
  ) =>
    request<SessionView>(
      `/opd/encounters/${encounterId}/dictations?duration_ms=${Math.round(durationMs)}&source=${source}`,
      { method: "POST", body: audio, headers: { "Content-Type": audio.type || "audio/webm" } },
    ),
  retryDictation: (dictationId: string) =>
    request<SessionView>(`/opd/dictations/${dictationId}/retry`, { method: "POST", body: "{}" }),
  reviewDictation: (dictationId: string, data: ReviewRequest) =>
    request<ReviewSummary>(`/opd/dictations/${dictationId}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Procedure Catalog & Orders ──────────────────────────
  listProcedureCatalog: () => request<ProcedureCatalog[]>("/opd/procedure-catalog"),
  importProcedureCatalog: (data: CsvImportRequest) =>
    request<CsvImportResult>("/opd/procedure-catalog/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listProcedureOrders: (encounterId: string) =>
    request<ProcedureOrderWithName[]>(`/opd/encounters/${encounterId}/procedure-orders`),
  createProcedureOrder: (data: CreateProcedureOrderRequest) =>
    request<ProcedureOrderWithName>("/opd/procedure-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelProcedureOrder: (id: string) =>
    request<{ status: string }>(`/opd/procedure-orders/${id}`, { method: "DELETE" }),

  // ── Duplicate Order Detection ───────────────────────────
  checkDuplicateOrders: (params: {
    patient_id: string;
    test_id?: string;
    procedure_id?: string;
    hours?: number;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v != null)
        .map(([k, v]) => [k, String(v)]),
    );
    return request<DuplicateOrderInfo[]>(`/opd/duplicate-check?${qs}`);
  },

  // ── ICD-11 & Chief Complaints ─────────────────────────
  searchIcd11: (q: string, limit?: number) =>
    request<ClinicalCorpusEntry[]>(
      `/opd/icd11/search?q=${encodeURIComponent(q)}&limit=${limit ?? 20}`,
    ),
  listChiefComplaints: () => request<ChiefComplaintMaster[]>("/opd/chief-complaints"),

  // ── Clinical Corpus / Note Completion ─────────────────
  searchClinicalCorpus: (params: SearchClinicalCorpusParams) => {
    const qs = new URLSearchParams();
    qs.set("q", params.q);
    if (params.section) qs.set("section", params.section);
    if (params.corpus_type) qs.set("corpus_type", params.corpus_type);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    return request<ClinicalCorpusEntry[]>(`/opd/clinical-corpus?${qs}`);
  },
  createClinicalCorpusEntry: (data: CreateClinicalCorpusEntryRequest) =>
    request<ClinicalCorpusEntry>("/opd/clinical-corpus", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateClinicalCorpusEntry: (id: string, data: UpdateClinicalCorpusEntryRequest) =>
    request<ClinicalCorpusEntry>(`/opd/clinical-corpus/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── SNOMED CT Search ──────────────────────────────────
  searchSnomed: (q: string, limit?: number) =>
    request<SnomedCode[]>(`/opd/snomed/search?q=${encodeURIComponent(q)}&limit=${limit ?? 20}`),

  // ── Multi-Doctor Appointment Groups ───────────────────
  bookAppointmentGroup: (data: BookAppointmentGroupRequest) =>
    request<Appointment[]>("/opd/appointment-groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listAppointmentGroup: (groupId: string) =>
    request<Appointment[]>(`/opd/appointment-groups/${groupId}`),

  // ── Wait Time Estimation ──────────────────────────────
  getWaitEstimate: (params?: { department_id?: string; doctor_id?: string }) => {
    const qs = params
      ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`
      : "";
    return request<WaitEstimate>(`/opd/queue/wait-estimate${qs}`);
  },

  // ── OPD → IPD Admission ───────────────────────────────
  admitFromOpd: (encounterId: string, data: AdmitFromOpdRequest) =>
    request<AdmitFromOpdResponse>(`/opd/encounters/${encounterId}/admit-to-ipd`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Post-Consultation (Dockets, Reminders, Feedback, Consents) ──

  getDoctorDocket: (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    return request<DoctorDocket | null>(`/opd/docket${qs}`);
  },
  generateDoctorDocket: (date?: string) => {
    const qs = date ? `?date=${date}` : "";
    return request<DoctorDocket>(`/opd/docket/generate${qs}`, { method: "POST" });
  },

  listReminders: (params?: {
    patient_id?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
  }) => {
    const qs = params
      ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`
      : "";
    return request<PatientReminder[]>(`/opd/reminders${qs}`);
  },
  createReminder: (data: CreateReminderRequest) =>
    request<PatientReminder>("/opd/reminders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completeReminder: (id: string) =>
    request<PatientReminder>(`/opd/reminders/${id}/complete`, { method: "PUT" }),
  cancelReminder: (id: string) =>
    request<PatientReminder>(`/opd/reminders/${id}/cancel`, { method: "PUT" }),

  listPatientFeedback: (patientId: string) =>
    request<PatientFeedback[]>(`/opd/patients/${patientId}/feedback`),
  createFeedback: (data: CreateFeedbackRequest) =>
    request<PatientFeedback>("/opd/feedback", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listProcedureConsents: (patientId: string) =>
    request<ProcedureConsent[]>(`/opd/patients/${patientId}/consents`),
  createProcedureConsent: (data: CreateConsentRequest) =>
    request<ProcedureConsent>("/opd/consents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  signProcedureConsent: (id: string) =>
    request<ProcedureConsent>(`/opd/consents/${id}/sign`, { method: "PUT" }),
  revokeProcedureConsent: (id: string, data: RevokeProcedureConsentRequest) =>
    request<ProcedureConsent>(`/opd/consents/${id}/revoke`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── Consultation Templates ────────────────────────────
  listConsultationTemplates: () => request<ConsultationTemplate[]>("/opd/consultation-templates"),
  createConsultationTemplate: (data: CreateConsultationTemplateRequest) =>
    request<ConsultationTemplate>("/opd/consultation-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteConsultationTemplate: (id: string) =>
    request<ConsultationTemplate>(`/opd/consultation-templates/${id}`, {
      method: "DELETE",
    }),

  // ── OPD Appointments ──────────────────────────────────

  // Doctor schedules
  listSchedules: (params?: { doctor_id?: string; department_id?: string }) => {
    const qs = params
      ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`
      : "";
    return request<DoctorSchedule[]>(`/opd/schedules${qs}`);
  },
  createSchedule: (data: CreateScheduleRequest) =>
    request<DoctorSchedule>("/opd/schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSchedule: (id: string, data: UpdateScheduleRequest) =>
    request<DoctorSchedule>(`/opd/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSchedule: (id: string) =>
    request<{ status: string }>(`/opd/schedules/${id}`, {
      method: "DELETE",
    }),

  // Schedule exceptions
  listScheduleExceptions: (params: { doctor_id: string; from?: string; to?: string }) => {
    const qs = `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`;
    return request<DoctorScheduleException[]>(`/opd/schedule-exceptions${qs}`);
  },
  createScheduleException: (data: CreateScheduleExceptionRequest) =>
    request<DoctorScheduleException>("/opd/schedule-exceptions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteScheduleException: (id: string) =>
    request<{ status: string }>(`/opd/schedule-exceptions/${id}`, {
      method: "DELETE",
    }),

  // Available slots
  getAvailableSlots: (doctorId: string, date: string) =>
    request<AvailableSlot[]>(`/opd/doctors/${doctorId}/slots?date=${date}`),

  // Appointments
  listAppointments: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<AppointmentWithPatient[]>(`/opd/appointments${qs}`);
  },
  bookAppointment: (data: BookAppointmentRequest) =>
    request<Appointment>("/opd/appointments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAppointment: (id: string) => request<Appointment>(`/opd/appointments/${id}`),
  rescheduleAppointment: (id: string, data: RescheduleAppointmentRequest) =>
    request<Appointment>(`/opd/appointments/${id}/reschedule`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  cancelAppointment: (id: string, data: CancelAppointmentRequest) =>
    request<Appointment>(`/opd/appointments/${id}/cancel`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  checkInAppointment: (id: string) =>
    request<Appointment>(`/opd/appointments/${id}/check-in`, {
      method: "PUT",
    }),
  completeAppointment: (id: string) =>
    request<Appointment>(`/opd/appointments/${id}/complete`, {
      method: "PUT",
    }),
  markAppointmentNoShow: (id: string) =>
    request<Appointment>(`/opd/appointments/${id}/no-show`, {
      method: "PUT",
    }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — OPD (extended)
  // ══════════════════════════════════════════════════════════

  opdPharmacyDispatchStatus: (visitId: string) =>
    request<PharmacyDispatchStatus[]>(`/opd/visits/${visitId}/pharmacy-status`),

  opdReferralTracking: (params?: {
    status?: string;
    addressed_to_me?: boolean;
    sent_by_me?: boolean;
  }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.addressed_to_me) sp.set("addressed_to_me", "true");
    if (params?.sent_by_me) sp.set("sent_by_me", "true");
    const qs = sp.toString();
    return request<ReferralWithNames[]>(`/opd/referrals/tracking${qs ? `?${qs}` : ""}`);
  },

  opdFollowupCompliance: () => request<FollowupComplianceRow[]>("/opd/analytics/followup"),

  /** OPD counts for a date range (YYYY-MM-DD, inclusive): tiles, by day, by doctor. */
  opdReportSummary: (from: string, to: string) =>
    checkedRequest<OpdReportResponse>(
      opdReportResponseSchema,
      `/opd/reports/summary?${new URLSearchParams({ from, to })}`,
    ),

  // ── Phase 4: Clinical Delivery Print Data ─────────────────
  /**
   * Minted when a prescription is printed. The QR on the paper carries this
   * token, never the encounter id — a raw id cannot expire or be revoked.
   */
  issuePrescriptionVerifyLink: (encounterId: string) =>
    request<{ token: string }>(`/opd/encounters/${encounterId}/verify-link`, { method: "POST" }),

  listVerbalOrders: (status?: string) =>
    request<VerbalOrderEntry[]>(
      `/opd/verbal-orders${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  /** The link the front desk hands a patient so they can follow their token. */
  getQueueTokenStatusLink: (id: string) =>
    request<PublicTokenLink>(`/opd/queue-tokens/${id}/status-link`),
  getOpdAppointmentReminderConfig: () => request<unknown>("/opd/appointments/reminder-config"),
  updateOpdAppointmentReminderConfig: (data: Record<string, unknown>) =>
    request<unknown>("/opd/appointments/reminder-config", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
