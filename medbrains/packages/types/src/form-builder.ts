// Form builder types — split from index.ts, barrel-re-exported.
import type { FieldDataType, FormStatus, RequirementLevel } from "./common";
import type { RegulatoryClauseRef } from "./form-master";
import type { FieldAction, FieldDataSource } from "./form-runtime";
import type { PrintTemplateConfig } from "./index";

// ── Form Builder Types ──────────────────────────────────

/** Unique ID for any form builder node */
export type FormBuilderNodeId = string;

/** JSON Logic rule — pure data, no code execution */
export type JsonLogicRule = Record<string, unknown> | boolean | null;

/** The complete form builder state — single source of truth */
export interface FormBuilderState {
  /** Form metadata */
  form: {
    id: string;
    code: string;
    name: string;
    version: number;
    status: FormStatus;
    config: FormBuilderConfig;
  };

  /** Flat map of all sections (O(1) lookup) */
  sections: Record<FormBuilderNodeId, FormBuilderSectionNode>;

  /** Ordered list of section IDs (defines visual order) */
  sectionOrder: FormBuilderNodeId[];

  /** Flat map of all fields (O(1) lookup) */
  fields: Record<FormBuilderNodeId, FormBuilderFieldNode>;

  /** Section -> ordered field IDs mapping */
  fieldOrder: Record<FormBuilderNodeId, FormBuilderNodeId[]>;

  /** Currently selected node for property editing */
  selectedNodeId: FormBuilderNodeId | null;

  /** Drag state */
  dragState: FormBuilderDragState | null;

  /** Undo/redo history */
  history: FormBuilderHistoryStack;
}

/** Section node in the form builder */
export interface FormBuilderSectionNode {
  id: FormBuilderNodeId;
  code: string;
  name: string;
  icon: string | null;
  color: string | null;
  isCollapsible: boolean;
  isDefaultOpen: boolean;
  condition: JsonLogicRule | null;
  layout: "single" | "two-column" | "three-column";
}

/** Field node in the form builder */
export interface FormBuilderFieldNode {
  id: FormBuilderNodeId;
  fieldMasterId: string;
  fieldCode: string;
  label: string;
  dataType: FieldDataType;
  requirementLevel: RequirementLevel;
  /** Column span in a 12-column grid (1–12) */
  colSpan: number;
  isQuickMode: boolean;
  placeholder: string | null;
  helpText: string | null;
  defaultValue: string | null;

  /** Choices for select / multiselect / radio / checkbox fields */
  options: string[] | null;

  // Expression-powered properties (MBX)
  condition: JsonLogicRule | null;
  computedExpr: string | null;
  validationRules: FormBuilderValidationRule[];

  // Regulatory (read-only, from field_master)
  regulatoryClauses: RegulatoryClauseRef[];

  // Field icon (shown in leftSection or rightSection of the input)
  icon: string | null;
  iconPosition: "left" | "right";

  // Data source binding (for option-type fields)
  dataSource: FieldDataSource | null;

  // Field actions (API calls, validation, lookup, copy)
  actions: FieldAction[];
}

/** Enhanced validation rule for the form builder */
export interface FormBuilderValidationRule {
  type: "required" | "min_length" | "max_length" | "regex" | "min" | "max" | "custom_expr";
  value: string | number | boolean;
  message: string;
  condition?: JsonLogicRule;
}

/** Form-level configuration */
export interface FormBuilderConfig {
  submitLabel: string;
  cancelButton: boolean;
  supportsQuickMode: boolean;
  printTemplate: PrintTemplateConfig | null;
}

/** Drag-and-drop state */
export interface FormBuilderDragState {
  type: "field" | "section" | "palette-field";
  sourceId: FormBuilderNodeId;
  sourceSectionId?: FormBuilderNodeId;
  targetSectionId?: FormBuilderNodeId;
  targetIndex?: number;
}

/** Snapshot of form builder state for undo/redo */
export interface FormBuilderHistoryEntry {
  sections: Record<FormBuilderNodeId, FormBuilderSectionNode>;
  sectionOrder: FormBuilderNodeId[];
  fields: Record<FormBuilderNodeId, FormBuilderFieldNode>;
  fieldOrder: Record<FormBuilderNodeId, FormBuilderNodeId[]>;
}

/** Undo/redo stack */
export interface FormBuilderHistoryStack {
  past: FormBuilderHistoryEntry[];
  future: FormBuilderHistoryEntry[];
}
