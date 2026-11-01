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

/** A clause over switches or facts; null applies always. */
export type FlowClause = Record<string, FlowSwitchValue> | null;

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
