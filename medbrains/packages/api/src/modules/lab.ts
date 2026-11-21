/** The `/lab` API area. Moved from `client.ts`; one module per first path segment. */

import {
  labOrderDetailResponseSchema,
  labOrderListResponseSchema,
  labResultListResponseSchema,
} from "@medbrains/schemas";
import type {
  AddOnTestRequest,
  AddResultsRequest,
  AmendResultRequest,
  AnalyserCandidateOrder,
  AutoValidateResult,
  CollectSampleRequest,
  CreateB2bClientRequest,
  CreateB2bRateRequest,
  CreateCalibrationRequest,
  CreateCollectionCenterRequest,
  CreateCytologyReportRequest,
  CreateDirectLabOrderRequest,
  CreateEqasResultRequest,
  CreateHistopathReportRequest,
  CreateHomeCollectionRequest,
  CreateLabCatalogRequest,
  CreateLabOrderRequest,
  CreateLabPanelRequest,
  CreateMolecularReportRequest,
  CreateNablDocumentRequest,
  CreateOutsourcedOrderRequest,
  CreatePhlebotomyEntryRequest,
  CreateProficiencyTestRequest,
  CreateQcResultRequest,
  CreateReagentLotRequest,
  CreateReportDispatchRequest,
  CreateReportTemplateRequest,
  CreateSampleArchiveRequest,
  CsvImportRequest,
  CsvImportResult,
  CumulativeReportResponse,
  DirectLabOrderResponse,
  HeldAnalyserMessage,
  HomeCollectionStatsRow,
  HomeCollectionStatusRequest,
  LabAnalyzerWorklistRow,
  LabB2bClient,
  LabB2bCreditSummary,
  LabB2bRate,
  LabCalibration,
  LabCollectionCenter,
  LabCriticalAlert,
  LabCriticalCall,
  LabCrossmatchLink,
  LabCytologyReport,
  LabEqasResult,
  LabHistopathReport,
  LabHomeCollection,
  LabMolecularReport,
  LabNablDocument,
  LabOrder,
  LabOrderDetailResponse,
  LabOrderListResponse,
  LabOutsourcedOrder,
  LabPanelDetailResponse,
  LabPhlebotomyQueueItem,
  LabProficiencyTest,
  LabQcResult,
  LabReagentLot,
  LabReferralDoctor,
  LabReferralPayout,
  LabReportDeliveryConfig,
  LabReportDispatch,
  LabReportTemplate,
  LabReportTemplateListItem,
  LabResult,
  LabResultAmendment,
  LabSampleArchive,
  LabTatAnalyticsRow,
  LabTestCatalog,
  LabTestPanel,
  ReagentConsumptionRow,
  RecordCriticalCallRequest,
  RejectSampleRequest,
  TatMonitoringRow,
  UpdateB2bClientRequest,
  UpdateCollectionCenterRequest,
  UpdateEqasResultRequest,
  UpdateHomeCollectionRequest,
  UpdateLabCatalogRequest,
  UpdateLabPanelRequest,
  UpdateNablDocumentRequest,
  UpdateOutsourcedOrderRequest,
  UpdatePhlebotomyStatusRequest,
  UpdateReagentLotRequest,
  UpdateReportStatusRequest,
  UpdateReportTemplateRequest,
} from "@medbrains/types";
import { checkedRequest, request } from "../client.js";

export const labApi = {
  // Setup — CSV import
  importLabCatalog: (data: CsvImportRequest) =>
    request<CsvImportResult>("/lab/catalog/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Lab ────────────────────────────────────────────────

  listLabOrders: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return checkedRequest<LabOrderListResponse>(labOrderListResponseSchema, `/lab/orders${qs}`);
  },
  createLabOrder: (data: CreateLabOrderRequest) =>
    request<LabOrder>("/lab/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLabOrder: (id: string) =>
    checkedRequest<LabOrderDetailResponse>(labOrderDetailResponseSchema, `/lab/orders/${id}`),
  collectSample: (id: string, data: CollectSampleRequest) =>
    request<LabOrder>(`/lab/orders/${id}/collect`, { method: "PUT", body: JSON.stringify(data) }),
  startProcessing: (id: string) =>
    request<LabOrder>(`/lab/orders/${id}/process`, { method: "PUT" }),
  completeLabOrder: (id: string) =>
    request<LabOrder>(`/lab/orders/${id}/complete`, { method: "PUT" }),
  verifyResults: (id: string) => request<LabOrder>(`/lab/orders/${id}/verify`, { method: "PUT" }),
  cancelLabOrder: (id: string) => request<LabOrder>(`/lab/orders/${id}/cancel`, { method: "PUT" }),
  addLabResults: (orderId: string, data: AddResultsRequest) =>
    request<LabResult[]>(`/lab/orders/${orderId}/results`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  /** Analyser results held for review (no barcode, ambiguous, conflicting). */
  listHeldAnalyserResults: (page = 1) =>
    request<HeldAnalyserMessage[]>(`/lab/analyser-review?page=${page}`),
  listAnalyserCandidateOrders: (messageId: string, barcode?: string) =>
    request<AnalyserCandidateOrder[]>(
      `/lab/analyser-review/${messageId}/candidates${
        barcode ? `?${new URLSearchParams({ barcode })}` : ""
      }`,
    ),
  attachAnalyserResults: (messageId: string, orderId: string) =>
    request<{ status: string; order_id: string; posted: number }>(
      `/lab/analyser-review/${messageId}/attach`,
      { method: "POST", body: JSON.stringify({ order_id: orderId }) },
    ),
  dismissAnalyserResults: (messageId: string, reason: string) =>
    request<{ status: string }>(`/lab/analyser-review/${messageId}/dismiss`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  listLabResults: (orderId: string) =>
    checkedRequest<LabResult[]>(labResultListResponseSchema, `/lab/orders/${orderId}/results`),
  listLabCatalog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabTestCatalog[]>(`/lab/catalog${qs}`);
  },
  /**
   * A walk-in at the lab counter: opens the lab visit, records the referral,
   * places every test and raises the bill in one step.
   */
  createDirectLabOrder: (data: CreateDirectLabOrderRequest) =>
    request<DirectLabOrderResponse>("/lab/direct-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createLabCatalogEntry: (data: CreateLabCatalogRequest) =>
    request<LabTestCatalog>("/lab/catalog", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLabCatalogEntry: (id: string, data: UpdateLabCatalogRequest) =>
    request<LabTestCatalog>(`/lab/catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Panels
  listLabPanels: () => request<LabTestPanel[]>("/lab/panels"),
  getLabPanel: (id: string) => request<LabPanelDetailResponse>(`/lab/panels/${id}`),
  createLabPanel: (data: CreateLabPanelRequest) =>
    request<LabPanelDetailResponse>("/lab/panels", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLabPanel: (id: string, data: UpdateLabPanelRequest) =>
    request<LabPanelDetailResponse>(`/lab/panels/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteLabPanel: (id: string) =>
    request<{ deleted: boolean }>(`/lab/panels/${id}`, { method: "DELETE" }),

  // Sample Rejection
  rejectSample: (orderId: string, data: RejectSampleRequest) =>
    request<LabOrder>(`/lab/orders/${orderId}/reject`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Amendments & Critical Alerts
  amendLabResult: (orderId: string, data: AmendResultRequest) =>
    request<LabResultAmendment>(`/lab/orders/${orderId}/results/amend`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listLabAmendments: (orderId: string) =>
    request<LabResultAmendment[]>(`/lab/orders/${orderId}/amendments`),
  listCriticalAlerts: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabCriticalAlert[]>(`/lab/critical-alerts${qs}`);
  },
  acknowledgeCriticalAlert: (alertId: string, data: { readback_value: string }) =>
    request<LabCriticalAlert>(`/lab/critical-alerts/${alertId}/acknowledge`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Document the lab-to-clinician phone call for a critical value. */
  recordCriticalCall: (alertId: string, data: RecordCriticalCallRequest) =>
    request<LabCriticalCall>(`/lab/critical-alerts/${alertId}/phone-call`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Report Status
  updateLabReportStatus: (orderId: string, data: UpdateReportStatusRequest) =>
    request<LabOrder>(`/lab/orders/${orderId}/report-status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  lockLabReport: (orderId: string) =>
    request<LabOrder>(`/lab/orders/${orderId}/lock-report`, { method: "PUT" }),

  // Lab Phase 2 — Cumulative & TAT
  getLabCumulativeReport: (patientId: string, testId: string) =>
    request<CumulativeReportResponse>(`/lab/patients/${patientId}/cumulative/${testId}`),
  getLabTatMonitoring: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<TatMonitoringRow[]>(`/lab/tat-monitoring${qs}`);
  },

  // Lab Phase 2 — Reagent Lots
  listReagentLots: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabReagentLot[]>(`/lab/reagent-lots${qs}`);
  },
  createReagentLot: (data: CreateReagentLotRequest) =>
    request<LabReagentLot>("/lab/reagent-lots", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateReagentLot: (id: string, data: UpdateReagentLotRequest) =>
    request<LabReagentLot>(`/lab/reagent-lots/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — QC Results
  listQcResults: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabQcResult[]>(`/lab/qc-results${qs}`);
  },
  createQcResult: (data: CreateQcResultRequest) =>
    request<LabQcResult>("/lab/qc-results", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  reviewQcResult: (id: string, data: { reviewer_notes?: string }) =>
    request<LabQcResult>(`/lab/qc-results/${id}/review`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Calibrations
  listCalibrations: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabCalibration[]>(`/lab/calibrations${qs}`);
  },
  createCalibration: (data: CreateCalibrationRequest) =>
    request<LabCalibration>("/lab/calibrations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Phlebotomy Queue
  listPhlebotomyQueue: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabPhlebotomyQueueItem[]>(`/lab/phlebotomy-queue${qs}`);
  },
  // Answers a bare {"status":"assigned"} acknowledgement, not the row — so a
  // caller must refetch the queue rather than trust the response to carry
  // assigned_to. Typing it as the row invites exactly that mistake.
  assignPhlebotomist: (id: string, data: { assigned_to: string }) =>
    request<{ status: string }>(`/lab/phlebotomy/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  createPhlebotomyEntry: (data: CreatePhlebotomyEntryRequest) =>
    request<LabPhlebotomyQueueItem>("/lab/phlebotomy-queue", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePhlebotomyStatus: (id: string, data: UpdatePhlebotomyStatusRequest) =>
    request<LabPhlebotomyQueueItem>(`/lab/phlebotomy-queue/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Outsourced Orders
  listOutsourcedOrders: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabOutsourcedOrder[]>(`/lab/outsourced${qs}`);
  },
  createOutsourcedOrder: (data: CreateOutsourcedOrderRequest) =>
    request<LabOutsourcedOrder>("/lab/outsourced", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOutsourcedOrder: (id: string, data: UpdateOutsourcedOrderRequest) =>
    request<LabOutsourcedOrder>(`/lab/outsourced/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 2 — Add-on Test
  addOnLabTest: (orderId: string, data: AddOnTestRequest) =>
    request<LabOrder>(`/lab/orders/${orderId}/add-on`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — Home Collections
  listHomeCollections: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabHomeCollection[]>(`/lab/home-collections${qs}`);
  },
  createHomeCollection: (data: CreateHomeCollectionRequest) =>
    request<LabHomeCollection>("/lab/home-collections", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateHomeCollection: (id: string, data: UpdateHomeCollectionRequest) =>
    request<LabHomeCollection>(`/lab/home-collections/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  updateHomeCollectionStatus: (id: string, data: HomeCollectionStatusRequest) =>
    request<LabHomeCollection>(`/lab/home-collections/${id}/status`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getHomeCollectionStats: () => request<HomeCollectionStatsRow[]>("/lab/home-collections/stats"),

  // Lab Phase 3 — Collection Centers
  listCollectionCenters: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabCollectionCenter[]>(`/lab/collection-centers${qs}`);
  },
  createCollectionCenter: (data: CreateCollectionCenterRequest) =>
    request<LabCollectionCenter>("/lab/collection-centers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCollectionCenter: (id: string, data: UpdateCollectionCenterRequest) =>
    request<LabCollectionCenter>(`/lab/collection-centers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — Sample Archive
  listSampleArchive: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabSampleArchive[]>(`/lab/sample-archive${qs}`);
  },
  createSampleArchive: (data: CreateSampleArchiveRequest) =>
    request<LabSampleArchive>("/lab/sample-archive", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  retrieveSampleArchive: (id: string) =>
    request<LabSampleArchive>(`/lab/sample-archive/${id}/retrieve`, {
      method: "POST",
    }),

  // Lab Phase 3 — Report Dispatches
  listReportDispatches: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabReportDispatch[]>(`/lab/report-dispatches${qs}`);
  },
  createReportDispatch: (data: CreateReportDispatchRequest) =>
    request<LabReportDispatch>("/lab/report-dispatches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  confirmReportDispatch: (id: string) =>
    request<LabReportDispatch>(`/lab/report-dispatches/${id}/confirm`, {
      method: "POST",
    }),
  voidReportDispatch: (id: string, reason: string) =>
    request<LabReportDispatch>(`/lab/report-dispatches/${id}/void`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  // Lab Phase 3 — Report Templates
  listReportTemplates: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabReportTemplateListItem[]>(`/lab/report-templates${qs}`);
  },
  createReportTemplate: (data: CreateReportTemplateRequest) =>
    request<LabReportTemplate>("/lab/report-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateReportTemplate: (id: string, data: UpdateReportTemplateRequest) =>
    request<LabReportTemplate>(`/lab/report-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — STAT Orders
  listStatOrders: () => request<TatMonitoringRow[]>("/lab/stat-orders"),

  // Lab Phase 3 — EQAS
  listEqasResults: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabEqasResult[]>(`/lab/eqas${qs}`);
  },
  createEqasResult: (data: CreateEqasResultRequest) =>
    request<LabEqasResult>("/lab/eqas", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEqasResult: (id: string, data: UpdateEqasResultRequest) =>
    request<LabEqasResult>(`/lab/eqas/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — Proficiency Testing
  listProficiencyTests: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabProficiencyTest[]>(`/lab/proficiency-tests${qs}`);
  },
  createProficiencyTest: (data: CreateProficiencyTestRequest) =>
    request<LabProficiencyTest>("/lab/proficiency-tests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — NABL Documents
  listNablDocuments: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabNablDocument[]>(`/lab/nabl-documents${qs}`);
  },
  createNablDocument: (data: CreateNablDocumentRequest) =>
    request<LabNablDocument>("/lab/nabl-documents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNablDocument: (id: string, data: UpdateNablDocumentRequest) =>
    request<LabNablDocument>(`/lab/nabl-documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — Reagent Consumption
  getReagentConsumption: () => request<ReagentConsumptionRow[]>("/lab/reagent-consumption"),

  // Lab Phase 3 — Specialized Reports
  getHistopathReport: (orderId: string) => request<LabHistopathReport>(`/lab/histopath/${orderId}`),
  createHistopathReport: (data: CreateHistopathReportRequest) =>
    request<LabHistopathReport>("/lab/histopath", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getCytologyReport: (orderId: string) => request<LabCytologyReport>(`/lab/cytology/${orderId}`),
  createCytologyReport: (data: CreateCytologyReportRequest) =>
    request<LabCytologyReport>("/lab/cytology", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getMolecularReport: (orderId: string) => request<LabMolecularReport>(`/lab/molecular/${orderId}`),
  createMolecularReport: (data: CreateMolecularReportRequest) =>
    request<LabMolecularReport>("/lab/molecular", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Lab Phase 3 — B2B
  listB2bClients: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<LabB2bClient[]>(`/lab/b2b-clients${qs}`);
  },
  createB2bClient: (data: CreateB2bClientRequest) =>
    request<LabB2bClient>("/lab/b2b-clients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateB2bClient: (id: string, data: UpdateB2bClientRequest) =>
    request<LabB2bClient>(`/lab/b2b-clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listB2bRates: (clientId: string) => request<LabB2bRate[]>(`/lab/b2b-clients/${clientId}/rates`),
  createB2bRate: (clientId: string, data: CreateB2bRateRequest) =>
    request<LabB2bRate>(`/lab/b2b-clients/${clientId}/rates`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  autoValidateResult: (resultId: string) =>
    request<AutoValidateResult>(`/lab/results/${resultId}/auto-validate`, {
      method: "POST",
    }),
  listDoctorCriticalAlerts: (doctorId: string) =>
    request<LabCriticalAlert[]>(`/lab/critical-alerts/doctor/${doctorId}`),
  getLabTatAnalytics: () => request<LabTatAnalyticsRow[]>("/lab/analytics/tat"),
  getOrderCrossmatch: (orderId: string) =>
    request<LabCrossmatchLink>(`/lab/orders/${orderId}/crossmatch`),
  getLabAnalyzerWorklist: (params?: { department_id?: string }) => {
    const qs = params?.department_id ? `?department_id=${params.department_id}` : "";
    return request<LabAnalyzerWorklistRow[]>(`/lab/analyzer-worklist${qs}`);
  },
  assignLabPhlebotomy: (id: string, data: Record<string, unknown>) =>
    request<unknown>(`/lab/phlebotomy/${id}/assign`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  bulkPrintLabReports: (data: Record<string, unknown>) =>
    request<unknown>("/lab/reports/bulk-print", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLabReportDeliveryConfig: () => request<LabReportDeliveryConfig>("/lab/report-delivery-config"),
  updateLabReportDeliveryConfig: (data: LabReportDeliveryConfig) =>
    request<LabReportDeliveryConfig>("/lab/report-delivery-config", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listLabReferralDoctors: () => request<LabReferralDoctor[]>("/lab/referral-doctors"),
  createLabReferralDoctor: (data: Record<string, unknown>) =>
    request<unknown>("/lab/referral-doctors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLabReferralDoctor: (id: string, data: Record<string, unknown>) =>
    request<unknown>(`/lab/referral-doctors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listLabReferralPayouts: () => request<LabReferralPayout[]>("/lab/referral-payouts"),
  createLabReferralPayout: (data: Record<string, unknown>) =>
    request<unknown>("/lab/referral-payouts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLabB2bCreditSummary: () => request<LabB2bCreditSummary[]>("/lab/b2b-credit-summary"),
};
