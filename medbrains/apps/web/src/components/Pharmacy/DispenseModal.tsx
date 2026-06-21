import { Group, Stack, Text } from "@mantine/core";
import type { PharmacyCatalog, PharmacyOrderItem, SetupUser } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Modal, Select, Table, toast } from "@/components/ui";
import { NumberField } from "@/components/ui/Input";
import { adminAccessService } from "@/services/adminAccess.service";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import { pharmacyService } from "@/services/pharmacy.service";

interface Props {
  opened: boolean;
  onClose: () => void;
  items: PharmacyOrderItem[];
  isDispensing: boolean;
  onDispense: (payload: {
    items: { order_item_id: string; batch_stock_id?: string; quantity: number }[];
    witnessed_by?: string;
  }) => void;
}

interface RowState {
  qty: number;
  batchId: string | null;
}

const isControlled = (drug?: PharmacyCatalog): boolean =>
  Boolean(drug?.is_controlled || drug?.drug_schedule === "X" || drug?.drug_schedule === "H1");

/**
 * Dispense modal — per line: FEFO batch pick + dispensed quantity (partial),
 * with a mandatory witness when any Schedule-X/controlled drug is present.
 * Submits to the existing `dispense_order` (partial → `partially_dispensed`).
 */
export function DispenseModal({ opened, onClose, items, isDispensing, onDispense }: Props) {
  const { data: catalog = [] } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => clinicalSupportService.listPharmacyCatalog(),
    staleTime: 300_000,
    enabled: opened,
  });
  const catalogById = useMemo(
    () => Object.fromEntries((catalog as PharmacyCatalog[]).map((c) => [c.id, c])),
    [catalog],
  );

  const { data: users = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    staleTime: 300_000,
    enabled: opened,
  });

  // Lines that still have a balance to dispense.
  const lines = items
    .filter((it) => !it.removed_at)
    .map((it) => ({ item: it, remaining: it.quantity - it.quantity_dispensed }))
    .filter((l) => l.remaining > 0);

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [witness, setWitness] = useState<string | null>(null);

  const rowFor = (itemId: string, remaining: number): RowState =>
    rows[itemId] ?? { qty: remaining, batchId: null };
  const patch = (itemId: string, p: Partial<RowState>) =>
    setRows((r) => ({ ...r, [itemId]: { ...rowFor(itemId, 0), ...r[itemId], ...p } }));

  const anyControlled = lines.some((l) => isControlled(catalogById[l.item.catalog_item_id ?? ""]));
  const witnessMissing = anyControlled && !witness;

  const submit = () => {
    if (witnessMissing) {
      toast.error("A witness is required for Schedule-X / controlled drugs.", {
        title: "Witness needed",
      });
      return;
    }
    const payloadItems = lines.map((l) => {
      const r = rowFor(l.item.id, l.remaining);
      return {
        order_item_id: l.item.id,
        batch_stock_id: r.batchId ?? undefined,
        quantity: Math.min(Math.max(0, r.qty), l.remaining),
      };
    });
    onDispense({ items: payloadItems, witnessed_by: witness ?? undefined });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Dispense order" size="xl">
      <Stack gap="sm">
        {lines.length === 0 ? (
          <Alert tone="info">Nothing left to dispense on this order.</Alert>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Medication</Table.Th>
                <Table.Th>Batch (FEFO)</Table.Th>
                <Table.Th>Dispense qty</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map(({ item, remaining }) => (
                <DispenseRow
                  key={item.id}
                  item={item}
                  remaining={remaining}
                  controlled={isControlled(catalogById[item.catalog_item_id ?? ""])}
                  state={rowFor(item.id, remaining)}
                  enabled={opened}
                  onChange={(p) => patch(item.id, p)}
                />
              ))}
            </Table.Tbody>
          </Table>
        )}

        {anyControlled && (
          <Select
            label="Witness (second pharmacist — required for Schedule X)"
            placeholder="Select witness"
            data={(users as SetupUser[]).map((u) => ({ value: u.id, label: u.full_name }))}
            value={witness}
            onChange={setWitness}
            searchable
            error={witnessMissing ? "Required for controlled drugs" : undefined}
          />
        )}

        <Group justify="flex-end" mt="xs">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={isDispensing}
            disabled={lines.length === 0 || witnessMissing}
            onClick={submit}
          >
            Dispense
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function DispenseRow({
  item,
  remaining,
  controlled,
  state,
  enabled,
  onChange,
}: {
  item: PharmacyOrderItem;
  remaining: number;
  controlled: boolean;
  state: RowState;
  enabled: boolean;
  onChange: (p: Partial<RowState>) => void;
}) {
  const { data } = useQuery({
    queryKey: ["fefo-batch", item.catalog_item_id, remaining],
    queryFn: () =>
      pharmacyService.selectFefoBatch({
        catalog_item_id: item.catalog_item_id ?? "",
        quantity_needed: remaining,
      }),
    enabled: enabled && Boolean(item.catalog_item_id),
  });
  const batches = data?.batches ?? [];

  return (
    <Table.Tr>
      <Table.Td>
        <Text size="sm" fw={600}>
          {item.drug_name}
        </Text>
        <Group gap={4}>
          {controlled && (
            <Badge tone="danger" size="xs">
              Controlled
            </Badge>
          )}
          <Text size="xs" c="dimmed">
            {item.quantity_dispensed > 0
              ? `${item.quantity_dispensed}/${item.quantity} dispensed · ${remaining} left`
              : `ordered ${item.quantity}`}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td>
        {batches.length > 0 ? (
          <Select
            placeholder="FEFO (auto)"
            data={batches.map((b) => ({
              value: b.batch_id,
              label: `${b.batch_number} · exp ${b.expiry_date} · ${b.quantity_on_hand}`,
            }))}
            value={state.batchId}
            onChange={(v) => onChange({ batchId: v })}
            w={240}
            size="xs"
          />
        ) : (
          <Text size="xs" c="dimmed">
            Auto / not batch-tracked
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <NumberField
          aria-label={`Dispense quantity for ${item.drug_name}`}
          min={0}
          max={remaining}
          value={state.qty}
          onChange={(v) => onChange({ qty: Math.min(Math.max(0, Number(v) || 0), remaining) })}
          w={90}
          size="xs"
        />
      </Table.Td>
    </Table.Tr>
  );
}
