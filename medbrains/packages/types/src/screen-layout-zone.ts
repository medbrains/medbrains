// Screen layout zone types — split from index.ts, barrel-re-exported.
import type { DoseAlert, WeightDoseAlert } from "./clinical-knowledge-base";

// ── Screen Layout Zone Types ────────────────────────────────

export type ScreenZoneType =
  | "form"
  | "data_table"
  | "filter_bar"
  | "detail_header"
  | "tabs"
  | "stepper"
  | "calendar"
  | "kanban"
  | "widget_grid"
  | "info_panel";

export interface ScreenZone {
  type: ScreenZoneType;
  key: string;
  label?: string;
  config: Record<string, unknown>;
}

export interface ScreenAction {
  key: string;
  label: string;
  icon?: string;
  variant?: string;
  action_type: string;
  permission?: string;
  route?: string;
  confirm?: boolean;
}

export interface ScreenLayout {
  header?: {
    title: string;
    subtitle?: string;
    icon?: string;
  };
  breadcrumbs?: Array<{ label: string; path: string }>;
  actions?: ScreenAction[];
  zones: ScreenZone[];
}

// ══════════════════════════════════════════════════════════
//  Clinical Decision Support
// ══════════════════════════════════════════════════════════

export interface DrugInteraction {
  id: string;
  tenant_id: string;
  drug_a_name: string;
  drug_b_name: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  mechanism: string | null;
  management: string | null;
  source: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DrugInteractionAlert {
  drug_a: string;
  drug_b: string;
  severity: string;
  description: string;
  management: string | null;
}

export interface AllergyConflict {
  drug_name: string;
  allergen_name: string;
  allergy_type: string;
  severity: string | null;
  reaction: string | null;
}

export interface PregnancyAlert {
  drug_name: string;
  pregnancy_category: string;
  severity: string;
  description: string;
}

export interface DrugSafetyCheckResult {
  interactions: DrugInteractionAlert[];
  allergy_conflicts: AllergyConflict[];
  dose_alerts: DoseAlert[];
  weight_alerts: WeightDoseAlert[];
  renal_alerts: RenalDoseAlert[];
  hepatic_alerts: HepaticAlert[];
  ingredient_alerts: IngredientAlert[];
  pregnancy_alerts: PregnancyAlert[];
  conclusion: ClinicalConclusion;
}

export interface ClinicalConclusion {
  severity: "critical" | "warning" | "clear";
  summary: string;
  recommendation: string;
  issue_count: number;
}

export interface RenalDoseAlert {
  drug_name: string;
  egfr: number;
  threshold: number;
  rule: string;
}

export interface HepaticAlert {
  drug_name: string;
  caution: string;
}

export interface IngredientAlert {
  kind: "duplicate" | "incompatible";
  label: string;
  detail: string;
  severity: string;
}
