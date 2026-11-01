/** Knowledge change sets (`/api/knowledge`), RFC-KNOWLEDGE-CHANGE-SETS. */

export type KnowledgeArea = "drug_interactions" | "critical_value_rules";

export type KnowledgeChangeStatus =
  | "draft"
  | "previewed"
  | "approved"
  | "applied"
  | "rolled_back"
  | "rejected"
  | "stale";

export type KnowledgeChangeOp = "create" | "update" | "delete";

/** Ordered most serious first. */
export type KnowledgeImpactSeverity = "safety" | "access" | "money" | "info";

export interface KnowledgeImpactExample {
  label: string;
  href: string | null;
}

export interface KnowledgeImpactEntry {
  severity: KnowledgeImpactSeverity;
  relation: string;
  summary: string;
  count: number;
  examples: KnowledgeImpactExample[];
  /** The count hit its bound and is a floor. */
  truncated: boolean;
}

export interface KnowledgeImpactReport {
  entries: KnowledgeImpactEntry[];
  computed_at: string;
}

/** A row's editable fields, as the area stores them. */
export type KnowledgeRowFields = Record<string, string | number | boolean | null>;

export interface KnowledgeChangeSet {
  id: string;
  area: KnowledgeArea;
  title: string;
  reason: string;
  status: KnowledgeChangeStatus;
  author_id: string;
  author_name: string | null;
  approver_id: string | null;
  approver_name: string | null;
  decision_note: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  applied_by: string | null;
  rollback_of_set_id: string | null;
  rolled_back_by_set_id: string | null;
  created_at: string;
  previewed_at: string | null;
  approved_at: string | null;
  applied_at: string | null;
  base_hash: string | null;
  proof_hash: string | null;
  impact: KnowledgeImpactReport | null;
}

export interface KnowledgeChangeItem {
  id: string;
  target_kind: string;
  target_key: string | null;
  op: KnowledgeChangeOp;
  before: KnowledgeRowFields | null;
  after: KnowledgeRowFields | null;
  seq: number;
}

export interface KnowledgeChangeSetDetail extends KnowledgeChangeSet {
  items: KnowledgeChangeItem[];
}

export interface NewKnowledgeChangeItem {
  op: KnowledgeChangeOp;
  target_id: string | null;
  after: KnowledgeRowFields | null;
}

export interface NewKnowledgeChangeSet {
  area: KnowledgeArea;
  title: string;
  reason: string;
  items: NewKnowledgeChangeItem[];
}

export interface KnowledgeLiveRow {
  id: string;
  fields: KnowledgeRowFields;
}

export interface KnowledgeProofAuditRow {
  id: string;
  action: string;
  hash: string;
  prev_hash: string | null;
  hash_input_canonical: string | null;
}

export interface KnowledgeProof {
  change_set_id: string;
  /** The exact text `proof_hash` is the sha256 of. */
  canonical: string;
  input: unknown;
  proof_hash: string;
  audit_rows: KnowledgeProofAuditRow[];
  how_to_verify: string;
}

export interface KnowledgeChangeSetFilter {
  area?: KnowledgeArea;
  status?: KnowledgeChangeStatus;
}
