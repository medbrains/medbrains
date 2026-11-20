/** The `/pharmacy` API area. Moved from `client.ts`; one module per first path segment. */

import {
  pharmacyOrderDetailResponseSchema,
  pharmacyOrderListResponseSchema,
} from "@medbrains/schemas";
import type {
  ArrangeDeliveryRequest,
  AssignDeliveryRequest,
  CancelOrderRequest,
  CatalogDuplicatePair,
  CatalogMergeRecord,
  CloseDayRequest,
  CounterDay,
  CounterPatient,
  CreateDischargeMedsRequest,
  CreateNdpsEntryRequest,
  CreateOtcSaleRequest,
  CreatePharmacyBatchRequest,
  CreatePharmacyCatalogRequest,
  CreatePharmacyCreditNoteRequest,
  CreatePharmacyOrderRequest,
  CreatePharmacyReturnBatchRequest,
  CreatePharmacyReturnRequest,
  CreatePharmacyTransferRequest,
  CreateStockTransactionRequest,
  CreateStoreAssignmentRequest,
  CreateStoreIndentRequest,
  CsvImportRequest,
  CsvImportResult,
  DayCloseRow,
  DayReconciliation,
  DayReport,
  DeliveryOptions,
  DeliveryRunner,
  DispenseWitness,
  DrugInteractionCheckRequest,
  DrugInteractionResult,
  DrugUtilizationRow,
  ExpiredBatchRow,
  FormularyCheckResult,
  FulfilmentQueueRow,
  FulfilmentStageResponse,
  LocationStockSummary,
  MergeCatalogItemsRequest,
  NdpsListResponse,
  NdpsRegisterEntry,
  NdpsReportResponse,
  NearExpiryRow,
  PharmacyAbcVedRow,
  PharmacyBatch,
  PharmacyCatalog,
  PharmacyConsumptionRow,
  PharmacyCreditNote,
  PharmacyDaySettlement,
  PharmacyDeadStockRow,
  PharmacyDelivery,
  PharmacyDeliveryList,
  PharmacyDestructionLog,
  PharmacyDispenseContext,
  PharmacyDrugRecall,
  PharmacyEmergencyKit,
  PharmacyOrder,
  PharmacyOrderDetailResponse,
  PharmacyOrderListResponse,
  PharmacyPaymentTransaction,
  PharmacyPosSale,
  PharmacyPosSaleItem,
  PharmacyPrescriptionRx,
  PharmacyPricingTier,
  PharmacyReturn,
  PharmacyRxDetailResponse,
  PharmacySafetyRecordRow,
  PharmacyStockTransaction,
  PharmacyStoreAssignment,
  PharmacyStoreIndent,
  PharmacySubstitute,
  PharmacyTransferRequest,
  PharmacyValidationResult,
  PickLine,
  PosDaySummary,
  PosPricesResponse,
  PrescriptionAuditEntry,
  ProcessPharmacyReturnRequest,
  ReleaseOrderRequest,
  RepeatEligibility,
  RepeatRow,
  Returnable,
  ReturnPosItemsRequest,
  ReturnResult,
  ReviewPharmacyPrescriptionRequest,
  RxQueueRow,
  StockListItem,
  UpdatePharmacyCatalogRequest,
  UpdatePharmacyOrderItemRequest,
  VerifyLineRequest,
  VerifyLineResponse,
  WardStockConsumeRequest,
  WardStockConsumeResponse,
  WardStockRow,
} from "@medbrains/types";
import type { AssignPharmacyStaffRequest, MyPharmacy, UserPharmacyAssignment } from "../client.js";
import { checkedRequest, request } from "../client.js";
import { getApiBase } from "../config.js";

export const pharmacyApi = {
  importPharmacyCatalog: (data: CsvImportRequest) =>
    request<CsvImportResult>("/pharmacy/catalog/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Pharmacy ──────────────────────────────────────────

  listPharmacyOrders: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return checkedRequest<PharmacyOrderListResponse>(
      pharmacyOrderListResponseSchema,
      `/pharmacy/orders${qs}`,
    );
  },
  createPharmacyOrder: (data: CreatePharmacyOrderRequest) =>
    request<PharmacyOrderDetailResponse>("/pharmacy/orders", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPharmacyOrder: (id: string) =>
    checkedRequest<PharmacyOrderDetailResponse>(
      pharmacyOrderDetailResponseSchema,
      `/pharmacy/orders/${id}`,
    ),
  updatePharmacyOrderItem: (
    orderId: string,
    itemId: string,
    data: UpdatePharmacyOrderItemRequest,
  ) =>
    request<PharmacyOrderDetailResponse>(`/pharmacy/orders/${orderId}/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  removePharmacyOrderItem: (orderId: string, itemId: string) =>
    request<PharmacyOrderDetailResponse>(`/pharmacy/orders/${orderId}/items/${itemId}`, {
      method: "DELETE",
    }),
  dispenseOrder: (
    id: string,
    data?: {
      items?: unknown[];
      witnessed_by?: string;
      /** The witness's own password, typed by them; checked on the server. */
      witness_password?: string;
      allergy_override_reason?: string;
      ndps_override_reason?: string;
      unpaid_override_reason?: string;
      /** Clinical reason for dispensing past a blocking safety finding. */
      safety_override_reason?: string;
      /** Scan id or serial of the retained Schedule X duplicate prescription. */
      schedule_x_duplicate_ref?: string;
      /** The pharmacist asked: the patient's allergy status was unknown. */
      allergy_status_acknowledged?: boolean;
    },
  ) =>
    request<PharmacyOrder>(`/pharmacy/orders/${id}/dispense`, {
      method: "PUT",
      body: JSON.stringify(data ?? {}),
    }),
  cancelPharmacyOrder: (id: string) =>
    request<PharmacyOrder>(`/pharmacy/orders/${id}/cancel`, {
      method: "PUT",
    }),
  listPharmacyCatalog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyCatalog[]>(`/pharmacy/catalog${qs}`);
  },
  createPharmacyCatalog: (data: CreatePharmacyCatalogRequest) =>
    request<PharmacyCatalog>("/pharmacy/catalog", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // ── Home delivery ─────────────────────────────────────
  getDeliveryOptions: (orderId: string) =>
    request<DeliveryOptions>(`/pharmacy/orders/${orderId}/delivery-options`),
  arrangeDelivery: (data: ArrangeDeliveryRequest) =>
    request<PharmacyDelivery>("/pharmacy/deliveries", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listDeliveries: (status?: string) =>
    request<PharmacyDeliveryList>(`/pharmacy/deliveries${status ? `?status=${status}` : ""}`),
  listDeliveryRunners: () => request<DeliveryRunner[]>("/pharmacy/delivery-runners"),
  dispatchDelivery: (id: string) =>
    request<PharmacyDelivery>(`/pharmacy/deliveries/${id}/dispatch`, {
      method: "POST",
      body: "{}",
    }),
  completeDelivery: (id: string, data: { code?: string; cash_collected?: number }) =>
    request<PharmacyDelivery>(`/pharmacy/deliveries/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  failDelivery: (id: string, data: { reason: string }) =>
    request<PharmacyDelivery>(`/pharmacy/deliveries/${id}/fail`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelDelivery: (id: string) =>
    request<PharmacyDelivery>(`/pharmacy/deliveries/${id}/cancel`, { method: "POST", body: "{}" }),
  assignDelivery: (id: string, data: AssignDeliveryRequest) =>
    request<PharmacyDelivery>(`/pharmacy/deliveries/${id}/assign`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePharmacyCatalog: (id: string, data: UpdatePharmacyCatalogRequest) =>
    request<PharmacyCatalog>(`/pharmacy/catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listStock: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<StockListItem[]>(`/pharmacy/stock${qs}`);
  },
  createStockTransaction: (data: CreateStockTransactionRequest) =>
    request<PharmacyStockTransaction>("/pharmacy/stock/transactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Pharmacy Phase 2
  validatePharmacyOrder: (id: string) =>
    request<PharmacyValidationResult>(`/pharmacy/orders/${id}/validate`, {
      method: "POST",
    }),

  getPharmacyOrderSafetyRecord: (id: string) =>
    request<PharmacySafetyRecordRow[]>(`/pharmacy/orders/${id}/safety-record`),

  listDispenseWitnesses: (q?: string) =>
    request<DispenseWitness[]>(
      `/pharmacy/dispense-witnesses${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),

  getPharmacyDispenseContext: (patientId: string) =>
    request<PharmacyDispenseContext>(`/pharmacy/patients/${patientId}/dispense-context`),
  createOtcSale: (data: CreateOtcSaleRequest) =>
    request<PharmacyOrderDetailResponse>("/pharmacy/otc-sale", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createDischargeMeds: (data: CreateDischargeMedsRequest) =>
    request<PharmacyOrderDetailResponse>("/pharmacy/discharge-dispensing", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listNdpsEntries: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<NdpsListResponse>(`/pharmacy/ndps-register${qs}`);
  },
  createNdpsEntry: (data: CreateNdpsEntryRequest) =>
    request<NdpsRegisterEntry>("/pharmacy/ndps-register", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getNdpsBalance: () => request<NdpsReportResponse>("/pharmacy/ndps-register/balance"),
  getNdpsReport: () => request<NdpsReportResponse>("/pharmacy/ndps-register/report"),
  listPharmacyBatches: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyBatch[]>(`/pharmacy/batches${qs}`);
  },
  createPharmacyBatch: (data: CreatePharmacyBatchRequest) =>
    request<PharmacyBatch>("/pharmacy/batches", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLocationStockDashboard: () => request<LocationStockSummary[]>("/pharmacy/stock/by-location"),
  getNearExpiryReport: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<NearExpiryRow[]>(`/pharmacy/batches/near-expiry${qs}`);
  },
  listExpiredBatches: () => request<ExpiredBatchRow[]>("/pharmacy/batches/expired"),
  writeOffExpired: (data: { method?: string; witness_name: string; notes?: string }) =>
    request<{
      certificate_number: string;
      batches_written_off: number;
      total_quantity: number;
      controlled_held: number;
    }>("/pharmacy/batches/write-off-expired", { method: "POST", body: JSON.stringify(data) }),

  // Ward PAR / imprest stock
  listWardStock: (departmentId: string) =>
    request<WardStockRow[]>(`/pharmacy/ward-stock?department_id=${departmentId}`),
  setWardPar: (data: {
    department_id: string;
    catalog_item_id: string;
    par_qty: number;
    min_qty?: number;
  }) =>
    request<{ ok: boolean }>("/pharmacy/ward-stock/par", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  replenishWard: (departmentId: string) =>
    request<{ items_replenished: number; total_issued: number }>("/pharmacy/ward-stock/replenish", {
      method: "POST",
      body: JSON.stringify({ department_id: departmentId }),
    }),
  consumeWardStock: (data: WardStockConsumeRequest) =>
    request<WardStockConsumeResponse>("/pharmacy/ward-stock/consume", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPharmacyDeadStock: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyDeadStockRow[]>(`/pharmacy/batches/dead-stock${qs}`);
  },
  listPharmacyStoreAssignments: () =>
    request<PharmacyStoreAssignment[]>("/pharmacy/store-assignments"),
  createPharmacyStoreAssignment: (data: CreateStoreAssignmentRequest) =>
    request<PharmacyStoreAssignment>("/pharmacy/store-assignments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listPharmacyStaff: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<UserPharmacyAssignment[]>(`/pharmacy/staff${qs}`);
  },
  assignPharmacyStaff: (data: AssignPharmacyStaffRequest) =>
    request<UserPharmacyAssignment>("/pharmacy/staff", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removePharmacyStaff: (id: string) =>
    request<{ status: string }>(`/pharmacy/staff/${id}`, { method: "DELETE" }),
  myPharmacies: () => request<MyPharmacy[]>("/pharmacy/my-locations"),
  listPharmacyTransfers: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyTransferRequest[]>(`/pharmacy/transfers${qs}`);
  },
  createPharmacyTransfer: (data: CreatePharmacyTransferRequest) =>
    request<PharmacyTransferRequest>("/pharmacy/transfers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approvePharmacyTransfer: (id: string) =>
    request<PharmacyTransferRequest>(`/pharmacy/transfers/${id}/approve`, {
      method: "PUT",
    }),
  dispatchPharmacyTransfer: (id: string) =>
    request<PharmacyTransferRequest>(`/pharmacy/transfers/${id}/dispatch`, {
      method: "POST",
    }),
  receivePharmacyTransfer: (id: string) =>
    request<PharmacyTransferRequest>(`/pharmacy/transfers/${id}/receive`, {
      method: "POST",
    }),
  listPharmacyReturns: () => request<PharmacyReturn[]>("/pharmacy/returns"),
  createPharmacyReturn: (data: CreatePharmacyReturnRequest) =>
    request<PharmacyReturn>("/pharmacy/returns", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createPharmacyReturns: (data: CreatePharmacyReturnBatchRequest) =>
    request<PharmacyReturn[]>("/pharmacy/returns/batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  processPharmacyReturn: (id: string, data: ProcessPharmacyReturnRequest) =>
    request<PharmacyReturn>(`/pharmacy/returns/${id}/process`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getPharmacyConsumption: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyConsumptionRow[]>(`/pharmacy/analytics/consumption${qs}`);
  },
  getPharmacyAbcVed: () => request<PharmacyAbcVedRow[]>("/pharmacy/analytics/abc-ved"),
  getDrugUtilization: () => request<DrugUtilizationRow[]>("/pharmacy/analytics/utilization"),

  // Pharmacy Phase 3: Rx Queue
  listRxQueue: (params?: { patient_id?: string; rx_queue_id?: string; status?: string }) => {
    const sp = params ? new URLSearchParams(params) : null;
    const qs = sp?.toString();
    return request<RxQueueRow[]>(`/pharmacy/rx-queue${qs ? `?${qs}` : ""}`);
  },
  getRxDetail: (id: string) => request<PharmacyRxDetailResponse>(`/pharmacy/rx-queue/${id}`),
  reviewPrescription: (id: string, data: ReviewPharmacyPrescriptionRequest) =>
    request<PharmacyPrescriptionRx>(`/pharmacy/rx-queue/${id}/review`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Safety
  checkPatientAllergies: (data: { patient_id: string; drug_ids: string[] }) =>
    request<{ matches: unknown[]; safe: boolean }>("/pharmacy/safety/allergy-check", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  selectFefoBatch: (data: {
    catalog_item_id: string;
    quantity_needed: number;
    store_location_id?: string;
  }) =>
    request<{ batches: unknown[] }>("/pharmacy/batches/fefo-select", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // POS
  createPosSale: (data: Record<string, unknown>) =>
    request<PharmacyPosSale>("/pharmacy/pos/sales", { method: "POST", body: JSON.stringify(data) }),
  listPosSales: (params?: { payment_mode?: string; date?: string }) => {
    const qs = new URLSearchParams();
    if (params?.payment_mode) qs.set("payment_mode", params.payment_mode);
    if (params?.date) qs.set("date", params.date);
    const q = qs.toString();
    return request<PharmacyPosSale[]>(`/pharmacy/pos/sales${q ? `?${q}` : ""}`);
  },
  getPosSale: (saleId: string) => request<PharmacyPosSale>(`/pharmacy/pos/sales/${saleId}`),
  getPosPrices: (catalogItemIds: string[]) =>
    request<PosPricesResponse>(
      `/pharmacy/pos/prices?ids=${encodeURIComponent(catalogItemIds.join(","))}`,
    ),
  searchCounterPatients: (q: string) =>
    request<CounterPatient[]>(`/pharmacy/patients/search?q=${encodeURIComponent(q)}`),
  listPosSaleItems: (saleId: string) =>
    request<PharmacyPosSaleItem[]>(`/pharmacy/pos/sales/${saleId}/items`),
  getPosDaySummary: () => request<PosDaySummary>("/pharmacy/pos/day-summary"),

  // Pricing
  resolveDrugPrice: (data: { catalog_item_id: string; tier_name?: string }) =>
    request<Record<string, unknown>>("/pharmacy/pricing/resolve", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  upsertPricingTier: (data: { catalog_item_id: string; tier_name: string; price: number }) =>
    request<PharmacyPricingTier>("/pharmacy/pricing/tiers", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Stock
  reconcileStock: (data: {
    items: { catalog_item_id: string; physical_quantity: number; reason?: string }[];
  }) =>
    request<{ reconciled: number }>("/pharmacy/stock/reconcile", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getReorderSuggestions: () =>
    request<{ suggestions: unknown[] }>("/pharmacy/stock/reorder-suggestions"),

  // Analytics
  pharmacyDailySales: (params?: { days?: number }) => {
    const qs = params?.days ? `?days=${params.days}` : "";
    return request<{ sales: unknown[] }>(`/pharmacy/analytics/daily-sales${qs}`);
  },
  pharmacyFillRate: () => request<Record<string, unknown>>("/pharmacy/analytics/fill-rate"),
  pharmacyMargins: () => request<{ margins: unknown[] }>("/pharmacy/analytics/margins"),

  // ── Pharmacy Credit Notes ──────────────────────────────
  listPharmacyCreditNotes: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyCreditNote[]>(`/pharmacy/credit-notes${qs}`);
  },
  createPharmacyCreditNote: (data: CreatePharmacyCreditNoteRequest) =>
    request<PharmacyCreditNote>("/pharmacy/credit-notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getPharmacyCreditNote: (id: string) =>
    request<PharmacyCreditNote>(`/pharmacy/credit-notes/${id}`),
  approvePharmacyCreditNote: (id: string) =>
    request<PharmacyCreditNote>(`/pharmacy/credit-notes/${id}/approve`, { method: "PUT" }),
  settlePharmacyCreditNote: (id: string) =>
    request<PharmacyCreditNote>(`/pharmacy/credit-notes/${id}/settle`, { method: "PUT" }),
  cancelPharmacyCreditNote: (id: string) =>
    request<PharmacyCreditNote>(`/pharmacy/credit-notes/${id}/cancel`, { method: "PUT" }),

  listPatientOrdersForReturn: (patientId: string) =>
    request<Array<{ order_id: string; order_date: string; status: string; items: unknown }>>(
      `/pharmacy/patient-orders/${patientId}`,
    ),

  lookupPosSale: (receipt: string) =>
    request<{
      id: string;
      receipt_number: string;
      patient_id: string | null;
      total_amount: number;
      payment_mode: string;
      status: string;
      items: unknown;
    }>(`/pharmacy/pos/lookup?receipt=${encodeURIComponent(receipt)}`),

  // ── Pharmacy Store Indents ────────────────────────────
  listPharmacyStoreIndents: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyStoreIndent[]>(`/pharmacy/store-indents${qs}`);
  },
  createPharmacyStoreIndent: (data: CreateStoreIndentRequest) =>
    request<PharmacyStoreIndent>("/pharmacy/store-indents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approvePharmacyStoreIndent: (id: string) =>
    request<PharmacyStoreIndent>(`/pharmacy/store-indents/${id}/approve`, { method: "PUT" }),
  issuePharmacyStoreIndent: (id: string) =>
    request<PharmacyStoreIndent>(`/pharmacy/store-indents/${id}/issue`, { method: "PUT" }),
  receivePharmacyStoreIndent: (id: string) =>
    request<PharmacyStoreIndent>(`/pharmacy/store-indents/${id}/receive`, { method: "PUT" }),

  // ── Pharmacy Fulfilment (pick → pack → verify → dispatch → collect) ────
  //
  // Only meaningful for a store in `pack_and_collect` mode. Every one of these
  // is refused with a plain-English reason for a counter pharmacy, and for any
  // order carrying a controlled line — a narcotic never travels the pack route.
  listFulfilmentQueue: (storeLocationId?: string) => {
    const qs = storeLocationId
      ? `?${new URLSearchParams({ store_location_id: storeLocationId })}`
      : "";
    return request<FulfilmentQueueRow[]>(`/pharmacy/fulfilment/queue${qs}`);
  },
  getFulfilmentPickList: (orderId: string) =>
    request<PickLine[]>(`/pharmacy/fulfilment/${orderId}/pick-list`),
  /**
   * Claim for picking. A reason is needed only to override a medication safety
   * block; the acknowledgement only when the patient's allergy status is unknown.
   */
  claimFulfilmentOrder: (
    orderId: string,
    data?: { safety_override_reason?: string; allergy_status_acknowledged?: boolean },
  ) =>
    request<FulfilmentStageResponse>(`/pharmacy/fulfilment/${orderId}/claim`, {
      method: "POST",
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
  packFulfilmentOrder: (orderId: string) =>
    request<FulfilmentStageResponse>(`/pharmacy/fulfilment/${orderId}/pack`, { method: "POST" }),
  verifyFulfilmentLine: (orderId: string, data: VerifyLineRequest) =>
    request<VerifyLineResponse>(`/pharmacy/fulfilment/${orderId}/verify`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  markFulfilmentVerified: (orderId: string) =>
    request<FulfilmentStageResponse>(`/pharmacy/fulfilment/${orderId}/verified`, {
      method: "POST",
    }),
  markFulfilmentReady: (orderId: string) =>
    request<FulfilmentStageResponse>(`/pharmacy/fulfilment/${orderId}/ready`, { method: "POST" }),
  collectFulfilmentOrder: (orderId: string) =>
    request<FulfilmentStageResponse>("/pharmacy/fulfilment/collect", {
      method: "POST",
      body: JSON.stringify({ order_id: orderId }),
    }),
  releaseFulfilmentOrder: (orderId: string, data: ReleaseOrderRequest) =>
    request<FulfilmentStageResponse>(`/pharmacy/fulfilment/${orderId}/release`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelFulfilmentOrder: (orderId: string, data: CancelOrderRequest) =>
    request<FulfilmentStageResponse>(`/pharmacy/fulfilment/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  returnPosItems: (saleId: string, data: ReturnPosItemsRequest) =>
    request<ReturnResult>(`/pharmacy/pos/sales/${saleId}/return-items`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getPosReturnable: (saleId: string) =>
    request<Returnable>(`/pharmacy/pos/sales/${saleId}/returnable`),
  lookupPosReceipt: (number: string) =>
    request<PharmacyPosSale>(`/pharmacy/pos/receipt-lookup?${new URLSearchParams({ number })}`),
  getCounterCreditNote: (id: string) =>
    request<Record<string, unknown>>(`/pharmacy/pos/credit-notes/${id}`),

  // ── Pharmacy Drug Recalls ─────────────────────────────
  listPharmacyRecalls: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyDrugRecall[]>(`/pharmacy/recalls${qs}`);
  },
  createPharmacyRecall: (data: {
    drug_id?: string;
    drug_name?: string;
    batch_numbers: string[];
    reason: string;
    severity?: string;
    manufacturer_ref?: string;
  }) =>
    request<PharmacyDrugRecall>("/pharmacy/recalls", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  completePharmacyRecall: (id: string) =>
    request<PharmacyDrugRecall>(`/pharmacy/recalls/${id}/complete`, { method: "PUT" }),
  getRecallAffectedPatients: (id: string) =>
    request<Record<string, unknown>>(`/pharmacy/recalls/${id}/affected-patients`),

  // ── Pharmacy Destruction Register ─────────────────────
  listPharmacyDestructions: () => request<PharmacyDestructionLog[]>("/pharmacy/destruction"),
  createPharmacyDestruction: (data: {
    destruction_date: string;
    method: string;
    items: unknown[];
    total_quantity: number;
    total_value: number;
    reason: string;
    witness_name: string;
    authorized_by?: string;
    notes?: string;
  }) =>
    request<PharmacyDestructionLog>("/pharmacy/destruction", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getDestructionCertificate: (id: string) =>
    request<PharmacyDestructionLog>(`/pharmacy/destruction/${id}/certificate`),

  // ── Generic Substitution ──────────────────────────────
  listPharmacySubstitutes: (drugId: string) =>
    request<PharmacySubstitute[]>(`/pharmacy/substitutes/${drugId}`),
  createPharmacySubstitute: (data: {
    brand_drug_id: string;
    generic_drug_id: string;
    is_therapeutic_equivalent?: boolean;
    notes?: string;
  }) =>
    request<PharmacySubstitute>("/pharmacy/substitutes", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ── Emergency Kits ────────────────────────────────────
  listPharmacyEmergencyKits: () => request<PharmacyEmergencyKit[]>("/pharmacy/emergency-kits"),
  createPharmacyEmergencyKit: (data: {
    kit_code: string;
    kit_type: string;
    location_description?: string;
    department_id?: string;
    items: unknown[];
    check_interval_days?: number;
  }) =>
    request<PharmacyEmergencyKit>("/pharmacy/emergency-kits", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  checkPharmacyEmergencyKit: (id: string) =>
    request<PharmacyEmergencyKit>(`/pharmacy/emergency-kits/${id}/check`, { method: "PUT" }),
  restockPharmacyEmergencyKit: (id: string, items: unknown[]) =>
    request<PharmacyEmergencyKit>(`/pharmacy/emergency-kits/${id}/restock`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),

  // ── Pharmacy Payments & Reconciliation ────────────────
  listPharmacyPayments: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PharmacyPaymentTransaction[]>(`/pharmacy/payments${qs}`);
  },
  createPharmacyPayment: (data: {
    pos_sale_id?: string;
    order_id?: string;
    invoice_id?: string;
    payment_mode: string;
    amount: number;
    reference_number?: string;
    upi_transaction_id?: string;
    card_last_four?: string;
    device_terminal_id?: string;
    shift_id?: string;
    counter_id?: string;
  }) =>
    request<PharmacyPaymentTransaction>("/pharmacy/payments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  reconcilePharmacyPayment: (id: string) =>
    request<PharmacyPaymentTransaction>(`/pharmacy/payments/${id}/reconcile`, { method: "PUT" }),
  autoReconcileUpi: () =>
    request<{ matched_count: number }>("/pharmacy/payments/auto-reconcile", { method: "POST" }),
  pharmacyDayReconciliation: (params?: { date?: string; counter_id?: string }) => {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    return request<DayReconciliation>(`/pharmacy/payments/day-reconciliation${qs}`);
  },

  // ── Day Settlement ────────────────────────────────────
  getPharmacySettlement: (params?: { date?: string }) => {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>)}` : "";
    return request<PharmacyDaySettlement>(`/pharmacy/settlements${qs}`);
  },
  closePharmacySettlement: (id: string, data: { cash_counted: number; notes?: string }) =>
    request<PharmacyDaySettlement>(`/pharmacy/settlements/${id}/close`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  verifyPharmacySettlement: (id: string) =>
    request<PharmacyDaySettlement>(`/pharmacy/settlements/${id}/verify`, { method: "PUT" }),

  listPharmacyCatalogDuplicates: () =>
    request<CatalogDuplicatePair[]>("/pharmacy/catalog/duplicates"),

  mergePharmacyCatalogItems: (data: MergeCatalogItemsRequest) =>
    request<CatalogMergeRecord>("/pharmacy/catalog/merge", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Pharmacy (extended)
  // ══════════════════════════════════════════════════════════

  checkDrugInteractions: (data: DrugInteractionCheckRequest) =>
    request<DrugInteractionResult[]>("/pharmacy/interactions/check", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  prescriptionAudit: (prescriptionId: string) =>
    request<PrescriptionAuditEntry[]>(`/pharmacy/prescriptions/${prescriptionId}/audit`),

  formularyCheck: (data: { drug_id: string }) =>
    request<FormularyCheckResult>("/pharmacy/formulary/check", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // ══════════════════════════════════════════════════════════════════
  // Pharmacy Improvements
  // ══════════════════════════════════════════════════════════════════

  // Repeats
  checkRepeatEligibility: (prescription_id: string) =>
    request<RepeatEligibility>(`/pharmacy/prescriptions/${prescription_id}/repeat-eligibility`),
  listRepeatsForRx: (prescription_id: string) =>
    request<RepeatRow[]>(`/pharmacy/prescriptions/${prescription_id}/repeats`),
  dispenseRepeat: (prescription_id: string, data: { notes?: string }) =>
    request<RepeatRow>(`/pharmacy/prescriptions/${prescription_id}/repeats`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Substitutions
  createSubstitution: (data: Record<string, unknown>) =>
    request<unknown>("/pharmacy/substitutions", { method: "POST", body: JSON.stringify(data) }),
  listSubstitutionsForItem: (item_id: string) =>
    request<unknown[]>(`/pharmacy/substitutions/item/${item_id}`),

  // Counseling
  createCounseling: (data: Record<string, unknown>) =>
    request<unknown>("/pharmacy/counseling", { method: "POST", body: JSON.stringify(data) }),
  listCounselingForOrder: (order_id: string) =>
    request<unknown[]>(`/pharmacy/counseling/order/${order_id}`),

  // Coverage checks
  createCoverageCheck: (data: Record<string, unknown>) =>
    request<unknown>("/pharmacy/coverage-checks", { method: "POST", body: JSON.stringify(data) }),
  listCoverageForOrder: (order_id: string) =>
    request<unknown[]>(`/pharmacy/coverage-checks/order/${order_id}`),

  // ══════════════════════════════════════════════════════════════════
  // Pharmacy Finance
  // ══════════════════════════════════════════════════════════════════

  // Cash drawer
  listCashDrawers: (params?: {
    status?: string;
    cashier_user_id?: string;
    pharmacy_location_id?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.cashier_user_id) qs.set("cashier_user_id", params.cashier_user_id);
    if (params?.pharmacy_location_id) qs.set("pharmacy_location_id", params.pharmacy_location_id);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<unknown[]>(`/pharmacy/cash-drawers${q ? `?${q}` : ""}`);
  },
  openCashDrawer: (data: { pharmacy_location_id: string; opening_float: number; notes?: string }) =>
    request<unknown>("/pharmacy/cash-drawers", { method: "POST", body: JSON.stringify(data) }),
  closeCashDrawer: (
    id: string,
    data: { actual_close_amount: number; variance_reason?: string; notes?: string },
  ) =>
    request<unknown>(`/pharmacy/cash-drawers/${id}/close`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getMyActiveCashDrawer: () => request<unknown | null>("/pharmacy/cash-drawers/me/active"),

  // Day close
  listCounterDays: (q?: string) =>
    request<CounterDay[]>(`/pharmacy/day-close${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  getDayCloseReport: (params: { pharmacy_location_id: string; business_date: string }) =>
    request<DayReport>(`/pharmacy/day-close/report?${new URLSearchParams(params)}`),
  closeCounterDay: (data: CloseDayRequest) =>
    request<DayCloseRow>("/pharmacy/day-close", { method: "POST", body: JSON.stringify(data) }),
  reopenCounterDay: (id: string, data: { reason: string }) =>
    request<DayCloseRow>(`/pharmacy/day-close/${id}/reopen`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Petty cash
  listPettyCash: (params?: { status?: string; cash_drawer_id?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.cash_drawer_id) qs.set("cash_drawer_id", params.cash_drawer_id);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<unknown[]>(`/pharmacy/petty-cash${q ? `?${q}` : ""}`);
  },
  createPettyCash: (data: Record<string, unknown>) =>
    request<unknown>("/pharmacy/petty-cash", { method: "POST", body: JSON.stringify(data) }),
  decidePettyCash: (id: string, data: { approved: boolean; notes?: string }) =>
    request<unknown>(`/pharmacy/petty-cash/${id}/decide`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Cash float movements
  listCashFloatMovements: () => request<unknown[]>("/pharmacy/cash-float-movements"),
  createCashFloatMovement: (data: Record<string, unknown>) =>
    request<unknown>("/pharmacy/cash-float-movements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Free dispensings
  listFreeDispensings: (params?: { category?: string; from_date?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.from_date) qs.set("from_date", params.from_date);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<unknown[]>(`/pharmacy/free-dispensings${q ? `?${q}` : ""}`);
  },
  approveFreeDispensing: (data: Record<string, unknown>) =>
    request<unknown>("/pharmacy/free-dispensings", { method: "POST", body: JSON.stringify(data) }),

  // Cashier overrides
  listCashierOverrides: (params?: {
    cashier_user_id?: string;
    override_type?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.cashier_user_id) qs.set("cashier_user_id", params.cashier_user_id);
    if (params?.override_type) qs.set("override_type", params.override_type);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<unknown[]>(`/pharmacy/cashier-overrides${q ? `?${q}` : ""}`);
  },
  createCashierOverride: (data: Record<string, unknown>) =>
    request<unknown>("/pharmacy/cashier-overrides", { method: "POST", body: JSON.stringify(data) }),

  // Supplier payments (pharmacy-scoped — distinct from procurement supplier payments)
  listPharmacySupplierPayments: (params?: {
    status?: string;
    supplier_id?: string;
    overdue_only?: boolean;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.supplier_id) qs.set("supplier_id", params.supplier_id);
    if (params?.overdue_only) qs.set("overdue_only", "true");
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<unknown[]>(`/pharmacy/supplier-payments${q ? `?${q}` : ""}`);
  },
  createPharmacySupplierPayment: (data: Record<string, unknown>) =>
    request<unknown>("/pharmacy/supplier-payments", { method: "POST", body: JSON.stringify(data) }),
  payPharmacySupplier: (
    id: string,
    data: { paid_amount: number; payment_mode: string; utr_number?: string },
  ) =>
    request<unknown>(`/pharmacy/supplier-payments/${id}/pay`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Drug margins
  listDrugMargins: (params?: {
    from_date?: string;
    to_date?: string;
    drug_id?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.from_date) qs.set("from_date", params.from_date);
    if (params?.to_date) qs.set("to_date", params.to_date);
    if (params?.drug_id) qs.set("drug_id", params.drug_id);
    if (params?.limit !== undefined) qs.set("limit", String(params.limit));
    const q = qs.toString();
    return request<unknown[]>(`/pharmacy/drug-margins/daily${q ? `?${q}` : ""}`);
  },
  listStorefrontOrders: (status?: string) =>
    request<import("@medbrains/types").StorefrontQueue>(
      `/pharmacy/storefront/orders${status ? `?status=${status}` : ""}`,
    ),
  /** The uploaded prescription, read in the browser with the staff session. */
  storefrontPrescriptionUrl: (id: string) =>
    `${getApiBase()}/pharmacy/storefront/orders/${id}/prescription`,
  verifyStorefrontOrder: (id: string, data: import("@medbrains/types").StorefrontVerifyRequest) =>
    request<import("@medbrains/types").StoreOrder>(`/pharmacy/storefront/orders/${id}/verify`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  setStorefrontListing: (id: string, data: import("@medbrains/types").StorefrontListing) =>
    request<PharmacyCatalog>(`/pharmacy/storefront/catalog/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listStorefrontPharmacists: () =>
    request<{ id: string; full_name: string; registration_number: string | null }[]>(
      "/pharmacy/storefront/pharmacists",
    ),
  getStorefrontSettings: () =>
    request<import("@medbrains/types").StorefrontSettings>("/pharmacy/storefront/settings"),
  updateStorefrontSettings: (data: import("@medbrains/types").StorefrontSettings) =>
    request<import("@medbrains/types").StorefrontSettings>("/pharmacy/storefront/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getStorefrontRules: () =>
    request<import("@medbrains/types").StorefrontRules>("/pharmacy/storefront/rules"),
  updateStorefrontRules: (data: import("@medbrains/types").StorefrontRules) =>
    request<import("@medbrains/types").StorefrontRules>("/pharmacy/storefront/rules", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listOnlineStores: () =>
    request<import("@medbrains/types").OnlineStore[]>("/pharmacy/storefront/stores"),
  updateOnlineStore: (id: string, data: import("@medbrains/types").OnlineStoreUpdate) =>
    request<import("@medbrains/types").OnlineStore[]>(`/pharmacy/storefront/stores/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listStorefrontFloors: () =>
    request<import("@medbrains/types").StorefrontFloorRow[]>("/pharmacy/storefront/floors"),
  listStorefrontSubstitutes: (orderId: string, itemId: string) =>
    request<import("@medbrains/types").SubstituteCandidates>(
      `/pharmacy/storefront/orders/${orderId}/lines/${itemId}/substitutes`,
    ),
  proposeStorefrontSubstitution: (
    orderId: string,
    data: import("@medbrains/types").ProposeSubstitution,
  ) =>
    request<import("@medbrains/types").StoreOrder>(
      `/pharmacy/storefront/orders/${orderId}/substitutions`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  printStorefrontOutside: (orderId: string, catalogItemIds: string[]) =>
    request<import("@medbrains/types").OutsidePrint>(
      `/pharmacy/storefront/orders/${orderId}/outside-print`,
      { method: "POST", body: JSON.stringify({ catalog_item_ids: catalogItemIds }) },
    ),
  listStorefrontReturns: () =>
    request<import("@medbrains/types").StoreReturnQueue>("/pharmacy/storefront/returns"),
  acknowledgeStorefrontReturn: (id: string) =>
    request<{ id: string; status: string }>(`/pharmacy/storefront/returns/${id}/acknowledge`, {
      method: "POST",
    }),
  receiveStorefrontReturn: (id: string, data: import("@medbrains/types").StoreReturnReceive) =>
    request<{ id: string; status: string; credit_note_number: string; refund_id: string | null }>(
      `/pharmacy/storefront/returns/${id}/receive`,
      { method: "POST", body: JSON.stringify(data) },
    ),
  refuseStorefrontReturn: (id: string, note: string) =>
    request<{ id: string; status: string }>(`/pharmacy/storefront/returns/${id}/refuse`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
  listStorefrontRefunds: () =>
    request<import("@medbrains/types").StoreRefund[]>("/pharmacy/storefront/refunds"),
  issueStorefrontRefund: (id: string) =>
    request<import("@medbrains/types").StoreRefund>(`/pharmacy/storefront/refunds/${id}/issue`, {
      method: "POST",
    }),
  listQuarantine: () => request<import("@medbrains/types").QuarantineRow[]>("/pharmacy/quarantine"),
  destroyQuarantine: (data: import("@medbrains/types").QuarantineDestroyRequest) =>
    request<import("@medbrains/types").QuarantineDestroyed>("/pharmacy/quarantine/destroy", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listNppaCeilings: (q?: string) =>
    request<import("@medbrains/types").NppaCeilings>(
      `/pharmacy/nppa-ceilings${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ),
  setNppaCeiling: (id: string, data: import("@medbrains/types").NppaCeilingUpdate) =>
    request<import("@medbrains/types").NppaCeilingRow>(`/pharmacy/nppa-ceilings/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  importNppaCeilings: (rows: import("@medbrains/types").NppaImportRow[]) =>
    request<import("@medbrains/types").NppaImported>("/pharmacy/nppa-ceilings/import", {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  getPosReturnPolicy: () =>
    request<import("@medbrains/types").CounterReturnPolicy>("/pharmacy/pos/return-policy"),
  getH1Register: (from: string, to: string) =>
    request<import("@medbrains/types").H1RegisterEntry[]>(
      `/pharmacy/h1-register?from=${from}&to=${to}`,
    ),
  cancelPharmacyPosSale: (saleId: string, data: Record<string, unknown>) =>
    request<unknown>(`/pharmacy/pos/sales/${saleId}/cancel`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
