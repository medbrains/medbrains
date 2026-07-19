// PROCUREMENT SupplierPaymentsPanel — split from procurement.tsx (pure move).

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
import type { ProcurementSupplierPaymentFormInput } from "@medbrains/schemas";
import { procurementSupplierPaymentFormSchema } from "@medbrains/schemas";
import type { SupplierPayment } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Button, toast } from "@/components/ui";
import { VendorSearchSelect } from "@/components/VendorSearchSelect";
import { procurementService } from "@/services/procurement.service";
import { formNumber, optionalText, requiredFormNumber } from "./shared";

const paymentStatusColors: Record<string, string> = {
  pending: "orange",
  partially_paid: "primary",
  paid: "success",
  overdue: "danger",
  disputed: "violet",
};

function CreatePaymentForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProcurementSupplierPaymentFormInput>({
    resolver: zodResolver(procurementSupplierPaymentFormSchema),
    defaultValues: {
      vendor_id: "",
      po_id: null,
      invoice_amount: 0,
      paid_amount: 0,
      due_date: "",
      payment_method: null,
      reference_number: "",
      notes: "",
    },
  });
  const vendorId = useWatch({ control, name: "vendor_id" });

  const { data: poData } = useQuery({
    queryKey: ["purchase-orders", "for-vendor", vendorId],
    queryFn: () => procurementService.listPurchaseOrders({ vendor_id: vendorId, per_page: "100" }),
    enabled: !!vendorId,
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementSupplierPaymentFormInput) =>
      procurementService.createSupplierPayment({
        vendor_id: values.vendor_id,
        po_id: optionalText(values.po_id),
        invoice_amount: requiredFormNumber(values.invoice_amount),
        paid_amount: formNumber(values.paid_amount),
        due_date: optionalText(values.due_date),
        payment_method: values.payment_method ?? undefined,
        reference_number: optionalText(values.reference_number),
        notes: optionalText(values.notes),
      }),
    onSuccess: () => {
      toast.success("Payment recorded", { title: "Created" });
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
            placeholder="Select vendor"
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              setValue("po_id", null, { shouldDirty: true, shouldValidate: true });
            }}
            required
            error={errors.vendor_id?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="po_id"
        render={({ field }) => (
          <Select
            label="Purchase Order (optional)"
            placeholder="Link to PO"
            data={(poData?.purchase_orders ?? []).map((po) => ({
              value: po.id,
              label: `${po.po_number} - ₹${po.total_amount}`,
            }))}
            value={field.value}
            onChange={field.onChange}
            searchable
            clearable
            disabled={!vendorId}
            error={errors.po_id?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="invoice_amount"
        render={({ field }) => (
          <NumberInput
            label="Invoice Amount"
            min={0}
            decimalScale={2}
            value={field.value}
            onChange={field.onChange}
            error={errors.invoice_amount?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="paid_amount"
        render={({ field }) => (
          <NumberInput
            label="Paid Amount"
            min={0}
            decimalScale={2}
            value={field.value}
            onChange={field.onChange}
            error={errors.paid_amount?.message}
          />
        )}
      />
      <TextInput
        label="Due Date"
        placeholder="YYYY-MM-DD"
        error={errors.due_date?.message}
        {...register("due_date")}
      />
      <Controller
        control={control}
        name="payment_method"
        render={({ field }) => (
          <Select
            label="Payment Method"
            placeholder="Select method"
            data={[
              { value: "bank_transfer", label: "Bank Transfer" },
              { value: "cheque", label: "Cheque" },
              { value: "cash", label: "Cash" },
              { value: "upi", label: "UPI" },
              { value: "demand_draft", label: "Demand Draft" },
            ]}
            value={field.value}
            onChange={field.onChange}
            clearable
            error={errors.payment_method?.message}
          />
        )}
      />
      <TextInput
        label="Reference Number"
        placeholder="Txn / Cheque number"
        error={errors.reference_number?.message}
        {...register("reference_number")}
      />
      <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
      <Button tone="primary" loading={mutation.isPending} type="submit">
        Record Payment
      </Button>
    </Stack>
  );
}

export function SupplierPaymentsPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["supplier-payments"],
    queryFn: () => procurementService.listSupplierPayments(),
  });

  const columns = [
    {
      key: "payment_number",
      label: "Payment #",
      render: (row: SupplierPayment) => <Text fw={600}>{row.payment_number}</Text>,
    },
    {
      key: "invoice_amount",
      label: "Invoice",
      render: (row: SupplierPayment) => `₹${row.invoice_amount}`,
    },
    {
      key: "paid_amount",
      label: "Paid",
      render: (row: SupplierPayment) => `₹${row.paid_amount}`,
    },
    {
      key: "balance_amount",
      label: "Balance",
      render: (row: SupplierPayment) => `₹${row.balance_amount}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row: SupplierPayment) => (
        <TableValueBadge
          value={row.status}
          kind="billing"
          color={paymentStatusColors[row.status] ?? "slate"}
        />
      ),
    },
    {
      key: "due_date",
      label: "Due Date",
      render: (row: SupplierPayment) => {
        if (!row.due_date) return "-";
        const overdue = new Date(row.due_date) < new Date() && row.status !== "paid";
        return (
          <Text c={overdue ? "danger" : undefined} fw={overdue ? 600 : undefined}>
            {row.due_date}
          </Text>
        );
      },
    },
    {
      key: "payment_date",
      label: "Payment Date",
      render: (row: SupplierPayment) => row.payment_date ?? "-",
    },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Payment
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No supplier payments"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Record Payment"
        closeButtonProps={{ "aria-label": "Close Record Payment" }}
        position="right"
        size="xl"
      >
        <CreatePaymentForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}
