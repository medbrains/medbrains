import { useDraggable } from "@dnd-kit/core";
import {
  Badge,
  Box,
  Divider,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import type { AvailableField, MappingFieldType, OperationDescriptor } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { OPERATION_CATEGORIES, OPERATION_DESCRIPTORS } from "./operationRegistry";
import { TYPE_COLORS, TYPE_LABELS } from "./typeInference";

// ── Types ─────────────────────────────────────────────────

interface SourcePanelProps {
  availableFields: AvailableField[];
  mappedSourcePaths: Set<string>;
  viewMode: "diagram" | "freeform";
}

// ── Draggable source field ────────────────────────────────

function DraggableSourceField({
  field,
  isMapped,
  viewMode,
}: {
  field: AvailableField;
  isMapped: boolean;
  viewMode: "diagram" | "freeform";
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${field.nodeId}-${field.path}`,
    data: { type: "available-field", field },
  });

  const handleDragStart = (e: React.DragEvent) => {
    if (viewMode === "freeform") {
      e.dataTransfer.setData(
        "application/mapper-node",
        JSON.stringify({
          type: "sourceField",
          data: { fieldPath: field.path, nodeLabel: field.nodeLabel },
        }),
      );
    }
  };

  return (
    <UnstyledButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      draggable={viewMode === "freeform"}
      onDragStart={handleDragStart}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 4,
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        background: isMapped ? "var(--mantine-color-green-0)" : "transparent",
        borderLeft: isMapped ? "3px solid var(--mantine-color-green-5)" : "3px solid transparent",
        width: "100%",
        transition: "all 150ms ease",
      }}
    >
      <Text size="xs" fw={500} truncate style={{ flex: 1 }}>
        {field.path}
      </Text>
      {field.type && field.type !== "unknown" && (
        <Badge
          size="xs"
          variant="light"
          color={TYPE_COLORS[field.type as MappingFieldType] ?? "slate"}
          style={{ flexShrink: 0 }}
        >
          {TYPE_LABELS[field.type as MappingFieldType] ?? field.type}
        </Badge>
      )}
      {field.source && (
        <Badge size="xs" variant="dot" color="violet">
          {field.source}
        </Badge>
      )}
      {isMapped && (
        <Box
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--mantine-color-green-5)",
            flexShrink: 0,
          }}
        />
      )}
    </UnstyledButton>
  );
}

// ── Draggable operation ───────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  string: "primary",
  array: "teal",
  number: "orange",
  date: "violet",
  conversion: "danger",
  merge: "primary",
};

function DraggableOperation({
  op,
  viewMode,
}: {
  op: OperationDescriptor;
  viewMode: "diagram" | "freeform";
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `op-${op.type}`,
    data: { type: "operation", operation: op },
  });

  const color = CATEGORY_COLORS[op.category] ?? "slate";

  const handleDragStart = (e: React.DragEvent) => {
    if (viewMode === "freeform") {
      e.dataTransfer.setData(
        "application/mapper-node",
        JSON.stringify({
          type: "operation",
          data: {
            operation: op.type,
            label: op.label,
            category: op.category,
            config: {},
          },
        }),
      );
    }
  };

  return (
    <UnstyledButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      draggable={viewMode === "freeform"}
      onDragStart={handleDragStart}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        borderRadius: 4,
        cursor: "grab",
        opacity: isDragging ? 0.4 : 1,
        width: "100%",
        transition: "all 150ms ease",
      }}
    >
      <Badge size="xs" variant="light" color={color} style={{ flexShrink: 0 }}>
        {op.label}
      </Badge>
      {op.hasConfig && (
        <Text size="xs" c="dimmed" style={{ fontSize: 9 }}>
          [cfg]
        </Text>
      )}
    </UnstyledButton>
  );
}

// ── Main Panel ────────────────────────────────────────────

export function SourcePanel({ availableFields, mappedSourcePaths, viewMode }: SourcePanelProps) {
  const [fieldSearch, setFieldSearch] = useState("");
  const [opSearch, setOpSearch] = useState("");
  const [opCategory, setOpCategory] = useState("all");

  // Group fields by origin
  const groupedFields = useMemo(() => {
    const groups: Record<string, AvailableField[]> = {};
    for (const f of availableFields) {
      const sourceTag = f.source ? ` [${f.source}]` : "";
      const key = `${f.nodeLabel}${sourceTag}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    }
    return groups;
  }, [availableFields]);

  // Filter fields by search
  const filteredGroups = useMemo(() => {
    if (!fieldSearch.trim()) return groupedFields;
    const q = fieldSearch.toLowerCase();
    const result: Record<string, AvailableField[]> = {};
    for (const [key, fields] of Object.entries(groupedFields)) {
      const matched = fields.filter((f) => f.path.toLowerCase().includes(q));
      if (matched.length > 0) result[key] = matched;
    }
    return result;
  }, [groupedFields, fieldSearch]);

  // Filter operations
  const filteredOps = useMemo(() => {
    let ops = OPERATION_DESCRIPTORS;
    if (opCategory !== "all") {
      ops = ops.filter((o) => o.category === opCategory);
    }
    if (opSearch.trim()) {
      const q = opSearch.toLowerCase();
      ops = ops.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          o.description.toLowerCase().includes(q) ||
          o.type.includes(q),
      );
    }
    return ops;
  }, [opCategory, opSearch]);

  const categoryTabs = useMemo(
    () => [
      { value: "all", label: "All" },
      ...OPERATION_CATEGORIES.map((c) => ({
        value: c.key,
        label: c.label.slice(0, 3),
      })),
    ],
    [],
  );

  return (
    <Stack gap={0} style={{ height: "100%", overflow: "hidden" }}>
      {/* ── SOURCE FIELDS ─────────────────────────── */}
      <Box p="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <Group gap="xs" mb={6}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            Source Fields
          </Text>
          <Badge size="xs" variant="light" color="primary">
            {availableFields.length}
          </Badge>
        </Group>
        <TextInput
          size="xs"
          placeholder="Search fields..."
          leftSection={<IconSearch size={12} />}
          value={fieldSearch}
          onChange={(e) => setFieldSearch(e.currentTarget.value)}
        />
      </Box>

      <ScrollArea.Autosize mah={250} p="xs">
        <Stack gap={2}>
          {Object.entries(filteredGroups).map(([nodeLabel, fields]) => (
            <Box key={nodeLabel}>
              <Text size="xs" fw={600} c="dimmed" mb={2}>
                {nodeLabel}
              </Text>
              {fields.map((f) => (
                <DraggableSourceField
                  key={`${f.nodeId}-${f.path}`}
                  field={f}
                  isMapped={mappedSourcePaths.has(f.path)}
                  viewMode={viewMode}
                />
              ))}
            </Box>
          ))}
          {Object.keys(filteredGroups).length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="md">
              {fieldSearch ? "No matching fields" : "No upstream fields"}
            </Text>
          )}
        </Stack>
      </ScrollArea.Autosize>

      {/* ── OPERATIONS ────────────────────────────── */}
      <Divider />
      <Box p="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
          Operations
        </Text>
        <TextInput
          size="xs"
          placeholder="Search operations..."
          leftSection={<IconSearch size={12} />}
          value={opSearch}
          onChange={(e) => setOpSearch(e.currentTarget.value)}
          mb={6}
        />
        <SegmentedControl
          size="xs"
          data={categoryTabs}
          value={opCategory}
          onChange={setOpCategory}
          fullWidth
          styles={{
            root: { gap: 2 },
          }}
        />
      </Box>

      <ScrollArea.Autosize style={{ flex: 1 }} p="xs">
        <Stack gap={2}>
          {filteredOps.map((op) => (
            <DraggableOperation key={op.type} op={op} viewMode={viewMode} />
          ))}
          {filteredOps.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="md">
              No matching operations
            </Text>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
