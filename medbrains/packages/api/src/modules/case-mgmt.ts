/** The `/case-mgmt` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  AutoAssignRequest,
  BarrierAnalyticsRow,
  CaseAssignment,
  CaseloadRow,
  CaseReferral,
  CreateCaseAssignmentRequest,
  CreateCaseReferralRequest,
  CreateDischargeBarrierRequest,
  DischargeBarrier,
  DispositionRow,
  OutcomeAnalytics,
  UpdateCaseAssignmentRequest,
  UpdateCaseReferralRequest,
  UpdateDischargeBarrierRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const caseMgmtApi = {
  // ══════════════════════════════════════════════════════════
  //  Case Management
  // ══════════════════════════════════════════════════════════

  listCaseAssignments: (params?: {
    case_manager_id?: string;
    status?: string;
    priority?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.case_manager_id) sp.set("case_manager_id", params.case_manager_id);
    if (params?.status) sp.set("status", params.status);
    if (params?.priority) sp.set("priority", params.priority);
    const qs = sp.toString();
    return request<CaseAssignment[]>(`/case-mgmt/assignments${qs ? `?${qs}` : ""}`);
  },

  createCaseAssignment: (data: CreateCaseAssignmentRequest) =>
    request<CaseAssignment>("/case-mgmt/assignments", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getCaseAssignment: (id: string) => request<CaseAssignment>(`/case-mgmt/assignments/${id}`),

  updateCaseAssignment: (id: string, data: UpdateCaseAssignmentRequest) =>
    request<CaseAssignment>(`/case-mgmt/assignments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  caseloadSummary: () => request<CaseloadRow[]>("/case-mgmt/caseload"),

  autoAssignCase: (data: AutoAssignRequest) =>
    request<CaseAssignment>("/case-mgmt/auto-assign", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listDischargeBarriers: (params?: {
    case_assignment_id?: string;
    barrier_type?: string;
    is_resolved?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.case_assignment_id) sp.set("case_assignment_id", params.case_assignment_id);
    if (params?.barrier_type) sp.set("barrier_type", params.barrier_type);
    if (params?.is_resolved) sp.set("is_resolved", params.is_resolved);
    const qs = sp.toString();
    return request<DischargeBarrier[]>(`/case-mgmt/barriers${qs ? `?${qs}` : ""}`);
  },

  createDischargeBarrier: (data: CreateDischargeBarrierRequest) =>
    request<DischargeBarrier>("/case-mgmt/barriers", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateDischargeBarrier: (id: string, data: UpdateDischargeBarrierRequest) =>
    request<DischargeBarrier>(`/case-mgmt/barriers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listCaseReferrals: (params?: {
    case_assignment_id?: string;
    referral_type?: string;
    status?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.case_assignment_id) sp.set("case_assignment_id", params.case_assignment_id);
    if (params?.referral_type) sp.set("referral_type", params.referral_type);
    if (params?.status) sp.set("status", params.status);
    const qs = sp.toString();
    return request<CaseReferral[]>(`/case-mgmt/referrals${qs ? `?${qs}` : ""}`);
  },

  createCaseReferral: (data: CreateCaseReferralRequest) =>
    request<CaseReferral>("/case-mgmt/referrals", { method: "POST", body: JSON.stringify(data) }),

  updateCaseReferral: (id: string, data: UpdateCaseReferralRequest) =>
    request<CaseReferral>(`/case-mgmt/referrals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  dispositionAnalytics: () => request<DispositionRow[]>("/case-mgmt/analytics/dispositions"),

  barrierAnalytics: () => request<BarrierAnalyticsRow[]>("/case-mgmt/analytics/barriers"),

  outcomeAnalytics: () => request<OutcomeAnalytics>("/case-mgmt/analytics/outcomes"),
};
