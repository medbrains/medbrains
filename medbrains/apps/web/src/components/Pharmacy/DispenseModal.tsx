import { Group, Stack, Text, Textarea } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { PharmacyCatalog, PharmacyOrderItem } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Checkbox, Modal, Select, Table, toast } from "@/components/ui";
import { Input, NumberField, PasswordField } from "@/components/ui/Input";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import { pharmacyService } from "@/services/pharmacy.service";
import { findAllergyConflicts } from "@/utils/allergyMatch";
import { SafetyFindingsPanel, useSafetyGate } from "./SafetyFindingsPanel";

interface Props {
  opened: boolean;
  /** The order being dispensed — its safety findings come from the server. */
  orderId: string;
  onClose: () => void;
  items: PharmacyOrderItem[];
  isDispensing: boolean;
  /** Active drug-allergen names for the order's patient (for the dispense-time guard). */
  patientAllergens?: string[];
  /** No drug allergy recorded and "no known allergies" never noted. */
  allergyStatusUnknown?: boolean;
  onDispense: (payload: {
    items: { order_item_id: string; batch_stock_id?: string; quantity: number }[];
    witnessed_by?: string;
    witness_password?: string;
    ndps_override_reason?: string;
    schedule_x_duplicate_ref?: string;
    allergy_status_acknowledged?: boolean;
    allergy_override_reason?: string;
    safety_override_reason?: string;
  }) => void;
}

interface RowState {
  qty: number;
  batchId: string | null;
}

/**
 * The one meaning of "controlled", as the server's: the flag, which a Schedule
 * X or NDPS drug always carries. H1 is scheduled, not controlled — it needs a
 * prescription and the H1 register, not a witness.
 */
const isControlled = (drug: PharmacyCatalog): boolean =>
  drug.is_controlled || drug.drug_schedule === "X" || drug.drug_schedule === "NDPS";

/**
 * Dispense modal — per line: FEFO batch pick + dispensed quantity (partial),
 * with a mandatory witness when any Schedule-X/controlled drug is present.
 * Submits to the existing `dispense_order` (partial → `partially_dispensed`).
 */
export function DispenseModal({
  opened,
  orderId,
  onClose,
  items,
  isDispensing,
  patientAllergens = [],
  allergyStatusUnknown = false,
  onDispense,
}: Props) {
  // This order's drugs, by id. The first hundred of the catalogue by name
  // did not always hold them, and a controlled drug then lost its witness.
  const catalogIds = useMemo(
    () => [...new Set(items.map((it) => it.catalog_item_id).filter(Boolean))].sort().join(","),
    [items],
  );
  const catalogQuery = useQuery({
    queryKey: ["pharmacy-catalog", "ids", catalogIds],
    queryFn: () => clinicalSupportService.listPharmacyCatalog({ ids: catalogIds }),
    staleTime: 300_000,
    enabled: opened && catalogIds.length > 0,
  });
  const catalogById = useMemo(
    () => new Map((catalogQuery.data ?? []).map((c: PharmacyCatalog) => [c.id, c] as const)),
    [catalogQuery.data],
  );
  const canSkipWitness = useHasPermission(P.PHARMACY.NDPS_WITNESS_OVERRIDE);

  // Colleagues who may dispense, by name. The user directory it read before
  // is an administrator's, so a pharmacist's witness list was empty. The list
  // is capped on the server, so typing searches the server, not this page.
  const [witnessSearch, setWitnessSearch] = useState("");
  const [witnessQuery] = useDebouncedValue(witnessSearch.trim(), 250);
  const { data: witnesses = [] } = useQuery({
    queryKey: ["pharmacy-dispense-witnesses", witnessQuery],
    queryFn: () => pharmacyService.listDispenseWitnesses(witnessQuery || undefined),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
    enabled: opened,
  });

  // Lines that still have a balance to dispense.
  const lines = items
    .filter((it) => !it.removed_at)
    .map((it) => ({ item: it, remaining: it.quantity - it.quantity_dispensed }))
    .filter((l) => l.remaining > 0);

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [witness, setWitness] = useState<string | null>(null);
  // Typed by the witness, at this screen, and checked on the server.
  const [witnessPassword, setWitnessPassword] = useState("");
  const [noWitnessReason, setNoWitnessReason] = useState("");
  const [duplicateRef, setDuplicateRef] = useState("");
  const [allergyAsked, setAllergyAsked] = useState(false);
  const [allergyReason, setAllergyReason] = useState("");
  const [safetyReason, setSafetyReason] = useState("");

  // Interactions, Reserve antibiotics and non-formulary lines, as the dispense
  // gate will judge them. Allergy is checked separately below.
  const validation = useQuery({
    queryKey: ["pharmacy-order-validate", orderId],
    queryFn: () => pharmacyService.validatePharmacyOrder(orderId),
    enabled: opened,
  });
  const safety = useSafetyGate(validation.data?.findings, {
    loading: validation.isLoading,
    failed: validation.isError,
    reason: safetyReason,
  });

  // Last-barrier allergy check: a dispensable line whose drug name matches a
  // documented allergen. Warn & require an acknowledged reason (logged server-
  // side); the server re-checks independently as the backstop.
  const allergyConflicts = useMemo(
    () =>
      patientAllergens.length === 0
        ? []
        : findAllergyConflicts(
            lines.map((l) => l.item.drug_name),
            patientAllergens,
          ),
    [lines, patientAllergens],
  );
  const allergyBlocked = allergyConflicts.length > 0 && allergyReason.trim().length < 5;

  const rowFor = (itemId: string, remaining: number): RowState =>
    rows[itemId] ?? { qty: remaining, batchId: null };
  const patch = (itemId: string, p: Partial<RowState>) =>
    setRows((r) => ({ ...r, [itemId]: { ...rowFor(itemId, 0), ...r[itemId], ...p } }));

  const drugOf = (it: PharmacyOrderItem) => catalogById.get(it.catalog_item_id ?? "");
  // Until the order's drugs are read, whether any is controlled is unknown:
  // shown as unknown, and the dispense waits rather than guessing "no".
  const controlledUnknown = lines.some((l) => l.item.catalog_item_id && !drugOf(l.item));
  const anyControlled = lines.some((l) => {
    const drug = drugOf(l.item);
    return drug !== undefined && isControlled(drug);
  });
  const anyScheduleX = lines.some((l) => drugOf(l.item)?.drug_schedule === "X");
  // Without a witness, only someone named for it may go ahead, on a reason,
  // and never for Schedule X.
  const skippingWitness = anyControlled && !anyScheduleX && canSkipWitness && !witness;
  const witnessMissing =
    anyControlled &&
    (skippingWitness
      ? noWitnessReason.trim().length < 5
      : !witness || witnessPassword.length === 0);
  const duplicateMissing = anyScheduleX && duplicateRef.trim().length < 3;
  const allergyUnacknowledged = allergyStatusUnknown && !allergyAsked;

  const submit = () => {
    if (witnessMissing) {
      toast.error("A witness is required for Schedule-X / controlled drugs.", {
        title: "Witness needed",
      });
      return;
    }
    if (allergyBlocked) {
      toast.error("Documented drug allergy — record an override reason to dispense.", {
        title: "Allergy conflict",
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
    onDispense({
      items: payloadItems,
      witnessed_by: witness ?? undefined,
      witness_password: witness ? witnessPassword : undefined,
      ndps_override_reason: skippingWitness ? noWitnessReason.trim() : undefined,
      schedule_x_duplicate_ref: anyScheduleX ? duplicateRef.trim() : undefined,
      allergy_status_acknowledged: allergyStatusUnknown ? allergyAsked : undefined,
      allergy_override_reason: allergyConflicts.length > 0 ? allergyReason.trim() : undefined,
      safety_override_reason: safety.needsReason ? safetyReason.trim() : undefined,
    });
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
                  controlled={controlledState(item, drugOf(item))}
                  state={rowFor(item.id, remaining)}
                  enabled={opened}
                  onChange={(p) => patch(item.id, p)}
                />
              ))}
            </Table.Tbody>
          </Table>
        )}

        {allergyConflicts.length > 0 && (
          <Alert
            tone="danger"
            icon={<IconAlertTriangle size={16} />}
            title="Documented drug allergy"
          >
            <Stack gap={4}>
              {allergyConflicts.map((c) => (
                <Text key={c.drug} size="sm">
                  <b>{c.drug}</b> — patient allergic to {c.allergen}
                  {c.cross ? " (cross-reactive)" : ""}
                </Text>
              ))}
              <Textarea
                label="Override reason"
                required
                autosize
                minRows={2}
                placeholder="e.g. Prior documented tolerance; prescriber confirmed; no alternative"
                value={allergyReason}
                onChange={(e) => setAllergyReason(e.currentTarget.value)}
                error={allergyBlocked ? "A reason (≥5 chars) is required to dispense" : undefined}
              />
            </Stack>
          </Alert>
        )}

        <SafetyFindingsPanel
          state={safety}
          reason={safetyReason}
          onReasonChange={setSafetyReason}
        />

        {controlledUnknown && (
          <Alert tone={catalogQuery.isError ? "danger" : "info"}>
            {catalogQuery.isError
              ? "Whether these drugs are controlled could not be read. Dispensing waits until it can be."
              : "Reading which drugs are controlled…"}
          </Alert>
        )}

        {allergyStatusUnknown && (
          <Alert
            tone="warning"
            icon={<IconAlertTriangle size={16} />}
            title="Allergy status unknown"
          >
            <Checkbox
              label="I asked the patient about drug allergies before dispensing"
              checked={allergyAsked}
              onChange={(e) => setAllergyAsked(e.currentTarget.checked)}
            />
          </Alert>
        )}

        {anyScheduleX && (
          <Input
            label="Retained duplicate prescription (Schedule X)"
            description="The scan id or serial of the copy the pharmacy keeps for two years."
            value={duplicateRef}
            onChange={(e) => setDuplicateRef(e.currentTarget.value)}
            error={duplicateMissing ? "Required for Schedule X" : undefined}
            required
          />
        )}

        {anyControlled && (
          <Select
            label="Witness (second pharmacist — required for controlled drugs)"
            placeholder="Select witness"
            data={witnesses.map((u) => ({ value: u.id, label: u.full_name }))}
            value={witness}
            onChange={setWitness}
            searchable
            searchValue={witnessSearch}
            onSearchChange={setWitnessSearch}
            filter={({ options }) => options}
            error={!witness && !skippingWitness ? "Required for controlled drugs" : undefined}
          />
        )}
        {skippingWitness && (
          <Textarea
            label="Reason there is no witness"
            description="Filed on the NDPS record for the inspector."
            required
            autosize
            minRows={2}
            value={noWitnessReason}
            onChange={(e) => setNoWitnessReason(e.currentTarget.value)}
            error={
              noWitnessReason.trim().length < 5 ? "A reason (≥5 chars) is required" : undefined
            }
          />
        )}
        {anyControlled && witness && (
          <PasswordField
            label="Witness's password"
            description="The witness types their own password to confirm they saw this dispense."
            value={witnessPassword}
            onChange={(e) => setWitnessPassword(e.currentTarget.value)}
            autoComplete="off"
            required
          />
        )}

        <Group justify="flex-end" mt="xs">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={isDispensing}
            disabled={
              lines.length === 0 ||
              controlledUnknown ||
              witnessMissing ||
              duplicateMissing ||
              allergyUnacknowledged ||
              allergyBlocked ||
              !safety.canProceed
            }
            onClick={submit}
          >
            Dispense
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

type ControlledState = "yes" | "no" | "unknown";

/** A line's controlled status: unknown while its catalogue row is not read. */
function controlledState(item: PharmacyOrderItem, drug?: PharmacyCatalog): ControlledState {
  if (!item.catalog_item_id) return "no";
  if (!drug) return "unknown";
  return isControlled(drug) ? "yes" : "no";
}

/** One line to dispense: its FEFO batch, the quantity, and its controlled status. */
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
  controlled: ControlledState;
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
          {controlled === "yes" && (
            <Badge tone="danger" size="xs">
              Controlled
            </Badge>
          )}
          {controlled === "unknown" && (
            <Badge tone="neutral" size="xs">
              Controlled: unknown
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
