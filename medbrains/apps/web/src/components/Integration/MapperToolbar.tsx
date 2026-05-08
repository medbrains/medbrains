import {
  Badge,
  Button,
  Group,
  Popover,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconDatabase, IconLayersLinked, IconTransform } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";

// ── Types ─────────────────────────────────────────────────

export type ViewMode = "diagram" | "freeform";

interface MapperToolbarProps {
  mappingCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sampleData: string;
  onSampleDataChange: (json: string) => void;
  sourceFieldPaths: string[];
  canGroup: boolean;
  onGroup: () => void;
  onCancel: () => void;
  onApply: () => void;
}

// ── Component ─────────────────────────────────────────────

export function MapperToolbar({
  mappingCount,
  viewMode,
  onViewModeChange,
  sampleData,
  onSampleDataChange,
  sourceFieldPaths,
  canGroup,
  onGroup,
  onCancel,
  onApply,
}: MapperToolbarProps) {
  const [sampleOpen, setSampleOpen] = useState(false);

  // Parse current JSON into flat key-value for the input fields
  const parsedValues: Record<string, string> = useMemo(() => {
    try {
      const parsed = JSON.parse(sampleData) as Record<string, unknown>;
      if (typeof parsed !== "object" || parsed === null) return {};
      const result: Record<string, string> = {};
      for (const [key, val] of Object.entries(parsed)) {
        result[key] = val === null || val === undefined ? "" : String(val);
      }
      return result;
    } catch {
      return {};
    }
  }, [sampleData]);

  // Count how many fields have values
  const filledCount = useMemo(
    () => Object.values(parsedValues).filter((v) => v.trim() !== "").length,
    [parsedValues],
  );

  const handleFieldChange = useCallback(
    (fieldPath: string, value: string) => {
      const current = { ...parsedValues };
      if (value.trim() === "") {
        delete current[fieldPath];
      } else {
        // Try to parse as number/boolean/array for realistic sample data
        let parsed: unknown = value;
        if (value === "true") parsed = true;
        else if (value === "false") parsed = false;
        else if (value.startsWith("[") || value.startsWith("{")) {
          try {
            parsed = JSON.parse(value);
          } catch {
            parsed = value;
          }
        } else if (!Number.isNaN(Number(value)) && value.trim() !== "") {
          parsed = Number(value);
        }
        current[fieldPath] = String(parsed);
      }

      // Rebuild JSON with proper types
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(current)) {
        if (val === "true") result[key] = true;
        else if (val === "false") result[key] = false;
        else if (!Number.isNaN(Number(val)) && val.trim() !== "") result[key] = Number(val);
        else {
          try {
            const p = JSON.parse(val);
            if (Array.isArray(p) || (typeof p === "object" && p !== null)) {
              result[key] = p;
            } else {
              result[key] = val;
            }
          } catch {
            result[key] = val;
          }
        }
      }
      onSampleDataChange(JSON.stringify(result, null, 2));
    },
    [parsedValues, onSampleDataChange],
  );

  return (
    <Group
      gap="sm"
      px="md"
      py={8}
      style={{
        borderBottom: "1px solid var(--mantine-color-gray-2)",
        background: "var(--mantine-color-gray-0)",
      }}
      justify="space-between"
      wrap="nowrap"
    >
      {/* Left side */}
      <Group gap="sm" wrap="nowrap">
        <Group gap={6} wrap="nowrap">
          <IconTransform size={18} />
          <Text fw={600} size="sm">
            Visual Field Mapper
          </Text>
        </Group>
        <Badge size="sm" variant="light" color="slate">
          {mappingCount} mapping{mappingCount !== 1 ? "s" : ""}
        </Badge>
      </Group>

      {/* Center */}
      <Group gap="sm" wrap="nowrap">
        <SegmentedControl
          size="xs"
          data={[
            { value: "diagram", label: "Diagram" },
            { value: "freeform", label: "Freeform" },
          ]}
          value={viewMode}
          onChange={(v) => onViewModeChange(v as ViewMode)}
        />

        {viewMode === "freeform" && (
          <Button
            size="xs"
            variant="light"
            color="violet"
            leftSection={<IconLayersLinked size={14} />}
            disabled={!canGroup}
            onClick={onGroup}
          >
            Group
          </Button>
        )}

        <Popover
          opened={sampleOpen}
          onChange={setSampleOpen}
          width={380}
          position="bottom"
          withArrow
        >
          <Popover.Target>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconDatabase size={14} />}
              onClick={() => setSampleOpen((v) => !v)}
            >
              Sample Data
              {filledCount > 0 && (
                <Badge size="xs" variant="filled" color="primary" ml={6}>
                  {filledCount}
                </Badge>
              )}
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="xs" fw={600} mb={4}>
              Sample Data
            </Text>
            <Text size="xs" c="dimmed" mb={8}>
              Enter sample values to preview transform results.
            </Text>
            <ScrollArea.Autosize mah={300}>
              <Stack gap={6}>
                {sourceFieldPaths.length > 0 ? (
                  sourceFieldPaths.map((path) => (
                    <TextInput
                      key={path}
                      size="xs"
                      label={path}
                      placeholder={`e.g. "John", 42, true`}
                      value={parsedValues[path] ?? ""}
                      onChange={(e) => handleFieldChange(path, e.currentTarget.value)}
                    />
                  ))
                ) : (
                  <Text size="xs" c="dimmed" ta="center" py="md">
                    No source fields available
                  </Text>
                )}
              </Stack>
            </ScrollArea.Autosize>
          </Popover.Dropdown>
        </Popover>
      </Group>

      {/* Right side */}
      <Group gap="sm" wrap="nowrap">
        <Button variant="subtle" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={onApply}>
          Apply Mappings
        </Button>
      </Group>
    </Group>
  );
}
