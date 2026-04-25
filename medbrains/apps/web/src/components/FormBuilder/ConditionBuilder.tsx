import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useFormBuilderStore } from "@medbrains/stores";
import type { FormBuilderFieldNode, JsonLogicRule } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import classes from "./form-builder.module.scss";

// ── Condition Row Types ─────────────────────────────────

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

interface ConditionGroup {
  connector: "and" | "or";
  rows: ConditionRow[];
}

const OPERATORS = [
  { value: "==", label: "equals" },
  { value: "!=", label: "not equals" },
  { value: ">", label: "greater than" },
  { value: "<", label: "less than" },
  { value: ">=", label: "greater or equal" },
  { value: "<=", label: "less or equal" },
  { value: "in", label: "in list" },
  { value: "!!", label: "is not empty" },
  { value: "!", label: "is empty" },
];

// ── JSON Logic Conversion ───────────────────────────────

function conditionGroupToJsonLogic(group: ConditionGroup): JsonLogicRule {
  if (group.rows.length === 0) return null;

  const rules = group.rows
    .filter((row) => row.field && row.operator)
    .map((row): JsonLogicRule => {
      const fieldRef = { var: row.field };

      if (row.operator === "!!" || row.operator === "!") {
        return { [row.operator]: [fieldRef] };
      }

      if (row.operator === "in") {
        const values = row.value.split(",").map((v) => v.trim());
        return { in: [fieldRef, values] };
      }

      // Try to parse numeric values
      const numVal = Number(row.value);
      const parsedValue = Number.isFinite(numVal) ? numVal : row.value;

      return { [row.operator]: [fieldRef, parsedValue] };
    });

  if (rules.length === 0) return null;
  if (rules.length === 1) return rules[0] ?? null;

  return { [group.connector]: rules };
}

function jsonLogicToConditionGroup(rule: JsonLogicRule): ConditionGroup {
  const defaultGroup: ConditionGroup = { connector: "and", rows: [] };

  if (!rule || typeof rule !== "object" || typeof rule === "boolean") {
    return defaultGroup;
  }

  const ruleObj = rule as Record<string, unknown>;
  const connector = "and" in ruleObj ? "and" : "or" in ruleObj ? "or" : null;

  if (connector) {
    const conditions = ruleObj[connector] as JsonLogicRule[];
    if (!Array.isArray(conditions)) return defaultGroup;

    const rows = conditions
      .map((cond) => parseConditionRow(cond))
      .filter((r): r is ConditionRow => r !== null);

    return { connector: connector as "and" | "or", rows };
  }

  // Single condition
  const row = parseConditionRow(rule);
  return row ? { connector: "and", rows: [row] } : defaultGroup;
}

function parseConditionRow(rule: JsonLogicRule): ConditionRow | null {
  if (!rule || typeof rule !== "object" || typeof rule === "boolean") return null;

  const ruleObj = rule as Record<string, unknown>;
  const operators = Object.keys(ruleObj);
  if (operators.length !== 1) return null;

  const operator = operators[0]!;
  const args = ruleObj[operator];
  if (!Array.isArray(args)) return null;

  // Unary operators (!, !!)
  if ((operator === "!" || operator === "!!") && args.length === 1) {
    const fieldRef = args[0] as Record<string, unknown> | undefined;
    if (fieldRef && typeof fieldRef === "object" && "var" in fieldRef) {
      return { field: fieldRef.var as string, operator, value: "" };
    }
    return null;
  }

  // Binary operators
  if (args.length === 2) {
    const fieldRef = args[0] as Record<string, unknown> | undefined;
    if (fieldRef && typeof fieldRef === "object" && "var" in fieldRef) {
      const value = operator === "in" && Array.isArray(args[1])
        ? (args[1] as string[]).join(", ")
        : String(args[1]);
      return { field: fieldRef.var as string, operator, value };
    }
  }

  return null;
}

// ── Component ───────────────────────────────────────────

interface ConditionBuilderProps {
  condition: JsonLogicRule | null;
  onChange: (condition: JsonLogicRule | null) => void;
}

export function ConditionBuilder({ condition, onChange }: ConditionBuilderProps) {
  const allFields = useFormBuilderStore((s) => s.fields);

  const fieldOptions = useMemo(
    () =>
      Object.values(allFields).map((f: FormBuilderFieldNode) => ({
        value: f.fieldCode,
        label: f.label,
      })),
    [allFields],
  );

  const [group, setGroup] = useState<ConditionGroup>(() =>
    jsonLogicToConditionGroup(condition),
  );

  const updateAndEmit = useCallback(
    (newGroup: ConditionGroup) => {
      setGroup(newGroup);
      onChange(conditionGroupToJsonLogic(newGroup));
    },
    [onChange],
  );

  const addRow = useCallback(() => {
    updateAndEmit({
      ...group,
      rows: [...group.rows, { field: "", operator: "==", value: "" }],
    });
  }, [group, updateAndEmit]);

  const removeRow = useCallback(
    (index: number) => {
      const newRows = group.rows.filter((_, i) => i !== index);
      updateAndEmit({ ...group, rows: newRows });
    },
    [group, updateAndEmit],
  );

  const updateRow = useCallback(
    (index: number, updates: Partial<ConditionRow>) => {
      const newRows = group.rows.map((row, i) =>
        i === index ? { ...row, ...updates } : row,
      );
      updateAndEmit({ ...group, rows: newRows });
    },
    [group, updateAndEmit],
  );

  const toggleConnector = useCallback(
    (value: string) => {
      updateAndEmit({ ...group, connector: value as "and" | "or" });
    },
    [group, updateAndEmit],
  );

  return (
    <Stack gap="sm">
      {group.rows.length > 1 && (
        <div className={classes.conditionGroupToggle}>
          <SegmentedControl
            size="xs"
            value={group.connector}
            onChange={toggleConnector}
            data={[
              { label: "AND", value: "and" },
              { label: "OR", value: "or" },
            ]}
          />
        </div>
      )}

      {group.rows.map((row, index) => (
        <div key={index} className={classes.conditionRow}>
          <Select
            size="xs"
            placeholder="Field"
            data={fieldOptions}
            value={row.field}
            onChange={(val) => updateRow(index, { field: val ?? "" })}
            style={{ flex: 2 }}
            searchable
          />
          <Select
            size="xs"
            placeholder="Operator"
            data={OPERATORS}
            value={row.operator}
            onChange={(val) => updateRow(index, { operator: val ?? "==" })}
            style={{ flex: 1.5 }}
          />
          {row.operator !== "!" && row.operator !== "!!" && (
            <TextInput
              size="xs"
              placeholder="Value"
              value={row.value}
              onChange={(e) => updateRow(index, { value: e.currentTarget.value })}
              style={{ flex: 2 }}
            />
          )}
          <ActionIcon
            size="sm"
            variant="subtle"
            color="danger"
            onClick={() => removeRow(index)}
            aria-label="Delete"
          >
            <IconTrash size={12} />
          </ActionIcon>
        </div>
      ))}

      <Group>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={12} />}
          onClick={addRow}
        >
          Add Condition
        </Button>
        {group.rows.length > 0 && (
          <Button
            size="xs"
            variant="subtle"
            color="danger"
            onClick={() => updateAndEmit({ connector: "and", rows: [] })}
          >
            Clear All
          </Button>
        )}
      </Group>

      {group.rows.length > 0 && (
        <ConditionSummary group={group} fieldOptions={fieldOptions} />
      )}
    </Stack>
  );
}

// ── Human-readable Condition Summary ─────────────────────

function getOperatorLabel(op: string): string {
  const found = OPERATORS.find((o) => o.value === op);
  return found?.label ?? op;
}

function formatConditionValue(value: string, operator: string): string {
  if (operator === "!" || operator === "!!") return "";
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  if (value === "") return '""';
  return value;
}

interface ConditionSummaryProps {
  group: ConditionGroup;
  fieldOptions: Array<{ value: string; label: string }>;
}

export function ConditionSummary({ group, fieldOptions }: ConditionSummaryProps) {
  const getFieldLabel = (code: string): string => {
    const found = fieldOptions.find((f) => f.value === code);
    return found?.label ?? code;
  };

  if (group.rows.length === 0) return null;

  return (
    <Stack gap={4} p="sm" bg="gray.0" style={{ borderRadius: "var(--mantine-radius-sm)" }}>
      {group.rows.map((row, i) => (
        <Group key={i} gap="xs" wrap="nowrap">
          {i === 0 && (
            <Text size="xs" c="dimmed" fw={500}>
              When
            </Text>
          )}
          {i > 0 && (
            <Badge size="xs" variant="light">
              {group.connector.toUpperCase()}
            </Badge>
          )}
          <Text size="xs" fw={500} lineClamp={1}>
            {getFieldLabel(row.field)}
          </Text>
          <Text size="xs" c="dimmed">
            {getOperatorLabel(row.operator)}
          </Text>
          {row.operator !== "!" && row.operator !== "!!" && (
            <Text size="xs" fw={500} c="primary">
              {formatConditionValue(row.value, row.operator)}
            </Text>
          )}
        </Group>
      ))}
    </Stack>
  );
}

/** Build a one-line condition summary string for badges/labels */
export function conditionOneLiner(
  condition: JsonLogicRule | null,
  fieldOptions: Array<{ value: string; label: string }>,
): string | null {
  if (!condition) return null;
  const group = jsonLogicToConditionGroup(condition);
  if (group.rows.length === 0) return null;

  const getLabel = (code: string) =>
    fieldOptions.find((f) => f.value === code)?.label ?? code;

  const parts = group.rows.map((row) => {
    const lbl = getLabel(row.field);
    const op = getOperatorLabel(row.operator);
    if (row.operator === "!" || row.operator === "!!") return `${lbl} ${op}`;
    const val = formatConditionValue(row.value, row.operator);
    return `${lbl} ${op} ${val}`;
  });

  return parts.join(` ${group.connector.toUpperCase()} `);
}
