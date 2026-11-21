/** The `/ipd` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  Admission,
  AdmissionAttender,
  AdmissionChecklist,
  AdmissionDetailResponse,
  AdmissionListResponse,
  AdmissionPrintData,
  AlosRow,
  AssignBedToWardRequest,
  AvailableBed,
  BedDashboardRow,
  BedDashboardSummary,
  BedReservation,
  BedsideTransfusion,
  BedTransferRequest,
  BedTransferResponse,
  BedTurnaroundLog,
  BillingSummaryResponse,
  CensusWardRow,
  CompleteBedsideTransfusionRequest,
  CreateAdmissionRequest,
  CreateAdmissionResponse,
  CreateAssessmentRequest,
  CreateAttenderRequest,
  CreateBedReservationRequest,
  CreateBedTurnaroundRequest,
  CreateBirthRecordRequest,
  CreateCarePlanRequest,
  CreateChecklistItemsRequest,
  CreateClinicalDocRequest,
  CreateDeathSummaryRequest,
  CreateDischargeSummaryRequest,
  CreateDischargeTemplateRequest,
  CreateHandoverRequest,
  CreateInfusionInput,
  CreateIntakeOutputRequest,
  CreateIpTypeRequest,
  CreateMarRequest,
  CreateNursingAssessmentRequest,
  CreateNursingTaskRequest,
  CreateRestraintCheckRequest,
  CreateTransferRequest,
  CreateWardRequest,
  DietOrder,
  DischargeRequest,
  DischargeStatRow,
  DischargeSummary,
  DischargeSummaryTemplate,
  EstimatedCostResponse,
  ExpectedDischargeRow,
  InitDischargeTatRequest,
  InvestigationsResponse,
  IoBalanceResponse,
  IpdBirthRecord,
  IpdCarePlan,
  IpdClinicalAssessment,
  IpdClinicalDocumentation,
  IpdDamaRecord,
  IpdDamaRequest,
  IpdDeathSummary,
  IpdDischargeChecklist,
  IpdDischargeStepUpdate,
  IpdDischargeSummary,
  IpdDischargeTatLog,
  IpdDischargeWorkflow,
  IpdHandoverReport,
  IpdIntakeOutput,
  IpdMedicationAdministration,
  IpdMortalityCreate,
  IpdMortalityReview,
  IpdMortalitySubmit,
  IpdNoDuesCertificate,
  IpdNursingAssessment,
  IpdPostDischargeRow,
  IpdTransferLog,
  IpTypeConfiguration,
  IvFluidOrder,
  LinkMlcRequest,
  MarListRow,
  MlcCase,
  NursingTask,
  OccupancyRow,
  PriorAuthRequestRow,
  ProcedureConsent,
  Receipt,
  RestraintMonitoringLog,
  RoomCheck,
  StartBedsideTransfusionRequest,
  ToggleChecklistItemRequest,
  TransferBedRequest,
  UpdateAdmissionRequest,
  UpdateBedReservationStatusRequest,
  UpdateBedStatusRequest,
  UpdateBirthRecordRequest,
  UpdateCarePlanRequest,
  UpdateClinicalDocRequest,
  UpdateDeathSummaryRequest,
  UpdateDischargeChecklistRequest,
  UpdateDischargeSummaryRequest,
  UpdateDischargeTatRequest,
  UpdateInfusionInput,
  UpdateIpTypeRequest,
  UpdateMarRequest,
  UpdateNursingTaskRequest,
  UpdateWardRequest,
  Ward,
  WardBedMapping,
  WardBedRow,
  WardListRow,
  WardOnDutyRow,
} from "@medbrains/types";
import { request } from "../client.js";

export const ipdApi = {
  // ── Available Beds ────────────────────────────────────
  listAvailableBeds: (params?: { ward_id?: string }) => {
    const qs = params?.ward_id ? `?ward_id=${params.ward_id}` : "";
    return request<AvailableBed[]>(`/ipd/beds/available${qs}`);
  },

  // ── IPD ───────────────────────────────────────────────

  listAdmissions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<AdmissionListResponse>(`/ipd/admissions${qs}`);
  },
  /** The bed's rate against the patient's policy room-rent limit, before allocating it. */
  checkRoomEligibility: (params: { patient_id: string; bed_id: string; admission_id?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
    );
    return request<RoomCheck>(`/ipd/room-eligibility?${qs}`);
  },
  createAdmission: (data: CreateAdmissionRequest) =>
    request<CreateAdmissionResponse>("/ipd/admissions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAdmission: (id: string) => request<AdmissionDetailResponse>(`/ipd/admissions/${id}`),
  updateAdmission: (id: string, data: UpdateAdmissionRequest) =>
    request<Admission>(`/ipd/admissions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  transferBed: (id: string, data: TransferBedRequest) =>
    request<Admission>(`/ipd/admissions/${id}/transfer`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  dischargePatient: (id: string, data: DischargeRequest) =>
    request<Admission>(`/ipd/admissions/${id}/discharge`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listNursingTasks: (admissionId: string) =>
    request<NursingTask[]>(`/ipd/admissions/${admissionId}/tasks`),
  createNursingTask: (admissionId: string, data: CreateNursingTaskRequest) =>
    request<NursingTask>(`/ipd/admissions/${admissionId}/tasks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNursingTask: (admissionId: string, taskId: string, data: UpdateNursingTaskRequest) =>
    request<NursingTask>(`/ipd/admissions/${admissionId}/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── IPD Clinical Expansion ────────────────────────────────

  // Progress Notes

  // Clinical Assessments
  listAssessments: (admissionId: string) =>
    request<IpdClinicalAssessment[]>(`/ipd/admissions/${admissionId}/assessments`),
  createAssessment: (admissionId: string, data: CreateAssessmentRequest) =>
    request<IpdClinicalAssessment>(`/ipd/admissions/${admissionId}/assessments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // MAR (Medication Administration Record)
  listMar: (admissionId: string) => request<MarListRow[]>(`/ipd/admissions/${admissionId}/mar`),
  createMar: (admissionId: string, data: CreateMarRequest) =>
    request<IpdMedicationAdministration>(`/ipd/admissions/${admissionId}/mar`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMar: (admissionId: string, marId: string, data: UpdateMarRequest) =>
    request<IpdMedicationAdministration>(`/ipd/admissions/${admissionId}/mar/${marId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // I/O Chart
  listIntakeOutput: (admissionId: string) =>
    request<IpdIntakeOutput[]>(`/ipd/admissions/${admissionId}/io`),
  createIntakeOutput: (admissionId: string, data: CreateIntakeOutputRequest) =>
    request<IpdIntakeOutput>(`/ipd/admissions/${admissionId}/io`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getIoBalance: (admissionId: string) =>
    request<IoBalanceResponse>(`/ipd/admissions/${admissionId}/io/balance`),
  listInfusions: (admissionId: string) =>
    request<IvFluidOrder[]>(`/ipd/admissions/${admissionId}/infusions`),
  createInfusion: (admissionId: string, data: CreateInfusionInput) =>
    request<IvFluidOrder>(`/ipd/admissions/${admissionId}/infusions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateInfusion: (admissionId: string, infusionId: string, data: UpdateInfusionInput) =>
    request<IvFluidOrder>(`/ipd/admissions/${admissionId}/infusions/${infusionId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listBedsideTransfusions: (admissionId: string) =>
    request<BedsideTransfusion[]>(`/ipd/admissions/${admissionId}/transfusions`),
  startBedsideTransfusion: (admissionId: string, data: StartBedsideTransfusionRequest) =>
    request<BedsideTransfusion>(`/ipd/admissions/${admissionId}/transfusions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completeBedsideTransfusion: (id: string, data: CompleteBedsideTransfusionRequest) =>
    request<BedsideTransfusion>(`/ipd/transfusions/${id}/complete`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Nursing Assessment
  listNursingAssessments: (admissionId: string) =>
    request<IpdNursingAssessment[]>(`/ipd/admissions/${admissionId}/nursing-assessments`),
  createNursingAssessment: (admissionId: string, data: CreateNursingAssessmentRequest) =>
    request<IpdNursingAssessment>(`/ipd/admissions/${admissionId}/nursing-assessments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNursingAssessment: (
    admissionId: string,
    assessId: string,
    data: CreateNursingAssessmentRequest,
  ) =>
    request<IpdNursingAssessment>(
      `/ipd/admissions/${admissionId}/nursing-assessments/${assessId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    ),

  // Care Plans
  listCarePlans: (admissionId: string) =>
    request<IpdCarePlan[]>(`/ipd/admissions/${admissionId}/care-plans`),
  createCarePlan: (admissionId: string, data: CreateCarePlanRequest) =>
    request<IpdCarePlan>(`/ipd/admissions/${admissionId}/care-plans`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCarePlan: (admissionId: string, planId: string, data: UpdateCarePlanRequest) =>
    request<IpdCarePlan>(`/ipd/admissions/${admissionId}/care-plans/${planId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Handover Reports
  listHandovers: (admissionId: string) =>
    request<IpdHandoverReport[]>(`/ipd/admissions/${admissionId}/handovers`),
  createHandover: (admissionId: string, data: CreateHandoverRequest) =>
    request<IpdHandoverReport>(`/ipd/admissions/${admissionId}/handovers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  acknowledgeHandover: (admissionId: string, handoverId: string) =>
    request<IpdHandoverReport>(
      `/ipd/admissions/${admissionId}/handovers/${handoverId}/acknowledge`,
      {
        method: "PUT",
      },
    ),

  // Discharge Checklist
  listDischargeChecklist: (admissionId: string) =>
    request<IpdDischargeChecklist[]>(`/ipd/admissions/${admissionId}/discharge-checklist`),
  initDischargeChecklist: (admissionId: string) =>
    request<IpdDischargeChecklist[]>(`/ipd/admissions/${admissionId}/discharge-checklist`, {
      method: "POST",
    }),
  updateDischargeChecklistItem: (
    admissionId: string,
    itemId: string,
    data: UpdateDischargeChecklistRequest,
  ) =>
    request<IpdDischargeChecklist>(`/ipd/admissions/${admissionId}/discharge-checklist/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── IPD Phase 2 — Wards ──────────────────────────────────

  listWards: () => request<WardListRow[]>("/ipd/wards"),

  wardOnDuty: (wardId: string) => request<WardOnDutyRow[]>(`/ipd/wards/${wardId}/on-duty`),
  getWard: (id: string) => request<Ward>(`/ipd/wards/${id}`),
  createWard: (data: CreateWardRequest) =>
    request<Ward>("/ipd/wards", { method: "POST", body: JSON.stringify(data) }),
  updateWard: (id: string, data: UpdateWardRequest) =>
    request<Ward>(`/ipd/wards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  listWardBeds: (wardId: string) => request<WardBedRow[]>(`/ipd/wards/${wardId}/beds`),
  assignBedToWard: (wardId: string, data: AssignBedToWardRequest) =>
    request<WardBedMapping>(`/ipd/wards/${wardId}/beds`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateWardBed: (wardId: string, mappingId: string, data: { bed_type_id: string | null }) =>
    request<WardBedMapping>(`/ipd/wards/${wardId}/beds/${mappingId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  removeBedFromWard: (wardId: string, mappingId: string) =>
    request<{ message: string }>(`/ipd/wards/${wardId}/beds/${mappingId}`, {
      method: "DELETE",
    }),

  // IPD Phase 2 — Bed Dashboard
  bedDashboardSummary: () => request<BedDashboardSummary[]>("/ipd/bed-dashboard"),
  bedDashboardBeds: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<BedDashboardRow[]>(`/ipd/bed-dashboard/beds${qs}`);
  },
  updateBedStatus: (bedId: string, data: UpdateBedStatusRequest) =>
    request<{ message: string }>(`/ipd/bed-dashboard/beds/${bedId}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // IPD Phase 2 — Attenders
  listAttenders: (admissionId: string) =>
    request<AdmissionAttender[]>(`/ipd/admissions/${admissionId}/attenders`),
  createAttender: (admissionId: string, data: CreateAttenderRequest) =>
    request<AdmissionAttender>(`/ipd/admissions/${admissionId}/attenders`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteAttender: (admissionId: string, attenderId: string) =>
    request<{ message: string }>(`/ipd/admissions/${admissionId}/attenders/${attenderId}`, {
      method: "DELETE",
    }),

  // IPD Phase 2 — Discharge Summary
  listDischargeTemplates: () => request<DischargeSummaryTemplate[]>("/ipd/discharge-templates"),
  createDischargeTemplate: (data: CreateDischargeTemplateRequest) =>
    request<DischargeSummaryTemplate>("/ipd/discharge-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDischargeSummary: (admissionId: string) =>
    request<IpdDischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary`),
  createDischargeSummary: (admissionId: string, data: CreateDischargeSummaryRequest) =>
    request<IpdDischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateDischargeSummary: (admissionId: string, data: UpdateDischargeSummaryRequest) =>
    request<IpdDischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  finalizeDischargeSummary: (admissionId: string) =>
    request<IpdDischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary/finalize`, {
      method: "POST",
    }),
  getNoDuesCertificate: (admissionId: string) =>
    request<IpdNoDuesCertificate | null>(`/ipd/admissions/${admissionId}/no-dues-certificate`),
  issueNoDuesCertificate: (admissionId: string, data: { notes?: string }) =>
    request<IpdNoDuesCertificate>(`/ipd/admissions/${admissionId}/no-dues-certificate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // IPD Phase 2 — Reports
  reportCensus: () => request<CensusWardRow[]>("/ipd/reports/census"),
  reportOccupancy: (params: Record<string, string>) => {
    const qs = `?${new URLSearchParams(params)}`;
    return request<OccupancyRow[]>(`/ipd/reports/occupancy${qs}`);
  },
  reportAlos: (params: Record<string, string>) => {
    const qs = `?${new URLSearchParams(params)}`;
    return request<AlosRow[]>(`/ipd/reports/alos${qs}`);
  },
  reportDischargeStats: (params: Record<string, string>) => {
    const qs = `?${new URLSearchParams(params)}`;
    return request<DischargeStatRow[]>(`/ipd/reports/discharge-stats${qs}`);
  },

  // ── IPD Phase 2b ──────────────────────────────────────────

  // IP Type Configuration
  listIpTypes: () => request<IpTypeConfiguration[]>("/ipd/ip-types"),

  createIpType: (data: CreateIpTypeRequest) =>
    request<IpTypeConfiguration>("/ipd/ip-types", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateIpType: (id: string, data: UpdateIpTypeRequest) =>
    request<IpTypeConfiguration>(`/ipd/ip-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Admission Checklists
  listAdmissionChecklist: (admissionId: string) =>
    request<AdmissionChecklist[]>(`/ipd/admissions/${admissionId}/checklist`),

  createAdmissionChecklist: (admissionId: string, data: CreateChecklistItemsRequest) =>
    request<AdmissionChecklist[]>(`/ipd/admissions/${admissionId}/checklist`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  toggleChecklistItem: (admissionId: string, itemId: string, data: ToggleChecklistItemRequest) =>
    request<AdmissionChecklist>(`/ipd/admissions/${admissionId}/checklist/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Bed Reservations
  listBedReservations: (params?: { status?: string; bed_id?: string; patient_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.bed_id) sp.set("bed_id", params.bed_id);
    if (params?.patient_id) sp.set("patient_id", params.patient_id);
    const qs = sp.toString();
    return request<BedReservation[]>(`/ipd/bed-reservations${qs ? `?${qs}` : ""}`);
  },

  createBedReservation: (data: CreateBedReservationRequest) =>
    request<BedReservation>("/ipd/bed-reservations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBedReservationStatus: (id: string, data: UpdateBedReservationStatusRequest) =>
    request<BedReservation>(`/ipd/bed-reservations/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listBedReservationsForBed: (bedId: string) =>
    request<BedReservation[]>(`/ipd/beds/${bedId}/reservations`),

  // Bed Turnaround
  listBedTurnaround: (params?: { from?: string; to?: string }) => {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    const qs = sp.toString();
    return request<BedTurnaroundLog[]>(`/ipd/bed-turnaround${qs ? `?${qs}` : ""}`);
  },

  createBedTurnaround: (data: CreateBedTurnaroundRequest) =>
    request<BedTurnaroundLog>("/ipd/bed-turnaround", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  completeBedTurnaround: (id: string) =>
    request<BedTurnaroundLog>(`/ipd/bed-turnaround/${id}/complete`, {
      method: "POST",
    }),

  // Clinical Documentation
  listClinicalDocs: (admissionId: string, params?: { doc_type?: string }) => {
    const sp = new URLSearchParams();
    if (params?.doc_type) sp.set("doc_type", params.doc_type);
    const qs = sp.toString();
    return request<IpdClinicalDocumentation[]>(
      `/ipd/admissions/${admissionId}/clinical-docs${qs ? `?${qs}` : ""}`,
    );
  },

  createClinicalDoc: (admissionId: string, data: CreateClinicalDocRequest) =>
    request<IpdClinicalDocumentation>(`/ipd/admissions/${admissionId}/clinical-docs`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateClinicalDoc: (admissionId: string, docId: string, data: UpdateClinicalDocRequest) =>
    request<IpdClinicalDocumentation>(`/ipd/admissions/${admissionId}/clinical-docs/${docId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  resolveClinicalDoc: (admissionId: string, docId: string) =>
    request<IpdClinicalDocumentation>(
      `/ipd/admissions/${admissionId}/clinical-docs/${docId}/resolve`,
      {
        method: "POST",
      },
    ),

  // Restraint Monitoring
  listRestraintChecks: (admissionId: string, docId: string) =>
    request<RestraintMonitoringLog[]>(`/ipd/admissions/${admissionId}/restraint-checks/${docId}`),

  createRestraintCheck: (admissionId: string, data: CreateRestraintCheckRequest) =>
    request<RestraintMonitoringLog>(`/ipd/admissions/${admissionId}/restraint-checks`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Transfers
  listTransfers: (admissionId: string) =>
    request<IpdTransferLog[]>(`/ipd/admissions/${admissionId}/transfers`),

  createTransfer: (admissionId: string, data: CreateTransferRequest) =>
    request<IpdTransferLog>(`/ipd/admissions/${admissionId}/transfers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Death Summary
  getDeathSummary: (admissionId: string) =>
    request<IpdDeathSummary>(`/ipd/admissions/${admissionId}/death-summary`),

  createDeathSummary: (admissionId: string, data: CreateDeathSummaryRequest) =>
    request<IpdDeathSummary>(`/ipd/admissions/${admissionId}/death-summary`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDeathSummary: (admissionId: string, data: UpdateDeathSummaryRequest) =>
    request<IpdDeathSummary>(`/ipd/admissions/${admissionId}/death-summary`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Birth Records
  listBirthRecords: (admissionId: string) =>
    request<IpdBirthRecord[]>(`/ipd/admissions/${admissionId}/birth-records`),

  createBirthRecord: (admissionId: string, data: CreateBirthRecordRequest) =>
    request<IpdBirthRecord>(`/ipd/admissions/${admissionId}/birth-records`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateBirthRecord: (admissionId: string, recId: string, data: UpdateBirthRecordRequest) =>
    request<IpdBirthRecord>(`/ipd/admissions/${admissionId}/birth-records/${recId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Discharge TAT
  getDischargeTat: (admissionId: string) =>
    request<IpdDischargeTatLog>(`/ipd/admissions/${admissionId}/discharge-tat`),

  initiateDischargeTat: (admissionId: string, data?: InitDischargeTatRequest) =>
    request<IpdDischargeTatLog>(`/ipd/admissions/${admissionId}/discharge-tat`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  updateDischargeTat: (admissionId: string, data: UpdateDischargeTatRequest) =>
    request<IpdDischargeTatLog>(`/ipd/admissions/${admissionId}/discharge-tat`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // IPD Phase 3a — Cross-module reads
  getAdmissionInvestigations: (admissionId: string) =>
    request<InvestigationsResponse>(`/ipd/admissions/${admissionId}/investigations`),

  getEstimatedCost: (admissionId: string) =>
    request<EstimatedCostResponse>(`/ipd/admissions/${admissionId}/estimated-cost`),

  getAdmissionAdvances: (admissionId: string) =>
    request<Receipt[]>(`/ipd/admissions/${admissionId}/advances`),

  getAdmissionPriorAuth: (admissionId: string) =>
    request<PriorAuthRequestRow[]>(`/ipd/admissions/${admissionId}/prior-auth`),

  linkMlc: (admissionId: string, data: LinkMlcRequest) =>
    request<Admission>(`/ipd/admissions/${admissionId}/mlc`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getAdmissionMlc: (admissionId: string) =>
    request<MlcCase | null>(`/ipd/admissions/${admissionId}/mlc`),

  getAdmissionBillingSummary: (admissionId: string) =>
    request<BillingSummaryResponse>(`/ipd/admissions/${admissionId}/billing-summary`),

  getAdmissionPrintData: (admissionId: string, params?: { reprintReason?: string }) => {
    const sp = new URLSearchParams();
    if (params?.reprintReason) sp.set("reprint_reason", params.reprintReason);
    const qs = sp.toString();
    return request<AdmissionPrintData>(`/ipd/admissions/${admissionId}/print${qs ? `?${qs}` : ""}`);
  },

  getAdmissionDietOrders: (admissionId: string) =>
    request<DietOrder[]>(`/ipd/admissions/${admissionId}/diet-orders`),

  getAdmissionConsents: (admissionId: string) =>
    request<ProcedureConsent[]>(`/ipd/admissions/${admissionId}/consents`),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — IPD (extended)
  // ══════════════════════════════════════════════════════════

  generateDischargeSummary: (admissionId: string) =>
    request<DischargeSummary>(`/ipd/admissions/${admissionId}/discharge-summary`, {
      method: "POST",
    }),

  bedTransfer: (admissionId: string, data: BedTransferRequest) =>
    request<BedTransferResponse>(`/ipd/admissions/${admissionId}/transfer`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  expectedDischarges: (params?: { hours?: number }) => {
    const sp = new URLSearchParams();
    if (params?.hours != null) sp.set("hours", String(params.hours));
    const qs = sp.toString();
    return request<ExpectedDischargeRow[]>(`/ipd/discharges/expected${qs ? `?${qs}` : ""}`);
  },

  // ── IPD post-discharge workflow ─────────────────────────
  getIpdDischargeWorkflow: (admissionId: string) =>
    request<IpdDischargeWorkflow | null>(`/ipd/admissions/${admissionId}/discharge-workflow`),
  updateIpdDischargeStep: (admissionId: string, body: IpdDischargeStepUpdate) =>
    request<IpdDischargeWorkflow>(`/ipd/admissions/${admissionId}/discharge-workflow/step`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getIpdDama: (admissionId: string) =>
    request<IpdDamaRecord | null>(`/ipd/admissions/${admissionId}/dama`),
  recordIpdDama: (admissionId: string, body: IpdDamaRequest) =>
    request<IpdDamaRecord>(`/ipd/admissions/${admissionId}/dama`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listIpdPostDischarge: () => request<IpdPostDischargeRow[]>(`/ipd/post-discharge`),
  sendIpdSurvey: (admissionId: string, via: "sms" | "email" | "whatsapp") =>
    request<IpdPostDischargeRow>(`/ipd/post-discharge/${admissionId}/survey/send`, {
      method: "POST",
      body: JSON.stringify({ via }),
    }),
  listIpdMortalityReviews: () => request<IpdMortalityReview[]>(`/ipd/mortality-reviews`),
  createIpdMortalityReview: (body: IpdMortalityCreate) =>
    request<IpdMortalityReview>(`/ipd/mortality-reviews`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  submitIpdMortalityReview: (id: string, body: IpdMortalitySubmit) =>
    request<IpdMortalityReview>(`/ipd/mortality-reviews/${id}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
