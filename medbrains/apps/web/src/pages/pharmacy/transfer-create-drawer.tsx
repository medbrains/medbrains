// Raise a stock transfer between two pharmacy stores.
//
// The endpoint has existed since the transfer lifecycle shipped; nothing ever
// called it, so transfers could be approved, dispatched and received but never
// created. The screen shows what the source store actually holds for each line,
// because the dispatch step refuses a transfer the source cannot cover — and
// learning that at dispatch, after an approval, is learning it too late.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { PharmacyTransferFormInput } from "@medbrains/schemas";
import { pharmacyTransferFormSchema } from "@medbrains/schemas";
import type { CreatePharmacyTransferRequest, PharmacyBatch } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { DrugSearchSelect } from "@/components";
import {
  Alert,
  Button,
  Drawer,
  IconButton,
  NumberField,
  Select,
  TextArea,
  toast,
} from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

/** What a single store holds of a single item, and what would leave first. */
interface SourceStock {
  onHand: number;
  earliestExpiry: string | null;
}

const stockKey = (storeId: string, itemId: string) => `${storeId}:${itemId}`;

/**
 * Index every batch once into `store:item -> {onHand, earliestExpiry}`.
 * A per-line lookup would otherwise be a scan of the whole batch list per
 * line, and a per-line fetch would be a round trip per line.
 */
export function indexStock(batches: PharmacyBatch[]): Map<string, SourceStock> {
  const index = new Map<string, SourceStock>();
  for (const batch of batches) {
    if (!batch.store_location_id || batch.quantity_on_hand <= 0) continue;
    const key = stockKey(batch.store_location_id, batch.catalog_item_id);
    const current = index.get(key);
    if (current) {
      current.onHand += batch.quantity_on_hand;
      if (!current.earliestExpiry || batch.expiry_date < current.earliestExpiry) {
        current.earliestExpiry = batch.expiry_date;
      }
    } else {
      index.set(key, { onHand: batch.quantity_on_hand, earliestExpiry: batch.expiry_date });
    }
  }
  return index;
}

const emptyLine = { catalog_item_id: "", quantity: 1 };

export function TransferCreateDrawer({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const {
    data: stores = [],
    isLoading: storesLoading,
    isError: storesFailed,
  } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => pharmacyService.listStoreLocations(),
    enabled: opened,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PharmacyTransferFormInput>({
    resolver: zodResolver(pharmacyTransferFormSchema),
    defaultValues: { from_location_id: "", to_location_id: "", notes: "", items: [emptyLine] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const fromId = watch("from_location_id");
  const lines = watch("items");

  // Scope the batch read to the source store. The endpoint caps at 500 rows,
  // so an unfiltered fetch in a busy tenant can truncate away the very batch
  // this form is asking about — and the line would then say "none at source"
  // with a full shelf behind it.
  const { data: batches = [], isError: batchesFailed } = useQuery({
    queryKey: ["pharmacy-batches", fromId],
    queryFn: () => pharmacyService.listPharmacyBatches({ store_location_id: fromId }),
    enabled: opened && Boolean(fromId),
  });

  const stockIndex = useMemo(() => indexStock(batches), [batches]);

  const storeOptions = stores.map((store) => ({ value: store.id, label: store.name }));

  /** Lines the source store cannot cover — the dispatch step would refuse these. */
  const shortLines = useMemo(() => {
    if (!fromId) return [];
    return (lines ?? [])
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => {
        if (!line.catalog_item_id) return false;
        const held = stockIndex.get(stockKey(fromId, line.catalog_item_id))?.onHand ?? 0;
        return Number(line.quantity) > held;
      });
  }, [fromId, lines, stockIndex]);

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyTransferRequest) =>
      pharmacyService.createPharmacyTransfer(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-transfers"] });
      toast.success("Transfer raised and waiting for approval", { title: "Transfer requested" });
      reset();
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not raise transfer" }),
  });

  const submit = handleSubmit((values) => {
    createMutation.mutate({
      from_location_id: values.from_location_id,
      to_location_id: values.to_location_id,
      notes: values.notes || undefined,
      items: values.items.map((line) => ({
        catalog_item_id: line.catalog_item_id,
        quantity: Number(line.quantity),
      })),
    });
  });

  return (
    <Drawer opened={opened} onClose={onClose} title="Raise a stock transfer" size="lg">
      <Stack gap="md">
        {storesFailed && (
          <Alert tone="danger" title="Stores could not be loaded">
            The list of pharmacy stores is unavailable, so a transfer cannot be addressed. This is
            not the same as having no stores — try again, and report it if it persists.
          </Alert>
        )}
        {batchesFailed && (
          <Alert tone="warning" title="Stock levels unavailable">
            Batch stock could not be read, so this form cannot show what the source store holds. You
            can still raise the transfer, but dispatch will refuse it if the stock is not there.
          </Alert>
        )}

        <Group grow align="flex-start">
          <Controller
            control={control}
            name="from_location_id"
            render={({ field }) => (
              <Select
                {...field}
                label="From store"
                placeholder="Where the stock leaves"
                data={storeOptions}
                disabled={storesLoading}
                error={errors.from_location_id?.message}
                searchable
              />
            )}
          />
          <Controller
            control={control}
            name="to_location_id"
            render={({ field }) => (
              <Select
                {...field}
                label="To store"
                placeholder="Where the stock arrives"
                data={storeOptions.filter((option) => option.value !== fromId)}
                disabled={storesLoading}
                error={errors.to_location_id?.message}
                searchable
              />
            )}
          />
        </Group>

        <Stack gap="sm">
          {fields.map((fieldRow, index) => {
            const itemId = lines?.[index]?.catalog_item_id ?? "";
            const held = fromId && itemId ? stockIndex.get(stockKey(fromId, itemId)) : undefined;
            const wanted = Number(lines?.[index]?.quantity ?? 0);
            const isShort = Boolean(fromId && itemId && wanted > (held?.onHand ?? 0));

            return (
              <Group key={fieldRow.id} align="flex-start" gap="sm" wrap="nowrap">
                <Controller
                  control={control}
                  name={`items.${index}.catalog_item_id`}
                  render={({ field }) => (
                    <DrugSearchSelect
                      value={field.value}
                      onChange={(drugId) => field.onChange(drugId)}
                      label="Medicine"
                      error={errors.items?.[index]?.catalog_item_id?.message}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <NumberField
                      {...field}
                      label="Quantity"
                      min={1}
                      w={120}
                      error={errors.items?.[index]?.quantity?.message}
                    />
                  )}
                />
                <Stack gap={2} pt={26} miw={160}>
                  {fromId && itemId ? (
                    <>
                      <Text size="xs" c={isShort ? "red" : "dimmed"}>
                        {held?.onHand ? `${held.onHand} at source` : "none at source"}
                      </Text>
                      {held?.earliestExpiry && (
                        <Text size="xs" c="dimmed">
                          first out {held.earliestExpiry}
                        </Text>
                      )}
                    </>
                  ) : (
                    <Text size="xs" c="dimmed">
                      pick a source store
                    </Text>
                  )}
                </Stack>
                <IconButton
                  tone="danger"
                  aria-label={`Remove medicine line ${index + 1}`}
                  disabled={fields.length === 1}
                  mt={26}
                  onClick={() => remove(index)}
                >
                  <IconTrash size={16} />
                </IconButton>
              </Group>
            );
          })}
          {errors.items?.message && (
            <Text size="xs" c="red">
              {errors.items.message}
            </Text>
          )}
          <Group>
            <Button
              tone="tertiary"
              leftSection={<IconPlus size={16} />}
              onClick={() => append(emptyLine)}
            >
              Add medicine
            </Button>
          </Group>
        </Stack>

        {shortLines.length > 0 && (
          <Alert tone="warning" title="The source store cannot cover this transfer">
            {shortLines.length === 1
              ? "One line asks for more than the source holds."
              : `${shortLines.length} lines ask for more than the source holds.`}{" "}
            The transfer can still be raised, but dispatch will refuse it until the stock is there.
          </Alert>
        )}

        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextArea {...field} label="Notes" placeholder="Why this stock is moving (optional)" />
          )}
        />

        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" loading={createMutation.isPending} onClick={() => void submit()}>
            Raise transfer
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
