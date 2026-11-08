// Medicines on discharge: picked from the formulary, so each carries the
// catalogue id the pharmacy dispenses Schedule H/H1 discharge lines against.

import { Group, Stack, Text } from "@mantine/core";
import type { DischargeMedicine } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { IconButton, Input, NumberField } from "@/components/ui";

interface DischargeMedicinesEditorProps {
  value: DischargeMedicine[];
  onChange: (next: DischargeMedicine[]) => void;
}

/** The most medicines a summary lists; the server holds the same limit. */
const MAX_MEDICINES = 50;

/** Edits the medicines a patient goes home with, one formulary drug per row. */
export function DischargeMedicinesEditor({ value, onChange }: DischargeMedicinesEditorProps) {
  /** Changes one row's quantity or instructions. */
  const update = (index: number, patch: Partial<DischargeMedicine>) =>
    onChange(value.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  /** Adds a picked formulary drug once; picking it again keeps the existing row. */
  const add = (catalogItemId: string, drugName: string) => {
    if (!catalogItemId || value.some((m) => m.catalog_item_id === catalogItemId)) return;
    onChange([...value, { catalog_item_id: catalogItemId, drug_name: drugName, quantity: 1 }]);
  };

  return (
    <Stack gap="xs">
      <Text fw={600} size="sm">
        Medicines on discharge
      </Text>
      {value.length === 0 && (
        <Text size="sm" c="dimmed">
          No medicines yet. The pharmacy dispenses discharge medicines from this list.
        </Text>
      )}
      {value.map((medicine, index) => (
        <Group key={medicine.catalog_item_id} align="flex-end" wrap="nowrap">
          <Text size="sm" flex={1}>
            {medicine.drug_name}
          </Text>
          <NumberField
            label="Quantity"
            min={1}
            allowDecimal={false}
            w={96}
            value={medicine.quantity}
            onChange={(q) => update(index, { quantity: typeof q === "number" ? q : 1 })}
          />
          <Input
            label="How to take"
            placeholder="1 tablet twice a day after food"
            value={medicine.instructions ?? ""}
            onChange={(e) => update(index, { instructions: e.currentTarget.value || undefined })}
          />
          <IconButton
            tone="danger"
            aria-label={`Remove ${medicine.drug_name}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <IconTrash size={16} />
          </IconButton>
        </Group>
      ))}
      {value.length < MAX_MEDICINES && (
        <DrugSearchSelect
          label="Add a medicine"
          value=""
          clearOnSelect
          onChange={(id, drug) => add(id, drug?.name ?? "")}
        />
      )}
    </Stack>
  );
}
