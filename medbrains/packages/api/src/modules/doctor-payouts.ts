/** The `/doctor-payouts` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreatePayoutRateCard,
  DaySettlementSummary,
  DoctorAgreement,
  DoctorAgreementInput,
  DoctorPayout,
  DoctorPayoutSettingsView,
  DoctorPayoutSummaryRow,
  PayoutBankFile,
  PayoutCalcInput,
  PayoutCalcResult,
  PayoutLedgerLine,
  PayoutLedgerQuery,
  PayoutRateCard,
  PayoutRule,
  PayoutRuleInput,
  PayoutStatement,
  PayoutStatementDetail,
  PayoutTdsRow,
  PreparePayoutStatement,
  ReferralComplianceReport,
  ReferralStatementRequest,
  ReferralSwitchRequest,
  RunPayoutsRequest,
  RunPayoutsResult,
  SettleDayRequest,
  SettleDayResult,
  UpdateDoctorPayoutSettings,
} from "@medbrains/types";
import { request } from "../client.js";

export const doctorPayoutsApi = {
  // ── Doctor payouts (#4886) ──────────────────────────────────

  getDoctorPayoutSettings: () => request<DoctorPayoutSettingsView>("/doctor-payouts/settings"),

  updateDoctorPayoutSettings: (data: UpdateDoctorPayoutSettings) =>
    request<DoctorPayoutSettingsView>("/doctor-payouts/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  setReferralPayoutSwitch: (data: ReferralSwitchRequest) =>
    request<DoctorPayoutSettingsView>("/doctor-payouts/settings/referral", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listDoctorAgreements: () => request<DoctorAgreement[]>("/doctor-payouts/agreements"),

  createDoctorAgreement: (data: DoctorAgreementInput) =>
    request<DoctorAgreement>("/doctor-payouts/agreements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDoctorAgreement: (id: string, data: DoctorAgreementInput) =>
    request<DoctorAgreement>(`/doctor-payouts/agreements/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listPayoutRateCards: () => request<PayoutRateCard[]>("/doctor-payouts/rate-cards"),

  createPayoutRateCard: (data: CreatePayoutRateCard) =>
    request<string>("/doctor-payouts/rate-cards", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  newPayoutRateCardVersion: (id: string, effectiveFrom: string) =>
    request<string>(`/doctor-payouts/rate-cards/${id}/versions`, {
      method: "POST",
      body: JSON.stringify({ effective_from: effectiveFrom }),
    }),

  listPayoutRules: (cardId: string) =>
    request<PayoutRule[]>(`/doctor-payouts/rate-cards/${cardId}/rules`),

  addPayoutRule: (cardId: string, data: PayoutRuleInput) =>
    request<PayoutRule>(`/doctor-payouts/rate-cards/${cardId}/rules`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removePayoutRule: (cardId: string, ruleId: string) =>
    request<string>(`/doctor-payouts/rate-cards/${cardId}/rules/${ruleId}`, {
      method: "DELETE",
    }),

  calculatePayout: (cardId: string, data: PayoutCalcInput) =>
    request<PayoutCalcResult>(`/doctor-payouts/rate-cards/${cardId}/calculate`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listPayoutLedger: (q: PayoutLedgerQuery) =>
    request<PayoutLedgerLine[]>(
      `/doctor-payouts/ledger?${new URLSearchParams(
        Object.entries(q).filter((e): e is [string, string] => Boolean(e[1])),
      ).toString()}`,
    ),

  listPayoutStatements: (status?: string, kind?: string) =>
    request<PayoutStatement[]>(
      `/doctor-payouts/statements?${new URLSearchParams({
        ...(status ? { status } : {}),
        ...(kind ? { kind } : {}),
      }).toString()}`,
    ),

  getPayoutStatement: (id: string) =>
    request<PayoutStatementDetail>(`/doctor-payouts/statements/${id}`),

  preparePayoutStatement: (data: PreparePayoutStatement) =>
    request<PayoutStatementDetail>("/doctor-payouts/statements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adjustPayoutStatement: (id: string, data: { amount: string; reason: string }) =>
    request<PayoutStatementDetail>(`/doctor-payouts/statements/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  disputePayoutStatement: (id: string, reason: string) =>
    request<PayoutStatement>(`/doctor-payouts/statements/${id}/dispute`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  approvePayoutStatement: (id: string) =>
    request<PayoutStatement>(`/doctor-payouts/statements/${id}/approve`, { method: "POST" }),

  listDoctorPayouts: (status?: string) =>
    request<DoctorPayout[]>(`/doctor-payouts/payouts${status ? `?status=${status}` : ""}`),

  runDoctorPayouts: (data: RunPayoutsRequest) =>
    request<RunPayoutsResult>("/doctor-payouts/payouts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  markDoctorPayoutPaid: (id: string, utr?: string) =>
    request<string>(`/doctor-payouts/payouts/${id}/paid`, {
      method: "POST",
      body: JSON.stringify({ utr }),
    }),

  markDoctorPayoutFailed: (id: string, reason: string) =>
    request<string>(`/doctor-payouts/payouts/${id}/failed`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  getPayoutBankFile: (runId: string) =>
    request<PayoutBankFile>(`/doctor-payouts/runs/${runId}/bank-file`),

  getDaySettlement: (doctorId: string, date: string) =>
    request<DaySettlementSummary>(`/doctor-payouts/day?doctor_id=${doctorId}&date=${date}`),

  settleDoctorDay: (data: SettleDayRequest) =>
    request<SettleDayResult>("/doctor-payouts/day/settle", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createReferralStatement: (data: ReferralStatementRequest) =>
    request<PayoutStatementDetail>("/doctor-payouts/referral-statements", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getDoctorPayoutSummary: (from: string, to: string) =>
    request<DoctorPayoutSummaryRow[]>(`/doctor-payouts/reports/summary?from=${from}&to=${to}`),

  getPayoutTdsRegister: (financialYear: string) =>
    request<PayoutTdsRow[]>(`/doctor-payouts/reports/tds?financial_year=${financialYear}`),

  getReferralCompliance: (financialYear: string) =>
    request<ReferralComplianceReport>(
      `/doctor-payouts/reports/referral-compliance?financial_year=${financialYear}`,
    ),

  getMyEarnings: (from: string, to: string) =>
    request<PayoutLedgerLine[]>(`/doctor-payouts/me/ledger?from=${from}&to=${to}`),

  getMyPayoutStatements: () => request<PayoutStatement[]>("/doctor-payouts/me/statements"),

  disputeMyPayoutStatement: (id: string, reason: string) =>
    request<PayoutStatement>(`/doctor-payouts/me/statements/${id}/dispute`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
};
