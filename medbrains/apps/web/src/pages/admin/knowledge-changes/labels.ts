import type {
  KnowledgeArea,
  KnowledgeChangeOp,
  KnowledgeChangeStatus,
  KnowledgeImpactSeverity,
} from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

export const AREA_LABEL: Record<KnowledgeArea, string> = {
  drug_interactions: "Drug interactions",
  critical_value_rules: "Critical lab values",
  flow_switches: "Flow switches",
};

export const STATUS: Record<KnowledgeChangeStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft, not previewed", tone: "neutral" },
  previewed: { label: "Waiting for approval", tone: "warning" },
  approved: { label: "Approved, not applied", tone: "info" },
  applied: { label: "Applied", tone: "success" },
  rolled_back: { label: "Rolled back", tone: "neutral" },
  rejected: { label: "Rejected", tone: "danger" },
  stale: { label: "Stale: preview again", tone: "danger" },
};

export const SEVERITY: Record<KnowledgeImpactSeverity, { label: string; tone: BadgeTone }> = {
  safety: { label: "Safety", tone: "danger" },
  access: { label: "Access", tone: "warning" },
  money: { label: "Money", tone: "warning" },
  info: { label: "Info", tone: "info" },
};

export const OP_LABEL: Record<KnowledgeChangeOp, string> = {
  create: "Add",
  update: "Change",
  delete: "Remove",
};

export type FieldKind = "text" | "longtext" | "number" | "select";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: { value: string; label: string }[];
}

/** The editable fields of each area, in the order the editor shows them. */
export const AREA_FIELDS: Record<KnowledgeArea, FieldDef[]> = {
  drug_interactions: [
    { key: "drug_a_name", label: "Drug A", kind: "text", required: true },
    { key: "drug_b_name", label: "Drug B", kind: "text", required: true },
    {
      key: "severity",
      label: "Severity",
      kind: "select",
      required: true,
      options: ["minor", "moderate", "major", "contraindicated"].map((v) => ({
        value: v,
        label: v[0]?.toUpperCase() + v.slice(1),
      })),
    },
    { key: "description", label: "Description", kind: "longtext", required: true },
    { key: "mechanism", label: "Mechanism", kind: "text" },
    { key: "management", label: "Management", kind: "longtext" },
  ],
  critical_value_rules: [
    { key: "test_code", label: "Test code", kind: "text", required: true },
    { key: "test_name", label: "Test name", kind: "text", required: true },
    { key: "low_critical", label: "Critical below", kind: "number" },
    { key: "high_critical", label: "Critical above", kind: "number" },
    { key: "unit", label: "Unit", kind: "text" },
    { key: "age_min", label: "Minimum age (years)", kind: "number" },
    { key: "age_max", label: "Maximum age (years)", kind: "number" },
    {
      key: "gender",
      label: "Sex",
      kind: "select",
      options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
      ],
    },
    { key: "alert_message", label: "Alert message", kind: "longtext", required: true },
  ],
  // Drafted on Admin → Flows (the switchboard), never in the generic editor.
  flow_switches: [
    { key: "flow_code", label: "Flow", kind: "text", required: true },
    { key: "tpa_before_billing", label: "Insurance patients need TPA clearance", kind: "text" },
    { key: "final_signoff", label: "Who signs off the final discharge", kind: "text" },
  ],
};

/** Fields shown in diffs but never edited in the row form: a flow's track
 * is built on the Build tab, not typed here. */
export const DIFF_ONLY_FIELDS: Partial<Record<KnowledgeArea, FieldDef[]>> = {
  flow_switches: [{ key: "track", label: "Track (stations in order)", kind: "text" }],
};

/** A short name for a row, for lists and diffs. */
export function rowTitle(area: KnowledgeArea, fields: Record<string, unknown> | null): string {
  if (!fields) return "—";
  if (area === "flow_switches") return String(fields.flow_code ?? "");
  return area === "drug_interactions"
    ? `${String(fields.drug_a_name ?? "")} + ${String(fields.drug_b_name ?? "")}`
    : `${String(fields.test_name ?? "")} (${String(fields.test_code ?? "")})`;
}
