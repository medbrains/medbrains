/** The `/billing` API area. Moved from `client.ts`; one module per first path segment. */

import {
  invoiceDetailResponseSchema,
  invoiceListResponseSchema,
  paymentListResponseSchema,
} from "@medbrains/schemas";
import type {
  AddDiscountRequest,
  AddInvoiceItemRequest,
  AdjustAdvanceRequest,
  AdvanceAdjustment,
  AgingBucket,
  ApproveClaimSettlementRequest,
  ApproveWriteOffRequest,
  AuditLogResponse,
  AutoConcessionRule,
  AutoConcessionRulesResponse,
  AutoReconcileResponse,
  BadDebtWriteOff,
  BankTransaction,
  BillingConcession,
  BillingEntity,
  BillingEntityInput,
  BillingLane,
  BillingLaneInput,
  BillingLaneName,
  BillingPackage,
  BillingPaymentSettings,
  BillingServicePackage,
  BillingSummaryReport,
  BillingThresholdStatus,
  BillPayer,
  ChargeAttentionItem,
  ChargeAttentionSummary,
  ChargeMaster,
  ClaimNhcxView,
  ClaimSettlementBackfillResult,
  ClaimSettlementPosting,
  ClaimSettlementReasonRequest,
  CollectionEfficiencyReport,
  CollectRequest,
  CollectResult,
  ConcessionListResponse,
  CorporateClient,
  CorporateEnrollment,
  CounterOpenTodayRow,
  CreateAdvanceRequest,
  CreateBillingServicePackageRequest,
  CreateChargeMasterRequest,
  CreateConcessionRequest,
  CreateCorporateRequest,
  CreateCreditNoteRequest,
  CreateCreditPatientRequest,
  CreateDayCloseRequest,
  CreateEnrollmentRequest,
  CreateExchangeRateRequest,
  CreateGlAccountRequest,
  CreateInstallmentRequest,
  CreateInsuranceClaimRequest,
  CreateInterimInvoiceRequest,
  CreateInvoiceRequest,
  CreateJournalEntryRequest,
  CreatePackageRequest,
  CreateRatePlanRequest,
  CreateRefundRequest,
  CreateTdsRequest,
  CreateTpaRateCardRequest,
  CreateWriteOffRequest,
  CreditAgingRow,
  CreditNote,
  CreditPatient,
  CsvImportRequest,
  CsvImportResult,
  DailyRevenueRow,
  DailySummary,
  DayEndClose,
  DepartmentRevenueRow,
  DismissChargeAttentionRequest,
  DismissPreauthRequest,
  DoctorRevenueRow,
  DualInsuranceResult,
  ErFastInvoiceRequest,
  ErpExportLog,
  ErpExportRequest,
  ExchangeRate,
  FinalBillChecklist,
  FinancialMisReport,
  GenerateGstrRequest,
  GlAccount,
  GstReturnSummary,
  HsnSummaryRow,
  ImportBankTransactionsRequest,
  ImportBankTransactionsResponse,
  InsuranceClaim,
  InsurancePanelRow,
  Invoice,
  InvoiceDetailResponse,
  InvoiceDiscount,
  InvoiceItem,
  InvoiceListResponse,
  InvoicePrintData,
  JournalEntry,
  JournalEntryDetail,
  ManualAutoChargeRequest,
  ManualAutoChargeResponse,
  MatchBankTransactionRequest,
  NamePatientChargeAttentionRequest,
  NhcxClaimTaskRequest,
  NhcxDocumentPick,
  NhcxPayment,
  NhcxPreparedClaimDocuments,
  NhcxQueuedResponse,
  NonPayableRule,
  PackageDetailResponse,
  PatientAdvance,
  PatientDues,
  PayerSplit,
  PayInstallmentRequest,
  PayInstallmentResponse,
  Payment,
  PaymentInstallment,
  PaymentInstallmentItem,
  PreauthAlertSettings,
  ProfitLossDeptRow,
  RatePlan,
  RatePlanDetailResponse,
  Receipt,
  ReconciliationReport,
  RecordClaimSettlementRequest,
  RecordPaymentRequest,
  Refund,
  RefundAdvanceRequest,
  RequestEnhancementRequest,
  RevenueAlert,
  RevenueAlertKind,
  RoomConsentInput,
  RoomConsentWitness,
  RoomRentLimit,
  RoomRentLimitInput,
  SchemeRateResult,
  TdsDeduction,
  TpaRateCard,
  UnbilledScanResult,
  UpdateBillingPaymentSettings,
  UpdateChargeMasterRequest,
  UpdateCorporateRequest,
  UpdateCreditPatientRequest,
  UpdateGlAccountRequest,
  UpdateInsuranceClaimRequest,
  UpdatePackageRequest,
  UpdatePreauthAlertSettings,
  UpdateRatePlanRequest,
  UpdateTpaRateCardRequest,
} from "@medbrains/types";
import type { Paginated } from "../client.js";
import { checkedRequest, request } from "../client.js";

export const billingApi = {
  // ── Billing ────────────────────────────────────────────

  listInvoices: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return checkedRequest<InvoiceListResponse>(invoiceListResponseSchema, `/billing/invoices${qs}`);
  },
  createInvoice: (data: CreateInvoiceRequest) =>
    request<Invoice>("/billing/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getInvoice: (id: string) =>
    checkedRequest<InvoiceDetailResponse>(invoiceDetailResponseSchema, `/billing/invoices/${id}`),
  updateInvoice: (id: string, data: { notes?: string }) =>
    request<Invoice>(`/billing/invoices/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  addInvoiceItem: (invoiceId: string, data: AddInvoiceItemRequest) =>
    request<InvoiceItem>(`/billing/invoices/${invoiceId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeInvoiceItem: (invoiceId: string, itemId: string) =>
    request<{ status: string }>(`/billing/invoices/${invoiceId}/items/${itemId}`, {
      method: "DELETE",
    }),
  issueInvoice: (id: string, data?: { preauth_override: boolean; override_reason: string }) =>
    request<Invoice>(`/billing/invoices/${id}/issue`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),
  cancelInvoice: (id: string) =>
    request<Invoice>(`/billing/invoices/${id}/cancel`, { method: "POST" }),
  closeZeroInvoice: (id: string) =>
    request<Invoice>(`/billing/invoices/${id}/close-zero`, { method: "POST" }),
  recordPayment: (invoiceId: string, data: RecordPaymentRequest) =>
    request<Payment>(`/billing/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  // -- Collect anywhere (#4885) --
  listCounterOpenToday: () => request<CounterOpenTodayRow[]>("/billing/counter/open-today"),
  getPatientDues: (patientId: string, lane?: BillingLaneName) =>
    request<PatientDues>(
      `/billing/patients/${patientId}/dues${lane ? `?lane=${encodeURIComponent(lane)}` : ""}`,
    ),
  collectPayment: (data: CollectRequest) =>
    request<CollectResult>("/billing/collect", { method: "POST", body: JSON.stringify(data) }),
  listBillingEntities: () => request<BillingEntity[]>("/billing/entities"),
  createBillingEntity: (data: BillingEntityInput) =>
    request<BillingEntity>("/billing/entities", { method: "POST", body: JSON.stringify(data) }),
  updateBillingEntity: (id: string, data: BillingEntityInput) =>
    request<BillingEntity>(`/billing/entities/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listBillingLanes: () => request<BillingLane[]>("/billing/lanes"),
  updateBillingLane: (lane: BillingLaneName, data: BillingLaneInput) =>
    request<BillingLane>(`/billing/lanes/${lane}`, { method: "PUT", body: JSON.stringify(data) }),
  listPayments: (invoiceId: string) =>
    checkedRequest<Payment[]>(paymentListResponseSchema, `/billing/invoices/${invoiceId}/payments`),
  listChargeMaster: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ChargeMaster[]>(`/billing/charge-master${qs}`);
  },
  createChargeMaster: (data: CreateChargeMasterRequest) =>
    request<ChargeMaster>("/billing/charge-master", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  importChargeMaster: (data: CsvImportRequest) =>
    request<CsvImportResult>("/billing/charge-master/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateChargeMaster: (id: string, data: UpdateChargeMasterRequest) =>
    request<ChargeMaster>(`/billing/charge-master/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteChargeMaster: (id: string) =>
    request<{ status: string }>(`/billing/charge-master/${id}`, {
      method: "DELETE",
    }),

  // -- Billing Packages --
  listPackages: () => request<BillingPackage[]>("/billing/packages"),
  getPackage: (id: string) => request<PackageDetailResponse>(`/billing/packages/${id}`),
  createPackage: (data: CreatePackageRequest) =>
    request<BillingPackage>("/billing/packages", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePackage: (id: string, data: UpdatePackageRequest) =>
    request<BillingPackage>(`/billing/packages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletePackage: (id: string) =>
    request<{ deleted: boolean }>(`/billing/packages/${id}`, {
      method: "DELETE",
    }),

  // -- Rate Plans --
  listRatePlans: () => request<RatePlan[]>("/billing/rate-plans"),
  getRatePlan: (id: string) => request<RatePlanDetailResponse>(`/billing/rate-plans/${id}`),
  createRatePlan: (data: CreateRatePlanRequest) =>
    request<RatePlan>("/billing/rate-plans", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateRatePlan: (id: string, data: UpdateRatePlanRequest) =>
    request<RatePlan>(`/billing/rate-plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteRatePlan: (id: string) =>
    request<{ deleted: boolean }>(`/billing/rate-plans/${id}`, {
      method: "DELETE",
    }),

  // -- Discounts --
  listInvoiceDiscounts: (invoiceId: string) =>
    request<InvoiceDiscount[]>(`/billing/invoices/${invoiceId}/discounts`),
  addDiscount: (invoiceId: string, data: AddDiscountRequest) =>
    request<InvoiceDiscount>(`/billing/invoices/${invoiceId}/discounts`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeDiscount: (invoiceId: string, discountId: string) =>
    request<{ deleted: boolean }>(`/billing/invoices/${invoiceId}/discounts/${discountId}`, {
      method: "DELETE",
    }),

  // -- Refunds --
  listRefunds: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Paginated<Refund>>(`/billing/refunds${qs}`);
  },
  createRefund: (data: CreateRefundRequest) =>
    request<Refund>("/billing/refunds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Credit Notes --
  listCreditNotes: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Paginated<CreditNote>>(`/billing/credit-notes${qs}`);
  },
  createCreditNote: (data: CreateCreditNoteRequest) =>
    request<CreditNote>("/billing/credit-notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  applyCreditNote: (id: string, invoiceId: string) =>
    request<CreditNote>(`/billing/credit-notes/${id}/apply`, {
      method: "POST",
      body: JSON.stringify({ invoice_id: invoiceId }),
    }),

  // -- Receipts --
  listReceipts: (invoiceId: string) =>
    request<Receipt[]>(`/billing/invoices/${invoiceId}/receipts`),
  generateReceipt: (invoiceId: string, paymentId: string) =>
    request<Receipt>(`/billing/invoices/${invoiceId}/receipts`, {
      method: "POST",
      body: JSON.stringify({ payment_id: paymentId }),
    }),

  // -- Insurance Claims --
  listInsuranceClaims: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<InsuranceClaim[]>(`/billing/insurance-claims${qs}`);
  },
  getInsuranceClaim: (id: string) => request<InsuranceClaim>(`/billing/insurance-claims/${id}`),
  createInsuranceClaim: (data: CreateInsuranceClaimRequest) =>
    request<InsuranceClaim>("/billing/insurance-claims", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateInsuranceClaim: (id: string, data: UpdateInsuranceClaimRequest) =>
    request<InsuranceClaim>(`/billing/insurance-claims/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /** Submit a claim/pre-auth to NHCX — assembles the FHIR Bundle + queues the exchange. */
  submitClaimToNhcx: (
    id: string,
    data: { recipient_code: string; use?: string; documents?: NhcxDocumentPick[] },
  ) =>
    request<NhcxQueuedResponse>(`/billing/insurance-claims/${id}/submit-to-nhcx`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** A claim's NHCX state: the final claim's lines, the payer's adjudication, the Tasks asked. */
  getClaimNhcx: (id: string) => request<ClaimNhcxView>(`/billing/insurance-claims/${id}/nhcx`),

  /** Render the final claim's documents — summary, bill, lab reports — for the desk to choose. */
  prepareClaimNhcxDocuments: (id: string) =>
    request<NhcxPreparedClaimDocuments>(`/billing/insurance-claims/${id}/nhcx/documents`, {
      method: "POST",
    }),

  /** Ask the payer where the claim stands (`hcx/status`). */
  checkClaimNhcxStatus: (id: string) =>
    request<NhcxQueuedResponse>(`/billing/insurance-claims/${id}/nhcx/status`, {
      method: "POST",
    }),

  /** Ask the payer to cancel the claim. */
  cancelNhcxClaim: (id: string, data: NhcxClaimTaskRequest) =>
    request<NhcxQueuedResponse>(`/billing/insurance-claims/${id}/nhcx/cancel`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Ask the payer to reprocess the claim, after its deductions are answered. */
  reprocessNhcxClaim: (id: string, data: NhcxClaimTaskRequest) =>
    request<NhcxQueuedResponse>(`/billing/insurance-claims/${id}/nhcx/reprocess`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** A claim's NHCX payments. */
  listClaimNhcxPayments: (id: string) =>
    request<NhcxPayment[]>(`/billing/insurance-claims/${id}/nhcx/payments`),

  // -- Auto Billing --
  triggerAutoCharge: (data: ManualAutoChargeRequest) =>
    request<ManualAutoChargeResponse>("/billing/auto-charge", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Advances --
  listAdvances: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PatientAdvance[]>(`/billing/advances${qs}`);
  },
  createAdvance: (data: CreateAdvanceRequest) =>
    request<PatientAdvance>("/billing/advances", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getFinalBillChecklist: (admissionId: string) =>
    request<FinalBillChecklist>(`/billing/admissions/${admissionId}/final-bill-checklist`),
  adjustAdvance: (id: string, data: AdjustAdvanceRequest) =>
    request<AdvanceAdjustment>(`/billing/advances/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  refundAdvance: (id: string, data: RefundAdvanceRequest) =>
    request<PatientAdvance>(`/billing/advances/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Interim Billing --
  createInterimInvoice: (data: CreateInterimInvoiceRequest) =>
    request<Invoice>("/billing/invoices/interim", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Corporate Clients --
  listCorporates: () => request<CorporateClient[]>("/billing/corporates"),
  getCorporate: (id: string) => request<CorporateClient>(`/billing/corporates/${id}`),
  createCorporate: (data: CreateCorporateRequest) =>
    request<CorporateClient>("/billing/corporates", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCorporate: (id: string, data: UpdateCorporateRequest) =>
    request<CorporateClient>(`/billing/corporates/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listCorporateEnrollments: (corporateId: string) =>
    request<CorporateEnrollment[]>(`/billing/corporates/${corporateId}/enrollments`),
  createCorporateEnrollment: (corporateId: string, data: CreateEnrollmentRequest) =>
    request<CorporateEnrollment>(`/billing/corporates/${corporateId}/enrollments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCorporateEnrollment: (corporateId: string, enrollmentId: string) =>
    request<{ deleted: boolean }>(
      `/billing/corporates/${corporateId}/enrollments/${enrollmentId}`,
      {
        method: "DELETE",
      },
    ),
  listCorporateInvoices: (corporateId: string) =>
    request<Invoice[]>(`/billing/corporates/${corporateId}/invoices`),

  // -- Billing Reports --
  billingReportSummary: (from: string, to: string) =>
    request<BillingSummaryReport>(`/billing/reports/summary?from=${from}&to=${to}`),
  billingReportDepartmentRevenue: (from: string, to: string) =>
    request<DepartmentRevenueRow[]>(`/billing/reports/department-revenue?from=${from}&to=${to}`),
  billingReportCollectionEfficiency: (from: string, to: string) =>
    request<CollectionEfficiencyReport>(
      `/billing/reports/collection-efficiency?from=${from}&to=${to}`,
    ),
  billingReportAging: () => request<AgingBucket[]>("/billing/reports/aging"),
  billingReportDaily: (date: string) =>
    request<DailySummary>(`/billing/reports/daily?date=${date}`),
  billingReportDailyRevenue: (from: string, to: string) =>
    request<DailyRevenueRow[]>(`/billing/reports/daily-revenue?from=${from}&to=${to}`),
  billingReportDoctorRevenue: (from: string, to: string) =>
    request<DoctorRevenueRow[]>(`/billing/reports/doctor-revenue?from=${from}&to=${to}`),
  billingReportInsurancePanel: (from: string, to: string) =>
    request<InsurancePanelRow[]>(`/billing/reports/insurance-panel?from=${from}&to=${to}`),
  billingReportReconciliation: (date: string) =>
    request<ReconciliationReport>(`/billing/reports/reconciliation?date=${date}`),

  // -- EMI / Installment Payments --
  listInstallments: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<PaymentInstallment[]>(`/billing/installments${qs}`);
  },
  createInstallment: (data: CreateInstallmentRequest) =>
    request<PaymentInstallment>("/billing/installments", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getInstallment: (id: string) => request<PaymentInstallment>(`/billing/installments/${id}`),
  payInstallmentItem: (installmentId: string, itemId: string, data: PayInstallmentRequest) =>
    request<PayInstallmentResponse>(`/billing/installments/${installmentId}/items/${itemId}/pay`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  waiveInstallmentItem: (installmentId: string, itemId: string) =>
    request<PaymentInstallmentItem>(
      `/billing/installments/${installmentId}/items/${itemId}/waive`,
      {
        method: "POST",
      },
    ),

  // -- Day Close --
  listDayCloses: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<DayEndClose[]>(`/billing/day-closes${qs}`);
  },
  createDayClose: (data: CreateDayCloseRequest) =>
    request<DayEndClose>("/billing/day-closes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyDayClose: (id: string, data?: { verification_notes?: string }) =>
    request<DayEndClose>(`/billing/day-closes/${id}/verify`, {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }),

  // -- Write-Offs --
  listClaimSettlements: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Paginated<ClaimSettlementPosting>>(`/billing/claim-settlements${qs}`);
  },
  recordClaimSettlement: (data: RecordClaimSettlementRequest) =>
    request<ClaimSettlementPosting>("/billing/claim-settlements", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveClaimSettlement: (id: string, data: ApproveClaimSettlementRequest) =>
    request<ClaimSettlementPosting>(`/billing/claim-settlements/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  rejectClaimSettlement: (id: string, data: ClaimSettlementReasonRequest) =>
    request<ClaimSettlementPosting>(`/billing/claim-settlements/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  reverseClaimSettlement: (id: string, data: ClaimSettlementReasonRequest) =>
    request<ClaimSettlementPosting>(`/billing/claim-settlements/${id}/reverse`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  listChargeAttention: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Paginated<ChargeAttentionItem>>(`/billing/charge-attention${qs}`);
  },
  chargeAttentionSummary: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ChargeAttentionSummary>(`/billing/charge-attention/summary${qs}`);
  },
  scanUnbilledOrders: () =>
    request<UnbilledScanResult>("/billing/charge-attention/unbilled-scan", { method: "POST" }),
  postChargeAttention: (id: string) =>
    request<ChargeAttentionItem>(`/billing/charge-attention/${id}/post`, { method: "PUT" }),
  dismissChargeAttention: (id: string, data: DismissChargeAttentionRequest) =>
    request<ChargeAttentionItem>(`/billing/charge-attention/${id}/dismiss`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Pre-auths nearly used up or rooms above the policy limit, by kind. */
  listRevenueAlerts: (params: { kind: RevenueAlertKind; status?: string }) =>
    request<Paginated<RevenueAlert>>(`/billing/revenue-alerts?${new URLSearchParams(params)}`),
  /** Ask the payer for more on a pre-auth nearly used up; closes the alert. */
  requestPreauthEnhancement: (id: string, data: RequestEnhancementRequest) =>
    request<RevenueAlert>(`/billing/revenue-alerts/${id}/request-enhancement`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Dismiss a "no usable pre-auth" alert with why none is needed. */
  dismissPreauthAlert: (id: string, data: DismissPreauthRequest) =>
    request<RevenueAlert>(`/billing/revenue-alerts/${id}/dismiss`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** The hospital's pre-auth alert threshold, and whether the stored one is unreadable. */
  getPreauthAlertSettings: () => request<PreauthAlertSettings>("/billing/preauth-alert-settings"),
  /** Save the pre-auth alert threshold (1 to 100%). */
  updatePreauthAlertSettings: (data: UpdatePreauthAlertSettings) =>
    request<PreauthAlertSettings>("/billing/preauth-alert-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Record the family's consent to a room above the policy limit; closes the alert. */
  recordRoomConsent: (id: string, data: RoomConsentInput) =>
    request<RevenueAlert>(`/billing/revenue-alerts/${id}/room-consent`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Staff who may witness a family's room consent, by name. */
  listRoomConsentWitnesses: (search?: string) =>
    request<RoomConsentWitness[]>(
      `/billing/room-consent/witnesses${search ? `?${new URLSearchParams({ search })}` : ""}`,
    ),
  /** Set the eligible room rent on a patient's policy (₹ a day or % of sum insured). */
  setRoomRentLimit: (policyId: string, data: RoomRentLimitInput) =>
    request<RoomRentLimit>(`/billing/policies/${policyId}/room-rent-limit`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  namePatientChargeAttention: (id: string, data: NamePatientChargeAttentionRequest) =>
    request<ChargeAttentionItem>(`/billing/charge-attention/${id}/patient`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  backfillClaimSettlements: (data: { dry_run: boolean }) =>
    request<ClaimSettlementBackfillResult>("/billing/claim-settlements/backfill", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listWriteOffs: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<Paginated<BadDebtWriteOff>>(`/billing/write-offs${qs}`);
  },
  createWriteOff: (data: CreateWriteOffRequest) =>
    request<BadDebtWriteOff>("/billing/write-offs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveWriteOff: (id: string, data: ApproveWriteOffRequest) =>
    request<BadDebtWriteOff>(`/billing/write-offs/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- TPA Rate Cards --
  listTpaRateCards: () => request<TpaRateCard[]>("/billing/tpa-rate-cards"),
  createTpaRateCard: (data: CreateTpaRateCardRequest) =>
    request<TpaRateCard>("/billing/tpa-rate-cards", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateTpaRateCard: (id: string, data: UpdateTpaRateCardRequest) =>
    request<TpaRateCard>(`/billing/tpa-rate-cards/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteTpaRateCard: (id: string) =>
    request<{ deleted: boolean }>(`/billing/tpa-rate-cards/${id}`, { method: "DELETE" }),

  // -- Clone & Audit --
  cloneInvoice: (id: string) =>
    request<Invoice>(`/billing/invoices/${id}/clone`, { method: "POST" }),
  listBillingAuditLog: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<AuditLogResponse>(`/billing/audit-log${qs}`);
  },

  // -- Billing Phase 3: Exchange Rates --
  listExchangeRates: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ExchangeRate[]>(`/billing/exchange-rates${qs}`);
  },
  createExchangeRate: (data: CreateExchangeRateRequest) =>
    request<ExchangeRate>("/billing/exchange-rates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Billing Phase 3: Invoice Print & Threshold --
  getInvoicePrintData: (id: string) =>
    request<InvoicePrintData>(`/billing/invoices/${id}/print-data`),
  checkBillingThreshold: (encounterId: string) =>
    request<BillingThresholdStatus>(`/billing/threshold-check/${encounterId}`),
  getSchemeRate: (params: Record<string, string>) => {
    const qs = `?${new URLSearchParams(params)}`;
    return request<SchemeRateResult>(`/billing/scheme-rate${qs}`);
  },

  // -- Billing Phase 3: Credit Patients --
  listCreditPatients: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<CreditPatient[]>(`/billing/credit-patients${qs}`);
  },
  createCreditPatient: (data: CreateCreditPatientRequest) =>
    request<CreditPatient>("/billing/credit-patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCreditPatient: (id: string, data: UpdateCreditPatientRequest) =>
    request<CreditPatient>(`/billing/credit-patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  reportCreditAging: () => request<CreditAgingRow[]>("/billing/credit-patients/aging"),

  // -- Billing Phase 3: Dual Insurance --
  coordinateDualInsurance: (invoiceId: string) =>
    request<DualInsuranceResult>(`/billing/invoices/${invoiceId}/dual-insurance`, {
      method: "POST",
    }),
  getDualInsuranceStatus: (invoiceId: string) =>
    request<DualInsuranceResult>(`/billing/invoices/${invoiceId}/dual-insurance`),
  generateReimbursementDocs: (claimId: string, documents: unknown) =>
    request<InsuranceClaim>(`/billing/insurance-claims/${claimId}/reimbursement-docs`, {
      method: "POST",
      body: JSON.stringify({ documents }),
    }),
  updateReimbursementDocs: (claimId: string, documents: unknown) =>
    request<InsuranceClaim>(`/billing/insurance-claims/${claimId}/reimbursement-docs`, {
      method: "PUT",
      body: JSON.stringify({ documents }),
    }),

  // -- Billing Phase 3: GL Accounts --
  listGlAccounts: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<GlAccount[]>(`/billing/gl-accounts${qs}`);
  },
  createGlAccount: (data: CreateGlAccountRequest) =>
    request<GlAccount>("/billing/gl-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateGlAccount: (id: string, data: UpdateGlAccountRequest) =>
    request<GlAccount>(`/billing/gl-accounts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // -- Billing Phase 3: Journal Entries --
  listJournalEntries: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<JournalEntry[]>(`/billing/journal-entries${qs}`);
  },
  getJournalEntry: (id: string) => request<JournalEntryDetail>(`/billing/journal-entries/${id}`),
  createJournalEntry: (data: CreateJournalEntryRequest) =>
    request<JournalEntryDetail>("/billing/journal-entries", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  postJournalEntry: (id: string) =>
    request<JournalEntry>(`/billing/journal-entries/${id}/post`, { method: "POST" }),
  reverseJournalEntry: (id: string) =>
    request<JournalEntryDetail>(`/billing/journal-entries/${id}/reverse`, { method: "POST" }),

  // -- Billing Phase 3: Bank Reconciliation --
  listBankTransactions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<BankTransaction[]>(`/billing/bank-transactions${qs}`);
  },
  importBankTransactions: (data: ImportBankTransactionsRequest) =>
    request<ImportBankTransactionsResponse>("/billing/bank-transactions/import", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  matchBankTransaction: (id: string, data: MatchBankTransactionRequest) =>
    request<BankTransaction>(`/billing/bank-transactions/${id}/match`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  autoReconcile: () =>
    request<AutoReconcileResponse>("/billing/bank-transactions/auto-reconcile", {
      method: "POST",
    }),

  /**
   * TPA recon (priority #4) — match unmatched bank credits to
   * insurance_claims via reference / claim_number / amount-window
   * heuristics. Returns counts; full results visible in the bank
   * transactions list with `matched_claim_id` populated.
   */
  autoMatchBankTransactions: () =>
    request<{
      processed: number;
      matched: number;
      variance_flagged: number;
      still_unmatched: number;
    }>("/billing/bank-transactions/auto-match", { method: "POST" }),

  /** Insurance receivables aging buckets per payer. */
  listInsuranceReceivablesAging: () =>
    request<
      Array<{
        tpa_name: string | null;
        bucket_0_30: number;
        bucket_30_60: number;
        bucket_60_90: number;
        bucket_90_plus: number;
        total_outstanding: number;
        claim_count: number;
      }>
    >("/billing/insurance-receivables/aging"),

  // -- Billing Phase 3: TDS --
  listTdsDeductions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<TdsDeduction[]>(`/billing/tds${qs}`);
  },
  createTdsDeduction: (data: CreateTdsRequest) =>
    request<TdsDeduction>("/billing/tds", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  depositTds: (id: string, data: { challan_number: string; challan_date: string }) =>
    request<TdsDeduction>(`/billing/tds/${id}/deposit`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  issueTdsCertificate: (
    id: string,
    data: { certificate_number: string; certificate_date: string },
  ) =>
    request<TdsDeduction>(`/billing/tds/${id}/certificate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // -- Billing Phase 3: GST Returns --
  generateGstrSummary: (data: GenerateGstrRequest) =>
    request<GstReturnSummary>("/billing/gst-returns/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listGstrSummaries: () => request<GstReturnSummary[]>("/billing/gst-returns"),
  fileGstr: (id: string) =>
    request<GstReturnSummary>(`/billing/gst-returns/${id}/file`, { method: "POST" }),
  reportHsnSummary: (period: string) =>
    request<HsnSummaryRow[]>(`/billing/reports/hsn-summary?period=${period}`),

  // -- Billing Phase 3: Financial MIS & P&L --
  reportFinancialMis: (dateFrom: string, dateTo: string) =>
    request<FinancialMisReport>(
      `/billing/reports/financial-mis?date_from=${dateFrom}&date_to=${dateTo}`,
    ),
  reportProfitLoss: (dateFrom: string, dateTo: string) =>
    request<ProfitLossDeptRow[]>(
      `/billing/reports/profit-loss?date_from=${dateFrom}&date_to=${dateTo}`,
    ),

  // -- Billing Phase 3: ERP Export --
  exportToErp: (data: ErpExportRequest) =>
    request<ErpExportLog>("/billing/erp/export", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  listErpExports: () => request<ErpExportLog[]>("/billing/erp/exports"),

  // ══════════════════════════════════════════════════════════
  //  Batch 2 — Billing (extended)
  // ══════════════════════════════════════════════════════════

  listBillingPackages: () => request<BillingServicePackage[]>("/billing/packages"),

  createBillingPackage: (data: CreateBillingServicePackageRequest) =>
    request<BillingServicePackage>("/billing/packages", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Each bill line's payer and the insurer/patient totals (#294). */
  getPayerSplit: (invoiceId: string) =>
    request<PayerSplit>(`/billing/invoices/${invoiceId}/payer-split`),
  /** Move one line to the insurer or the patient; `payer: null` returns it to the rule. */
  assignItemPayer: (
    invoiceId: string,
    itemId: string,
    data: { payer: BillPayer | null; reason?: string },
  ) =>
    request<PayerSplit>(`/billing/invoices/${invoiceId}/items/${itemId}/payer`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** Write the insurer's share onto the claim as the amount claimed. */
  applyPayerSplit: (invoiceId: string) =>
    request<PayerSplit>(`/billing/invoices/${invoiceId}/payer-split/apply`, { method: "POST" }),
  /** The non-payables list in force (the hospital's, or the IRDAI default). */
  getNonPayables: () =>
    request<{ rules: NonPayableRule[]; is_default: boolean }>("/billing/non-payables"),

  erFastInvoice: (data: ErFastInvoiceRequest) =>
    request<Invoice>("/billing/er-invoice", { method: "POST", body: JSON.stringify(data) }),

  // -- Billing Concessions --
  listConcessions: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return request<ConcessionListResponse>(`/billing/concessions${qs}`);
  },
  createConcession: (data: CreateConcessionRequest) =>
    request<BillingConcession>("/billing/concessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveConcession: (id: string) =>
    request<BillingConcession>(`/billing/concessions/${id}/approve`, { method: "PUT" }),
  rejectConcession: (id: string) =>
    request<BillingConcession>(`/billing/concessions/${id}/reject`, { method: "PUT" }),
  getAutoConcessionRules: () =>
    request<AutoConcessionRulesResponse>("/billing/concessions/auto-rules"),
  updateAutoConcessionRules: (data: { rules: AutoConcessionRule[] }) =>
    request<AutoConcessionRulesResponse>("/billing/concessions/auto-rules", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  /** The billing screen's UPI ID and payment-link terms (never provider keys). */
  getBillingPaymentSettings: () => request<BillingPaymentSettings>("/billing/payment-settings"),
  updateBillingPaymentSettings: (data: UpdateBillingPaymentSettings) =>
    request<BillingPaymentSettings>("/billing/payment-settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
