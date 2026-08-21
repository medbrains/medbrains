/**
 * Central approvals platform.
 *
 * One request model for everything a person can ask the hospital for — access,
 * leave, a controlled drug, a parking pass. The request *type* is configuration
 * rather than code, so this file describes the shape of a request and its
 * chain, not any particular kind of request.
 *
 * Backend: `crates/medbrains-approvals-api`.
 */

/**
 * One vocabulary for every request type.
 *
 * `rejected` is the word for a refusal. The sixteen implementations this
 * replaces used four state machines between them, two of which disagreed on
 * that — a report grouping by status counted the same event twice.
 *
 * `revoked` is distinct from `rejected` on purpose: the grant existed and may
 * have been used, which is what an audit needs to know.
 */
export type ApprovalStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "revoked";

export type ApprovalDecisionKind = "approve" | "reject" | "abstain";

export type ApprovalStepStatus = "waiting" | "active" | "approved" | "rejected" | "skipped";

/** A row in a list. Deliberately without the payload or the decision history. */
export interface ApprovalRequestSummary {
  id: string;
  /** The request type's code, e.g. `facilities.parking_pass`. */
  kind: string;
  status: ApprovalStatus;
  reason: string;
  requester_id: string;
  /**
   * Which stage is live.
   *
   * Must be echoed back when deciding — see {@link DecideApprovalRequest}.
   */
  current_step_seq: number;
  created_at: string;
  sla_due_at: string | null;
}

export interface ApprovalDecision {
  actor_id: string;
  decision: ApprovalDecisionKind;
  note: string | null;
  /** Present where the stage required a witness. Never the actor. */
  witnessed_by: string | null;
  signed_at: string;
}

export interface ApprovalStep {
  seq: number;
  name: string;
  status: ApprovalStepStatus;
  /** How many approvals this stage needs. 2 expresses a dual lock. */
  quorum: number;
  requires_witness: boolean;
  decisions: ApprovalDecision[];
}

export interface ApprovalRequestDetail extends ApprovalRequestSummary {
  /** Answers to the request type's configured fields. */
  payload: Record<string, unknown>;
  /** Who the request is about, when that is not the requester. */
  on_behalf_of_id: string | null;
  steps: ApprovalStep[];
}

export interface RaiseApprovalRequest {
  kind: string;
  reason: string;
  payload?: Record<string, unknown>;
  on_behalf_of_id?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
}

export interface RaisedApprovalRequest {
  request_id: string;
  steps: number;
  /**
   * How many people the first stage went to.
   *
   * Zero means an external or automatic stage, not an unassigned one — the
   * engine refuses to create a human stage nobody can decide.
   */
  awaiting: number;
}

export interface DecideApprovalRequest {
  decision: ApprovalDecisionKind;
  note?: string | null;
  /** Required where the stage demands a witness, and must not be the actor. */
  witnessed_by?: string | null;
  /**
   * The stage the UI believed was live when it rendered.
   *
   * Sent deliberately rather than resolved server-side. If the server read the
   * current stage itself, a decision would always apply to whatever state it
   * arrived to — so two approvers clicking at once would both succeed, and a
   * stale tab could decide a stage that had already moved on. Sending it makes
   * the second one a 409 the user can act on.
   */
  expected_step_seq: number;
}

export interface DecidedApprovalRequest {
  status: ApprovalStatus;
  /** Rendered by the server: "1 of 2 approvals", "approved". */
  outcome: string;
  /** Whether a domain effect ran. False for config-only request types. */
  effect_applied: boolean;
}

export interface ApprovalListParams {
  kind?: string;
  status?: ApprovalStatus;
  limit?: number;
}
