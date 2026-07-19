// PROCUREMENT RateContractPanel — split from procurement.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ProcurementRateContractFormInput } from "@medbrains/schemas";
import { procurementRateContractFormSchema } from "@medbrains/schemas";
import type { CreateRcItemInput, RateContract } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Button, IconButton, toast } from "@/components/ui";
import { VendorSearchSelect } from "@/components/VendorSearchSelect";
import { procurementService } from "@/services/procurement.service";
import { formNumber, optionalText, requiredFormNumber } from "./shared";

const rcStatusColors: Record<string, string> = {
  draft: "slate",
  active: "success",
  expired: "orange",
  terminated: "danger",
};

const emptyRcItem = (): ProcurementRateContractFormInput["items"][number] => ({
  catalog_item_id: "",
  contracted_price: 0,
  max_quantity: "",
  notes: "",
});

const toRcItemInput = (
  item: ProcurementRateContractFormInput["items"][number],
): CreateRcItemInput => ({
  catalog_item_id: item.catalog_item_id,
  contracted_price: requiredFormNumber(item.contracted_price),
  max_quantity: formNumber(item.max_quantity),
  notes: optionalText(item.notes),
});

function CreateRcForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcurementRateContractFormInput>({
    resolver: zodResolver(procurementRateContractFormSchema),
    defaultValues: {
      vendor_id: "",
      start_date: "",
      end_date: "",
      notes: "",
      items: [emptyRcItem()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => procurementService.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementRateContractFormInput) =>
      procurementService.createRateContract({
        vendor_id: values.vendor_id,
        start_date: values.start_date,
        end_date: values.end_date,
        notes: optionalText(values.notes),
        items: values.items.map(toRcItemInput),
      }),
    onSuccess: () => {
      toast.success("Rate contract created", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Controller
        control={control}
        name="vendor_id"
        render={({ field }) => (
          <VendorSearchSelect
            label="Vendor"
            value={field.value}
            onChange={field.onChange}
            required
            error={errors.vendor_id?.message}
          />
        )}
      />
      <TextInput
        label="Start Date"
        placeholder="YYYY-MM-DD"
        required
        error={errors.start_date?.message}
        {...register("start_date")}
      />
      <TextInput
        label="End Date"
        placeholder="YYYY-MM-DD"
        required
        error={errors.end_date?.message}
        {...register("end_date")}
      />
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />

      <Text fw={600}>Contract Items</Text>
      {fields.map((field, idx) => (
        <Group key={field.id} align="flex-start">
          <Controller
            control={control}
            name={`items.${idx}.catalog_item_id`}
            render={({ field: itemField }) => (
              <Select
                size="xs"
                placeholder="Catalog item"
                data={(catalog ?? []).map((c) => ({
                  value: c.id,
                  label: `${c.code} - ${c.name}`,
                }))}
                value={itemField.value}
                onChange={(value) => itemField.onChange(value ?? "")}
                searchable
                error={errors.items?.[idx]?.catalog_item_id?.message}
                style={{ flex: 1 }}
              />
            )}
          />
          <Controller
            control={control}
            name={`items.${idx}.contracted_price`}
            render={({ field: itemField }) => (
              <NumberInput
                size="xs"
                w={120}
                label="Price"
                min={0}
                decimalScale={2}
                value={itemField.value}
                onChange={itemField.onChange}
                error={errors.items?.[idx]?.contracted_price?.message}
              />
            )}
          />
          <IconButton
            tone="danger"
            size={44}
            mt={24}
            aria-label={`Remove rate contract item ${idx + 1}`}
            onClick={() => {
              if (fields.length > 1) remove(idx);
            }}
          >
            ×
          </IconButton>
        </Group>
      ))}
      <Button tone="secondary" size="xs" onClick={() => append(emptyRcItem())} w="fit-content">
        Add Item
      </Button>

      <Button tone="primary" loading={mutation.isPending} type="submit">
        Create Contract
      </Button>
    </Stack>
  );
}

export function RateContractPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["rate-contracts"],
    queryFn: () => procurementService.listRateContracts(),
  });

  const columns = [
    {
      key: "contract_number",
      label: "Contract #",
      render: (row: RateContract) => <Text fw={600}>{row.contract_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: RateContract) => (
        <TableValueBadge
          value={row.status}
          kind="status"
          color={rcStatusColors[row.status] ?? "slate"}
        />
      ),
    },
    { key: "start_date", label: "Start", render: (row: RateContract) => row.start_date },
    { key: "end_date", label: "End", render: (row: RateContract) => row.end_date },
    { key: "notes", label: "Notes", render: (row: RateContract) => row.notes ?? "-" },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Contract
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={contracts ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No rate contracts"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Create Rate Contract"
        closeButtonProps={{ "aria-label": "Close Create Rate Contract" }}
        position="right"
        size="lg"
      >
        <CreateRcForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["rate-contracts"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}
