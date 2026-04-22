import type {
  FieldAction,
  FieldDataSource,
  FieldDataType,
  FormBuilderConfig,
  FormBuilderDragState,
  FormBuilderFieldNode,
  FormBuilderHistoryEntry,
  FormBuilderNodeId,
  FormBuilderSectionNode,
  FormBuilderState,
  FormBuilderValidationRule,
  FormStatus,
  JsonLogicRule,
  RegulatoryClauseRef,
  RequirementLevel,
} from "@medbrains/types";
import { deepClone } from "@medbrains/utils";
import { create } from "zustand";

// ── 12-Column Grid Helpers ───────────────────────────────

const MAX_COLUMNS = 12;

/** Clamp column span to valid range 1–12 */
export function clampColSpan(cols: number): number {
  return Math.max(1, Math.min(MAX_COLUMNS, Math.round(cols)));
}

/** Snap a percentage width (0–100) to the nearest column count (1–12) */
export function snapPercentToColumns(percent: number): number {
  const raw = (percent / 100) * MAX_COLUMNS;
  return clampColSpan(Math.round(raw));
}

/** Convert column span to CSS percentage */
export function colSpanToPercent(colSpan: number): number {
  return (clampColSpan(colSpan) / MAX_COLUMNS) * 100;
}

// ── Tab Order ────────────────────────────────────────────

export function computeTabOrder(
  sectionOrder: FormBuilderNodeId[],
  fieldOrder: Record<FormBuilderNodeId, FormBuilderNodeId[]>,
): FormBuilderNodeId[] {
  const ordered: FormBuilderNodeId[] = [];
  for (const sectionId of sectionOrder) {
    const fieldIds = fieldOrder[sectionId];
    if (fieldIds) {
      for (const fieldId of fieldIds) {
        ordered.push(fieldId);
      }
    }
  }
  return ordered;
}

// ── ID Generation ────────────────────────────────────────

let counter = 0;
function generateId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}`;
}

// ── History Helpers ──────────────────────────────────────

const MAX_HISTORY = 50;

function takeSnapshot(state: FormBuilderStoreState): FormBuilderHistoryEntry {
  return {
    sections: deepClone(state.sections),
    sectionOrder: [...state.sectionOrder],
    fields: deepClone(state.fields),
    fieldOrder: Object.fromEntries(
      Object.entries(state.fieldOrder).map(([k, v]) => [k, [...v]]),
    ),
  };
}

// ── Default Field Factory ────────────────────────────────

interface NewFieldOptions {
  label: string;
  dataType: FieldDataType;
  fieldCode?: string;
  colSpan?: number;
  requirementLevel?: RequirementLevel;
  fieldMasterId?: string;
  placeholder?: string | null;
  helpText?: string | null;
  defaultValue?: string | null;
  options?: string[] | null;
  regulatoryClauses?: RegulatoryClauseRef[];
  icon?: string | null;
  iconPosition?: "left" | "right";
  dataSource?: FieldDataSource | null;
  actions?: FieldAction[];
}

const OPTION_TYPES = new Set(["select", "multiselect", "radio", "checkbox"]);
function hasOptions(dt: string): boolean {
  return OPTION_TYPES.has(dt);
}

function createField(options: NewFieldOptions): FormBuilderFieldNode {
  const id = generateId("fld");
  return {
    id,
    fieldMasterId: options.fieldMasterId ?? "",
    fieldCode: options.fieldCode ?? options.label.toLowerCase().replace(/\s+/g, "_"),
    label: options.label,
    dataType: options.dataType,
    requirementLevel: options.requirementLevel ?? "optional",
    colSpan: clampColSpan(options.colSpan ?? 6),
    isQuickMode: false,
    placeholder: options.placeholder ?? null,
    helpText: options.helpText ?? null,
    defaultValue: options.defaultValue ?? null,
    options: options.options ?? (hasOptions(options.dataType) ? ["Option 1", "Option 2", "Option 3"] : null),
    condition: null,
    computedExpr: null,
    validationRules: [],
    regulatoryClauses: options.regulatoryClauses ?? [],
    icon: options.icon ?? null,
    iconPosition: options.iconPosition ?? "left",
    dataSource: options.dataSource ?? null,
    actions: options.actions ?? [],
  };
}

function createSection(name: string): FormBuilderSectionNode {
  const id = generateId("sec");
  return {
    id,
    code: name.toLowerCase().replace(/\s+/g, "_"),
    name,
    icon: null,
    color: null,
    isCollapsible: true,
    isDefaultOpen: true,
    condition: null,
    layout: "single",
  };
}

// ── Store Interface ──────────────────────────────────────

interface FormBuilderActions {
  // Section operations
  addSection: (name: string) => void;
  updateSection: (id: FormBuilderNodeId, updates: Partial<FormBuilderSectionNode>) => void;
  removeSection: (id: FormBuilderNodeId) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;

  // Field operations
  addField: (sectionId: FormBuilderNodeId, options: NewFieldOptions, index?: number) => void;
  updateField: (id: FormBuilderNodeId, updates: Partial<FormBuilderFieldNode>) => void;
  removeField: (id: FormBuilderNodeId) => void;
  moveField: (
    fieldId: FormBuilderNodeId,
    fromSectionId: FormBuilderNodeId,
    toSectionId: FormBuilderNodeId,
    toIndex: number,
  ) => void;
  reorderFields: (sectionId: FormBuilderNodeId, fromIndex: number, toIndex: number) => void;
  resizeField: (id: FormBuilderNodeId, percentWidth: number) => void;

  // Selection
  selectNode: (id: FormBuilderNodeId | null) => void;

  // DnD state
  setDragState: (state: FormBuilderDragState | null) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Form metadata
  updateFormMeta: (updates: Partial<FormBuilderState["form"]>) => void;
  updateFormConfig: (updates: Partial<FormBuilderConfig>) => void;

  // Persistence
  loadForm: (state: FormBuilderState) => void;
  resetForm: () => void;
  markClean: () => void;

  // Computed
  getTabOrder: () => FormBuilderNodeId[];
  getFieldsInSection: (sectionId: FormBuilderNodeId) => FormBuilderFieldNode[];
  findFieldSection: (fieldId: FormBuilderNodeId) => FormBuilderNodeId | null;

  // Field validation rules
  addValidationRule: (fieldId: FormBuilderNodeId, rule: FormBuilderValidationRule) => void;
  removeValidationRule: (fieldId: FormBuilderNodeId, index: number) => void;
  updateFieldCondition: (fieldId: FormBuilderNodeId, condition: JsonLogicRule | null) => void;
  updateFieldComputed: (fieldId: FormBuilderNodeId, expr: string | null) => void;

  // Data source & field actions
  updateFieldDataSource: (fieldId: FormBuilderNodeId, dataSource: FieldDataSource | null) => void;
  addFieldAction: (fieldId: FormBuilderNodeId, action: FieldAction) => void;
  updateFieldAction: (fieldId: FormBuilderNodeId, actionId: string, updates: Partial<FieldAction>) => void;
  removeFieldAction: (fieldId: FormBuilderNodeId, actionId: string) => void;
}

interface FormBuilderDirtyState {
  isDirty: boolean;
  serverFormId: string | null;
}

type FormBuilderStoreState = FormBuilderState & FormBuilderDirtyState & FormBuilderActions;

const INITIAL_STATE: FormBuilderState & FormBuilderDirtyState = {
  form: {
    id: "",
    code: "",
    name: "Untitled Form",
    version: 1,
    status: "draft" as FormStatus,
    config: {
      submitLabel: "Submit",
      cancelButton: true,
      supportsQuickMode: false,
      printTemplate: null,
    },
  },
  sections: {},
  sectionOrder: [],
  fields: {},
  fieldOrder: {},
  selectedNodeId: null,
  dragState: null,
  history: { past: [], future: [] },
  isDirty: false,
  serverFormId: null,
};

export const useFormBuilderStore = create<FormBuilderStoreState>()((set, get) => ({
  ...INITIAL_STATE,

  // ── Section Operations ───────────────────────────────

  addSection: (name) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const section = createSection(name);

    set({
      sections: { ...state.sections, [section.id]: section },
      sectionOrder: [...state.sectionOrder, section.id],
      fieldOrder: { ...state.fieldOrder, [section.id]: [] },
      selectedNodeId: section.id,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateSection: (id, updates) => {
    const state = get();
    const existing = state.sections[id];
    if (!existing) return;

    const snapshot = takeSnapshot(state);
    set({
      sections: { ...state.sections, [id]: { ...existing, ...updates, id } },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  removeSection: (id) => {
    const state = get();
    const snapshot = takeSnapshot(state);

    const { [id]: _removed, ...remainingSections } = state.sections;
    const sectionFieldIds = state.fieldOrder[id] ?? [];
    const remainingFields = { ...state.fields };
    for (const fieldId of sectionFieldIds) {
      delete remainingFields[fieldId];
    }
    const { [id]: _removedOrder, ...remainingFieldOrder } = state.fieldOrder;

    set({
      sections: remainingSections,
      sectionOrder: state.sectionOrder.filter((sid) => sid !== id),
      fields: remainingFields,
      fieldOrder: remainingFieldOrder,
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  reorderSections: (fromIndex, toIndex) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const newOrder = [...state.sectionOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    if (moved) {
      newOrder.splice(toIndex, 0, moved);
    }

    set({
      sectionOrder: newOrder,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  // ── Field Operations ─────────────────────────────────

  addField: (sectionId, options, index) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const field = createField(options);
    const sectionFields = [...(state.fieldOrder[sectionId] ?? [])];
    const insertIndex = index ?? sectionFields.length;
    sectionFields.splice(insertIndex, 0, field.id);

    set({
      fields: { ...state.fields, [field.id]: field },
      fieldOrder: { ...state.fieldOrder, [sectionId]: sectionFields },
      selectedNodeId: field.id,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateField: (id, updates) => {
    const state = get();
    const existing = state.fields[id];
    if (!existing) return;

    const snapshot = takeSnapshot(state);
    set({
      fields: { ...state.fields, [id]: { ...existing, ...updates, id } },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  removeField: (id) => {
    const state = get();
    const snapshot = takeSnapshot(state);

    const { [id]: _removed, ...remainingFields } = state.fields;
    const newFieldOrder = Object.fromEntries(
      Object.entries(state.fieldOrder).map(([sectionId, fieldIds]) => [
        sectionId,
        fieldIds.filter((fid) => fid !== id),
      ]),
    );

    set({
      fields: remainingFields,
      fieldOrder: newFieldOrder,
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  moveField: (fieldId, fromSectionId, toSectionId, toIndex) => {
    const state = get();
    const snapshot = takeSnapshot(state);

    const fromFields = [...(state.fieldOrder[fromSectionId] ?? [])].filter(
      (id) => id !== fieldId,
    );
    const toFields =
      fromSectionId === toSectionId
        ? fromFields
        : [...(state.fieldOrder[toSectionId] ?? [])];

    toFields.splice(toIndex, 0, fieldId);

    set({
      fieldOrder: {
        ...state.fieldOrder,
        [fromSectionId]: fromFields,
        ...(fromSectionId !== toSectionId ? { [toSectionId]: toFields } : {}),
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  reorderFields: (sectionId, fromIndex, toIndex) => {
    const state = get();
    const snapshot = takeSnapshot(state);
    const fieldIds = [...(state.fieldOrder[sectionId] ?? [])];
    const [moved] = fieldIds.splice(fromIndex, 1);
    if (moved) {
      fieldIds.splice(toIndex, 0, moved);
    }

    set({
      fieldOrder: { ...state.fieldOrder, [sectionId]: fieldIds },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  resizeField: (id, percentWidth) => {
    const state = get();
    const existing = state.fields[id];
    if (!existing) return;

    const newColSpan = snapPercentToColumns(percentWidth);
    if (newColSpan === existing.colSpan) return;

    const snapshot = takeSnapshot(state);
    set({
      fields: { ...state.fields, [id]: { ...existing, colSpan: newColSpan } },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  // ── Selection ────────────────────────────────────────

  selectNode: (id) => set({ selectedNodeId: id }),

  // ── DnD ──────────────────────────────────────────────

  setDragState: (dragState) => set({ dragState }),

  // ── History ──────────────────────────────────────────

  undo: () => {
    const state = get();
    const { past, future } = state.history;
    if (past.length === 0) return;

    const currentSnapshot = takeSnapshot(state);
    const previous = past[past.length - 1]!;

    set({
      sections: previous.sections,
      sectionOrder: previous.sectionOrder,
      fields: previous.fields,
      fieldOrder: previous.fieldOrder,
      isDirty: true,
      history: {
        past: past.slice(0, -1),
        future: [currentSnapshot, ...future].slice(0, MAX_HISTORY),
      },
    });
  },

  redo: () => {
    const state = get();
    const { past, future } = state.history;
    if (future.length === 0) return;

    const currentSnapshot = takeSnapshot(state);
    const next = future[0]!;

    set({
      sections: next.sections,
      sectionOrder: next.sectionOrder,
      fields: next.fields,
      fieldOrder: next.fieldOrder,
      isDirty: true,
      history: {
        past: [...past, currentSnapshot],
        future: future.slice(1),
      },
    });
  },

  // ── Form Metadata ────────────────────────────────────

  updateFormMeta: (updates) => {
    const state = get();
    set({ form: { ...state.form, ...updates }, isDirty: true });
  },

  updateFormConfig: (updates) => {
    const state = get();
    set({ form: { ...state.form, config: { ...state.form.config, ...updates } }, isDirty: true });
  },

  // ── Persistence ──────────────────────────────────────

  loadForm: (formState) => {
    set({
      ...formState,
      selectedNodeId: null,
      dragState: null,
      history: { past: [], future: [] },
      isDirty: false,
      serverFormId: formState.form.id || null,
    });
  },

  resetForm: () => {
    set({ ...INITIAL_STATE });
  },

  markClean: () => {
    set({ isDirty: false });
  },

  // ── Computed Selectors ───────────────────────────────

  getTabOrder: () => {
    const state = get();
    return computeTabOrder(state.sectionOrder, state.fieldOrder);
  },

  getFieldsInSection: (sectionId) => {
    const state = get();
    const fieldIds = state.fieldOrder[sectionId] ?? [];
    return fieldIds
      .map((id) => state.fields[id])
      .filter((f): f is FormBuilderFieldNode => f !== undefined);
  },

  findFieldSection: (fieldId) => {
    const state = get();
    for (const [sectionId, fieldIds] of Object.entries(state.fieldOrder)) {
      if (fieldIds.includes(fieldId)) return sectionId;
    }
    return null;
  },

  // ── Validation & Expression Helpers ──────────────────

  addValidationRule: (fieldId, rule) => {
    const state = get();
    const field = state.fields[fieldId];
    if (!field) return;

    const snapshot = takeSnapshot(state);
    set({
      fields: {
        ...state.fields,
        [fieldId]: {
          ...field,
          validationRules: [...field.validationRules, rule],
        },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  removeValidationRule: (fieldId, index) => {
    const state = get();
    const field = state.fields[fieldId];
    if (!field) return;

    const snapshot = takeSnapshot(state);
    const rules = [...field.validationRules];
    rules.splice(index, 1);

    set({
      fields: {
        ...state.fields,
        [fieldId]: { ...field, validationRules: rules },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateFieldCondition: (fieldId, condition) => {
    const state = get();
    const field = state.fields[fieldId];
    if (!field) return;

    const snapshot = takeSnapshot(state);
    set({
      fields: {
        ...state.fields,
        [fieldId]: { ...field, condition },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateFieldComputed: (fieldId, expr) => {
    const state = get();
    const field = state.fields[fieldId];
    if (!field) return;

    const snapshot = takeSnapshot(state);
    set({
      fields: {
        ...state.fields,
        [fieldId]: { ...field, computedExpr: expr },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  // ── Data Source & Field Actions ─────────────────────────

  updateFieldDataSource: (fieldId, dataSource) => {
    const state = get();
    const field = state.fields[fieldId];
    if (!field) return;

    const snapshot = takeSnapshot(state);
    set({
      fields: {
        ...state.fields,
        [fieldId]: { ...field, dataSource },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  addFieldAction: (fieldId, action) => {
    const state = get();
    const field = state.fields[fieldId];
    if (!field) return;

    const snapshot = takeSnapshot(state);
    set({
      fields: {
        ...state.fields,
        [fieldId]: {
          ...field,
          actions: [...field.actions, action],
        },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  updateFieldAction: (fieldId, actionId, updates) => {
    const state = get();
    const field = state.fields[fieldId];
    if (!field) return;

    const idx = field.actions.findIndex((a) => a.id === actionId);
    if (idx === -1) return;

    const snapshot = takeSnapshot(state);
    const newActions = [...field.actions];
    const existing = newActions[idx]!;
    newActions[idx] = { ...existing, ...updates, id: actionId };

    set({
      fields: {
        ...state.fields,
        [fieldId]: { ...field, actions: newActions },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },

  removeFieldAction: (fieldId, actionId) => {
    const state = get();
    const field = state.fields[fieldId];
    if (!field) return;

    const snapshot = takeSnapshot(state);
    set({
      fields: {
        ...state.fields,
        [fieldId]: {
          ...field,
          actions: field.actions.filter((a) => a.id !== actionId),
        },
      },
      isDirty: true,
      history: {
        past: [...state.history.past, snapshot].slice(-MAX_HISTORY),
        future: [],
      },
    });
  },
}));

export type { FormBuilderActions, FormBuilderDirtyState, FormBuilderStoreState, NewFieldOptions };
