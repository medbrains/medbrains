import { ActionIcon, Card, Group, NumberInput, Stack, Text, Tooltip } from "@mantine/core";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type { FieldAccessLevel, PharmacyCatalog } from "@medbrains/types";
import { P } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconTrash } from "@tabler/icons-react";
import { DrugSearchSelect } from "../DrugSearchSelect";

export interface MedicineOrderLineValue {
  catalog_item_id?: string;
  drug_name: string;
  quantity: number;
  unit_price: number;
  tax_percent?: number;
}

interface MedicineOrderLineCardProps {
  value: MedicineOrderLineValue;
  index: number;
  onChange: (value: MedicineOrderLineValue) => void;
  onDrugSelect?: (drug?: PharmacyCatalog) => void;
  onRemove?: () => void;
  canRemove?: boolean;
  removePermission?: string;
  className?: string;
  priceLabel?: string;
  readOnlyPrice?: boolean;
  priceAccess?: FieldAccessLevel;
}

function numberOrZero(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInr(value: number) {
  return `₹${Number.isFinite(value) ? value.toFixed(2) : "0.00"}`;
}

function canViewPrice(access: FieldAccessLevel) {
  return access === "edit" || access === "view";
}

function canEditPrice(access: FieldAccessLevel) {
  return access === "edit";
}

function priceText(access: FieldAccessLevel, value: number) {
  return fieldAccessText(access, formatInr(value), "amount");
}

function drugLineFromSelection(
  current: MedicineOrderLineValue,
  drugId: string,
  drug?: PharmacyCatalog,
): MedicineOrderLineValue {
  return {
    ...current,
    catalog_item_id: drugId || undefined,
    drug_name: drug?.name ?? "",
    unit_price: drug ? numberOrZero(drug.base_price) : 0,
    tax_percent: drug ? numberOrZero(drug.tax_percent ?? 0) : 0,
  };
}

export function MedicineOrderLineCard({
  value,
  index,
  onChange,
  onDrugSelect,
  onRemove,
  canRemove,
  removePermission = P.PHARMACY.DISPENSING_CREATE,
  className,
  priceLabel = "Unit price",
  readOnlyPrice,
  priceAccess,
}: MedicineOrderLineCardProps) {
  const fieldPriceAccess = useFieldAccess("pharmacy.pricing.unit_price");
  const canRemoveLine = useHasPermission(removePermission);
  const effectivePriceAccess = priceAccess ?? fieldPriceAccess;
  const quantity = numberOrZero(value.quantity);
  const unitPrice = numberOrZero(value.unit_price);
  const taxPercent = numberOrZero(value.tax_percent ?? 0);
  const subtotal = quantity * unitPrice;
  const tax = subtotal * (taxPercent / 100);
  const showPriceInput = canViewPrice(effectivePriceAccess);

  return (
    <Card withBorder padding="xs" className={className}>
      <Stack gap="xs">
        <Group justify="space-between" gap="xs">
          <Text size="sm" fw={700}>
            Medicine #{index + 1}
          </Text>
          {canRemove && canRemoveLine && onRemove && (
            <Tooltip label="Remove medicine">
              <ActionIcon
                size="sm"
                color="danger"
                variant="subtle"
                onClick={onRemove}
                aria-label={`Remove medicine ${index + 1}`}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        <DrugSearchSelect
          value={value.catalog_item_id ?? ""}
          onChange={(drugId, drug) => {
            onChange(drugLineFromSelection(value, drugId, drug));
            onDrugSelect?.(drug);
          }}
          label="Medicine"
          placeholder="Search medicine, generic name, or code"
          required
        />

        <Group grow align="flex-start">
          <NumberInput
            label="Qty"
            min={1}
            value={value.quantity}
            onChange={(next) => onChange({ ...value, quantity: numberOrZero(next) })}
          />
          {showPriceInput ? (
            <NumberInput
              label={priceLabel}
              min={0}
              decimalScale={2}
              prefix="₹"
              value={value.unit_price}
              readOnly={readOnlyPrice || !canEditPrice(effectivePriceAccess)}
              onChange={(next) => onChange({ ...value, unit_price: numberOrZero(next) })}
            />
          ) : (
            <Stack gap={0} justify="flex-end" pb={2}>
              <Text size="xs" c="dimmed">
                {priceLabel}
              </Text>
              <Text size="sm" fw={600}>
                {priceText(effectivePriceAccess, unitPrice)}
              </Text>
            </Stack>
          )}
          <Stack gap={0} justify="flex-end" pb={2}>
            <Text size="xs" c="dimmed">
              Subtotal
            </Text>
            <Text size="sm" fw={600}>
              {priceText(effectivePriceAccess, subtotal)}
            </Text>
          </Stack>
        </Group>

        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            GST {taxPercent}%: {priceText(effectivePriceAccess, tax)}
          </Text>
          <Text size="sm" fw={700}>
            Total {priceText(effectivePriceAccess, subtotal + tax)}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}
