// Medicines on discharge: picked from the formulary, so each carries the
// catalogue id the pharmacy dispenses Schedule H/H1 discharge lines against.
// A medicine the hospital does not stock is marked buy outside on purpose:
// it names no catalogue item and prints "Buy from outside the hospital".

import { Group, Stack, Text } from "@mantine/core";
import type { DischargeMedicine } from "@medbrains/types";
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { Badge, Button, IconButton, Input, NumberField } from "@/components/ui";
import { BUY_OUTSIDE_PRINT } from "@/features/prescription/rxBuyOutside";

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
  const [outsideName, setOutsideName] = useState("");
  /** Adds the typed medicine as bought outside, chosen on purpose. */
  const addOutside = () => {
    const name = outsideName.trim();
    if (!name) return;
    onChange([...value, { buy_outside: true, drug_name: name, quantity: 1 }]);
    setOutsideName("");
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
        <Group
          key={medicine.catalog_item_id ?? `outside-${index}-${medicine.drug_name}`}
          align="flex-end"
          wrap="nowrap"
        >
          <Stack gap={2} flex={1}>
            <Text size="sm">{medicine.drug_name}</Text>
            {medicine.buy_outside && (
              <Badge tone="neutral" size="xs">
                {BUY_OUTSIDE_PRINT}
              </Badge>
            )}
          </Stack>
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
        <>
          <DrugSearchSelect
            label="Add a medicine"
            value=""
            clearOnSelect
            onChange={(id, drug) => add(id, drug?.name ?? "")}
          />
          <Group align="flex-end" wrap="nowrap">
            <Input
              label="Not stocked here: buy outside"
              placeholder="Medicine name and strength"
              value={outsideName}
              onChange={(e) => setOutsideName(e.currentTarget.value)}
              flex={1}
            />
            <Button tone="secondary" onClick={addOutside} disabled={!outsideName.trim()}>
              Add as buy outside
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
