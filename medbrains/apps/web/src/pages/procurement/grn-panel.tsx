// PROCUREMENT GrnPanel — split from procurement.tsx (pure move).

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
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ProcurementGrnFormInput } from "@medbrains/schemas";
import { procurementGrnFormSchema } from "@medbrains/schemas";
import type { CreateGrnItemInput, GoodsReceiptNote } from "@medbrains/types";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { procurementService } from "@/services/procurement.service";
import { colorToBadgeTone, optionalText, requiredFormNumber } from "./shared";

const grnStatusColors: Record<string, string> = {
  draft: "slate",
  inspecting: "primary",
  accepted: "success",
  partially_accepted: "teal",
  rejected: "danger",
  completed: "violet",
};

const emptyGrnItem = (): ProcurementGrnFormInput["items"][number] => ({
  po_item_id: null,
  catalog_item_id: null,
  item_name: "",
  quantity_received: 1,
  quantity_accepted: 1,
  quantity_rejected: 0,
  batch_number: "",
  expiry_date: "",
  manufacture_date: "",
  unit_price: 0,
  rejection_reason: "",
  notes: "",
});

const toGrnItemInput = (item: ProcurementGrnFormInput["items"][number]): CreateGrnItemInput => ({
  po_item_id: optionalText(item.po_item_id),
  catalog_item_id: optionalText(item.catalog_item_id),
  item_name: item.item_name.trim(),
  quantity_received: requiredFormNumber(item.quantity_received),
  quantity_accepted: requiredFormNumber(item.quantity_accepted),
  quantity_rejected: requiredFormNumber(item.quantity_rejected),
  batch_number: optionalText(item.batch_number),
  expiry_date: optionalText(item.expiry_date),
  manufacture_date: optionalText(item.manufacture_date),
  unit_price: requiredFormNumber(item.unit_price),
  rejection_reason: optionalText(item.rejection_reason),
  notes: optionalText(item.notes),
});

function GrnDetailView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["grn", id],
    queryFn: () => procurementService.getGrn(id),
  });

  if (isLoading || !data) return <Text>Loading...</Text>;

  return (
    <Stack>
      <Group>
        <Badge tone={colorToBadgeTone(grnStatusColors[data.grn.status])} variant="filled">
          {data.grn.status}
        </Badge>
        <Text size="sm" c="dimmed">
          GRN #{data.grn.grn_number}
        </Text>
      </Group>
      <Text size="sm">Receipt Date: {data.grn.receipt_date}</Text>
      {data.grn.invoice_number && <Text size="sm">Invoice: {data.grn.invoice_number}</Text>}

      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Received</Table.Th>
            <Table.Th>Accepted</Table.Th>
            <Table.Th>Rejected</Table.Th>
            <Table.Th>Batch</Table.Th>
            <Table.Th>Expiry</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.item_name}</Table.Td>
              <Table.Td>{item.quantity_received}</Table.Td>
              <Table.Td>
                <Text c="success">{item.quantity_accepted}</Text>
              </Table.Td>
              <Table.Td>
                {item.quantity_rejected > 0 ? (
                  <Text c="danger">{item.quantity_rejected}</Text>
                ) : (
                  "-"
                )}
              </Table.Td>
              <Table.Td>{item.batch_number ?? "-"}</Table.Td>
              <Table.Td>{item.expiry_date ?? "-"}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Text fw={600}>Total: ₹{data.grn.total_amount}</Text>
    </Stack>
  );
}

function CreateGrnForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProcurementGrnFormInput>({
    resolver: zodResolver(procurementGrnFormSchema),
    defaultValues: {
      po_id: "",
      invoice_number: "",
      notes: "",
      items: [emptyGrnItem()],
    },
  });
  const { fields } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });

  const { data: poData } = useQuery({
    queryKey: ["purchase-orders", "receivable"],
    queryFn: () =>
      procurementService.listPurchaseOrders({ status: "sent_to_vendor", per_page: "100" }),
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementGrnFormInput) =>
      procurementService.createGrn({
        po_id: values.po_id,
        invoice_number: optionalText(values.invoice_number),
        notes: optionalText(values.notes),
        items: values.items.map(toGrnItemInput),
      }),
    onSuccess: () => {
      toast.success("GRN created and stock updated", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  const handlePoSelect = async (value: string | null) => {
    setValue("po_id", value ?? "", { shouldDirty: true, shouldValidate: true });
    if (!value) {
      setValue("items", [emptyGrnItem()], { shouldDirty: true, shouldValidate: true });
      return;
    }

    try {
      const detail = await procurementService.getPurchaseOrder(value);
      const receivableItems = detail.items
        .map((item) => {
          const remaining = item.quantity_ordered - item.quantity_received;
          return {
            po_item_id: item.id,
            catalog_item_id: item.catalog_item_id ?? null,
            item_name: item.item_name,
            quantity_received: remaining,
            quantity_accepted: remaining,
            quantity_rejected: 0,
            batch_number: "",
            expiry_date: "",
            manufacture_date: "",
            unit_price: Number(item.unit_price),
            rejection_reason: "",
            notes: "",
          };
        })
        .filter((item) => item.quantity_received > 0);

      setValue("items", receivableItems.length > 0 ? receivableItems : [emptyGrnItem()], {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load purchase order";
      toast.error(message, { title: "PO load failed" });
    }
  };

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Controller
        control={control}
        name="po_id"
        render={({ field }) => (
          <Select
            label="Purchase Order"
            placeholder="Select PO to receive against"
            data={(poData?.purchase_orders ?? []).map((po) => ({
              value: po.id,
              label: `${po.po_number} - ₹${po.total_amount}`,
            }))}
            value={field.value}
            onChange={(value) => {
              void handlePoSelect(value);
            }}
            searchable
            required
            error={errors.po_id?.message}
          />
        )}
      />
      <TextInput
        label="Invoice Number"
        error={errors.invoice_number?.message}
        {...register("invoice_number")}
      />
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />

      <Text fw={600}>Items</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Received</Table.Th>
            <Table.Th>Accepted</Table.Th>
            <Table.Th>Batch</Table.Th>
            <Table.Th>Expiry</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {fields.map((field, idx) => (
            <Table.Tr key={field.id}>
              <Table.Td>
                <Text size="sm">{items?.[idx]?.item_name || "-"}</Text>
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.quantity_received`}
                  render={({ field: itemField }) => (
                    <NumberInput
                      size="xs"
                      w={80}
                      min={1}
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.quantity_received?.message}
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.quantity_accepted`}
                  render={({ field: itemField }) => (
                    <NumberInput
                      size="xs"
                      w={80}
                      min={0}
                      max={Number(items?.[idx]?.quantity_received ?? 0)}
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.quantity_accepted?.message}
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  w={100}
                  placeholder="Batch #"
                  error={errors.items?.[idx]?.batch_number?.message}
                  {...register(`items.${idx}.batch_number`)}
                />
              </Table.Td>
              <Table.Td>
                <TextInput
                  size="xs"
                  w={120}
                  placeholder="YYYY-MM-DD"
                  error={errors.items?.[idx]?.expiry_date?.message}
                  {...register(`items.${idx}.expiry_date`)}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button tone="primary" loading={mutation.isPending} type="submit">
        Create GRN
      </Button>
    </Stack>
  );
}

export function GrnPanel({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["grns", page],
    queryFn: () => procurementService.listGrns({ page: String(page), per_page: "20" }),
  });

  const columns = [
    {
      key: "grn_number",
      label: "GRN #",
      render: (row: GoodsReceiptNote) => <Text fw={600}>{row.grn_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: GoodsReceiptNote) => (
        <TableValueBadge
          value={row.status}
          kind="status"
          color={grnStatusColors[row.status] ?? "slate"}
        />
      ),
    },
    {
      key: "total_amount",
      label: "Amount",
      render: (row: GoodsReceiptNote) => `₹${row.total_amount}`,
    },
    {
      key: "receipt_date",
      label: "Receipt Date",
      render: (row: GoodsReceiptNote) => row.receipt_date,
    },
    {
      key: "invoice_number",
      label: "Invoice",
      render: (row: GoodsReceiptNote) => row.invoice_number ?? "-",
    },
    {
      key: "actions",
      label: "",
      render: (row: GoodsReceiptNote) => (
        <Tooltip label="View">
          <IconButton
            size={44}
            onClick={() => {
              setDetailId(row.id);
              openDetail();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New GRN
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={data?.grns ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 20)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No goods receipt notes"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Create GRN"
        closeButtonProps={{ "aria-label": "Close Create GRN" }}
        position="right"
        size="xl"
      >
        <CreateGrnForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["grns"] });
            void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="GRN Details"
        closeButtonProps={{ "aria-label": "Close GRN Details" }}
        position="right"
        size="lg"
      >
        {detailId && <GrnDetailView id={detailId} />}
      </Drawer>
    </>
  );
}
