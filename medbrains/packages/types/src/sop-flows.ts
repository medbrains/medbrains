/** SOP flows (`/api/flows`), RFC-SOP-FLOWS. */

/** A switch's value: On/Off or a short choice. */
export type FlowSwitchValue = boolean | string;
export type FlowSwitches = Record<string, FlowSwitchValue>;

export type FlowStationKind =
  | { type: "action"; action: string }
  | { type: "task"; task: string }
  | { type: "switch"; fact: string }
  | { type: "signal"; signal: string }
  | { type: "end" };

/**
 * A clause over switches or facts; null applies always. Each entry is a
 * literal to equal or `{ op: value }` (eq, ne, gt, gte, lt, lte, in);
 * `$any` holds an OR group of clauses.
 */
export type FlowClause = Record<string, unknown> | null;

export interface FlowStation {
  key: string;
  name: string;
  stage: string;
  kind: FlowStationKind;
  /** The branch it sits on; null is the main line. */
  lane: string | null;
  switch_when: FlowClause;
  fact_when: FlowClause;
  sla_minutes: number | null;
  /** A safety signal no switch can remove. */
  locked: boolean;
  holder: string;
  /** The tenant role that holds it; null takes the block's default role. */
  holder_role?: string | null;
  required_by: string | null;
  /** Readable address, e.g. "Hospital › IPD discharge › Billing › Billing cleared". */
  path: string;
}

export interface FlowSwitchOption {
  value: string;
  label: string;
}

export type FlowSwitchKind =
  | { type: "on_off"; default: boolean }
  | { type: "choice"; options: FlowSwitchOption[]; default: string };

export interface FlowSwitchDef {
  key: string;
  stage: string;
  sentence: string;
  sop: string;
  kind: FlowSwitchKind;
  /** One short line per value: what it does to the route. */
  effects: FlowSwitchOption[];
  path: string;
}

export interface FlowVersionCount {
  version: number;
  patients: number;
}

export interface FlowPendingChange {
  id: string;
  status: string;
  title: string;
  approvals: number;
  after: Record<string, FlowSwitchValue> | null;
}

export interface FlowHistoryEntry {
  change_set_id: string;
  title: string;
  applied_at: string | null;
  author_name: string | null;
  approver_name: string | null;
  second_approver_name: string | null;
  before: Record<string, FlowSwitchValue> | null;
  after: Record<string, FlowSwitchValue> | null;
}

export interface FlowDetail {
  code: string;
  name: string;
  clinical: boolean;
  template_id: string;
  version: number;
  status: string;
  published_at: string | null;
  switches: FlowSwitches;
  switch_defs: FlowSwitchDef[];
  stations: FlowStation[];
  in_flight: FlowVersionCount[];
  pending_change: FlowPendingChange | null;
  history: FlowHistoryEntry[];
  path: string;
}

export interface FlowSummary {
  code: string;
  name: string;
  module: string;
  version: number | null;
  in_flight: number;
}

export interface FlowImpactExample {
  label: string;
  href: string | null;
}

export interface FlowImpactLine {
  severity: "safety" | "money" | "info";
  relation: string;
  summary: string;
  count: number;
  examples: FlowImpactExample[];
  truncated: boolean;
}

export interface FlowImpactReport {
  route_changes: string[];
  entries: FlowImpactLine[];
}

export interface FlowStationPatient {
  admission_id: string;
  label: string;
  minutes: number;
  overdue: boolean;
  version: number | null;
}

export interface FlowStationLoad {
  key: string;
  name: string;
  path: string;
  holder: string;
  sla_minutes: number | null;
  count: number;
  longest_minutes: number | null;
  label: "calm" | "busy" | "overdue";
  patients: FlowStationPatient[];
}

export interface FlowControlRoom {
  flow_code: string;
  as_of: string;
  patients_visible: boolean;
  stations: FlowStationLoad[];
  spotlight: string;
  spotlight_station: string | null;
}

export interface FlowTicketStation {
  key: string;
  name: string;
  path: string;
  kind: "action" | "task" | "signal" | "switch" | "end";
  holder: string;
  outstanding: string[];
  since: string;
  minutes: number;
  sla_minutes: number | null;
  overdue: boolean;
  routed_by: string | null;
}

export interface FlowTicketStop {
  key: string;
  name: string;
  lane: string | null;
  state: "done" | "current" | "ahead" | "skipped";
  cleared_at: string | null;
}

export interface FlowTicket {
  instance_id: string;
  flow_code: string;
  subject_id: string;
  version: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  current: FlowTicketStation | null;
  stops: FlowTicketStop[];
  last_error: { station: string; name: string; reason: string; at: string } | null;
}

export interface FlowRunRequest {
  station: string;
  input: Record<string, string>;
}

/** A registered building block a flow designer may place (RFC §11.2). */
export interface FlowBlock {
  kind: "signal" | "task" | "action";
  code: string;
  name: string;
  /** What it does, in one sentence. */
  does: string;
  holder: string;
  /** The role that holds it unless the designer picks another. */
  role: string;
  /** The permission the holder's role needs. */
  permission: string;
  inputs: string[];
  stage: string;
  sla_minutes: number | null;
}

export type FlowFactType = "bool" | "number" | "text";

export interface FlowFact {
  key: string;
  label: string;
  type: FlowFactType;
  operators: string[];
}

export interface FlowNamed {
  code: string;
  name: string;
}

export interface FlowCheck {
  rule: "invariants" | "locked" | "ends" | "conditions" | "staffed" | "dry_run";
  sentence: string;
  pass: boolean;
  problems: string[];
  stations: string[];
}

export interface FlowDraft {
  id: string;
  flow_code: string;
  base_template_id: string | null;
  stations: FlowStation[];
  revision: number;
  dry_run_revision: number | null;
  dry_run_at: string | null;
  status: string;
  updated_at: string;
  updated_by_name: string | null;
  /** Another change was published after this draft started. */
  stale: boolean;
}

/** `GET /api/flows/{code}/build`: everything the Build tab draws. */
export interface FlowBuilder {
  code: string;
  name: string;
  template_id: string;
  version: number;
  published: FlowStation[];
  library: FlowStation[];
  switches: FlowSwitches;
  switch_defs: FlowSwitchDef[];
  draft: FlowDraft | null;
  checks: FlowCheck[];
  catalogue: {
    blocks: FlowBlock[];
    facts: FlowFact[];
    departments: FlowNamed[];
    roles: FlowNamed[];
  };
}

export interface FlowSaveDraft {
  /** The revision the screen last saw; 0 starts a new draft. */
  revision: number;
  stations: FlowStation[];
}

export interface FlowSample {
  label: string;
  facts: Record<string, unknown>;
  route: string[];
  skipped: string[];
}

export interface FlowReplay {
  journeys: number;
  route_differently: number;
  skip_required: number;
  median_minutes_before: number | null;
  median_minutes_after: number | null;
  used_expected_times: boolean;
  sentences: string[];
}

export interface FlowTestDrive {
  revision: number;
  samples: FlowSample[];
  replay: FlowReplay;
}
