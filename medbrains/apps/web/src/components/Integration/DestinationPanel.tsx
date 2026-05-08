import { useDraggable } from "@dnd-kit/core";
import {
  Badge,
  Box,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import type { MappingFieldType, TargetFieldSuggestion } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { TYPE_COLORS, TYPE_LABELS } from "./typeInference";

// ── Types ─────────────────────────────────────────────────

interface DestinationPanelProps {
  targetSuggestions: TargetFieldSuggestion[];
  mappedDestPaths: Set<string>;
  viewMode: "diagram" | "freeform";
}

// ── Draggable destination field ───────────────────────────

function DraggableDestField({
  suggestion,
  isMapped,
  viewMode,
}: {
  suggestion: TargetFieldSuggestion;
  isMapped: boolean;
  viewMode: "diagram" | "freeform";
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `dest-${suggestion.path}`,
    data: { type: "dest-field", suggestion },
  });

  const handleDragStart = (e: React.DragEvent) => {
    if (viewMode === "freeform") {
      e.dataTransfer.setData(
        "application/mapper-node",
        JSON.stringify({
          type: "destField",
          data: { fieldPath: suggestion.path },
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
        {suggestion.path}
      </Text>
      {suggestion.type && suggestion.type !== "unknown" && (
        <Badge
          size="xs"
          variant="light"
          color={TYPE_COLORS[suggestion.type as MappingFieldType] ?? "slate"}
          style={{ flexShrink: 0 }}
        >
          {TYPE_LABELS[suggestion.type as MappingFieldType] ?? suggestion.type}
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

// ── Main Panel ────────────────────────────────────────────

export function DestinationPanel({
  targetSuggestions,
  mappedDestPaths,
  viewMode,
}: DestinationPanelProps) {
  const [search, setSearch] = useState("");

  // Group by category
  const groupedSuggestions = useMemo(() => {
    const groups: Record<string, TargetFieldSuggestion[]> = {};
    for (const s of targetSuggestions) {
      const key = s.group || "Fields";
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    return groups;
  }, [targetSuggestions]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupedSuggestions;
    const q = search.toLowerCase();
    const result: Record<string, TargetFieldSuggestion[]> = {};
    for (const [key, suggestions] of Object.entries(groupedSuggestions)) {
      const matched = suggestions.filter(
        (s) => s.path.toLowerCase().includes(q) || s.label.toLowerCase().includes(q),
      );
      if (matched.length > 0) result[key] = matched;
    }
    return result;
  }, [groupedSuggestions, search]);

  return (
    <Stack gap={0} style={{ height: "100%", overflow: "hidden" }}>
      <Box p="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <Group gap="xs" mb={6}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            Destination
          </Text>
          <Badge size="xs" variant="light" color="orange">
            {targetSuggestions.length}
          </Badge>
        </Group>
        <TextInput
          size="xs"
          placeholder="Search fields..."
          leftSection={<IconSearch size={12} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </Box>

      <ScrollArea.Autosize style={{ flex: 1 }} p="xs">
        <Stack gap={2}>
          {Object.entries(filteredGroups).map(([groupName, suggestions]) => (
            <Box key={groupName}>
              <Text size="xs" fw={600} c="dimmed" mb={2}>
                {groupName}
              </Text>
              {suggestions.map((s) => (
                <DraggableDestField
                  key={s.path}
                  suggestion={s}
                  isMapped={mappedDestPaths.has(s.path)}
                  viewMode={viewMode}
                />
              ))}
            </Box>
          ))}
          {Object.keys(filteredGroups).length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="xl">
              {search ? "No matching fields" : "No destination fields"}
            </Text>
          )}
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}
