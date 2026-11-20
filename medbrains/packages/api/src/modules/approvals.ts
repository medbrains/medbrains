/** The `/approvals` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  ApprovalListParams,
  ApprovalRequestDetail,
  ApprovalRequestSummary,
  DecideApprovalRequest,
  DecidedApprovalRequest,
  RaiseApprovalRequest,
  RaisedApprovalRequest,
} from "@medbrains/types";
import { request } from "../client.js";

export const approvalsApi = {
  // ── central approvals ─────────────────────────────────────────────────────
  //
  // One set of methods for every request type. What a request *is* — its form,
  // its approval chain — is configuration on the server, so nothing here is
  // specific to leave, access or anything else.

  /** What is awaiting this user's decision. */
  listApprovalInbox: () => request<ApprovalRequestSummary[]>("/approvals/inbox"),

  /** What this user has asked for. */
  listMyApprovalRequests: () => request<ApprovalRequestSummary[]>("/approvals/mine"),

  listApprovalRequests: (params?: ApprovalListParams) => {
    const qs = new URLSearchParams();
    if (params?.kind) qs.set("kind", params.kind);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<ApprovalRequestSummary[]>(`/approvals/requests${suffix}`);
  },

  getApprovalRequest: (id: string) => request<ApprovalRequestDetail>(`/approvals/requests/${id}`),

  raiseApprovalRequest: (data: RaiseApprovalRequest) =>
    request<RaisedApprovalRequest>("/approvals/requests", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * Record a decision.
   *
   * `expected_step_seq` must be the stage the UI rendered. A 409 means the
   * request moved on — another approver got there first, or the tab is stale —
   * and the caller should reload rather than retry.
   */
  decideApprovalRequest: (id: string, data: DecideApprovalRequest) =>
    request<DecidedApprovalRequest>(`/approvals/requests/${id}/decide`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
