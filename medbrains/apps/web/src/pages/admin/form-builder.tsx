import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  ActionIcon,
  Badge,
  Button,
  Center,
  Checkbox,
  Divider,
  FileInput,
  Group,
  Loader,
  Modal,
  MultiSelect,
  NumberInput,
  Radio,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useFormBuilderStore } from "@medbrains/stores";
import { api } from "@medbrains/api";
import type {
  FieldDataType,
  FieldMasterFull,
  FormBuilderConfig,
  FormBuilderFieldNode,
  FormBuilderSectionNode,
  FormBuilderState,
  FormDetailResponse,
  RegulatoryClauseWithContext,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconDeviceFloppy,
  IconEye,
  IconForms,
  IconGitBranch,
  IconHistory,
  IconInfoCircle,
  IconLetterCase,
  IconLock,
  IconSettings,
  IconShield,
  IconUpload,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Canvas, FieldPalette, PropertyPanel, RegulatoryBrowser } from "../../components/FormBuilder";
import { VersionHistoryDrawer } from "../../components/FormBuilder/VersionHistoryDrawer";
import { SectionIcon } from "../../components/DynamicForm/SectionIcon";
import classes from "../../components/FormBuilder/form-builder.module.scss";

// ── Drag Overlay Content ────────────────────────────────

function DragOverlayContent({
  activeField,
  paletteLabel,
}: {
  activeField: FormBuilderFieldNode | null;
  paletteLabel: string | null;
}) {
  if (paletteLabel) {
    return (
      <div className={classes.dragOverlay}>
        <IconLetterCase size={14} />
        {paletteLabel}
      </div>
    );
  }

  if (activeField) {
    return (
      <div className={classes.dragOverlay}>
        <IconLetterCase size={14} />
        {activeField.label}
        <Badge size="xs" variant="light" color="slate">
          {activeField.dataType}
        </Badge>
      </div>
    );
  }

  return null;
}

// ── Preview Field Renderer ──────────────────────────────

function fieldLabel(field: FormBuilderFieldNode) {
  const hasHint = Boolean(field.helpText) || field.regulatoryClauses.length > 0;

  return (
    <Group gap={4} wrap="nowrap">
      <Text size="sm" fw={500}>
        {field.label}
      </Text>
      {field.requirementLevel === "mandatory" && (
        <Text size="sm" c="danger">
          *
        </Text>
      )}
      {hasHint && (
        <Tooltip
          label={
            <Stack gap={4}>
              {field.helpText && <Text size="xs">{field.helpText}</Text>}
              {field.regulatoryClauses.length > 0 && (
                <Group gap={4} wrap="wrap">
                  {field.regulatoryClauses.map((c) => (
                    <Badge
                      key={`${c.body_code}-${c.clause_code ?? ""}`}
                      size="xs"
                      variant="light"
                    >
                      {c.body_code}
                      {c.clause_code ? ` ${c.clause_code}` : ""}
                    </Badge>
                  ))}
                </Group>
              )}
            </Stack>
          }
          multiline
          w={300}
          withArrow
          position="top-end"
          events={{ hover: true, focus: true, touch: true }}
        >
          <ActionIcon variant="subtle" size="xs" color="slate" aria-label="Info">
            <IconInfoCircle size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}

function PreviewField({ field }: { field: FormBuilderFieldNode }) {
  const label = fieldLabel(field);
  const placeholder = field.placeholder ?? `Enter ${field.label.toLowerCase()}`;
  const selectData = (field.options ?? []).map((o) => ({ value: o, label: o }));

  // Field icon support
  const fieldIcon = field.icon ? <SectionIcon icon={field.icon} size={16} /> : undefined;
  const iconPos = field.iconPosition ?? "left";
  const leftIcon = fieldIcon && iconPos === "left" ? fieldIcon : undefined;
  const rightIcon = fieldIcon && iconPos === "right" ? fieldIcon : undefined;

  switch (field.dataType) {
    // ── Basic Text Types ──────────────────────────
    case "text":
      return <TextInput label={label} placeholder={placeholder} leftSection={leftIcon} rightSection={rightIcon} />;
    case "email":
      return <TextInput label={label} placeholder={placeholder} type="email" leftSection={leftIcon} rightSection={rightIcon} />;
    case "phone":
      return <TextInput label={label} placeholder={placeholder} type="tel" leftSection={leftIcon} rightSection={rightIcon} />;
    case "textarea":
      return <Textarea label={label} placeholder={placeholder} autosize minRows={3} />;

    // ── Number Types ──────────────────────────────
    case "number":
      return <NumberInput label={label} placeholder={placeholder} leftSection={leftIcon} rightSection={rightIcon} />;
    case "decimal":
      return <NumberInput label={label} placeholder={placeholder} decimalScale={2} leftSection={leftIcon} rightSection={rightIcon} />;

    // ── Date / Time Types ─────────────────────────
    case "date":
      return <TextInput label={label} placeholder="YYYY-MM-DD" type="date" leftSection={leftIcon} rightSection={rightIcon} />;
    case "datetime":
      return <TextInput label={label} placeholder="YYYY-MM-DDTHH:MM" type="datetime-local" leftSection={leftIcon} rightSection={rightIcon} />;
    case "time":
      return <TextInput label={label} placeholder="HH:MM" type="time" leftSection={leftIcon} rightSection={rightIcon} />;

    // ── Selection Types ───────────────────────────
    case "select":
      return (
        <Select
          label={label}
          placeholder={placeholder}
          data={selectData}
          clearable
          searchable
          leftSection={leftIcon}
          rightSection={rightIcon}
        />
      );
    case "multiselect":
      return (
        <MultiSelect
          label={label}
          placeholder={placeholder}
          data={selectData}
          clearable
          searchable
          leftSection={leftIcon}
        />
      );
    case "radio":
      return (
        <Radio.Group label={label}>
          <Group mt="xs" gap="lg">
            {(field.options ?? []).map((opt) => (
              <Radio key={opt} value={opt} label={opt} />
            ))}
            {(!field.options || field.options.length === 0) && (
              <Text size="sm" c="dimmed" fs="italic">No options defined</Text>
            )}
          </Group>
        </Radio.Group>
      );
    case "checkbox":
      return (
        <Checkbox.Group label={label}>
          <Group mt="xs" gap="lg">
            {(field.options ?? []).map((opt) => (
              <Checkbox key={opt} value={opt} label={opt} />
            ))}
            {(!field.options || field.options.length === 0) && (
              <Text size="sm" c="dimmed" fs="italic">No options defined</Text>
            )}
          </Group>
        </Checkbox.Group>
      );

    // ── Boolean ───────────────────────────────────
    case "boolean":
      return <Switch label={label} />;

    // ── File Upload ───────────────────────────────
    case "file":
      return <FileInput label={label} placeholder="Choose file..." clearable leftSection={leftIcon} />;

    // ── Computed (read-only) ──────────────────────
    case "computed":
      return (
        <TextInput
          label={label}
          placeholder="Auto-calculated"
          disabled
          leftSection={leftIcon}
          rightSection={rightIcon}
        />
      );

    // ── Hidden / JSON / UUID FK ───────────────────
    case "hidden":
      return (
        <TextInput
          label={label}
          placeholder="Hidden field"
          description="This field is not visible to users"
          disabled
          variant="filled"
        />
      );
    case "json":
      return (
        <Textarea
          label={label}
          placeholder='{"key": "value"}'
          autosize
          minRows={3}
          styles={{ input: { fontFamily: "monospace", fontSize: "var(--mantine-font-size-sm)" } }}
        />
      );
    case "uuid_fk":
      return (
        <Select
          label={label}
          placeholder="Select reference..."
          data={[]}
          disabled
          leftSection={leftIcon}
        />
      );

    default:
      return <TextInput label={label} placeholder={placeholder} leftSection={leftIcon} rightSection={rightIcon} />;
  }
}

// ── Preview Modal ───────────────────────────────────────

function PreviewModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const form = useFormBuilderStore((s) => s.form);
  const sectionOrder = useFormBuilderStore((s) => s.sectionOrder);
  const sections = useFormBuilderStore((s) => s.sections);
  const fields = useFormBuilderStore((s) => s.fields);
  const fieldOrder = useFormBuilderStore((s) => s.fieldOrder);

  const fieldWidthStyle = (colSpan: number) => ({
    width: `calc(${(Math.max(1, Math.min(12, colSpan)) / 12) * 100}% - 12px)`,
  });

  const sectionIconVars = (color: string | null): React.CSSProperties => {
    if (!color) return {};
    return {
      "--section-icon-bg": `var(--mantine-color-${color}-1)`,
      "--section-icon-color": `var(--mantine-color-${color}-6)`,
      "--section-icon-bg-dark": `var(--mantine-color-${color}-9)`,
      "--section-icon-color-dark": `var(--mantine-color-${color}-4)`,
    } as React.CSSProperties;
  };

  const totalFields = sectionOrder.reduce((sum, sid) => sum + (fieldOrder[sid]?.length ?? 0), 0);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconEye size={18} />
          <Text fw={600}>Preview</Text>
        </Group>
      }
      size="xl"
      fullScreen
      styles={{ body: { padding: "24px 32px" } }}
    >
      <ScrollArea h="calc(100vh - 100px)">
        {/* Form Header */}
        <div className={classes.previewHeader}>
          <div className={classes.previewHeaderIcon}>
            <IconForms size={20} />
          </div>
          <div>
            <Title order={4}>{form.name}</Title>
            <Text size="xs" c="dimmed">
              {sectionOrder.length} section{sectionOrder.length !== 1 ? "s" : ""}
              {" \u00B7 "}
              {totalFields} field{totalFields !== 1 ? "s" : ""}
            </Text>
          </div>
        </div>

        <Stack gap="md">
          {sectionOrder.map((sectionId) => {
            const section = sections[sectionId];
            if (!section) return null;
            const sectionFieldIds = fieldOrder[sectionId] ?? [];

            return (
              <div key={sectionId} className={classes.previewSection}>
                <div className={classes.previewSectionHeader}>
                  <div className={classes.previewSectionIcon} style={sectionIconVars(section.color)}>
                    <SectionIcon icon={section.icon} size={14} />
                  </div>
                  <div className={classes.previewSectionTitle}>{section.name}</div>
                  <div className={classes.previewFieldCount}>
                    {sectionFieldIds.length} field{sectionFieldIds.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className={classes.previewSectionBody}>
                  <div className={classes.previewFieldGrid}>
                    {sectionFieldIds.map((fieldId) => {
                      const field = fields[fieldId];
                      if (!field) return null;

                      return (
                        <div key={fieldId} style={fieldWidthStyle(field.colSpan)}>
                          <PreviewField field={field} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </Stack>

        {sectionOrder.length > 0 && (
          <div className={classes.previewActions} style={{ marginTop: 16 }}>
            {form.config.cancelButton && (
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button>{form.config.submitLabel}</Button>
          </div>
        )}

        {sectionOrder.length === 0 && (
          <Text c="dimmed" ta="center" py="xl">
            No sections or fields to preview. Add a section and drop some fields first.
          </Text>
        )}
      </ScrollArea>
    </Modal>
  );
}

// ── API → Store Transformer ──────────────────────────────

function uiWidthToColSpan(uiWidth: string | null): number {
  if (!uiWidth) return 6;
  const num = Number.parseInt(uiWidth, 10);
  if (Number.isFinite(num) && num >= 1 && num <= 12) return num;
  // Handle percentage strings like "50%"
  if (uiWidth.endsWith("%")) {
    const pct = Number.parseFloat(uiWidth);
    if (Number.isFinite(pct)) return Math.max(1, Math.min(12, Math.round((pct / 100) * 12)));
  }
  return 6;
}

function transformFormDetail(
  detail: FormDetailResponse,
  fieldMasters: FieldMasterFull[],
  allClauses?: RegulatoryClauseWithContext[],
): FormBuilderState {
  const masterMap = new Map(fieldMasters.map((fm) => [fm.id, fm]));

  // Group regulatory clauses by field_id for O(1) lookup
  const clausesByFieldId = new Map<string, RegulatoryClauseWithContext[]>();
  if (allClauses) {
    for (const clause of allClauses) {
      const existing = clausesByFieldId.get(clause.field_id);
      if (existing) {
        existing.push(clause);
      } else {
        clausesByFieldId.set(clause.field_id, [clause]);
      }
    }
  }

  const sections: Record<string, FormBuilderSectionNode> = {};
  const sectionOrder: string[] = [];
  const fields: Record<string, FormBuilderFieldNode> = {};
  const fieldOrder: Record<string, string[]> = {};

  // Sort sections by sort_order
  const sortedSections = [...detail.sections].sort((a, b) => a.sort_order - b.sort_order);

  for (const sec of sortedSections) {
    sections[sec.id] = {
      id: sec.id,
      code: sec.code,
      name: sec.name,
      icon: sec.icon,
      color: sec.color ?? null,
      isCollapsible: sec.is_collapsible,
      isDefaultOpen: sec.is_default_open,
      condition: null,
      layout: "single",
    };
    sectionOrder.push(sec.id);

    // Sort fields by sort_order
    const sortedFields = [...sec.fields].sort((a, b) => a.sort_order - b.sort_order);
    const sectionFieldIds: string[] = [];

    for (const ff of sortedFields) {
      const master = masterMap.get(ff.field_id);
      const fieldClauses = clausesByFieldId.get(ff.field_id) ?? [];
      const fieldNode: FormBuilderFieldNode = {
        id: ff.ff_id,
        fieldMasterId: ff.field_id,
        fieldCode: ff.field_code,
        label: ff.label_override ?? ff.field_name,
        dataType: ff.data_type,
        requirementLevel: "optional",
        colSpan: master ? uiWidthToColSpan(master.ui_width) : 6,
        isQuickMode: ff.is_quick_mode,
        placeholder: master?.placeholder ?? null,
        helpText: master?.description ?? null,
        defaultValue: master?.default_value ?? null,
        options: master?.validation?.options ?? null,
        condition: master?.condition as FormBuilderFieldNode["condition"] ?? null,
        computedExpr: null,
        validationRules: [],
        regulatoryClauses: fieldClauses.map((c) => ({
          body_code: c.body_code,
          body_name: c.body_name,
          clause_code: c.clause_code,
          clause_reference: c.clause_reference,
          requirement_level: c.requirement_level,
        })),
        dataSource: null,
        actions: [],
        icon: ff.icon ?? null,
        iconPosition: (ff.icon_position as "left" | "right") ?? "left",
      };
      fields[ff.ff_id] = fieldNode;
      sectionFieldIds.push(ff.ff_id);
    }

    fieldOrder[sec.id] = sectionFieldIds;
  }

  const config: FormBuilderConfig = {
    submitLabel: (detail.config as Record<string, unknown>)?.submitLabel as string ?? "Submit",
    cancelButton: (detail.config as Record<string, unknown>)?.cancelButton as boolean ?? true,
    supportsQuickMode: (detail.config as Record<string, unknown>)?.supportsQuickMode as boolean ?? false,
    printTemplate: null,
  };

  return {
    form: {
      id: detail.id,
      code: detail.code,
      name: detail.name,
      version: detail.version,
      status: detail.status,
      config,
    },
    sections,
    sectionOrder,
    fields,
    fieldOrder,
    selectedNodeId: null,
    dragState: null,
    history: { past: [], future: [] },
  };
}

// ── Empty State ─────────────────────────────────────────

function EmptyFormBuilder() {
  return (
    <Center h="calc(100vh - 120px)">
      <Stack align="center" gap="lg" maw={400}>
        <IconForms size={64} stroke={1} style={{ opacity: 0.3 }} />
        <Title order={3} ta="center">
          No form selected
        </Title>
        <Text c="dimmed" ta="center" size="sm">
          Open a form from Settings to start designing. The Form Builder lets you
          visually arrange fields, set conditions, and preview forms.
        </Text>
        <Button
          component={Link}
          to="/admin/settings"
          variant="light"
          leftSection={<IconSettings size={16} />}
        >
          Go to Settings
        </Button>
      </Stack>
    </Center>
  );
}

// ── Main Page ───────────────────────────────────────────

export function FormBuilderPage() {
  useRequirePermission(P.ADMIN.FORM_BUILDER.LIST);
  const { formId } = useParams<{ formId?: string }>();
  const queryClient = useQueryClient();

  const form = useFormBuilderStore((s) => s.form);
  const sectionOrder = useFormBuilderStore((s) => s.sectionOrder);
  const fields = useFormBuilderStore((s) => s.fields);
  const history = useFormBuilderStore((s) => s.history);
  const isDirty = useFormBuilderStore((s) => s.isDirty);
  const serverFormId = useFormBuilderStore((s) => s.serverFormId);
  const undo = useFormBuilderStore((s) => s.undo);
  const redo = useFormBuilderStore((s) => s.redo);
  const resetForm = useFormBuilderStore((s) => s.resetForm);
  const loadForm = useFormBuilderStore((s) => s.loadForm);
  const markClean = useFormBuilderStore((s) => s.markClean);
  const addField = useFormBuilderStore((s) => s.addField);
  const moveField = useFormBuilderStore((s) => s.moveField);
  const reorderFields = useFormBuilderStore((s) => s.reorderFields);
  const reorderSections = useFormBuilderStore((s) => s.reorderSections);
  const setDragState = useFormBuilderStore((s) => s.setDragState);
  const updateFormMeta = useFormBuilderStore((s) => s.updateFormMeta);

  const totalFields = Object.keys(fields).length;
  const totalSections = sectionOrder.length;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const [activeField, setActiveField] = useState<FormBuilderFieldNode | null>(null);
  const [paletteLabel, setPaletteLabel] = useState<string | null>(null);
  const [previewOpened, previewHandlers] = useDisclosure(false);
  const [regulatoryBrowserOpen, regulatoryBrowserHandlers] = useDisclosure(false);
  const [historyOpened, historyHandlers] = useDisclosure(false);
  const [publishModalOpen, publishModalHandlers] = useDisclosure(false);
  const [publishSummary, setPublishSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const hasLoadedRef = useRef<string | null>(null);

  const isLocked = form.status === "active";

  // ── Fetch form detail ────────────────────────────────
  const { data: formDetail, isLoading: formLoading } = useQuery({
    queryKey: ["admin-form-detail", formId],
    queryFn: () => api.adminGetFormDetail(formId!),
    enabled: !!formId,
    staleTime: 30_000,
  });

  // ── Fetch all field masters (for enriching form fields) ──
  const { data: fieldMasters } = useQuery({
    queryKey: ["admin-fields-all"],
    queryFn: () => api.adminListFields(),
    staleTime: 60_000,
  });

  // ── Fetch all regulatory clauses (for enriching fields) ──
  const { data: regulatoryClauses } = useQuery({
    queryKey: ["admin-regulatory-clauses"],
    queryFn: () => api.adminListRegulatoryClauses(),
    staleTime: 60_000,
  });

  // ── Load form into store when data arrives ───────────
  useEffect(() => {
    if (!formId) {
      resetForm();
      hasLoadedRef.current = null;
      return;
    }

    if (formDetail && fieldMasters && hasLoadedRef.current !== formId) {
      const state = transformFormDetail(formDetail, fieldMasters, regulatoryClauses);
      loadForm(state);
      hasLoadedRef.current = formId;
    }
  }, [formId, formDetail, fieldMasters, regulatoryClauses, loadForm, resetForm]);

  // ── Save logic ───────────────────────────────────────

  /** Returns true if the ID is a temporary client-side ID (not yet on server). */
  const isTempId = useCallback(
    (id: string) => id.startsWith("fld_") || id.startsWith("sec_"),
    [],
  );

  const handleSave = useCallback(async () => {
    if (!serverFormId) return;
    setSaving(true);

    try {
      const state = useFormBuilderStore.getState();

      // Collect the set of server-side section/field IDs from the last fetched data
      const serverSectionIds = new Set<string>();
      const serverFieldIds = new Set<string>(); // ff_id values
      if (formDetail) {
        for (const sec of formDetail.sections) {
          serverSectionIds.add(sec.id);
          for (const ff of sec.fields) {
            serverFieldIds.add(ff.ff_id);
          }
        }
      }

      // 1. Update form metadata
      await api.adminUpdateForm(serverFormId, {
        name: state.form.name,
        status: state.form.status,
        config: state.form.config as unknown as Record<string, unknown>,
      });

      // 2. Delete removed sections (existed on server but no longer in store)
      const currentSectionSet = new Set(state.sectionOrder);
      for (const serverId of serverSectionIds) {
        if (!currentSectionSet.has(serverId)) {
          await api.adminDeleteSection(serverFormId, serverId);
        }
      }

      // 3. Create new sections (temp IDs → real IDs)
      const sectionIdMap = new Map<string, string>(); // tempId → realId
      for (const sectionId of state.sectionOrder) {
        if (isTempId(sectionId)) {
          const sec = state.sections[sectionId];
          if (!sec) continue;
          const created = await api.adminCreateSection(serverFormId, {
            code: sec.code,
            name: sec.name,
            is_collapsible: sec.isCollapsible,
            is_default_open: sec.isDefaultOpen,
            icon: sec.icon ?? undefined,
            color: sec.color ?? undefined,
          });
          sectionIdMap.set(sectionId, created.id);
        } else {
          sectionIdMap.set(sectionId, sectionId);
          // Update existing section properties (name, icon, color, etc.)
          const sec = state.sections[sectionId];
          if (sec && formDetail) {
            const serverSec = formDetail.sections.find((s) => s.id === sectionId);
            if (serverSec) {
              const nameChanged = sec.name !== serverSec.name;
              const iconChanged = (sec.icon ?? null) !== (serverSec.icon ?? null);
              const colorChanged = (sec.color ?? null) !== (serverSec.color ?? null);
              const collapsibleChanged = sec.isCollapsible !== serverSec.is_collapsible;
              const defaultOpenChanged = sec.isDefaultOpen !== serverSec.is_default_open;
              if (nameChanged || iconChanged || colorChanged || collapsibleChanged || defaultOpenChanged) {
                await api.adminUpdateSection(serverFormId, sectionId, {
                  name: sec.name,
                  icon: sec.icon ?? undefined,
                  color: sec.color ?? undefined,
                  is_collapsible: sec.isCollapsible,
                  is_default_open: sec.isDefaultOpen,
                });
              }
            }
          }
        }
      }

      // 4. Delete removed fields (existed on server but no longer in store)
      const currentFieldSet = new Set(Object.keys(state.fields));
      for (const serverFfId of serverFieldIds) {
        if (!currentFieldSet.has(serverFfId)) {
          await api.adminRemoveFieldFromForm(serverFormId, serverFfId);
        }
      }

      // 5. Add new fields (temp IDs → real ff_ids via adminAddFieldToForm)
      const fieldIdMap = new Map<string, string>(); // tempId → realFfId
      for (const sectionId of state.sectionOrder) {
        const fieldIds = state.fieldOrder[sectionId] ?? [];
        const realSectionId = sectionIdMap.get(sectionId) ?? sectionId;

        for (const [idx, fId] of fieldIds.entries()) {
          if (isTempId(fId)) {
            const field = state.fields[fId];
            if (!field || !field.fieldMasterId) continue;
            const result = await api.adminAddFieldToForm(serverFormId, {
              field_id: field.fieldMasterId,
              section_id: realSectionId,
              sort_order: idx,
              label_override: field.label,
              is_quick_mode: field.isQuickMode,
              icon: field.icon,
              icon_position: field.iconPosition,
            });
            fieldIdMap.set(fId, result.id);
          } else {
            fieldIdMap.set(fId, fId);
          }
        }
      }

      // 6. Reorder sections (using real IDs only)
      const sectionReorder = state.sectionOrder.map((id, idx) => ({
        id: sectionIdMap.get(id) ?? id,
        sort_order: idx,
      }));
      if (sectionReorder.length > 0) {
        await api.adminReorderSections(serverFormId, sectionReorder);
      }

      // 7. Reorder fields per section + update existing field overrides
      for (const sectionId of state.sectionOrder) {
        const fieldIds = state.fieldOrder[sectionId] ?? [];
        const realSectionId = sectionIdMap.get(sectionId) ?? sectionId;

        const fieldReorder = fieldIds.map((id, idx) => ({
          id: fieldIdMap.get(id) ?? id,
          sort_order: idx,
        }));
        if (fieldReorder.length > 0) {
          await api.adminReorderFields(serverFormId, fieldReorder);
        }

        // Update label overrides and quick mode for existing (non-new) fields
        for (const fId of fieldIds) {
          if (isTempId(fId)) continue; // already set during creation in step 5
          const field = state.fields[fId];
          if (!field) continue;
          await api.adminUpdateFormField(serverFormId, fId, {
            label_override: field.label,
            is_quick_mode: field.isQuickMode,
            section_id: realSectionId,
            icon: field.icon,
            icon_position: field.iconPosition,
          });
        }
      }

      // 8. Update field master properties (data_type, options, placeholder, default_value)
      //    for fields whose properties were changed in the property panel
      if (fieldMasters) {
        const masterMap = new Map(fieldMasters.map((fm) => [fm.id, fm]));
        const updatedMasters = new Set<string>();

        for (const field of Object.values(state.fields)) {
          if (!field.fieldMasterId || isTempId(field.id)) continue;
          if (updatedMasters.has(field.fieldMasterId)) continue;

          const master = masterMap.get(field.fieldMasterId);
          if (!master) continue;

          const updates: Record<string, unknown> = {};

          if (field.dataType !== master.data_type) {
            updates.data_type = field.dataType;
          }
          if (field.placeholder !== (master.placeholder ?? null)) {
            updates.placeholder = field.placeholder ?? undefined;
          }
          if (field.defaultValue !== (master.default_value ?? null)) {
            updates.default_value = field.defaultValue ?? undefined;
          }
          // Persist options changes via validation.options
          const masterOptions = master.validation?.options ?? null;
          const fieldOptions = field.options;
          if (JSON.stringify(fieldOptions) !== JSON.stringify(masterOptions)) {
            const currentValidation = master.validation ?? {};
            updates.validation = fieldOptions
              ? { ...currentValidation, options: fieldOptions }
              : { ...currentValidation, options: undefined };
          }

          if (Object.keys(updates).length > 0) {
            await api.adminUpdateField(
              field.fieldMasterId,
              updates as Parameters<typeof api.adminUpdateField>[1],
            );
            updatedMasters.add(field.fieldMasterId);
          }
        }
      }

      markClean();
      void queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-form-detail", serverFormId] });
      notifications.show({
        title: "Form saved",
        message: `${state.form.name} has been saved`,
        color: "success",
      });
    } catch (err) {
      notifications.show({
        title: "Save failed",
        message: err instanceof Error ? err.message : "Unknown error",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  }, [serverFormId, formDetail, fieldMasters, markClean, queryClient, isTempId]);

  // ── Publish & New Version mutations ─────────────────────
  const publishMutation = useMutation({
    mutationFn: () =>
      api.adminPublishForm(serverFormId!, {
        change_summary: publishSummary || undefined,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Form published",
        message: "Form is now active and locked.",
        color: "success",
      });
      hasLoadedRef.current = null; // force reload so locked state updates
      void queryClient.invalidateQueries({ queryKey: ["admin-form-detail", formId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
      publishModalHandlers.close();
      setPublishSummary("");
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Publish failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const newVersionMutation = useMutation({
    mutationFn: () => api.adminCreateNewVersion(serverFormId!),
    onSuccess: () => {
      notifications.show({
        title: "New version created",
        message: "Form is now a draft. You can edit it.",
        color: "primary",
      });
      hasLoadedRef.current = null; // force reload from fresh data
      void queryClient.invalidateQueries({ queryKey: ["admin-form-detail", formId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-forms"] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  // ── Dirty state warnings ─────────────────────────────
  // beforeunload (browser close/refresh)
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Keyboard shortcuts
  useHotkeys([
    ["mod+z", undo],
    ["mod+shift+z", redo],
    ["mod+s", () => { handleSave(); }],
  ]);

  // DnD sensors (empty when locked to disable drag)
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const sensors = useSensors(isLocked ? undefined : pointerSensor);

  // ── DnD Handlers ──────────────────────────────────────

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const data = active.data.current;

      if (data?.type === "palette-field") {
        setPaletteLabel(data.label as string);
        setDragState({
          type: "palette-field",
          sourceId: active.id as string,
        });
      } else if (data?.type === "field") {
        setActiveField(data.field as FormBuilderFieldNode);
        setDragState({
          type: "field",
          sourceId: active.id as string,
          sourceSectionId: data.sectionId as string,
        });
      } else if (data?.type === "section") {
        setDragState({
          type: "section",
          sourceId: active.id as string,
        });
      }
    },
    [setDragState],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event;
      if (!over) return;

      const overData = over.data.current;
      const targetSectionId = overData?.sectionId as string | undefined;

      if (targetSectionId) {
        const current = useFormBuilderStore.getState().dragState;
        if (current) {
          setDragState({ ...current, targetSectionId });
        }
      }
    },
    [setDragState],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveField(null);
      setPaletteLabel(null);
      setDragState(null);

      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // Handle palette drop → create new field
      if (activeData?.type === "palette-field") {
        const targetSectionId =
          (overData?.sectionId as string) ??
          (overData?.type === "section" ? (over.id as string) : null);

        if (!targetSectionId) return;

        const currentFieldOrder = useFormBuilderStore.getState().fieldOrder;
        const targetFieldIds = currentFieldOrder[targetSectionId] ?? [];
        let insertIndex = targetFieldIds.length;

        if (overData?.type === "field") {
          const overIndex = targetFieldIds.indexOf(over.id as string);
          if (overIndex >= 0) insertIndex = overIndex;
        }

        // Look up master data if dropping a master field
        const masterId = activeData.fieldMasterId as string | undefined;
        const master = masterId && fieldMasters
          ? fieldMasters.find((fm) => fm.id === masterId)
          : undefined;

        // Look up regulatory clauses from cache
        const masterClauses = masterId && regulatoryClauses
          ? regulatoryClauses.filter((c) => c.field_id === masterId)
          : [];

        addField(
          targetSectionId,
          {
            label: activeData.label as string,
            dataType: activeData.dataType as FieldDataType,
            fieldMasterId: masterId,
            fieldCode: (activeData.fieldCode as string | undefined) ?? undefined,
            placeholder: master?.placeholder,
            helpText: master?.description,
            defaultValue: master?.default_value,
            options: master?.validation?.options,
            colSpan: master ? uiWidthToColSpan(master.ui_width) : undefined,
            regulatoryClauses: masterClauses.map((c) => ({
              body_code: c.body_code,
              body_name: c.body_name,
              clause_code: c.clause_code,
              clause_reference: c.clause_reference,
              requirement_level: c.requirement_level,
            })),
          },
          insertIndex,
        );
        return;
      }

      // Handle section reorder
      if (activeData?.type === "section" && overData?.type === "section") {
        const currentSectionOrder = useFormBuilderStore.getState().sectionOrder;
        const oldIndex = currentSectionOrder.indexOf(active.id as string);
        const newIndex = currentSectionOrder.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          reorderSections(oldIndex, newIndex);
        }
        return;
      }

      // Handle field reorder / move between sections
      if (activeData?.type === "field") {
        const fromSectionId = activeData.sectionId as string;
        const toSectionId =
          (overData?.sectionId as string) ??
          (overData?.type === "section" ? (over.id as string) : fromSectionId);

        const currentFieldOrder = useFormBuilderStore.getState().fieldOrder;
        const fromFieldIds = currentFieldOrder[fromSectionId] ?? [];
        const toFieldIds = currentFieldOrder[toSectionId] ?? [];
        const oldIndex = fromFieldIds.indexOf(active.id as string);

        let newIndex = toFieldIds.length;
        if (overData?.type === "field") {
          const overIndex = toFieldIds.indexOf(over.id as string);
          if (overIndex >= 0) newIndex = overIndex;
        }

        if (fromSectionId === toSectionId) {
          if (oldIndex !== -1 && oldIndex !== newIndex) {
            reorderFields(fromSectionId, oldIndex, newIndex);
          }
        } else {
          moveField(active.id as string, fromSectionId, toSectionId, newIndex);
        }
      }
    },
    [addField, moveField, reorderFields, reorderSections, setDragState],
  );

  // ── Empty state (no formId) ──────────────────────────
  if (!formId) {
    return <EmptyFormBuilder />;
  }

  // ── Loading state ─────────────────────────────────────
  if (formLoading || (formId && !formDetail)) {
    return (
      <Center h="calc(100vh - 120px)">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading form...</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <div className={classes.builderWrapper}>
      {/* Compact Toolbar */}
      <div className={classes.toolbar}>
        <div className={classes.toolbarTitle}>
          <IconForms size={20} stroke={1.5} />
          <Title order={5} fw={600}>
            Form Builder
          </Title>
          <Divider orientation="vertical" />
          <TextInput
            size="xs"
            variant="unstyled"
            placeholder="Enter form name..."
            value={form.name}
            onChange={(e) => updateFormMeta({ name: e.currentTarget.value })}
            styles={{
              input: {
                fontWeight: 500,
                fontSize: "var(--mantine-font-size-sm)",
                minWidth: 200,
              },
            }}
          />
          {isDirty && (
            <Badge size="xs" variant="dot" color="warning">
              Unsaved
            </Badge>
          )}
        </div>

        <Group gap="xs">
          {!isLocked && (
            <>
              <Tooltip label="Undo (Ctrl+Z)">
                <Button
                  variant="default"
                  size="compact-sm"
                  leftSection={<IconArrowBackUp size={14} />}
                  disabled={!canUndo}
                  onClick={undo}
                >
                  Undo
                </Button>
              </Tooltip>
              <Tooltip label="Redo (Ctrl+Shift+Z)">
                <Button
                  variant="default"
                  size="compact-sm"
                  leftSection={<IconArrowForwardUp size={14} />}
                  disabled={!canRedo}
                  onClick={redo}
                >
                  Redo
                </Button>
              </Tooltip>
              <Divider orientation="vertical" />
            </>
          )}
          <Button
            variant="default"
            size="compact-sm"
            leftSection={<IconEye size={14} />}
            onClick={previewHandlers.open}
          >
            Preview
          </Button>
          <Button
            variant="default"
            size="compact-sm"
            leftSection={<IconShield size={14} />}
            onClick={regulatoryBrowserHandlers.open}
          >
            Regulations
          </Button>
          <Tooltip label="Version History">
            <Button
              variant="default"
              size="compact-sm"
              leftSection={<IconHistory size={14} />}
              onClick={historyHandlers.open}
            >
              History
            </Button>
          </Tooltip>
          {isLocked ? (
            <Button
              size="compact-sm"
              color="primary"
              leftSection={<IconGitBranch size={14} />}
              onClick={() => newVersionMutation.mutate()}
              loading={newVersionMutation.isPending}
            >
              New Version
            </Button>
          ) : (
            <>
              <Button
                size="compact-sm"
                leftSection={<IconDeviceFloppy size={14} />}
                onClick={handleSave}
                loading={saving}
                disabled={!isDirty}
              >
                Save
              </Button>
              <Button
                size="compact-sm"
                color="success"
                leftSection={<IconUpload size={14} />}
                onClick={publishModalHandlers.open}
                disabled={isDirty}
              >
                Publish
              </Button>
            </>
          )}
        </Group>
      </div>

      {/* Locked form alert */}
      {isLocked && (
        <div style={{ padding: "8px 16px", background: "var(--mantine-color-blue-0)", borderBottom: "1px solid var(--mantine-color-blue-2)" }}>
          <Group gap="xs">
            <IconLock size={14} color="var(--mantine-color-blue-6)" />
            <Text size="xs" c="blue.7">
              This form is published and locked. Create a new version to make changes.
            </Text>
          </Group>
        </div>
      )}

      {/* DndContext wraps ALL three panels so palette → canvas DnD works */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className={classes.builderLayout}>
          <FieldPalette />
          <Canvas />
          <PropertyPanel />
        </div>

        <DragOverlay>
          <DragOverlayContent
            activeField={activeField}
            paletteLabel={paletteLabel}
          />
        </DragOverlay>
      </DndContext>

      {/* Status Bar */}
      <div className={classes.statusBar}>
        <div className={classes.statusItem}>
          <Badge size="xs" variant="light" color={form.status === "draft" ? "warning" : "success"}>
            v{form.version} {form.status.toUpperCase()}
          </Badge>
          {isLocked && <IconLock size={12} color="var(--mantine-color-green-6)" style={{ marginLeft: 4 }} />}
        </div>
        <div className={classes.statusItem}>
          <Text size="xs" c="dimmed">
            Fields: {totalFields}
          </Text>
        </div>
        <div className={classes.statusItem}>
          <Text size="xs" c="dimmed">
            Sections: {totalSections}
          </Text>
        </div>
        {serverFormId && (
          <div className={classes.statusItem}>
            <Text size="xs" c="dimmed">
              ID: {serverFormId.slice(0, 8)}...
            </Text>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <PreviewModal opened={previewOpened} onClose={previewHandlers.close} />

      {/* Global Regulatory Browser */}
      <RegulatoryBrowser
        opened={regulatoryBrowserOpen}
        onClose={regulatoryBrowserHandlers.close}
      />

      {/* Publish Modal */}
      <Modal
        opened={publishModalOpen}
        onClose={publishModalHandlers.close}
        title="Publish Form"
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Publishing will make this form active and locked. A snapshot will be
            saved to version history.
          </Text>
          <Textarea
            label="Change Summary (optional)"
            placeholder="Describe what changed..."
            value={publishSummary}
            onChange={(e) => setPublishSummary(e.currentTarget.value)}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="light" onClick={publishModalHandlers.close}>
              Cancel
            </Button>
            <Button
              color="success"
              leftSection={<IconUpload size={14} />}
              loading={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              Publish
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Version History Drawer */}
      {serverFormId && (
        <VersionHistoryDrawer
          formId={serverFormId}
          currentVersion={form.version}
          opened={historyOpened}
          onClose={historyHandlers.close}
        />
      )}
    </div>
  );
}
