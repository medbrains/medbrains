import { ActionIcon, Button, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import classes from "./screen-builder.module.scss";

interface ConditionRule {
  field: string;
  operator: string;
  value: string;
}

interface ConditionGroup {
  logic: "and" | "or";
  rules: ConditionRule[];
}

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "contains", label: "contains" },
  { value: "starts_with", label: "starts with" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

function parseCondition(condition: Record<string, unknown> | null): ConditionGroup {
  if (!condition) return { logic: "and", rules: [] };
  const logic = (condition.logic as "and" | "or") ?? "and";
  const rules = (condition.rules as ConditionRule[]) ?? [];
  return { logic, rules };
}

function serializeCondition(group: ConditionGroup): Record<string, unknown> | null {
  if (group.rules.length === 0) return null;
  return { logic: group.logic, rules: group.rules };
}

export function ScreenConditionBuilder({
  condition,
  onChange,
}: {
  condition: Record<string, unknown> | null;
  onChange: (condition: Record<string, unknown> | null) => void;
}) {
  const group = parseCondition(condition);

  const updateRule = (index: number, updates: Partial<ConditionRule>) => {
    const newRules = group.rules.map((r, i) =>
      i === index ? { ...r, ...updates } : r,
    );
    onChange(serializeCondition({ ...group, rules: newRules }));
  };

  const addRule = () => {
    onChange(
      serializeCondition({
        ...group,
        rules: [...group.rules, { field: "", operator: "eq", value: "" }],
      }),
    );
  };

  const removeRule = (index: number) => {
    const newRules = group.rules.filter((_, i) => i !== index);
    onChange(serializeCondition({ ...group, rules: newRules }));
  };

  const toggleLogic = () => {
    onChange(
      serializeCondition({
        ...group,
        logic: group.logic === "and" ? "or" : "and",
      }),
    );
  };

  return (
    <Stack gap="xs">
      {group.rules.length > 1 && (
        <Group gap="xs">
          <Text size="xs" c="dimmed">
            Match
          </Text>
          <Button
            variant={group.logic === "and" ? "filled" : "light"}
            size="compact-xs"
            onClick={toggleLogic}
          >
            {group.logic === "and" ? "ALL" : "ANY"}
          </Button>
          <Text size="xs" c="dimmed">
            conditions
          </Text>
        </Group>
      )}

      {group.rules.map((rule, i) => (
        <div key={i} className={classes.conditionRow}>
          <TextInput
            size="xs"
            placeholder="field"
            value={rule.field}
            onChange={(e) => updateRule(i, { field: e.currentTarget.value })}
            style={{ flex: 1 }}
          />
          <Select
            size="xs"
            data={OPERATORS}
            value={rule.operator}
            onChange={(v) => updateRule(i, { operator: v ?? "eq" })}
            style={{ width: 130 }}
          />
          <TextInput
            size="xs"
            placeholder="value"
            value={rule.value}
            onChange={(e) => updateRule(i, { value: e.currentTarget.value })}
            style={{ flex: 1 }}
          />
          <ActionIcon variant="subtle" color="danger" size="xs" onClick={() => removeRule(i)} aria-label="Delete">
            <IconTrash size={14} />
          </ActionIcon>
        </div>
      ))}

      <Button
        variant="light"
        size="compact-xs"
        leftSection={<IconPlus size={12} />}
        onClick={addRule}
      >
        Add condition
      </Button>
    </Stack>
  );
}
