import { ActionIcon, Group, Popover, SegmentedControl, Stack, Text } from "@mantine/core";
import { IconFilterPlus, IconTrash } from "@tabler/icons-react";
import { useId } from "react";
import { Badge, Button, Input, Select } from "@/components/ui";
import type { Column } from "./data-table-types";

export type AdvancedFilterOperator =
  | "contains"
  | "equals"
  | "notEquals"
  | "gt"
  | "lt"
  | "isEmpty"
  | "isNotEmpty";

export interface AdvancedFilterCondition {
  id: string;
  columnKey: string;
  operator: AdvancedFilterOperator;
  value: string;
}

export interface AdvancedFilterState {
  combinator: "AND" | "OR";
  conditions: AdvancedFilterCondition[];
}

export const emptyAdvancedFilter: AdvancedFilterState = { combinator: "AND", conditions: [] };

const OPERATOR_LABELS: Record<AdvancedFilterOperator, string> = {
  contains: "contains",
  equals: "=",
  notEquals: "≠",
  gt: ">",
  lt: "<",
  isEmpty: "is empty",
  isNotEmpty: "is not empty",
};

const VALUELESS = new Set<AdvancedFilterOperator>(["isEmpty", "isNotEmpty"]);

function matchOne<T>(row: T, condition: AdvancedFilterCondition, columns: Column<T>[]): boolean {
  const column = columns.find((c) => c.key === condition.columnKey);
  const get = column?.filterValue ?? column?.accessor;
  const raw = get?.(row);
  const text = String(raw ?? "").toLowerCase();
  const needle = condition.value.toLowerCase();
  switch (condition.operator) {
    case "contains":
      return text.includes(needle);
    case "equals":
      return text === needle;
    case "notEquals":
      return text !== needle;
    case "gt":
      return Number(raw) > Number(condition.value);
    case "lt":
      return Number(raw) < Number(condition.value);
    case "isEmpty":
      return text === "";
    case "isNotEmpty":
      return text !== "";
    default:
      return true;
  }
}

/** Apply the advanced filter to rows (AND/OR over conditions). */
export function applyAdvancedFilter<T>(
  rows: T[],
  state: AdvancedFilterState,
  columns: Column<T>[],
): T[] {
  const active = state.conditions.filter(
    (c) => c.columnKey && (VALUELESS.has(c.operator) || c.value !== ""),
  );
  if (active.length === 0) return rows;
  return rows.filter((row) => {
    const results = active.map((condition) => matchOne(row, condition, columns));
    return state.combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
  });
}

interface DataTableAdvancedFilterProps<T> {
  columns: Column<T>[];
  state: AdvancedFilterState;
  onChange: (state: AdvancedFilterState) => void;
}

/** Opt-in advanced filter builder: multi-condition AND/OR over any column. */
export function DataTableAdvancedFilter<T>({
  columns,
  state,
  onChange,
}: DataTableAdvancedFilterProps<T>) {
  const baseId = useId();
  const filterableColumns = columns.filter((c) => c.accessor || c.filterValue);
  const columnOptions = filterableColumns.map((c) => ({ value: c.key, label: c.label }));
  const activeCount = state.conditions.filter(
    (c) => c.columnKey && (VALUELESS.has(c.operator) || c.value !== ""),
  ).length;

  const addCondition = () =>
    onChange({
      ...state,
      conditions: [
        ...state.conditions,
        {
          id: `${baseId}-${state.conditions.length}`,
          columnKey: filterableColumns[0]?.key ?? "",
          operator: "contains",
          value: "",
        },
      ],
    });

  const updateCondition = (id: string, patch: Partial<AdvancedFilterCondition>) =>
    onChange({
      ...state,
      conditions: state.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });

  const removeCondition = (id: string) =>
    onChange({ ...state, conditions: state.conditions.filter((c) => c.id !== id) });

  return (
    <Popover position="bottom-end" withArrow shadow="md" width={420} trapFocus>
      <Popover.Target>
        <Button
          tone="secondary"
          size="xs"
          leftSection={<IconFilterPlus size={14} />}
          rightSection={activeCount > 0 ? <Badge tone="info">{activeCount}</Badge> : undefined}
        >
          Advanced
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={600} size="sm">
              Advanced filter
            </Text>
            <SegmentedControl
              size="xs"
              data={["AND", "OR"]}
              value={state.combinator}
              onChange={(value) =>
                onChange({ ...state, combinator: value === "OR" ? "OR" : "AND" })
              }
            />
          </Group>

          {state.conditions.length === 0 ? (
            <Text size="xs" c="dimmed">
              No conditions yet — add one to start filtering.
            </Text>
          ) : (
            state.conditions.map((condition) => (
              <Group key={condition.id} gap={6} wrap="nowrap" align="flex-end">
                <Select
                  size="xs"
                  data={columnOptions}
                  value={condition.columnKey}
                  onChange={(value) => updateCondition(condition.id, { columnKey: value ?? "" })}
                  aria-label="Column"
                  style={{ flex: 1 }}
                />
                <Select
                  size="xs"
                  data={Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }))}
                  value={condition.operator}
                  onChange={(value) =>
                    updateCondition(condition.id, {
                      operator: (value as AdvancedFilterOperator) ?? "contains",
                    })
                  }
                  aria-label="Operator"
                  style={{ width: 120 }}
                />
                {!VALUELESS.has(condition.operator) && (
                  <Input
                    size="xs"
                    value={condition.value}
                    placeholder="Value"
                    aria-label="Value"
                    onChange={(event) =>
                      updateCondition(condition.id, { value: event.currentTarget.value })
                    }
                    style={{ flex: 1 }}
                  />
                )}
                <ActionIcon
                  size="md"
                  color="gray"
                  variant="subtle"
                  aria-label="Remove condition"
                  onClick={() => removeCondition(condition.id)}
                >
                  <IconTrash size={15} />
                </ActionIcon>
              </Group>
            ))
          )}

          <Group justify="space-between">
            <Button
              tone="ghost"
              size="xs"
              leftSection={<IconFilterPlus size={14} />}
              onClick={addCondition}
            >
              Add condition
            </Button>
            {state.conditions.length > 0 && (
              <Button tone="ghost" size="xs" onClick={() => onChange(emptyAdvancedFilter)}>
                Clear all
              </Button>
            )}
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
