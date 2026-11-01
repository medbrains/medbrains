/** Edit one row's fields: an addition, or the new values of a change. */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack } from "@mantine/core";
import type { KnowledgeArea, KnowledgeRowFields } from "@medbrains/types";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, NumberField, Select, TextArea } from "@/components/ui";
import { AREA_FIELDS, type FieldDef } from "./labels";

interface RowFormProps {
  area: KnowledgeArea;
  initial: KnowledgeRowFields | null;
  onSave: (fields: KnowledgeRowFields) => void;
  onCancel: () => void;
}

function fieldSchema(f: FieldDef): z.ZodType {
  if (f.kind === "number") return z.number().nullable();
  if (f.required) return z.string().trim().min(1, `${f.label} is required`);
  return z.string().nullable();
}

/** The row as the server wants it: empty optional text as null, in use. */
export function toRow(area: KnowledgeArea, values: Record<string, unknown>): KnowledgeRowFields {
  const row: KnowledgeRowFields = { is_active: true };
  for (const f of AREA_FIELDS[area]) {
    const v = values[f.key];
    if (typeof v === "number") row[f.key] = v;
    else if (typeof v === "string") row[f.key] = v.trim() === "" && !f.required ? null : v;
    else row[f.key] = null;
  }
  return row;
}

function emptyValues(area: KnowledgeArea): KnowledgeRowFields {
  return Object.fromEntries(
    AREA_FIELDS[area].map((f) => [f.key, f.kind === "number" || !f.required ? null : ""]),
  );
}

export function RowForm({ area, initial, onSave, onCancel }: RowFormProps) {
  const schema = useMemo(
    () => z.object(Object.fromEntries(AREA_FIELDS[area].map((f) => [f.key, fieldSchema(f)]))),
    [area],
  );
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? emptyValues(area),
  });
  return (
    <Stack component="form" gap="sm" onSubmit={form.handleSubmit((v) => onSave(toRow(area, v)))}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {AREA_FIELDS[area].map((f) => (
          <Controller
            key={f.key}
            control={form.control}
            name={f.key}
            render={({ field, fieldState }) => {
              const common = {
                label: f.label,
                required: f.required,
                error: fieldState.error?.message,
              };
              if (f.kind === "number") {
                return (
                  <NumberField
                    {...common}
                    value={typeof field.value === "number" ? field.value : ""}
                    onChange={(v) => field.onChange(typeof v === "number" ? v : null)}
                  />
                );
              }
              if (f.kind === "select") {
                return (
                  <Select
                    {...common}
                    data={f.options ?? []}
                    clearable={!f.required}
                    value={typeof field.value === "string" ? field.value : null}
                    onChange={(v) => field.onChange(v)}
                  />
                );
              }
              const TextField = f.kind === "longtext" ? TextArea : Input;
              return (
                <TextField
                  {...common}
                  value={typeof field.value === "string" ? field.value : ""}
                  onChange={(e) => field.onChange(e.currentTarget.value)}
                />
              );
            }}
          />
        ))}
      </SimpleGrid>
      <Group justify="flex-end">
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button tone="primary" type="submit">
          Add to change
        </Button>
      </Group>
    </Stack>
  );
}
