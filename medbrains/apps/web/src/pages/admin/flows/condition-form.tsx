/**
 * The condition form (RFC §11.1): who takes a branch, built from rows of
 * fact + operator + value, all or any of them. No code. Facts and
 * operators come typed from the server's registry; the server checks the
 * result again (condition.rs).
 */
import { Group, Stack, Text } from "@mantine/core";
import type { FlowFact, FlowNamed } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import {
  Button,
  IconButton,
  MultiSelect,
  NumberField,
  SegmentedControl,
  Select,
} from "@/components/ui";
import type { ConditionRow, ConditionValue, Joiner } from "./condition";

const OP_LABEL: Record<string, string> = {
  eq: "is",
  ne: "is not",
  gt: "is over",
  gte: "is at least",
  lt: "is under",
  lte: "is at most",
  in: "is one of",
};

export interface ConditionFormProps {
  rows: ConditionRow[];
  joiner: Joiner;
  facts: FlowFact[];
  departments: FlowNamed[];
  disabled?: boolean;
  onChange: (rows: ConditionRow[], joiner: Joiner) => void;
}

function blankValue(fact: FlowFact | undefined): ConditionValue {
  if (fact?.type === "bool") return true;
  if (fact?.type === "number") return 0;
  return "";
}

interface ValueFieldProps {
  row: ConditionRow;
  fact: FlowFact | undefined;
  departments: FlowNamed[];
  label: string;
  disabled?: boolean;
  onChange: (v: ConditionValue) => void;
}

function ValueField({ row, fact, departments, label, disabled, onChange }: ValueFieldProps) {
  if (fact?.type === "bool") {
    return (
      <Select
        label={label}
        disabled={disabled}
        data={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
        value={String(row.value)}
        onChange={(v) => onChange(v === "true")}
        allowDeselect={false}
      />
    );
  }
  if (fact?.type === "number") {
    return (
      <NumberField
        label={label}
        disabled={disabled}
        value={typeof row.value === "number" ? row.value : 0}
        onChange={(v) => onChange(typeof v === "number" ? v : 0)}
      />
    );
  }
  const data = departments.map((d) => ({ value: d.code, label: d.name }));
  if (row.op === "in") {
    return (
      <MultiSelect
        label={label}
        disabled={disabled}
        data={data}
        searchable
        value={Array.isArray(row.value) ? row.value : []}
        onChange={(v) => onChange(v)}
      />
    );
  }
  return (
    <Select
      label={label}
      disabled={disabled}
      data={data}
      searchable
      nothingFoundMessage="No department with that name"
      value={typeof row.value === "string" ? row.value : null}
      onChange={(v) => onChange(v ?? "")}
    />
  );
}

export function ConditionForm({
  rows,
  joiner,
  facts,
  departments,
  disabled,
  onChange,
}: ConditionFormProps) {
  const factOf = (key: string) => facts.find((f) => f.key === key);
  const set = (i: number, patch: Partial<ConditionRow>) =>
    onChange(
      rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
      joiner,
    );
  const add = () => {
    const first = facts[0];
    if (!first) return;
    onChange([...rows, { fact: first.key, op: "eq", value: blankValue(first) }], joiner);
  };

  return (
    <Stack gap="sm">
      {rows.length > 1 && (
        <SegmentedControl
          aria-label="Patients take this branch when"
          disabled={disabled}
          value={joiner}
          onChange={(v) => onChange(rows, v as Joiner)}
          data={[
            { value: "all", label: "All of these are true" },
            { value: "any", label: "Any of these is true" },
          ]}
        />
      )}
      {rows.map((row, i) => {
        const fact = factOf(row.fact);
        const n = i + 1;
        return (
          <Group key={`${row.fact}-${i}`} align="flex-end" gap="xs" wrap="wrap">
            <Select
              label={`Rule ${n}: fact`}
              disabled={disabled}
              data={facts.map((f) => ({ value: f.key, label: f.label }))}
              value={row.fact}
              allowDeselect={false}
              onChange={(v) => {
                const next = factOf(v ?? "");
                if (next) set(i, { fact: next.key, op: "eq", value: blankValue(next) });
              }}
            />
            <Select
              label={`Rule ${n}: operator`}
              disabled={disabled}
              data={(fact?.operators ?? ["eq"]).map((op) => ({
                value: op,
                label: OP_LABEL[op] ?? op,
              }))}
              value={row.op}
              allowDeselect={false}
              onChange={(v) => set(i, { op: v ?? "eq", value: v === "in" ? [] : blankValue(fact) })}
            />
            <ValueField
              row={row}
              fact={fact}
              departments={departments}
              label={`Rule ${n}: value`}
              disabled={disabled}
              onChange={(value) => set(i, { value })}
            />
            <IconButton
              aria-label={`Remove rule ${n}`}
              tone="danger"
              disabled={disabled}
              onClick={() =>
                onChange(
                  rows.filter((_, j) => j !== i),
                  joiner,
                )
              }
            >
              <IconTrash size={16} aria-hidden />
            </IconButton>
          </Group>
        );
      })}
      {rows.length === 0 && (
        <Text size="sm" c="dimmed">
          Every patient stops here. Add a rule to make it a branch only some patients take.
        </Text>
      )}
      <Group>
        <Button
          tone="tertiary"
          size="xs"
          leftSection={<IconPlus size={16} />}
          disabled={disabled}
          onClick={add}
        >
          {rows.length === 0 ? "Add branch" : "Add a rule"}
        </Button>
      </Group>
    </Stack>
  );
}
