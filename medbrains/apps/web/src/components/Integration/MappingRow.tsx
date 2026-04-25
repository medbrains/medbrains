import {
  ActionIcon,
  Autocomplete,
  Badge,
  Box,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconArrowRight,
  IconGripVertical,
  IconLayersLinked,
  IconMinus,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useSortable } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type {
  CombineConfig,
  CombineMode,
  FieldMapping,
  MappingSource,
  TargetFieldSuggestion,
  TransformStep,
} from "@medbrains/types";
import { useMemo, useCallback } from "react";
import { TransformChain } from "./TransformChain";

const COMBINE_MODE_OPTIONS: { value: CombineMode; label: string }[] = [
  { value: "concat", label: "Concatenate" },
  { value: "fallback", label: "Fallback" },
  { value: "template", label: "Template" },
  { value: "arithmetic", label: "Arithmetic" },
];

interface MappingRowProps {
  mapping: FieldMapping;
  index: number;
  onChange: (updated: FieldMapping) => void;
  onDelete: () => void;
  targetSuggestions: TargetFieldSuggestion[];
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

export function MappingRow({
  mapping,
  index,
  onChange,
  onDelete,
  targetSuggestions,
}: MappingRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: mapping.id,
    data: { type: "mapping-row" },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `from-${mapping.id}`,
    data: { type: "from-field", mappingId: mapping.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const combineMode = mapping.combineMode ?? "single";
  const isMultiSource = combineMode !== "single";
  const sources: MappingSource[] = isMultiSource
    ? mapping.sources ?? (mapping.from ? [{ id: `row_src_${mapping.id}`, path: mapping.from }] : [])
    : [];

  const handleFromChange = (value: string) => {
    onChange({ ...mapping, from: value });
  };

  const handleToChange = (value: string) => {
    onChange({ ...mapping, to: value });
  };

  const handleChainChange = useCallback(
    (chain: TransformStep[]) => {
      const firstOp = chain[0]?.operation ?? "none";
      const firstConfig = chain[0]?.config ?? {};
      onChange({
        ...mapping,
        chain,
        operation: firstOp as FieldMapping["operation"],
        operationConfig: firstConfig,
      });
    },
    [mapping, onChange],
  );

  const toggleMultiSource = () => {
    if (isMultiSource) {
      const firstPath = sources[0]?.path ?? mapping.from;
      onChange({
        ...mapping,
        combineMode: "single",
        sources: undefined,
        combineConfig: undefined,
        from: firstPath,
      });
    } else {
      const initial: MappingSource[] = mapping.from
        ? [{ id: `row_src_${Date.now()}`, path: mapping.from }]
        : [];
      onChange({
        ...mapping,
        combineMode: "concat",
        sources: initial,
        combineConfig: { separator: " " },
      });
    }
  };

  const handleCombineModeChange = (value: string | null) => {
    const mode = (value ?? "concat") as CombineMode;
    const defaultConfig: CombineConfig =
      mode === "concat"
        ? { separator: " " }
        : mode === "template"
          ? { templateStr: "" }
          : mode === "arithmetic"
            ? { expression: "" }
            : {};
    onChange({ ...mapping, combineMode: mode, combineConfig: defaultConfig });
  };

  const handleSourceChange = (idx: number, path: string) => {
    const next = [...sources];
    const existing = next[idx];
    if (existing) {
      next[idx] = { ...existing, path };
    }
    onChange({ ...mapping, sources: next });
  };

  const handleAddSource = () => {
    onChange({ ...mapping, sources: [...sources, { id: `row_src_${Date.now()}`, path: "" }] });
  };

  const handleRemoveSource = (idx: number) => {
    const next = sources.filter((_, i) => i !== idx);
    if (next.length === 0) {
      onChange({
        ...mapping,
        combineMode: "single",
        sources: undefined,
        combineConfig: undefined,
      });
    } else {
      onChange({ ...mapping, sources: next });
    }
  };

  const handleCombineConfigChange = (partial: Partial<CombineConfig>) => {
    onChange({
      ...mapping,
      combineConfig: { ...mapping.combineConfig, ...partial },
    });
  };

  const autocompleteData = useMemo(() => {
    if (!targetSuggestions || targetSuggestions.length === 0) return [];
    const grouped: Record<string, string[]> = {};
    for (const s of targetSuggestions) {
      const group = s.group || "Fields";
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(s.path);
    }
    return Object.entries(grouped).map(([group, items]) => ({
      group,
      items,
    }));
  }, [targetSuggestions]);

  return (
    <Box
      ref={setSortableRef}
      style={{
        ...style,
        borderRadius: 6,
        border: `1px solid ${
          isOver
            ? "var(--mantine-color-blue-4)"
            : "var(--mantine-color-gray-3)"
        }`,
        background: isOver
          ? "var(--mantine-color-blue-0)"
          : "var(--mantine-color-white)",
      }}
      p="xs"
      mb={4}
      {...attributes}
    >
      <Stack gap={4}>
        {/* Row 1: Grip + Index + Source(s) + Delete */}
        <Group gap="xs" wrap="nowrap" align="flex-start">
          <ActionIcon
            variant="subtle"
            color="slate"
            size="xs"
            style={{ cursor: "grab", marginTop: 4 }}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <IconGripVertical size={14} />
          </ActionIcon>

          <Badge size="xs" variant="light" color="slate" w={24} ta="center" mt={4}>
            {index + 1}
          </Badge>

          <Box style={{ flex: 1 }}>
            {isMultiSource ? (
              <Stack gap={2}>
                {sources.map((src, si) => (
                  <Group key={si} gap={4} wrap="nowrap">
                    <TextInput
                      size="xs"
                      placeholder={`Source ${si + 1}`}
                      value={src.path}
                      onChange={(e) =>
                        handleSourceChange(si, e.currentTarget.value)
                      }
                      style={{ flex: 1 }}
                    />
                    <ActionIcon
                      variant="subtle"
                      color="slate"
                      size="xs"
                      onClick={() => handleRemoveSource(si)}
                      aria-label="Minus"
                    >
                      <IconMinus size={12} />
                    </ActionIcon>
                  </Group>
                ))}
                <Group gap={4}>
                  <ActionIcon
                    variant="light"
                    color="primary"
                    size="xs"
                    onClick={handleAddSource}
                    aria-label="Add"
                  >
                    <IconPlus size={12} />
                  </ActionIcon>
                  <Text size="xs" c="dimmed">Add source</Text>
                </Group>

                {/* Combine mode + config */}
                <Group gap={4} wrap="nowrap" mt={2}>
                  <Select
                    size="xs"
                    data={COMBINE_MODE_OPTIONS}
                    value={(combineMode as string) === "single" ? "concat" : combineMode}
                    onChange={handleCombineModeChange}
                    w={120}
                    comboboxProps={{ withinPortal: false }}
                  />
                  {combineMode === "concat" && (
                    <TextInput
                      size="xs"
                      placeholder="sep"
                      value={mapping.combineConfig?.separator ?? " "}
                      onChange={(e) =>
                        handleCombineConfigChange({
                          separator: e.currentTarget.value,
                        })
                      }
                      w={60}
                    />
                  )}
                  {combineMode === "template" && (
                    <TextInput
                      size="xs"
                      placeholder="{{first}} {{last}}"
                      value={mapping.combineConfig?.templateStr ?? ""}
                      onChange={(e) =>
                        handleCombineConfigChange({
                          templateStr: e.currentTarget.value,
                        })
                      }
                      style={{ flex: 1 }}
                    />
                  )}
                  {combineMode === "arithmetic" && (
                    <TextInput
                      size="xs"
                      placeholder="{{qty}} * {{price}}"
                      value={mapping.combineConfig?.expression ?? ""}
                      onChange={(e) =>
                        handleCombineConfigChange({
                          expression: e.currentTarget.value,
                        })
                      }
                      style={{ flex: 1 }}
                    />
                  )}
                </Group>
              </Stack>
            ) : (
              <Box ref={setDroppableRef}>
                <TextInput
                  size="xs"
                  placeholder="Source field path"
                  value={mapping.from}
                  onChange={(e) => handleFromChange(e.currentTarget.value)}
                  styles={{
                    input: {
                      borderColor: isOver
                        ? "var(--mantine-color-blue-4)"
                        : undefined,
                    },
                  }}
                />
              </Box>
            )}
          </Box>

          <Tooltip
            label={isMultiSource ? "Switch to single source" : "Multi-source mode"}
            withArrow
          >
            <ActionIcon
              variant={isMultiSource ? "filled" : "subtle"}
              color={isMultiSource ? "violet" : "slate"}
              size="xs"
              onClick={toggleMultiSource}
              mt={4}
              aria-label="Layers Linked"
            >
              <IconLayersLinked size={14} />
            </ActionIcon>
          </Tooltip>

          <ActionIcon
            variant="subtle"
            color="danger"
            size="xs"
            onClick={onDelete}
            mt={4}
            aria-label="Delete"
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Group>

        {/* Row 2: Arrow + Destination (Autocomplete) */}
        <Group gap="xs" wrap="nowrap" pl={52}>
          <Text c="dimmed" size="xs">
            <IconArrowRight size={12} />
          </Text>
          <Autocomplete
            size="xs"
            placeholder="Target field name"
            value={mapping.to}
            onChange={handleToChange}
            data={autocompleteData}
            style={{ flex: 1 }}
            comboboxProps={{ withinPortal: false }}
          />
        </Group>

        {/* Row 3: Transform Chain (compact) */}
        <Group gap="xs" wrap="nowrap" pl={52} align="flex-start">
          <TransformChain
            chain={resolveChain(mapping)}
            onChange={handleChainChange}
            compact
          />
        </Group>
      </Stack>
    </Box>
  );
}
