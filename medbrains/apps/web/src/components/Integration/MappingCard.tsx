import {
  ActionIcon,
  Autocomplete,
  Badge,
  Box,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowDown,
  IconBraces,
  IconBracesOff,
  IconGripVertical,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  CombineMode,
  FieldMapping,
  MappingSource,
  TargetFieldSuggestion,
  TransformStep,
} from "@medbrains/types";
import { useCallback, useMemo, useState } from "react";
import { TransformChain } from "./TransformChain";
import { evaluateMapping, type MappingEvalResult } from "./transformEvaluator";
import { inferFieldType, TYPE_LABELS, TYPE_COLORS } from "./typeInference";
import styles from "./MappingCard.module.scss";

// ── Props ─────────────────────────────────────────────────

interface MappingCardProps {
  mapping: FieldMapping;
  index: number;
  onChange: (updated: FieldMapping) => void;
  onDelete: () => void;
  targetSuggestions: TargetFieldSuggestion[];
  sampleData: Record<string, unknown>;
}

// ── Combine mode options ──────────────────────────────────

const COMBINE_MODES: { value: CombineMode; label: string }[] = [
  { value: "concat", label: "Concat" },
  { value: "fallback", label: "Fallback" },
  { value: "template", label: "Template" },
  { value: "arithmetic", label: "Arithmetic" },
];

const COMBINE_MODE_CYCLE: CombineMode[] = ["concat", "fallback", "template", "arithmetic"];

// ── Helpers ───────────────────────────────────────────────

let _srcSeq = 0;
function newSourceId(): string {
  _srcSeq += 1;
  return `src_${Date.now()}_${_srcSeq}`;
}

function resolveChain(mapping: FieldMapping): TransformStep[] {
  if (mapping.chain && mapping.chain.length > 0) return mapping.chain;
  if (mapping.operation && mapping.operation !== "none") {
    return [
      {
        id: `legacy_${mapping.id}`,
        operation: mapping.operation,
        config: mapping.operationConfig ?? {},
      },
    ];
  }
  return [];
}

/** Ensure every source has a stable id */
function ensureSourceIds(sources: MappingSource[]): MappingSource[] {
  return sources.map((s) => (s.id ? s : { ...s, id: newSourceId() }));
}

/** Get flat list of all leaf source paths (recursively) */
function getLeafPaths(sources: MappingSource[]): string[] {
  const paths: string[] = [];
  for (const s of sources) {
    if (s.children && s.children.length > 0) {
      paths.push(...getLeafPaths(s.children));
    } else if (s.path) {
      paths.push(s.path);
    }
  }
  return paths;
}

function getMappingSourcePaths(mapping: FieldMapping): string[] {
  if (mapping.combineMode && mapping.combineMode !== "single" && mapping.sources) {
    return getLeafPaths(mapping.sources);
  }
  return mapping.from ? [mapping.from] : [];
}

/** Get the top-level source items (with ids ensured) */
function getSourceItems(mapping: FieldMapping): MappingSource[] {
  if (mapping.combineMode && mapping.combineMode !== "single" && mapping.sources) {
    return ensureSourceIds(mapping.sources);
  }
  if (mapping.from) {
    return [{ id: newSourceId(), path: mapping.from }];
  }
  return [];
}

// ── Sortable Source Chip ──────────────────────────────────

function SortableSourceChip({
  source,
  isSelected,
  onSelect,
  onRemove,
  onCycleCombineMode,
  onUngroup,
}: {
  source: MappingSource;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onCycleCombineMode?: (id: string) => void;
  onUngroup?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: source.id });

  const isGroup = source.children && source.children.length > 0;

  return (
    <div
      ref={setNodeRef}
      className={`${isGroup ? styles.sourceChipGroup : styles.sourceChip} ${isSelected ? styles.sourceChipSelected : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={() => onSelect(source.id)}
    >
      {isGroup ? (
        /* ── Expanded group view ── */
        <Stack gap={2} style={{ width: "100%" }}>
          <Group gap={4} wrap="nowrap" justify="space-between">
            <Group gap={4} wrap="nowrap">
              <span {...attributes} {...listeners} style={{ display: "inline-flex", cursor: "grab" }}>
                <IconGripVertical size={10} color="var(--mantine-color-gray-5)" />
              </span>
              <Tooltip label="Click to change combine mode" withArrow>
                <Badge
                  size="xs"
                  variant="filled"
                  color="violet"
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCycleCombineMode?.(source.id);
                  }}
                >
                  {source.groupCombineMode ?? "concat"}
                </Badge>
              </Tooltip>
            </Group>
            <Group gap={2} wrap="nowrap">
              {onUngroup && (
                <Tooltip label="Ungroup" withArrow>
                  <ActionIcon
                    variant="subtle"
                    color="orange"
                    size={16}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUngroup(source.id);
                    }}
                    aria-label="Braces Off"
                  >
                    <IconBracesOff size={10} />
                  </ActionIcon>
                </Tooltip>
              )}
              <ActionIcon
                variant="transparent"
                color="slate"
                size={14}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(source.id);
                }}
                aria-label="Close"
              >
                <IconX size={10} />
              </ActionIcon>
            </Group>
          </Group>
          {/* Children chips inside the group */}
          <Group gap={3} wrap="wrap" pl={16}>
            {source.children?.map((child) => (
              <Badge
                key={child.id}
                size="xs"
                variant="light"
                color="success"
              >
                {child.path.split(".").pop() ?? child.path}
              </Badge>
            ))}
          </Group>
        </Stack>
      ) : (
        /* ── Single field chip ── */
        <>
          <span {...attributes} {...listeners} style={{ display: "inline-flex", cursor: "grab" }}>
            <IconGripVertical size={10} color="var(--mantine-color-gray-5)" />
          </span>
          <Text size="xs" fw={500} component="span" truncate style={{ maxWidth: 140 }}>
            {source.path}
          </Text>
          <ActionIcon
            variant="transparent"
            color="slate"
            size={14}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(source.id);
            }}
            aria-label="Close"
          >
            <IconX size={10} />
          </ActionIcon>
        </>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────

export function MappingCard({
  mapping,
  index,
  onChange,
  onDelete,
  targetSuggestions,
  sampleData,
}: MappingCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mapping.id, data: { type: "mapping-card" } });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `card-input-${mapping.id}`,
    data: { type: "card-input", mappingId: mapping.id },
  });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sourcePaths = getMappingSourcePaths(mapping);
  const sourceItems = useMemo(() => getSourceItems(mapping), [mapping]);
  const sourceIds = useMemo(() => sourceItems.map((s) => s.id), [sourceItems]);
  const isGrouped =
    mapping.combineMode && mapping.combineMode !== "single" && sourceItems.length > 1;
  const chain = resolveChain(mapping);

  // Selection state for grouping
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());

  const canGroupSelected = selectedSourceIds.size >= 2;
  const canUngroupSelected = selectedSourceIds.size === 1 && (() => {
    const selected = sourceItems.find((s) => s.id === [...selectedSourceIds][0]);
    return selected?.children && selected.children.length > 0;
  })();

  // Infer source type from sample data
  const sourceType = useMemo(() => {
    if (!sampleData || Object.keys(sampleData).length === 0) return undefined;
    if (sourcePaths.length === 0) return undefined;
    return inferFieldType(sampleData, sourcePaths[0] ?? "");
  }, [sampleData, sourcePaths]);

  // Destination type from suggestions
  const destType = useMemo(() => {
    if (!mapping.to || !targetSuggestions) return undefined;
    const match = targetSuggestions.find((s) => s.path === mapping.to);
    return match?.type;
  }, [mapping.to, targetSuggestions]);

  const typeMismatch = sourceType && destType && sourceType !== destType && sourceType !== "unknown" && destType !== "unknown";

  // Evaluate preview
  const preview: MappingEvalResult | null = useMemo(() => {
    if (!sampleData || Object.keys(sampleData).length === 0) return null;
    if (!mapping.from && (!mapping.sources || mapping.sources.length === 0)) return null;
    return evaluateMapping(mapping, sampleData);
  }, [mapping, sampleData]);

  // Autocomplete data for destination
  const autocompleteData = useMemo(() => {
    if (!targetSuggestions || targetSuggestions.length === 0) return [];
    const grouped: Record<string, string[]> = {};
    for (const s of targetSuggestions) {
      const group = s.group || "Fields";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(s.path);
    }
    return Object.entries(grouped).map(([group, items]) => ({ group, items }));
  }, [targetSuggestions]);

  // Droppable zones
  const { setNodeRef: setTransformDropRef, isOver: isTransformOver } = useDroppable({
    id: `card-transforms-${mapping.id}`,
    data: { type: "card-transforms", mappingId: mapping.id },
  });

  const { setNodeRef: setOutputDropRef, isOver: isOutputOver } = useDroppable({
    id: `card-output-${mapping.id}`,
    data: { type: "card-output", mappingId: mapping.id },
  });

  // Chip-level sortable sensors
  const chipSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // ── Handlers ──────────────────────────────────────

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRemoveSource = useCallback(
    (sourceId: string) => {
      const remaining = sourceItems.filter((s) => s.id !== sourceId);
      if (remaining.length <= 1) {
        const first = remaining[0];
        const singlePath = first
          ? (first.children ? getLeafPaths(remaining)[0] : first.path)
          : "";
        onChange({
          ...mapping,
          from: singlePath ?? "",
          sources: undefined,
          combineMode: "single",
          combineConfig: undefined,
        });
      } else {
        onChange({
          ...mapping,
          from: getLeafPaths(remaining)[0] ?? "",
          sources: remaining,
        });
      }
      setSelectedSourceIds(new Set());
    },
    [mapping, sourceItems, onChange],
  );

  const handleGroupSelected = useCallback(() => {
    if (selectedSourceIds.size < 2) return;
    const selected: MappingSource[] = [];
    const remaining: MappingSource[] = [];
    let insertIndex = -1;

    for (const item of sourceItems) {
      if (selectedSourceIds.has(item.id)) {
        if (insertIndex === -1) insertIndex = remaining.length;
        selected.push(item);
      } else {
        remaining.push(item);
      }
    }

    const group: MappingSource = {
      id: newSourceId(),
      path: "",
      children: selected,
      groupCombineMode: "concat",
      groupCombineConfig: { separator: " " },
    };

    remaining.splice(insertIndex >= 0 ? insertIndex : remaining.length, 0, group);

    onChange({
      ...mapping,
      from: getLeafPaths(remaining)[0] ?? mapping.from,
      sources: remaining,
      combineMode: mapping.combineMode === "single" || !mapping.combineMode
        ? "concat"
        : mapping.combineMode,
      combineConfig: mapping.combineConfig ?? { separator: " " },
    });
    setSelectedSourceIds(new Set());
  }, [selectedSourceIds, sourceItems, mapping, onChange]);

  const handleUngroupSelected = useCallback(() => {
    if (selectedSourceIds.size !== 1) return;
    const groupId = [...selectedSourceIds][0];
    const group = sourceItems.find((s) => s.id === groupId);
    if (!group?.children) return;

    const updated: MappingSource[] = [];
    for (const s of sourceItems) {
      if (s.id === groupId) {
        updated.push(...ensureSourceIds(group.children));
      } else {
        updated.push(s);
      }
    }

    onChange({
      ...mapping,
      from: getLeafPaths(updated)[0] ?? mapping.from,
      sources: updated,
    });
    setSelectedSourceIds(new Set());
  }, [selectedSourceIds, sourceItems, mapping, onChange]);

  /** Ungroup by group id (called from chip's ungroup button) */
  const handleUngroupById = useCallback(
    (groupId: string) => {
      const group = sourceItems.find((s) => s.id === groupId);
      if (!group?.children) return;

      const updated: MappingSource[] = [];
      for (const s of sourceItems) {
        if (s.id === groupId) {
          updated.push(...ensureSourceIds(group.children));
        } else {
          updated.push(s);
        }
      }

      onChange({
        ...mapping,
        from: getLeafPaths(updated)[0] ?? mapping.from,
        sources: updated,
        combineMode: updated.length > 1 ? (mapping.combineMode ?? "concat") : "single",
      });
      setSelectedSourceIds(new Set());
    },
    [sourceItems, mapping, onChange],
  );

  /** Cycle group combine mode on click */
  const handleCycleCombineMode = useCallback(
    (groupId: string) => {
      const updated = sourceItems.map((s) => {
        if (s.id !== groupId || !s.children) return s;
        const currentMode = s.groupCombineMode ?? "concat";
        const idx = COMBINE_MODE_CYCLE.indexOf(currentMode);
        const nextMode = COMBINE_MODE_CYCLE[(idx + 1) % COMBINE_MODE_CYCLE.length] ?? "concat";
        return { ...s, groupCombineMode: nextMode };
      });

      onChange({
        ...mapping,
        sources: updated,
      });
    },
    [sourceItems, mapping, onChange],
  );

  const handleChipSortEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = sourceItems.findIndex((s) => s.id === active.id);
      const newIdx = sourceItems.findIndex((s) => s.id === over.id);
      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = arrayMove(sourceItems, oldIdx, newIdx);
      onChange({
        ...mapping,
        from: getLeafPaths(reordered)[0] ?? mapping.from,
        sources: reordered,
        combineMode: mapping.combineMode === "single" || !mapping.combineMode
          ? (reordered.length > 1 ? "concat" : "single")
          : mapping.combineMode,
        combineConfig: mapping.combineConfig ?? { separator: " " },
      });
    },
    [sourceItems, mapping, onChange],
  );

  const handleCombineModeChange = useCallback(
    (mode: string | null) => {
      if (!mode) return;
      onChange({
        ...mapping,
        combineMode: mode as CombineMode,
      });
    },
    [mapping, onChange],
  );

  const handleCombineConfigChange = useCallback(
    (key: string, value: string) => {
      onChange({
        ...mapping,
        combineConfig: { ...mapping.combineConfig, [key]: value },
      });
    },
    [mapping, onChange],
  );

  const handleChainChange = useCallback(
    (newChain: TransformStep[]) => {
      const firstOp = newChain[0]?.operation ?? "none";
      const firstConfig = newChain[0]?.config ?? {};
      onChange({
        ...mapping,
        chain: newChain,
        operation: firstOp as FieldMapping["operation"],
        operationConfig: firstConfig,
      });
    },
    [mapping, onChange],
  );

  const handleDestChange = useCallback(
    (value: string) => {
      onChange({ ...mapping, to: value });
    },
    [mapping, onChange],
  );

  // Source summary for header
  const sourceSummary =
    sourcePaths.length > 0
      ? sourcePaths.length > 1
        ? `(${sourcePaths.length} fields)`
        : sourcePaths[0]
      : "(no source)";

  return (
    <div
      ref={setSortableRef}
      style={sortableStyle}
      className={`${styles.card} ${isDragging ? styles.dragging : ""}`}
    >
      {/* ── Header ──────────────────────────────────── */}
      <div className={styles.cardHeader} {...attributes} {...listeners}>
        <IconGripVertical size={14} color="var(--mantine-color-gray-5)" />
        <Badge size="xs" variant="light" color="primary" circle>
          {index + 1}
        </Badge>
        <Text size="xs" fw={500} truncate style={{ flex: 1 }}>
          {sourceSummary} → {mapping.to || "(no dest)"}
        </Text>
        <ActionIcon
          variant="subtle"
          color="danger"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete"
        >
          <IconTrash size={12} />
        </ActionIcon>
      </div>

      {/* ── Body ────────────────────────────────────── */}
      <div className={styles.cardBody}>
        <Stack gap="xs">
          {/* INPUT SECTION */}
          <Box>
            <Group gap={6} mb={4} justify="space-between">
              <Group gap={6}>
                <Text size="xs" fw={600} c="dimmed">
                  INPUT
                </Text>
                {sourceType && sourceType !== "unknown" && (
                  <Badge size="xs" variant="light" color={TYPE_COLORS[sourceType]}>
                    {TYPE_LABELS[sourceType]}
                  </Badge>
                )}
              </Group>
              {/* Group / Ungroup — visible when 2+ ungrouped sources or any group exists */}
              {(sourceItems.length >= 2 || sourceItems.some((s) => s.children && s.children.length > 0)) && (
                <Group gap={4}>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="violet"
                    leftSection={<IconBraces size={12} />}
                    disabled={!canGroupSelected}
                    onClick={handleGroupSelected}
                  >
                    Group
                  </Button>
                  <Button
                    size="compact-xs"
                    variant="light"
                    color="orange"
                    leftSection={<IconBracesOff size={12} />}
                    disabled={!canUngroupSelected}
                    onClick={handleUngroupSelected}
                  >
                    Ungroup
                  </Button>
                </Group>
              )}
            </Group>
            <div
              ref={setDropRef}
              className={`${styles.inputSection} ${isOver ? styles.dropTarget : ""}`}
            >
              {sourceItems.length > 0 ? (
                <DndContext
                  sensors={chipSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleChipSortEnd}
                >
                  <SortableContext items={sourceIds} strategy={horizontalListSortingStrategy}>
                    <Group gap={4} wrap="wrap">
                      {sourceItems.map((src) => (
                        <SortableSourceChip
                          key={src.id}
                          source={src}
                          isSelected={selectedSourceIds.has(src.id)}
                          onSelect={handleToggleSelect}
                          onRemove={handleRemoveSource}
                          onCycleCombineMode={handleCycleCombineMode}
                          onUngroup={handleUngroupById}
                        />
                      ))}
                    </Group>
                  </SortableContext>
                </DndContext>
              ) : (
                <Text size="xs" c="dimmed" ta="center">
                  Drag a source field here
                </Text>
              )}

              {/* Combine mode config (when grouped) */}
              {isGrouped && (
                <div className={styles.combineConfig}>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="xs" fw={600} c="dimmed">
                      Combine:
                    </Text>
                    <Select
                      size="xs"
                      data={COMBINE_MODES}
                      value={mapping.combineMode ?? "concat"}
                      onChange={handleCombineModeChange}
                      styles={{ input: { minHeight: 28 } }}
                      comboboxProps={{ withinPortal: true }}
                    />
                  </Group>
                  {mapping.combineMode === "concat" && (
                    <TextInput
                      size="xs"
                      label="Separator"
                      value={mapping.combineConfig?.separator ?? " "}
                      onChange={(e) =>
                        handleCombineConfigChange("separator", e.currentTarget.value)
                      }
                      mt={4}
                    />
                  )}
                  {mapping.combineMode === "template" && (
                    <TextInput
                      size="xs"
                      label="Template"
                      placeholder="{{source1}} {{source2}}"
                      value={mapping.combineConfig?.templateStr ?? ""}
                      onChange={(e) =>
                        handleCombineConfigChange("templateStr", e.currentTarget.value)
                      }
                      mt={4}
                    />
                  )}
                  {mapping.combineMode === "arithmetic" && (
                    <TextInput
                      size="xs"
                      label="Expression"
                      placeholder="{{source1}} * {{source2}}"
                      value={mapping.combineConfig?.expression ?? ""}
                      onChange={(e) =>
                        handleCombineConfigChange("expression", e.currentTarget.value)
                      }
                      mt={4}
                    />
                  )}
                </div>
              )}
            </div>
          </Box>

          {/* ARROW */}
          <div className={styles.arrow}>
            <IconArrowDown size={16} />
          </div>

          {/* TRANSFORMS */}
          <Box>
            <Text size="xs" fw={600} c="dimmed" mb={4}>
              TRANSFORMS
            </Text>
            <TransformChain chain={chain} onChange={handleChainChange} />
            <div
              ref={setTransformDropRef}
              className={`${styles.transformDropZone} ${isTransformOver ? styles.dropTarget : ""}`}
            >
              <Text size="xs" c="dimmed">
                Drag an operation or source field here
              </Text>
            </div>
          </Box>

          {/* ARROW */}
          <div className={styles.arrow}>
            <IconArrowDown size={16} />
          </div>

          {/* OUTPUT */}
          <Box>
            <Group gap={6} mb={4}>
              <Text size="xs" fw={600} c="dimmed">
                OUTPUT
              </Text>
              {destType && destType !== "unknown" && (
                <Badge size="xs" variant="light" color={TYPE_COLORS[destType]}>
                  {TYPE_LABELS[destType]}
                </Badge>
              )}
              {typeMismatch && (
                <Tooltip label={`Type mismatch: source is ${sourceType}, destination expects ${destType}`} withArrow>
                  <Badge size="xs" variant="light" color="warning">
                    mismatch
                  </Badge>
                </Tooltip>
              )}
            </Group>
            <div
              ref={setOutputDropRef}
              className={`${styles.outputDropZone} ${isOutputOver ? styles.dropTarget : ""}`}
            >
              <div className={styles.outputSection}>
                <Text size="xs" c="dimmed">
                  →
                </Text>
                <Autocomplete
                  size="xs"
                  placeholder="Drag a destination here or type"
                  value={mapping.to}
                  onChange={handleDestChange}
                  data={autocompleteData}
                  style={{ flex: 1 }}
                  comboboxProps={{ withinPortal: true }}
                />
                {preview && (
                  <Tooltip
                    label={String(preview.finalOutput ?? "null")}
                    withArrow
                    multiline
                    maw={300}
                  >
                    <Badge
                      size="xs"
                      variant="light"
                      color={preview.error ? "danger" : "success"}
                      className={styles.previewBadge}
                    >
                      {truncatePreview(preview.finalOutput)}
                    </Badge>
                  </Tooltip>
                )}
              </div>
            </div>
          </Box>
        </Stack>
      </div>
    </div>
  );
}

// ── Truncate preview value ────────────────────────────────

function truncatePreview(value: unknown): string {
  if (value === null || value === undefined) return "null";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > 30 ? `${s.slice(0, 27)}...` : s;
}
