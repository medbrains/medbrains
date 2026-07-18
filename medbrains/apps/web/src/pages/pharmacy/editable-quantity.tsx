// IPD EditablePharmacyQuantity — split from pharmacy.tsx (pure move).

import { Group, NumberInput, Tooltip } from "@mantine/core";
import type { PharmacyOrderDetailResponse } from "@medbrains/types";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { useState } from "react";
import { IconButton } from "@/components/ui";

export function EditablePharmacyQuantity({
  item,
  isSaving,
  onSave,
}: {
  item: PharmacyOrderDetailResponse["items"][number];
  isSaving: boolean;
  onSave: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(item.quantity);
  const canSave = Number.isInteger(quantity) && quantity > 0 && quantity !== item.quantity;

  return (
    <Group gap={4} wrap="nowrap">
      <NumberInput
        value={quantity}
        min={1}
        step={1}
        allowDecimal={false}
        clampBehavior="strict"
        hideControls
        size="xs"
        w={72}
        onChange={(value) => {
          const next = typeof value === "number" ? value : Number.parseInt(value || "0", 10);
          setQuantity(Number.isFinite(next) ? next : 0);
        }}
      />
      <Tooltip label="Save quantity">
        <IconButton
          size="sm"
          tone="primary"
          disabled={!canSave || isSaving}
          loading={isSaving && canSave}
          onClick={() => onSave(quantity)}
          aria-label={`Save ${item.drug_name} quantity`}
        >
          <IconDeviceFloppy size={14} />
        </IconButton>
      </Tooltip>
    </Group>
  );
}

// ── Prescription Audit Trail ──────────────────────────────
