// DPDP Act 2023 / Rules 2025 and CERT-In 2022 compliance pack
// (crates/medbrains-regulatory/src/dpdp_*.rs).

export type PrivacyOfficerRole = "dpo" | "grievance_officer" | "certin_poc";

export interface PrivacyOfficer {
  role: PrivacyOfficerRole;
  user_id: string | null;
  name: string;
  designation: string;
  email: string;
  phone: string;
  address: string | null;
  hours: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface SetPrivacyOfficerRequest {
  user_id?: string | null;
  name: string;
  designation: string;
  email: string;
  phone: string;
  address?: string;
  hours?: string;
}

export interface PublicOfficer {
  name: string;
  designation: string;
  email: string;
  phone: string;
  address: string | null;
  hours: string | null;
}

export interface PublishedNotice {
  language: CompliancePolicyLanguage;
  version: number;
  title: string;
  body: string;
  published_at: string | null;
}

export interface PublicPrivacyContact {
  grievance_officer: PublicOfficer | null;
  dpo: PublicOfficer | null;
  notices: PublishedNotice[];
}

export type CompliancePolicyKind =
  | "privacy_notice"
  | "retention_schedule"
  | "breach_response_plan"
  | "processor_policy"
  | "children_data_policy"
  | "confidentiality_undertaking";

export type CompliancePolicyLanguage = "en" | "hi" | "ta";
export type CompliancePolicyStatus =
  | "draft"
  | "in_review"
  | "published"
  | "superseded"
  | "returned";

export interface CompliancePolicy {
  id: string;
  kind: CompliancePolicyKind;
  language: CompliancePolicyLanguage;
  version: number;
  title: string;
  body: string;
  template_version: string | null;
  status: CompliancePolicyStatus;
  drafted_by: string;
  drafted_by_name: string | null;
  submitted_at: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  return_reason: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface CompliancePolicyTemplate {
  kind: CompliancePolicyKind;
  title: string;
  legal_basis: string;
}

export interface DpdpGap {
  code: string;
  severity: "critical" | "warning";
  title: string;
  basis: string;
  fix: "officers" | "policies" | "drills" | "grievances" | "processors" | "breaches";
}

export interface DpdpDashboard {
  gaps: DpdpGap[];
  requests_open: number;
  requests_overdue: number;
  processors_active: number;
  published_policies: number;
  next_drill_due: string | null;
}

export interface ComplianceDrill {
  id: string;
  held_on: string;
  format: "tabletop" | "live";
  scenario: string;
  findings: string;
  next_due_on: string;
  conducted_by_name: string | null;
  created_at: string;
}

export interface RecordDrillRequest {
  held_on: string;
  format: "tabletop" | "live";
  scenario: string;
  findings: string;
  next_due_on?: string;
}
