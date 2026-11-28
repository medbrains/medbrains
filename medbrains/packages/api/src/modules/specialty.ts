/** The `/specialty` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AncVisit,
  AnthracyclineCumulativeResult,
  AudiologyTest,
  BodyStatus,
  BookDialysisSlotRequest,
  CancerStaging,
  CathDevice,
  CathHemodynamic,
  CathPostMonitoring,
  CathProcedure,
  CathStemiTimeline,
  ChemoProtocol,
  CreateAncVisitRequest,
  CreateAudiologyTestRequest,
  CreateCancerStagingRequest,
  CreateCathDeviceRequest,
  CreateCathHemodynamicRequest,
  CreateCathPostMonitoringRequest,
  CreateCathProcedureRequest,
  CreateCathStemiEventRequest,
  CreateChemoProtocolRequest,
  CreateDentalChartEntryRequest,
  CreateDentalExamRequest,
  CreateDialysisResponse,
  CreateDialysisSessionRequest,
  CreateDnrOrderRequest,
  CreateEndoscopyBiopsyRequest,
  CreateEndoscopyProcedureRequest,
  CreateEndoscopyReprocessingRequest,
  CreateEndoscopyScopeRequest,
  CreateLaborRecordRequest,
  CreateMaternityRegistrationRequest,
  CreateMortuaryRecordRequest,
  CreateNewbornRecordRequest,
  CreateNewbornResponse,
  CreateNuclearMedAdminRequest,
  CreateNuclearMedSourceRequest,
  CreateOphthoExamRequest,
  CreatePainAssessmentRequest,
  CreatePostnatalRecordRequest,
  CreatePsychAdmissionRequest,
  CreatePsychAssessmentRequest,
  CreatePsychChallengeRequest,
  CreatePsychCounselingRequest,
  CreatePsychDirectiveRequest,
  CreatePsychEctRequest,
  CreatePsychMhrbRequest,
  CreatePsychometricTestRequest,
  CreatePsychPatientRequest,
  CreatePsychRepresentativeRequest,
  CreatePsychRestraintRequest,
  CreatePsychScreeningRequest,
  CreateRadiationRequest,
  CreateRehabPlanRequest,
  CreateRehabSessionRequest,
  CreateSpecialtyRecordRequest,
  CreateSpecialtyTemplateRequest,
  DecidePsychChallengeRequest,
  DeliveryType,
  DentalChartEntry,
  DentalExam,
  DentalTreatmentItem,
  DialysisMachine,
  DialysisSession,
  DialysisSlot,
  Dialyzer,
  DnrOrder,
  EndoscopyBiopsySpecimen,
  EndoscopyProcedure,
  EndoscopyReprocessing,
  EndoscopyScope,
  HbcrCoding,
  IssueDialyzerRequest,
  LaborRecord,
  MaternityRegistration,
  MortuaryRecord,
  NewbornRecord,
  NuclearMedAdministration,
  NuclearMedSource,
  OphthoExam,
  PainAssessment,
  PendingSafetyReview,
  PerioChart,
  PerioTooth,
  PlanDentalTreatmentRequest,
  PostnatalRecord,
  PsychAdmission,
  PsychAdvanceDirective,
  PsychAssessment,
  PsychCounselingSession,
  PsychDirectiveChallenge,
  PsychEctRegister,
  PsychMhrbNotification,
  PsychNominatedRepresentative,
  PsychometricTest,
  PsychPatient,
  PsychSafetyReviewRequest,
  PsychScreening,
  PsychSeclusionRestraint,
  RadiationSession,
  RegistryCase,
  RegistryCodeLists,
  RegistrySheet,
  RegistryWorklistRow,
  RehabPlan,
  RehabSession,
  ReleasePsychRestraintRequest,
  RestraintReportRow,
  SaveDialysisMachineRequest,
  ScopeStatus,
  SpecialtyRecord,
  SpecialtyTemplate,
  UpdateDentalChartEntryRequest,
  UpdateOphthoExamRequest,
  UpdatePsychMhrbRequest,
  UpdatePsychPatientRequest,
  VerifyNewbornIdentityRequest,
  VerifyNewbornIdentityResult,
} from "@medbrains/types";
import { request } from "../client.js";

export const specialtyApi = {
  listDialysisMachines: () => request<DialysisMachine[]>("/specialty/dialysis/machines"),
  saveDialysisMachine: (data: SaveDialysisMachineRequest) =>
    request<DialysisMachine>("/specialty/dialysis/machines", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDialysisReusePolicy: () => request<{ max_uses: number }>("/specialty/dialysis/reuse-policy"),
  setDialysisReusePolicy: (data: { max_uses: number }) =>
    request<{ max_uses: number }>("/specialty/dialysis/reuse-policy", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listDialysisSlots: (date: string) =>
    request<DialysisSlot[]>(`/specialty/dialysis/slots?${new URLSearchParams({ date })}`),
  bookDialysisSlot: (data: BookDialysisSlotRequest) =>
    request<DialysisSlot>("/specialty/dialysis/slots", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelDialysisSlot: (id: string) =>
    request<{ status: string }>(`/specialty/dialysis/slots/${id}/cancel`, { method: "POST" }),
  listDialyzers: (patientId: string) =>
    request<Dialyzer[]>(
      `/specialty/dialysis/dialyzers?${new URLSearchParams({ patient_id: patientId })}`,
    ),
  issueDialyzer: (data: IssueDialyzerRequest) =>
    request<Dialyzer>("/specialty/dialysis/dialyzers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reprocessDialyzer: (id: string, data: { tcv_ml: number }) =>
    request<Dialyzer>(`/specialty/dialysis/dialyzers/${id}/reprocess`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  discardDialyzer: (id: string, data: { reason: string }) =>
    request<{ status: string }>(`/specialty/dialysis/dialyzers/${id}/discard`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Specialty Clinical: Cath Lab ────────────────────────────

  // Specialty — Ophthalmology
  listOphthoExams: (params?: { patient_id?: string; encounter_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.encounter_id) sp.set("encounter_id", params.encounter_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<OphthoExam[]>(`/specialty/ophthalmology/exams${qs ? `?${qs}` : ""}`);
  },
  getOphthoExam: (id: string) => request<OphthoExam>(`/specialty/ophthalmology/exams/${id}`),
  createOphthoExam: (data: CreateOphthoExamRequest) =>
    request<OphthoExam>("/specialty/ophthalmology/exams", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOphthoExam: (id: string, data: UpdateOphthoExamRequest) =>
    request<OphthoExam>(`/specialty/ophthalmology/exams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Sign the exam; its refraction becomes the spectacle prescription. */
  signOphthoExam: (id: string) =>
    request<OphthoExam>(`/specialty/ophthalmology/exams/${id}/sign`, { method: "POST" }),

  // Specialty — Dental
  listDentalExams: (params?: { patient_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<DentalExam[]>(`/specialty/dental/exams${qs ? `?${qs}` : ""}`);
  },
  getDentalExam: (id: string) => request<DentalExam>(`/specialty/dental/exams/${id}`),
  createDentalExam: (data: CreateDentalExamRequest) =>
    request<DentalExam>("/specialty/dental/exams", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDentalExam: (
    id: string,
    data: { diagnosis?: string; treatment_plan?: string; status?: string },
  ) =>
    request<DentalExam>(`/specialty/dental/exams/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listDentalChart: (examId: string) =>
    request<DentalChartEntry[]>(`/specialty/dental/exams/${examId}/chart`),
  updateDentalChartEntry: (id: string, data: UpdateDentalChartEntryRequest) =>
    request<DentalChartEntry>(`/specialty/dental/chart/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  removeDentalChartEntry: (id: string) =>
    request<{ removed: boolean }>(`/specialty/dental/chart/${id}`, { method: "DELETE" }),
  listDentalTreatment: (examId: string) =>
    request<DentalTreatmentItem[]>(`/specialty/dental/exams/${examId}/treatment`),
  planDentalTreatment: (examId: string, data: PlanDentalTreatmentRequest) =>
    request<DentalTreatmentItem>(`/specialty/dental/exams/${examId}/treatment`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completeDentalTreatment: (id: string) =>
    request<DentalTreatmentItem>(`/specialty/dental/treatment/${id}/complete`, { method: "POST" }),
  cancelDentalTreatment: (id: string) =>
    request<DentalTreatmentItem>(`/specialty/dental/treatment/${id}/cancel`, { method: "POST" }),
  recordPerioChart: (examId: string, data: { teeth: PerioTooth[]; notes?: string | null }) =>
    request<string>(`/specialty/dental/exams/${examId}/perio`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPatientPerioCharts: (patientId: string) =>
    request<PerioChart[]>(`/specialty/dental/patients/${patientId}/perio`),
  createDentalChartEntry: (examId: string, data: CreateDentalChartEntryRequest) =>
    request<DentalChartEntry>(`/specialty/dental/exams/${examId}/chart`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Specialty — Oncology depth
  listCancerRegistry: () => request<RegistryWorklistRow[]>("/specialty/oncology/registry"),
  getRegistryCase: (stagingId: string) =>
    request<RegistryCase>(`/specialty/oncology/registry/${stagingId}`),
  saveRegistryAbstract: (stagingId: string, data: HbcrCoding) =>
    request<RegistryCase>(`/specialty/oncology/registry/${stagingId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getRegistryCodeLists: () => request<RegistryCodeLists>("/specialty/oncology/registry/codes"),
  exportRegistrySheet: () => request<RegistrySheet>("/specialty/oncology/registry/export"),
  markRegistrySubmitted: (stagingId: string, ncdirReference: string) =>
    request<RegistryCase>(`/specialty/oncology/registry/${stagingId}/submitted`, {
      method: "POST",
      body: JSON.stringify({ ncdir_reference: ncdirReference }),
    }),
  listCancerStagings: (patientId?: string) =>
    request<CancerStaging[]>(
      `/specialty/oncology/staging${patientId ? `?patient_id=${patientId}` : ""}`,
    ),
  createCancerStaging: (data: CreateCancerStagingRequest) =>
    request<CancerStaging>("/specialty/oncology/staging", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listRadiationSessions: (patientId?: string) =>
    request<RadiationSession[]>(
      `/specialty/oncology/radiation${patientId ? `?patient_id=${patientId}` : ""}`,
    ),
  createRadiationSession: (data: CreateRadiationRequest) =>
    request<RadiationSession>("/specialty/oncology/radiation", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listCathProcedures: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<CathProcedure[]>(`/specialty/cath-lab/procedures${qs ? `?${qs}` : ""}`);
  },
  getCathProcedure: (id: string) => request<CathProcedure>(`/specialty/cath-lab/procedures/${id}`),
  createCathProcedure: (data: CreateCathProcedureRequest) =>
    request<CathProcedure>("/specialty/cath-lab/procedures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCathProcedure: (id: string, data: Partial<CreateCathProcedureRequest>) =>
    request<CathProcedure>(`/specialty/cath-lab/procedures/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCathHemodynamics: (procedureId: string) =>
    request<CathHemodynamic[]>(`/specialty/cath-lab/procedures/${procedureId}/hemodynamics`),
  createCathHemodynamic: (procedureId: string, data: CreateCathHemodynamicRequest) =>
    request<CathHemodynamic>(`/specialty/cath-lab/procedures/${procedureId}/hemodynamics`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listCathDevices: (procedureId: string) =>
    request<CathDevice[]>(`/specialty/cath-lab/procedures/${procedureId}/devices`),
  createCathDevice: (procedureId: string, data: CreateCathDeviceRequest) =>
    request<CathDevice>(`/specialty/cath-lab/procedures/${procedureId}/devices`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listStemiTimeline: (procedureId: string) =>
    request<CathStemiTimeline[]>(`/specialty/cath-lab/procedures/${procedureId}/stemi-timeline`),
  createStemiEvent: (procedureId: string, data: CreateCathStemiEventRequest) =>
    request<CathStemiTimeline>(`/specialty/cath-lab/procedures/${procedureId}/stemi-timeline`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPostMonitoring: (procedureId: string) =>
    request<CathPostMonitoring[]>(`/specialty/cath-lab/procedures/${procedureId}/post-monitoring`),
  createPostMonitoring: (procedureId: string, data: CreateCathPostMonitoringRequest) =>
    request<CathPostMonitoring>(`/specialty/cath-lab/procedures/${procedureId}/post-monitoring`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Specialty Clinical: Endoscopy ───────────────────────────

  listEndoscopyProcedures: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<EndoscopyProcedure[]>(`/specialty/endoscopy/procedures${qs ? `?${qs}` : ""}`);
  },
  createEndoscopyProcedure: (data: CreateEndoscopyProcedureRequest) =>
    request<EndoscopyProcedure>("/specialty/endoscopy/procedures", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEndoscopyProcedure: (id: string, data: Partial<CreateEndoscopyProcedureRequest>) =>
    request<EndoscopyProcedure>(`/specialty/endoscopy/procedures/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listEndoscopyScopes: (params?: { status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<EndoscopyScope[]>(`/specialty/endoscopy/scopes${qs ? `?${qs}` : ""}`);
  },
  createEndoscopyScope: (data: CreateEndoscopyScopeRequest) =>
    request<EndoscopyScope>("/specialty/endoscopy/scopes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEndoscopyScope: (
    id: string,
    data: Partial<CreateEndoscopyScopeRequest> & { status?: ScopeStatus },
  ) =>
    request<EndoscopyScope>(`/specialty/endoscopy/scopes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listEndoscopyReprocessing: (params?: { scope_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.scope_id) sp.set("scope_id", params.scope_id);
    const qs = sp.toString();
    return request<EndoscopyReprocessing[]>(
      `/specialty/endoscopy/reprocessing${qs ? `?${qs}` : ""}`,
    );
  },
  createEndoscopyReprocessing: (data: CreateEndoscopyReprocessingRequest) =>
    request<EndoscopyReprocessing>("/specialty/endoscopy/reprocessing", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listBiopsySpecimens: (procedureId: string) =>
    request<EndoscopyBiopsySpecimen[]>(`/specialty/endoscopy/procedures/${procedureId}/biopsies`),
  createBiopsySpecimen: (procedureId: string, data: CreateEndoscopyBiopsyRequest) =>
    request<EndoscopyBiopsySpecimen>(`/specialty/endoscopy/procedures/${procedureId}/biopsies`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Specialty Clinical: Psychiatry ──────────────────────────

  listPsychPatients: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<PsychPatient[]>(`/specialty/psychiatry/patients${qs ? `?${qs}` : ""}`);
  },
  getPsychPatient: (id: string) => request<PsychPatient>(`/specialty/psychiatry/patients/${id}`),
  createPsychPatient: (data: CreatePsychPatientRequest) =>
    request<PsychPatient>("/specialty/psychiatry/patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePsychPatient: (id: string, data: UpdatePsychPatientRequest) =>
    request<PsychPatient>(`/specialty/psychiatry/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listPsychAssessments: (patientId: string) =>
    request<PsychAssessment[]>(`/specialty/psychiatry/patients/${patientId}/assessments`),
  createPsychAssessment: (patientId: string, data: CreatePsychAssessmentRequest) =>
    request<PsychAssessment>(`/specialty/psychiatry/patients/${patientId}/assessments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listEctSessions: (patientId: string) =>
    request<PsychEctRegister[]>(`/specialty/psychiatry/patients/${patientId}/ect`),
  createEctSession: (patientId: string, data: CreatePsychEctRequest) =>
    request<PsychEctRegister>(`/specialty/psychiatry/patients/${patientId}/ect`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listRestraints: (patientId: string) =>
    request<PsychSeclusionRestraint[]>(`/specialty/psychiatry/patients/${patientId}/restraints`),
  createRestraint: (patientId: string, data: CreatePsychRestraintRequest) =>
    request<PsychSeclusionRestraint>(`/specialty/psychiatry/patients/${patientId}/restraints`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // The handler takes a JSON body; sending none answered 415 and the release
  // button never worked.
  releaseRestraint: (id: string, data: ReleasePsychRestraintRequest = {}) =>
    request<PsychSeclusionRestraint>(`/specialty/psychiatry/restraints/${id}/release`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listMhrbNotifications: (patientId: string) =>
    request<PsychMhrbNotification[]>(`/specialty/psychiatry/patients/${patientId}/mhrb`),
  createMhrbNotification: (patientId: string, data: CreatePsychMhrbRequest) =>
    request<PsychMhrbNotification>(`/specialty/psychiatry/patients/${patientId}/mhrb`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMhrbNotification: (id: string, data: UpdatePsychMhrbRequest) =>
    request<PsychMhrbNotification>(`/specialty/psychiatry/mhrb/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCounselingSessions: (patientId: string) =>
    request<PsychCounselingSession[]>(`/specialty/psychiatry/patients/${patientId}/counseling`),
  createCounselingSession: (patientId: string, data: CreatePsychCounselingRequest) =>
    request<PsychCounselingSession>(`/specialty/psychiatry/patients/${patientId}/counseling`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listPsychAdmissions: (psychPatientId: string) =>
    request<PsychAdmission[]>(`/specialty/psychiatry/patients/${psychPatientId}/admissions`),
  createPsychAdmission: (psychPatientId: string, data: CreatePsychAdmissionRequest) =>
    request<PsychAdmission>(`/specialty/psychiatry/patients/${psychPatientId}/admissions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  dischargePsychAdmission: (id: string, data: { note?: string }) =>
    request<PsychAdmission>(`/specialty/psychiatry/admissions/${id}/discharge`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reportPsychAdmissionToBoard: (id: string, data: { reference_number?: string }) =>
    request<PsychAdmission>(`/specialty/psychiatry/admissions/${id}/board-report`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  recordPsychBoardDecision: (
    id: string,
    data: { decision: "permitted" | "discharge_ordered"; reference_number?: string },
  ) =>
    request<PsychAdmission>(`/specialty/psychiatry/admissions/${id}/board-decision`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPsychRepresentatives: (psychPatientId: string) =>
    request<PsychNominatedRepresentative[]>(
      `/specialty/psychiatry/patients/${psychPatientId}/nominated-representatives`,
    ),
  createPsychRepresentative: (psychPatientId: string, data: CreatePsychRepresentativeRequest) =>
    request<PsychNominatedRepresentative>(
      `/specialty/psychiatry/patients/${psychPatientId}/nominated-representatives`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  revokePsychRepresentative: (id: string, data: { reason?: string }) =>
    request<PsychNominatedRepresentative>(
      `/specialty/psychiatry/nominated-representatives/${id}/revoke`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  listPsychDirectives: (psychPatientId: string) =>
    request<PsychAdvanceDirective[]>(
      `/specialty/psychiatry/patients/${psychPatientId}/advance-directives`,
    ),
  createPsychDirective: (psychPatientId: string, data: CreatePsychDirectiveRequest) =>
    request<PsychAdvanceDirective>(
      `/specialty/psychiatry/patients/${psychPatientId}/advance-directives`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  revokePsychDirective: (id: string) =>
    request<PsychAdvanceDirective>(`/specialty/psychiatry/advance-directives/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  createPsychChallenge: (directiveId: string, data: CreatePsychChallengeRequest) =>
    request<PsychDirectiveChallenge>(
      `/specialty/psychiatry/advance-directives/${directiveId}/challenges`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  listPsychChallenges: (psychPatientId: string) =>
    request<PsychDirectiveChallenge[]>(
      `/specialty/psychiatry/patients/${psychPatientId}/directive-challenges`,
    ),
  decidePsychChallenge: (id: string, data: DecidePsychChallengeRequest) =>
    request<PsychDirectiveChallenge>(`/specialty/psychiatry/directive-challenges/${id}/decision`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPsychScreenings: (psychPatientId: string) =>
    request<PsychScreening[]>(`/specialty/psychiatry/patients/${psychPatientId}/screenings`),
  createPsychScreening: (psychPatientId: string, data: CreatePsychScreeningRequest) =>
    request<PsychScreening>(`/specialty/psychiatry/patients/${psychPatientId}/screenings`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completePsychSafetyReview: (id: string, data: PsychSafetyReviewRequest) =>
    request<PsychScreening>(`/specialty/psychiatry/screenings/${id}/safety-review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPendingSafetyReviews: () =>
    request<PendingSafetyReview[]>("/specialty/psychiatry/safety-reviews/pending"),
  markRestraintRepInformed: (id: string) =>
    request<{ informed: boolean }>(
      `/specialty/psychiatry/restraints/${id}/nominated-rep-informed`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  getRestraintReport: (month: string) =>
    request<RestraintReportRow[]>(
      `/specialty/psychiatry/restraint-report?month=${encodeURIComponent(month)}`,
    ),
  setPsychAbdmConsent: (psychPatientId: string, consented: boolean) =>
    request<PsychPatient>(`/specialty/psychiatry/patients/${psychPatientId}/abdm-consent`, {
      method: "PUT",
      body: JSON.stringify({ consented }),
    }),

  // ── Specialty Clinical: Maternity ───────────────────────────

  listMaternityRegistrations: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<MaternityRegistration[]>(
      `/specialty/maternity/registrations${qs ? `?${qs}` : ""}`,
    );
  },
  getMaternityRegistration: (id: string) =>
    request<MaternityRegistration>(`/specialty/maternity/registrations/${id}`),
  createMaternityRegistration: (data: CreateMaternityRegistrationRequest) =>
    request<MaternityRegistration>("/specialty/maternity/registrations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listAncVisits: (registrationId: string) =>
    request<AncVisit[]>(`/specialty/maternity/registrations/${registrationId}/anc`),
  createAncVisit: (registrationId: string, data: CreateAncVisitRequest) =>
    request<AncVisit>(`/specialty/maternity/registrations/${registrationId}/anc`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listLaborRecords: (registrationId: string) =>
    request<LaborRecord[]>(`/specialty/maternity/registrations/${registrationId}/labor`),
  createLaborRecord: (registrationId: string, data: CreateLaborRecordRequest) =>
    request<LaborRecord>(`/specialty/maternity/registrations/${registrationId}/labor`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLaborRecord: (
    id: string,
    data: Partial<CreateLaborRecordRequest> & {
      delivery_type?: DeliveryType;
      apgar_1min?: number;
      apgar_5min?: number;
      baby_weight_gm?: number;
    },
  ) =>
    request<LaborRecord>(`/specialty/maternity/labor/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listNewborns: (laborId: string) =>
    request<NewbornRecord[]>(`/specialty/maternity/labor/${laborId}/newborns`),
  createNewborn: (laborId: string, data: CreateNewbornRecordRequest) =>
    request<CreateNewbornResponse>(`/specialty/maternity/labor/${laborId}/newborns`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyNewbornIdentity: (newbornId: string, data: VerifyNewbornIdentityRequest) =>
    request<VerifyNewbornIdentityResult>(
      `/specialty/maternity/newborns/${newbornId}/verify-identity`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  listPostnatalRecords: (registrationId: string) =>
    request<PostnatalRecord[]>(`/specialty/maternity/registrations/${registrationId}/postnatal`),
  createPostnatalRecord: (registrationId: string, data: CreatePostnatalRecordRequest) =>
    request<PostnatalRecord>(`/specialty/maternity/registrations/${registrationId}/postnatal`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Specialty Clinical: PMR / Audiology ─────────────────────

  listRehabPlans: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<RehabPlan[]>(`/specialty/pmr/rehab-plans${qs ? `?${qs}` : ""}`);
  },
  createRehabPlan: (data: CreateRehabPlanRequest) =>
    request<RehabPlan>("/specialty/pmr/rehab-plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listRehabSessions: (planId: string) =>
    request<RehabSession[]>(`/specialty/pmr/rehab-plans/${planId}/sessions`),
  createRehabSession: (planId: string, data: CreateRehabSessionRequest) =>
    request<RehabSession>(`/specialty/pmr/rehab-plans/${planId}/sessions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listAudiologyTests: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<AudiologyTest[]>(`/specialty/pmr/audiology${qs ? `?${qs}` : ""}`);
  },
  createAudiologyTest: (data: CreateAudiologyTestRequest) =>
    request<AudiologyTest>("/specialty/pmr/audiology", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPsychometricTests: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<PsychometricTest[]>(`/specialty/pmr/psychometric${qs ? `?${qs}` : ""}`);
  },
  createPsychometricTest: (data: CreatePsychometricTestRequest) =>
    request<PsychometricTest>("/specialty/pmr/psychometric", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Specialty Clinical: Palliative / Mortuary / Nuclear Med ──

  listDnrOrders: (params?: { patient_id?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<DnrOrder[]>(`/specialty/palliative/dnr${qs ? `?${qs}` : ""}`);
  },
  createDnrOrder: (data: CreateDnrOrderRequest) =>
    request<DnrOrder>("/specialty/palliative/dnr", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  revokeDnrOrder: (id: string) =>
    request<DnrOrder>(`/specialty/palliative/dnr/${id}/revoke`, {
      method: "PUT",
    }),
  listPainAssessments: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<PainAssessment[]>(`/specialty/palliative/pain${qs ? `?${qs}` : ""}`);
  },
  createPainAssessment: (data: CreatePainAssessmentRequest) =>
    request<PainAssessment>("/specialty/palliative/pain", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listMortuaryRecords: (params?: { status?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<MortuaryRecord[]>(`/specialty/mortuary/records${qs ? `?${qs}` : ""}`);
  },
  createMortuaryRecord: (data: CreateMortuaryRecordRequest) =>
    request<MortuaryRecord>("/specialty/mortuary/records", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMortuaryRecord: (
    id: string,
    data: Partial<CreateMortuaryRecordRequest> & {
      status?: BodyStatus;
      pm_requested?: boolean;
      pm_conducted_by?: string;
      pm_date?: string;
      pm_findings?: string;
    },
  ) =>
    request<MortuaryRecord>(`/specialty/mortuary/records/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listNuclearSources: () => request<NuclearMedSource[]>("/specialty/nuclear-med/sources"),
  createNuclearSource: (data: CreateNuclearMedSourceRequest) =>
    request<NuclearMedSource>("/specialty/nuclear-med/sources", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listNuclearAdministrations: (params?: { patient_id?: string; source_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.source_id) sp.set("source_id", params.source_id);
    const qs = sp.toString();
    return request<NuclearMedAdministration[]>(
      `/specialty/nuclear-med/administrations${qs ? `?${qs}` : ""}`,
    );
  },
  createNuclearAdministration: (data: CreateNuclearMedAdminRequest) =>
    request<NuclearMedAdministration>("/specialty/nuclear-med/administrations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Specialty Clinical: Other Specialties ───────────────────

  listSpecialtyTemplates: (params?: { specialty?: string }) => {
    const sp = new URLSearchParams();
    if (params?.specialty) sp.set("specialty", params.specialty);
    const qs = sp.toString();
    return request<SpecialtyTemplate[]>(`/specialty/templates${qs ? `?${qs}` : ""}`);
  },
  createSpecialtyTemplate: (data: CreateSpecialtyTemplateRequest) =>
    request<SpecialtyTemplate>("/specialty/templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listSpecialtyRecords: (params?: { patient_id?: string; specialty?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    if (params?.specialty) sp.set("specialty", params.specialty);
    const qs = sp.toString();
    return request<SpecialtyRecord[]>(`/specialty/records${qs ? `?${qs}` : ""}`);
  },
  createSpecialtyRecord: (data: CreateSpecialtyRecordRequest) =>
    request<SpecialtyRecord>("/specialty/records", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listDialysisSessions: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<DialysisSession[]>(`/specialty/dialysis/sessions${qs ? `?${qs}` : ""}`);
  },
  createDialysisSession: (data: CreateDialysisSessionRequest) =>
    request<CreateDialysisResponse>("/specialty/dialysis/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDialysisSession: (
    id: string,
    data: Partial<CreateDialysisSessionRequest> & {
      post_weight_kg?: number;
      uf_achieved_ml?: number;
      post_vitals?: Record<string, unknown>;
      kt_v?: number;
      urr_pct?: number;
    },
  ) =>
    request<DialysisSession>(`/specialty/dialysis/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listChemoProtocols: (params?: { patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<ChemoProtocol[]>(`/specialty/chemo/protocols${qs ? `?${qs}` : ""}`);
  },
  createChemoProtocol: (data: CreateChemoProtocolRequest) =>
    request<ChemoProtocol>("/specialty/chemo/protocols", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  anthracyclineCumulative: (patientId: string, agent: string) =>
    request<AnthracyclineCumulativeResult>(
      `/specialty/chemo/anthracycline-cumulative?patient_id=${patientId}&agent=${encodeURIComponent(agent)}`,
    ),
  updateChemoProtocol: (id: string, data: Partial<CreateChemoProtocolRequest>) =>
    request<ChemoProtocol>(`/specialty/chemo/protocols/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
