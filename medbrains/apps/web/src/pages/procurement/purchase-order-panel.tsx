// PROCUREMENT PurchaseOrderPanel — split from procurement.tsx (pure move).

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
import type { ProcurementPurchaseOrderFormInput } from "@medbrains/schemas";
import { procurementPurchaseOrderFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreatePoItemInput,
  IndentRequisition,
  PurchaseOrder,
  PurchaseOrderItem,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { VendorSearchSelect } from "@/components/VendorSearchSelect";
import { procurementService } from "@/services/procurement.service";
import { colorToBadgeTone, formNumber, optionalText, requiredFormNumber } from "./shared";

const poLinkableIndentStatuses = new Set(["approved", "partially_approved", "partially_issued"]);

function formatLinkedIndentLabel(requisition: IndentRequisition) {
  return `${requisition.indent_number} • ${requisition.status.replace(/_/g, " ")}`;
}

const poStatusColors: Record<string, string> = {
  draft: "slate",
  submitted: "primary",
  approved: "success",
  sent_to_vendor: "teal",
  partially_received: "primary",
  fully_received: "violet",
  closed: "dark",
  cancelled: "danger",
};

const emptyPoItem = (): ProcurementPurchaseOrderFormInput["items"][number] => ({
  catalog_item_id: null,
  item_name: "",
  item_code: "",
  unit: "",
  quantity_ordered: 1,
  unit_price: 0,
  tax_percent: "",
  discount_percent: "",
  indent_item_id: null,
  notes: "",
});

const toPoItemInput = (
  item: ProcurementPurchaseOrderFormInput["items"][number],
): CreatePoItemInput => ({
  catalog_item_id: optionalText(item.catalog_item_id),
  item_name: item.item_name.trim(),
  item_code: optionalText(item.item_code),
  unit: optionalText(item.unit),
  quantity_ordered: requiredFormNumber(item.quantity_ordered),
  unit_price: requiredFormNumber(item.unit_price),
  tax_percent: formNumber(item.tax_percent),
  discount_percent: formNumber(item.discount_percent),
  indent_item_id: optionalText(item.indent_item_id),
  notes: optionalText(item.notes),
});

function PoDetailView({ id }: { id: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: () => procurementService.getPurchaseOrder(id),
  });

  const linkedIndentId = data?.purchase_order.indent_requisition_id ?? null;
  const linkedIndentQuery = useQuery({
    queryKey: ["indent-requisition", "procurement-link", linkedIndentId],
    queryFn: () => {
      if (!linkedIndentId) {
        throw new Error("Missing linked indent");
      }
      return procurementService.getIndentRequisition(linkedIndentId);
    },
    enabled: Boolean(linkedIndentId),
  });

  if (isLoading || !data) return <Text>Loading...</Text>;

  const { purchase_order: po, items } = data;
  const linkedIndent = linkedIndentQuery.data?.requisition;

  return (
    <Stack>
      <Group>
        <Badge tone={colorToBadgeTone(poStatusColors[po.status])} variant="filled">
          {po.status.replace(/_/g, " ")}
        </Badge>
        <Text size="sm" c="dimmed">
          PO #{po.po_number}
        </Text>
      </Group>

      <Text size="sm">Order Date: {po.order_date}</Text>
      {po.indent_requisition_id && (
        <Group gap="xs">
          <Text size="sm">Linked Indent:</Text>
          <Badge tone="info">{linkedIndent?.indent_number ?? po.indent_requisition_id}</Badge>
          {linkedIndent && (
            <Badge tone="neutral" variant="outline" size="sm">
              {linkedIndent.status.replace(/_/g, " ")}
            </Badge>
          )}
        </Group>
      )}
      {po.expected_delivery && <Text size="sm">Expected Delivery: {po.expected_delivery}</Text>}
      {po.payment_terms && <Text size="sm">Payment Terms: {po.payment_terms}</Text>}
      {po.notes && <Text size="sm">{po.notes}</Text>}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Received</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th>Total</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((item: PurchaseOrderItem) => (
            <Table.Tr key={item.id}>
              <Table.Td>{item.item_name}</Table.Td>
              <Table.Td>{item.quantity_ordered}</Table.Td>
              <Table.Td>{item.quantity_received}</Table.Td>
              <Table.Td>₹{item.unit_price}</Table.Td>
              <Table.Td>₹{item.total_amount}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Group>
        <Text size="sm">Subtotal: ₹{po.subtotal}</Text>
        <Text size="sm">Tax: ₹{po.tax_amount}</Text>
        <Text size="sm">Discount: ₹{po.discount_amount}</Text>
        <Text fw={600}>Total: ₹{po.total_amount}</Text>
      </Group>
    </Stack>
  );
}

function CreatePoForm({ onSuccess }: { onSuccess: () => void }) {
  const [isSyncingIndent, setIsSyncingIndent] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProcurementPurchaseOrderFormInput>({
    resolver: zodResolver(procurementPurchaseOrderFormSchema),
    defaultValues: {
      vendor_id: "",
      indent_requisition_id: null,
      notes: "",
      items: [emptyPoItem()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const linkedIndentId = useWatch({ control, name: "indent_requisition_id" });

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => procurementService.listStoreCatalog({ active_only: "true" }),
  });

  const { data: linkableIndents } = useQuery({
    queryKey: ["indent-requisitions", "procurement-linkable"],
    queryFn: async () => {
      const [approved, partiallyApproved, partiallyIssued] = await Promise.all([
        procurementService.listIndentRequisitions({
          status: "approved",
          page: "1",
          per_page: "50",
        }),
        procurementService.listIndentRequisitions({
          status: "partially_approved",
          page: "1",
          per_page: "50",
        }),
        procurementService.listIndentRequisitions({
          status: "partially_issued",
          page: "1",
          per_page: "50",
        }),
      ]);

      const merged = [
        ...approved.requisitions,
        ...partiallyApproved.requisitions,
        ...partiallyIssued.requisitions,
      ];

      const seen = new Set<string>();
      return merged.filter((requisition) => {
        if (seen.has(requisition.id)) {
          return false;
        }
        seen.add(requisition.id);
        return poLinkableIndentStatuses.has(requisition.status);
      });
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementPurchaseOrderFormInput) =>
      procurementService.createPurchaseOrder({
        vendor_id: values.vendor_id,
        indent_requisition_id: optionalText(values.indent_requisition_id),
        notes: optionalText(values.notes),
        items: values.items.map(toPoItemInput),
      }),
    onSuccess: () => {
      toast.success("Purchase order created", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  const addItem = () => append(emptyPoItem());
  const removeItem = (index: number) => {
    if (fields.length > 1) remove(index);
  };

  const syncLinkedIndent = async (value: string | null) => {
    setValue("indent_requisition_id", value, { shouldDirty: true, shouldValidate: true });

    if (!value) {
      return;
    }

    setIsSyncingIndent(true);
    try {
      const detail = await procurementService.getIndentRequisition(value);
      const syncedItems = detail.items
        .map((item) => ({
          catalog_item_id: item.catalog_item_id ?? null,
          item_name: item.item_name,
          item_code: "",
          unit: "",
          quantity_ordered: item.quantity_approved - item.quantity_issued,
          unit_price: Number(item.unit_price ?? 0),
          tax_percent: "",
          discount_percent: "",
          indent_item_id: item.id,
          notes: item.notes ?? "",
        }))
        .filter((item) => item.quantity_ordered > 0);

      setValue("items", syncedItems.length > 0 ? syncedItems : [emptyPoItem()], {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (!getValues("notes").trim()) {
        setValue("notes", `Linked to indent ${detail.requisition.indent_number}`, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load linked indent";
      toast.error(message, { title: "Indent sync failed" });
    } finally {
      setIsSyncingIndent(false);
    }
  };

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <Controller
        control={control}
        name="vendor_id"
        render={({ field }) => (
          <VendorSearchSelect
            label="Vendor"
            placeholder="Select vendor"
            value={field.value}
            onChange={field.onChange}
            required
            error={errors.vendor_id?.message}
          />
        )}
      />
      <Select
        label="Linked Indent"
        description="Optional cross-module link. Selecting an indent syncs approved items into this PO."
        placeholder="Select approved indent"
        data={(linkableIndents ?? []).map((requisition) => ({
          value: requisition.id,
          label: formatLinkedIndentLabel(requisition),
        }))}
        value={linkedIndentId}
        onChange={(value) => {
          void syncLinkedIndent(value);
        }}
        searchable
        clearable
        error={errors.indent_requisition_id?.message}
      />
      {linkedIndentId && (
        <Text size="xs" c="dimmed">
          {isSyncingIndent
            ? "Syncing indent items into the PO..."
            : "PO items are linked back to the indent requisition for downstream tracking."}
        </Text>
      )}
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />

      <Text fw={600}>Items</Text>
      {errors.items?.message && (
        <Text c="danger" size="sm">
          {errors.items.message}
        </Text>
      )}
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Catalog</Table.Th>
            <Table.Th>Qty</Table.Th>
            <Table.Th>Price</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {fields.map((field, idx) => (
            <Table.Tr key={field.id}>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.item_name`}
                  render={({ field: itemField }) => (
                    <TextInput
                      size="xs"
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.item_name?.message}
                      required
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.catalog_item_id`}
                  render={({ field: itemField }) => (
                    <Select
                      size="xs"
                      placeholder="From catalog"
                      data={(catalog ?? []).map((c) => ({
                        value: c.id,
                        label: `${c.code} - ${c.name}`,
                      }))}
                      value={itemField.value}
                      onChange={(value) => {
                        itemField.onChange(value);
                        const cat = catalog?.find((candidate) => candidate.id === value);
                        if (cat) {
                          setValue(`items.${idx}.item_name`, cat.name, {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          setValue(`items.${idx}.unit_price`, Number(cat.base_price), {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
                      searchable
                      clearable
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.quantity_ordered`}
                  render={({ field: itemField }) => (
                    <NumberInput
                      size="xs"
                      w={80}
                      min={1}
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.quantity_ordered?.message}
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <Controller
                  control={control}
                  name={`items.${idx}.unit_price`}
                  render={({ field: itemField }) => (
                    <NumberInput
                      size="xs"
                      w={100}
                      min={0}
                      decimalScale={2}
                      value={itemField.value}
                      onChange={itemField.onChange}
                      error={errors.items?.[idx]?.unit_price?.message}
                    />
                  )}
                />
              </Table.Td>
              <Table.Td>
                <IconButton
                  tone="danger"
                  size={44}
                  aria-label={`Remove purchase order item ${idx + 1}`}
                  onClick={() => removeItem(idx)}
                >
                  ×
                </IconButton>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Button
        tone="secondary"
        size="xs"
        leftSection={<IconPlus size={14} />}
        onClick={addItem}
        w="fit-content"
      >
        Add Item
      </Button>

      <Button tone="primary" loading={mutation.isPending} type="submit">
        Create PO
      </Button>
    </Stack>
  );
}

export function PurchaseOrderPanel({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const canApprove = useHasPermission(P.PROCUREMENT.PO_APPROVE);
  const [page, setPage] = useState(1);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["purchase-orders", page],
    queryFn: () => procurementService.listPurchaseOrders({ page: String(page), per_page: "20" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.approvePurchaseOrder(id),
    onSuccess: () => {
      toast.success("Purchase order approved", { title: "Approved" });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => procurementService.sendPurchaseOrder(id),
    onSuccess: () => {
      toast.success("PO sent to vendor", { title: "Sent" });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const columns = [
    {
      key: "po_number",
      label: "PO #",
      render: (row: PurchaseOrder) => <Text fw={600}>{row.po_number}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PurchaseOrder) => (
        <TableValueBadge
          value={row.status}
          kind="status"
          color={poStatusColors[row.status] ?? "slate"}
        />
      ),
    },
    {
      key: "total_amount",
      label: "Amount",
      render: (row: PurchaseOrder) => `₹${row.total_amount}`,
    },
    { key: "order_date", label: "Date", render: (row: PurchaseOrder) => row.order_date },
    {
      key: "expected_delivery",
      label: "Expected",
      render: (row: PurchaseOrder) => row.expected_delivery ?? "-",
    },
    {
      key: "actions",
      label: "",
      render: (row: PurchaseOrder) => (
        <Group gap={4}>
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
          {row.status === "draft" && canApprove && (
            <Button
              tone="secondary"
              size="compact-xs"
              loading={approveMutation.isPending}
              onClick={() => approveMutation.mutate(row.id)}
            >
              Approve
            </Button>
          )}
          {row.status === "approved" && (
            <Button
              tone="secondary"
              size="compact-xs"
              loading={sendMutation.isPending}
              onClick={() => sendMutation.mutate(row.id)}
            >
              Send
            </Button>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New PO
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={data?.purchase_orders ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((data?.total ?? 0) / 20)}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No purchase orders"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Create Purchase Order"
        closeButtonProps={{ "aria-label": "Close Create Purchase Order" }}
        position="right"
        size="xl"
      >
        <CreatePoForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Purchase Order Details"
        closeButtonProps={{ "aria-label": "Close Purchase Order Details" }}
        position="right"
        size="lg"
      >
        {detailId && <PoDetailView id={detailId} />}
      </Drawer>
    </>
  );
}
