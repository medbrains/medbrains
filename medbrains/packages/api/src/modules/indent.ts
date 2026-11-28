/** The `/indent` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AbcAnalysisRow,
  ApproveIndentRequest,
  BatchStock,
  ComplianceCheckRow,
  ConsignmentUsageRequest,
  ConsumptionAnalysisRow,
  CreateCondemnationRequest,
  CreateImplantRequest,
  CreateIndentRequisitionRequest,
  CreateStoreCatalogRequest,
  CreateStoreStockMovementRequest,
  DeadStockRow,
  DepartmentIssueRequest,
  EquipmentCondemnation,
  FsnAnalysisRow,
  ImplantRegistryEntry,
  IndentRequisition,
  IndentRequisitionDetailResponse,
  IndentRequisitionListResponse,
  InventoryValuationRow,
  IssueIndentRequest,
  IssueToPatientRequest,
  PatientConsumableIssue,
  PurchaseConsumptionTrendRow,
  ReorderAlert,
  ReturnToStoreRequest,
  StockMovementListResponse,
  StoreCatalog,
  StoreStockMovement,
  UpdateCondemnationStatusRequest,
  UpdateImplantRequest,
  UpdateStoreCatalogRequest,
  VedAnalysisRow,
} from "@medbrains/types";
import { request } from "../client.js";

export const indentApi = {
  // ── Indent / Store ──────────────────────────────────

  listIndentRequisitions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<IndentRequisitionListResponse>(`/indent/requisitions${qs}`);
  },
  createIndentRequisition: (data: CreateIndentRequisitionRequest) =>
    request<IndentRequisitionDetailResponse>("/indent/requisitions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getIndentRequisition: (id: string) =>
    request<IndentRequisitionDetailResponse>(`/indent/requisitions/${id}`),
  submitIndentRequisition: (id: string) =>
    request<IndentRequisition>(`/indent/requisitions/${id}/submit`, {
      method: "PUT",
    }),
  approveIndentRequisition: (id: string, data: ApproveIndentRequest) =>
    request<IndentRequisitionDetailResponse>(`/indent/requisitions/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  rejectIndentRequisition: (id: string) =>
    request<IndentRequisition>(`/indent/requisitions/${id}/reject`, {
      method: "PUT",
    }),
  issueIndentRequisition: (id: string, data: IssueIndentRequest) =>
    request<IndentRequisitionDetailResponse>(`/indent/requisitions/${id}/issue`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  cancelIndentRequisition: (id: string) =>
    request<IndentRequisition>(`/indent/requisitions/${id}/cancel`, {
      method: "PUT",
    }),
  listStoreCatalog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<StoreCatalog[]>(`/indent/catalog${qs}`);
  },
  createStoreCatalogItem: (data: CreateStoreCatalogRequest) =>
    request<StoreCatalog>("/indent/catalog", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateStoreCatalogItem: (id: string, data: UpdateStoreCatalogRequest) =>
    request<StoreCatalog>(`/indent/catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listStoreStockMovements: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<StockMovementListResponse>(`/indent/stock/movements${qs}`);
  },
  createStoreStockMovement: (data: CreateStoreStockMovementRequest) =>
    request<StoreStockMovement>("/indent/stock/movements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Indent Analytics ──────────────────────────────────
  getConsumptionAnalysis: (params?: Record<string, string>) =>
    request<ConsumptionAnalysisRow[]>(
      `/indent/analytics/consumption${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),
  getDeadStockReport: (params?: Record<string, string>) =>
    request<DeadStockRow[]>(
      `/indent/analytics/dead-stock${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),
  getPurchaseConsumptionTrend: (params?: Record<string, string>) =>
    request<PurchaseConsumptionTrendRow[]>(
      `/indent/analytics/purchase-vs-consumption${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),
  getInventoryValuation: () => request<InventoryValuationRow[]>("/indent/analytics/valuation"),
  getComplianceReport: () => request<ComplianceCheckRow[]>("/indent/analytics/compliance"),
  getFsnAnalysis: (params?: Record<string, string>) =>
    request<FsnAnalysisRow[]>(
      `/indent/analytics/fsn${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),
  getAbcAnalysis: () => request<AbcAnalysisRow[]>("/indent/analytics/abc"),
  getVedAnalysis: () => request<VedAnalysisRow[]>("/indent/analytics/ved"),

  // ── Indent Store Ops ──────────────────────────────────
  createDepartmentIssue: (data: DepartmentIssueRequest) =>
    request<StoreStockMovement>("/indent/department-issues", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  issueToPatient: (data: IssueToPatientRequest) =>
    request<PatientConsumableIssue>("/indent/patient-consumables", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPatientConsumables: (params?: Record<string, string>) =>
    request<PatientConsumableIssue[]>(
      `/indent/patient-consumables${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),
  createReturnToStore: (data: ReturnToStoreRequest) =>
    request<StoreStockMovement>("/indent/returns", { method: "POST", body: JSON.stringify(data) }),
  listConsignmentStock: () => request<BatchStock[]>("/indent/consignment-stock"),
  recordConsignmentUsage: (data: ConsignmentUsageRequest) =>
    request<StoreStockMovement>("/indent/consignment-usage", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Indent Assets & Implants ──────────────────────────
  listImplantRegistry: (params?: Record<string, string>) =>
    request<ImplantRegistryEntry[]>(
      `/indent/implant-registry${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),
  createImplantEntry: (data: CreateImplantRequest) =>
    request<ImplantRegistryEntry>("/indent/implant-registry", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateImplantEntry: (id: string, data: UpdateImplantRequest) =>
    request<ImplantRegistryEntry>(`/indent/implant-registry/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCondemnations: (params?: Record<string, string>) =>
    request<EquipmentCondemnation[]>(
      `/indent/condemnations${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),
  createCondemnation: (data: CreateCondemnationRequest) =>
    request<EquipmentCondemnation>("/indent/condemnations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCondemnationStatus: (id: string, data: UpdateCondemnationStatusRequest) =>
    request<EquipmentCondemnation>(`/indent/condemnations/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // ── Indent Reorder Alerts ─────────────────────────────
  checkReorderAlerts: () =>
    request<ReorderAlert[]>("/indent/reorder-alerts/check", { method: "POST" }),
  createReorderIndent: (departmentId?: string) =>
    request<IndentRequisition>("/indent/reorder-indent", {
      method: "POST",
      body: JSON.stringify(departmentId ? { department_id: departmentId } : {}),
    }),
  listReorderAlerts: () => request<ReorderAlert[]>("/indent/reorder-alerts"),
  acknowledgeReorderAlert: (id: string) =>
    request<ReorderAlert>(`/indent/reorder-alerts/${id}/acknowledge`, { method: "PUT" }),
};
