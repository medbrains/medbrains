import { Badge, Box, Collapse, Group, Table, Text, UnstyledButton } from "@mantine/core";
import type { FieldMapping, MappingSource } from "@medbrains/types";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { evaluateMapping, type MappingEvalResult } from "./transformEvaluator";

// ── Types ─────────────────────────────────────────────────

interface PreviewPanelProps {
  mappings: FieldMapping[];
  sampleData: Record<string, unknown>;
}

// ── Truncate helper ───────────────────────────────────────

function truncate(value: unknown, max = 40): string {
  if (value === null || value === undefined) return "null";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

/** Get all leaf source paths from a mapping, recursing into groups */
function getSourceLabel(mapping: FieldMapping): string {
  if (mapping.combineMode && mapping.combineMode !== "single" && mapping.sources) {
    const leafPaths = collectLeafs(mapping.sources);
    if (leafPaths.length > 1) {
      return `(${leafPaths.map((p) => p.split(".").pop()).join(` ${mapping.combineMode ?? "+"} `)})`;
    }
    return leafPaths[0] ?? (mapping.from || "(none)");
  }
  return mapping.from || "(none)";
}

function collectLeafs(sources: MappingSource[]): string[] {
  const paths: string[] = [];
  for (const s of sources) {
    if (s.children && s.children.length > 0) {
      paths.push(...collectLeafs(s.children));
    } else if (s.path) {
      paths.push(s.path);
    }
  }
  return paths;
}

// ── Component ─────────────────────────────────────────────

export function PreviewPanel({ mappings, sampleData }: PreviewPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const hasSampleData = Object.keys(sampleData).length > 0;

  // Evaluate all mappings
  const results: MappingEvalResult[] = useMemo(() => {
    if (!hasSampleData) return [];
    return mappings.map((m) => evaluateMapping(m, sampleData));
  }, [mappings, sampleData, hasSampleData]);

  return (
    <Box
      style={{
        borderTop: "1px solid var(--mantine-color-gray-2)",
        background: "var(--mantine-color-gray-0)",
      }}
    >
      <UnstyledButton
        onClick={() => setCollapsed((v) => !v)}
        style={{ width: "100%" }}
        p="xs"
        px="md"
      >
        <Group gap="xs" justify="space-between">
          <Group gap={4}>
            {collapsed ? <IconChevronRight size={14} /> : <IconChevronDown size={14} />}
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              Data Preview
            </Text>
            {!hasSampleData && (
              <Text size="xs" c="dimmed">
                — enter sample data to see previews
              </Text>
            )}
          </Group>
          <Badge size="xs" variant="light" color="slate">
            {collapsed ? "expand" : "collapse"}
          </Badge>
        </Group>
      </UnstyledButton>

      <Collapse expanded={!collapsed}>
        <Box px="md" pb="sm" style={{ maxHeight: 200, overflow: "auto" }}>
          {!hasSampleData ? (
            <Text size="xs" c="dimmed" ta="center" py="md">
              Add sample data via the toolbar to preview transform results.
            </Text>
          ) : mappings.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="md">
              No mappings to preview.
            </Text>
          ) : (
            <Table
              striped
              highlightOnHover
              withTableBorder
              fz="xs"
              styles={{
                th: { padding: "4px 8px", fontSize: "var(--mantine-font-size-xs)" },
                td: { padding: "4px 8px" },
              }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Source</Table.Th>
                  <Table.Th>Input</Table.Th>
                  <Table.Th>Transforms</Table.Th>
                  <Table.Th>Output</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {results.map((result) => {
                  const mapping = mappings.find((m) => m.id === result.mappingId);
                  return (
                    <Table.Tr key={result.mappingId}>
                      <Table.Td>
                        <Text size="xs" fw={500}>
                          {mapping ? getSourceLabel(mapping) : "(none)"}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {truncate(result.sourceValue)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {result.steps.length > 0 ? (
                          <Group gap={4} wrap="wrap">
                            {result.steps.map((step) => (
                              <Badge
                                key={step.stepId}
                                size="xs"
                                variant="light"
                                color={step.error ? "danger" : "primary"}
                              >
                                {step.operation}
                              </Badge>
                            ))}
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">
                            passthrough
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={500}>
                          {truncate(result.finalOutput)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          variant="light"
                          color={result.error ? "danger" : "success"}
                        >
                          {result.error ? "error" : "ok"}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
