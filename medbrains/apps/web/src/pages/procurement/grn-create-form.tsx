// Enter a supplier bill as a draft GRN. Nothing moves to stock until the GRN
// is posted from its detail view.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Stack, Text, Textarea, TextInput } from "@mantine/core";
import type { ProcurementGrnFormInput } from "@medbrains/schemas";
import { procurementGrnFormSchema } from "@medbrains/schemas";
import type { CreateGrnItemInput, GrnDetailResponse } from "@medbrains/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type Control, Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { Button, Select, Table, toast } from "@/components/ui";
import { procurementService } from "@/services/procurement.service";
import { formNumber, optionalText, requiredFormNumber } from "./shared";

type GrnLine = ProcurementGrnFormInput["items"][number];

const emptyGrnItem = (): GrnLine => ({
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
  mrp: "",
  free_quantity: "",
  discount_amount: "",
  gst_rate: "",
  hsn_code: "",
  rejection_reason: "",
  notes: "",
});

const toGrnItemInput = (item: GrnLine): CreateGrnItemInput => ({
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
  mrp: formNumber(item.mrp),
  free_quantity: formNumber(item.free_quantity),
  discount_amount: formNumber(item.discount_amount),
  gst_rate: formNumber(item.gst_rate),
  hsn_code: optionalText(item.hsn_code),
  rejection_reason: optionalText(item.rejection_reason),
  notes: optionalText(item.notes),
});

type NumberKey =
  | "quantity_received"
  | "quantity_accepted"
  | "free_quantity"
  | "unit_price"
  | "mrp"
  | "gst_rate";
type TextKey = "batch_number" | "expiry_date" | "hsn_code";

function NumberCell(props: {
  control: Control<ProcurementGrnFormInput>;
  idx: number;
  name: NumberKey;
  label: string;
  error?: string;
}) {
  return (
    <Controller
      control={props.control}
      name={`items.${props.idx}.${props.name}`}
      render={({ field }) => (
        <NumberInput
          size="xs"
          w={84}
          min={0}
          aria-label={props.label}
          value={field.value ?? ""}
          onChange={field.onChange}
          error={props.error}
        />
      )}
    />
  );
}

function TextCell(props: {
  control: Control<ProcurementGrnFormInput>;
  idx: number;
  name: TextKey;
  label: string;
  placeholder?: string;
  error?: string;
}) {
  return (
    <Controller
      control={props.control}
      name={`items.${props.idx}.${props.name}`}
      render={({ field }) => (
        <TextInput
          size="xs"
          w={props.name === "hsn_code" ? 80 : 110}
          aria-label={props.label}
          placeholder={props.placeholder}
          value={field.value}
          onChange={field.onChange}
          error={props.error}
        />
      )}
    />
  );
}

async function linesFromPo(poId: string): Promise<GrnLine[]> {
  const detail = await procurementService.getPurchaseOrder(poId);
  return detail.items
    .map((item) => ({
      ...emptyGrnItem(),
      po_item_id: item.id,
      catalog_item_id: item.catalog_item_id ?? null,
      item_name: item.item_name,
      quantity_received: item.quantity_ordered - item.quantity_received,
      quantity_accepted: item.quantity_ordered - item.quantity_received,
      unit_price: Number(item.unit_price),
    }))
    .filter((item) => item.quantity_received > 0);
}

export function CreateGrnForm({ onSuccess }: { onSuccess: (r: GrnDetailResponse) => void }) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<ProcurementGrnFormInput>({
    resolver: zodResolver(procurementGrnFormSchema),
    defaultValues: {
      po_id: "",
      store_location_id: "",
      invoice_number: "",
      invoice_date: "",
      invoice_amount: "",
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
  // Received stock lands in a store; with one store there is nothing to choose.
  const { data: stores = [] } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => procurementService.listStoreLocations(),
    staleTime: 10 * 60 * 1000,
  });
  const activeStores = stores.filter((store) => store.is_active);
  const storeValue = useWatch({ control, name: "store_location_id" });
  const receivingStore =
    storeValue || (activeStores.length === 1 ? (activeStores[0]?.id ?? "") : "");

  const mutation = useMutation({
    mutationFn: (values: ProcurementGrnFormInput) =>
      procurementService.createGrn({
        po_id: values.po_id,
        store_location_id: receivingStore || undefined,
        invoice_number: optionalText(values.invoice_number),
        invoice_date: optionalText(values.invoice_date),
        invoice_amount: formNumber(values.invoice_amount),
        notes: optionalText(values.notes),
        items: values.items.map(toGrnItemInput),
      }),
    onSuccess: (result) => {
      toast.success("Saved as a draft. Post it to move the stock.", { title: "GRN saved" });
      onSuccess(result);
    },
    onError: (err: Error) => toast.error(err.message, { title: "GRN not saved" }),
  });

  const handlePoSelect = async (value: string | null) => {
    setValue("po_id", value ?? "", { shouldDirty: true, shouldValidate: true });
    try {
      const lines = value ? await linesFromPo(value) : [];
      setValue("items", lines.length > 0 ? lines : [emptyGrnItem()], {
        shouldDirty: true,
        shouldValidate: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load purchase order";
      toast.error(message, { title: "PO load failed" });
    }
  };

  const lineError = (idx: number, key: keyof GrnLine) => errors.items?.[idx]?.[key]?.message;

  return (
    <Stack
      component="form"
      onSubmit={handleSubmit((values) => {
        if (activeStores.length > 0 && !receivingStore) {
          setError("store_location_id", { message: "Choose the store receiving this stock" });
          return;
        }
        mutation.mutate(values);
      })}
    >
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
            onChange={(value) => void handlePoSelect(value)}
            searchable
            required
            error={errors.po_id?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="store_location_id"
        render={({ field }) => (
          <Select
            label="Receive into store"
            placeholder={
              activeStores.length > 0 ? "Select the receiving store" : "No store configured"
            }
            data={activeStores.map((store) => ({ value: store.id, label: store.name }))}
            value={receivingStore || null}
            onChange={(value) => field.onChange(value ?? "")}
            required={activeStores.length > 0}
            disabled={activeStores.length === 0}
            searchable
            error={errors.store_location_id?.message}
          />
        )}
      />
      <Group grow align="flex-start">
        <TextInput
          label="Invoice Number"
          error={errors.invoice_number?.message}
          {...register("invoice_number")}
        />
        <TextInput
          label="Invoice date"
          type="date"
          error={errors.invoice_date?.message}
          {...register("invoice_date")}
        />
        <Controller
          control={control}
          name="invoice_amount"
          render={({ field }) => (
            <NumberInput
              label="Bill total (₹)"
              description="The lines must add up to it"
              min={0}
              decimalScale={2}
              value={field.value}
              onChange={field.onChange}
              error={errors.invoice_amount?.message}
            />
          )}
        />
      </Group>
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />

      <Text fw={600}>Items</Text>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th>Received</Table.Th>
            <Table.Th>Accepted</Table.Th>
            <Table.Th>Free</Table.Th>
            <Table.Th>Batch</Table.Th>
            <Table.Th>Expiry</Table.Th>
            <Table.Th>Rate</Table.Th>
            <Table.Th>MRP</Table.Th>
            <Table.Th>GST %</Table.Th>
            <Table.Th>HSN</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {fields.map((field, idx) => {
            const name = items?.[idx]?.item_name || `line ${idx + 1}`;
            const num = (key: NumberKey, label: string) => (
              <NumberCell
                control={control}
                idx={idx}
                name={key}
                label={`${label} — ${name}`}
                error={lineError(idx, key)}
              />
            );
            const txt = (key: TextKey, label: string, placeholder?: string) => (
              <TextCell
                control={control}
                idx={idx}
                name={key}
                label={`${label} — ${name}`}
                placeholder={placeholder}
                error={lineError(idx, key)}
              />
            );
            return (
              <Table.Tr key={field.id}>
                <Table.Td>
                  <Text size="sm">{name}</Text>
                </Table.Td>
                <Table.Td>{num("quantity_received", "Received")}</Table.Td>
                <Table.Td>{num("quantity_accepted", "Accepted")}</Table.Td>
                <Table.Td>{num("free_quantity", "Free")}</Table.Td>
                <Table.Td>{txt("batch_number", "Batch", "Batch #")}</Table.Td>
                <Table.Td>{txt("expiry_date", "Expiry", "YYYY-MM-DD")}</Table.Td>
                <Table.Td>{num("unit_price", "Rate")}</Table.Td>
                <Table.Td>{num("mrp", "MRP")}</Table.Td>
                <Table.Td>{num("gst_rate", "GST %")}</Table.Td>
                <Table.Td>{txt("hsn_code", "HSN")}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>

      <Button tone="primary" loading={mutation.isPending} type="submit">
        Save draft GRN
      </Button>
    </Stack>
  );
}
