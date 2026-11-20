/** The `/procurement` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  BatchStock,
  CommitGrnScanRequest,
  CreateEmergencyPoRequest,
  CreateGrnRequest,
  CreateGrnScanRequest,
  CreatePurchaseOrderRequest,
  CreateRateContractRequest,
  CreateStoreLocationRequest,
  CreateSupplierPaymentRequest,
  CreateVendorRequest,
  GoodsReceiptNote,
  GrnDetailResponse,
  GrnItemSuggestion,
  GrnListResponse,
  GrnScanClaim,
  GrnScanDraft,
  GrnScanListItem,
  GrnScanReview,
  PoDetailResponse,
  PoListResponse,
  PurchaseBillScan,
  PurchaseOrder,
  RateContract,
  RcDetailResponse,
  StoreLocation,
  SupplierPayment,
  SupplierScanAccuracy,
  UpdateStoreLocationRequest,
  UpdateSupplierPaymentRequest,
  UpdateVendorRequest,
  Vendor,
  VendorComparisonRow,
  VendorPerformanceRow,
} from "@medbrains/types";
import { request } from "../client.js";

export const procurementApi = {
  // ── Procurement ──────────────────────────────────────────

  // Vendors
  listVendors: (params?: Record<string, string>) =>
    request<Vendor[]>(`/procurement/vendors${params ? `?${new URLSearchParams(params)}` : ""}`),

  getVendor: (id: string) => request<Vendor>(`/procurement/vendors/${id}`),

  createVendor: (data: CreateVendorRequest) =>
    request<Vendor>("/procurement/vendors", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateVendor: (id: string, data: UpdateVendorRequest) =>
    request<Vendor>(`/procurement/vendors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Store Locations
  listStoreLocations: () => request<StoreLocation[]>("/procurement/store-locations"),

  createStoreLocation: (data: CreateStoreLocationRequest) =>
    request<StoreLocation>("/procurement/store-locations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStoreLocation: (id: string, data: UpdateStoreLocationRequest) =>
    request<StoreLocation>(`/procurement/store-locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Purchase Orders
  listPurchaseOrders: (params?: Record<string, string>) =>
    request<PoListResponse>(
      `/procurement/purchase-orders${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),

  getPurchaseOrder: (id: string) => request<PoDetailResponse>(`/procurement/purchase-orders/${id}`),

  createPurchaseOrder: (data: CreatePurchaseOrderRequest) =>
    request<PoDetailResponse>("/procurement/purchase-orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  approvePurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/procurement/purchase-orders/${id}/approve`, {
      method: "PUT",
    }),

  sendPurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/procurement/purchase-orders/${id}/send`, {
      method: "PUT",
    }),

  cancelPurchaseOrder: (id: string) =>
    request<PurchaseOrder>(`/procurement/purchase-orders/${id}/cancel`, {
      method: "PUT",
    }),

  // GRN
  listGrns: (params?: Record<string, string>) =>
    request<GrnListResponse>(`/procurement/grns${params ? `?${new URLSearchParams(params)}` : ""}`),

  getGrn: (id: string) => request<GrnDetailResponse>(`/procurement/grns/${id}`),

  createGrn: (data: CreateGrnRequest) =>
    request<GrnDetailResponse>("/procurement/grns", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Post a GRN to stock — the only moment received stock moves. */
  completeGrn: (id: string) =>
    request<GoodsReceiptNote>(`/procurement/grns/${id}/complete`, {
      method: "PUT",
    }),

  // Supplier-bill scans → draft GRNs (#4861)
  listGrnScans: (params?: { status?: string }) =>
    request<GrnScanListItem[]>(
      `/procurement/grn-scans${params?.status ? `?${new URLSearchParams(params)}` : ""}`,
    ),

  createGrnScan: (data: CreateGrnScanRequest) =>
    request<PurchaseBillScan>("/procurement/grn-scans", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getGrnScanReview: (id: string) => request<GrnScanReview>(`/procurement/grn-scans/${id}/review`),

  saveGrnScanDraft: (id: string, draft: GrnScanDraft) =>
    request<PurchaseBillScan>(`/procurement/grn-scans/${id}/draft`, {
      method: "PUT",
      body: JSON.stringify(draft),
    }),

  submitGrnScan: (id: string) =>
    request<PurchaseBillScan>(`/procurement/grn-scans/${id}/submit`, { method: "POST" }),

  discardGrnScan: (id: string) =>
    request<PurchaseBillScan>(`/procurement/grn-scans/${id}/discard`, { method: "POST" }),

  commitGrnScan: (id: string, data: CommitGrnScanRequest) =>
    request<GrnDetailResponse>(`/procurement/grn-scans/${id}/commit`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  searchGrnScanItems: (q: string) =>
    request<GrnItemSuggestion[]>(
      `/procurement/grn-scans/item-search?${new URLSearchParams({ q })}`,
    ),

  getGrnScanAccuracy: () => request<SupplierScanAccuracy[]>("/procurement/grn-scans/accuracy"),

  /** Bill-reader worker: take the oldest queued bill under a lease. */
  claimGrnScan: (data: { scan_id?: string } = {}) =>
    request<GrnScanClaim | null>("/procurement/grn-scans/claim", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Bill-reader worker: post what was read (see grn_scan_contract.rs). */
  postGrnScanParseResult: (id: string, result: Record<string, unknown>) =>
    request<PurchaseBillScan>(`/procurement/grn-scans/${id}/parse-result`, {
      method: "POST",
      body: JSON.stringify(result),
    }),

  // Rate Contracts
  listRateContracts: (params?: Record<string, string>) =>
    request<RateContract[]>(
      `/procurement/rate-contracts${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),

  getRateContract: (id: string) => request<RcDetailResponse>(`/procurement/rate-contracts/${id}`),

  createRateContract: (data: CreateRateContractRequest) =>
    request<RcDetailResponse>("/procurement/rate-contracts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Batch Stock
  listBatchStock: (params?: Record<string, string>) =>
    request<BatchStock[]>(
      `/procurement/batch-stock${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),

  // ── Procurement Phase 2 ──
  getVendorPerformance: () => request<VendorPerformanceRow[]>("/procurement/vendor-performance"),
  getVendorComparison: (catalogItemId: string) =>
    request<VendorComparisonRow[]>(
      `/procurement/vendor-comparison?catalog_item_id=${catalogItemId}`,
    ),
  createEmergencyPo: (data: CreateEmergencyPoRequest) =>
    request<PoDetailResponse>("/procurement/emergency-purchase", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listSupplierPayments: (params?: Record<string, string>) =>
    request<SupplierPayment[]>(
      `/procurement/supplier-payments${params ? `?${new URLSearchParams(params)}` : ""}`,
    ),
  createSupplierPayment: (data: CreateSupplierPaymentRequest) =>
    request<SupplierPayment>("/procurement/supplier-payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSupplierPayment: (id: string, data: UpdateSupplierPaymentRequest) =>
    request<SupplierPayment>(`/procurement/supplier-payments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getProcurementVendorLedger: (vendorId: string) =>
    request<unknown>(`/procurement/vendors/${vendorId}/ledger`),
};
