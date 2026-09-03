// Billing InstallmentsTab — EMI/installment payment management.

import {
  Drawer,
  Group,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateInstallmentRequest,
  PaymentInstallment,
  PaymentInstallmentItem,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconEye, IconForbid, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import type { BadgeTone } from "@/components/ui/Badge";
import { billingService } from "@/services/billing.service";

const statusTone = (s: string): BadgeTone => {
  switch (s) {
    case "active":
      return "info";
    case "completed":
      return "success";
    case "defaulted":
      return "danger";
    case "cancelled":
      return "neutral";
    case "pending":
      return "warning";
    case "paid":
      return "success";
    case "overdue":
      return "danger";
    case "waived":
      return "neutral";
    default:
      return "neutral";
  }
};

export function InstallmentsTab() {
  const canCreate = useHasPermission(P.BILLING.INVOICES_UPDATE);
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["billing", "installments"],
    queryFn: () => billingService.listInstallments(),
  });

  const { data: viewPlan, isLoading: viewLoading } = useQuery({
    queryKey: ["billing", "installments", viewId],
    queryFn: () => billingService.getInstallment(viewId!),
    enabled: !!viewId,
  });

  const createForm = useForm<CreateInstallmentRequest>({
    defaultValues: {
      invoice_id: "",
      installment_count: 3,
      frequency: "monthly",
      interest_rate: 0,
      penalty_rate: 0,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateInstallmentRequest) => billingService.createInstallment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "installments"] });
      setShowCreate(false);
      createForm.reset();
      toast.success("Installment plan created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMutation = useMutation({
    mutationFn: ({ installmentId, itemId }: { installmentId: string; itemId: string }) =>
      billingService.payInstallmentItem(installmentId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "installments"] });
      if (viewId) queryClient.invalidateQueries({ queryKey: ["billing", "installments", viewId] });
      toast.success("Installment marked as paid");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const waiveMutation = useMutation({
    mutationFn: ({ installmentId, itemId }: { installmentId: string; itemId: string }) =>
      billingService.waiveInstallmentItem(installmentId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "installments"] });
      if (viewId) queryClient.invalidateQueries({ queryKey: ["billing", "installments", viewId] });
      toast.success("Installment waived");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = [
    {
      key: "invoice_id",
      label: "Invoice",
      render: (row: PaymentInstallment) => (
        <Text size="sm" style={{ fontFamily: "monospace" }}>
          {row.invoice_id.slice(0, 8)}...
        </Text>
      ),
    },
    {
      key: "total_amount",
      label: "Total",
      render: (row: PaymentInstallment) => `₹${row.total_amount.toLocaleString()}`,
    },
    {
      key: "installment_count",
      label: "EMIs",
      render: (row: PaymentInstallment) =>
        `${row.installment_count} × ₹${row.installment_amount.toLocaleString()}`,
    },
    { key: "frequency", label: "Freq", render: (row: PaymentInstallment) => row.frequency },
    {
      key: "status",
      label: "Status",
      render: (row: PaymentInstallment) => (
        <Badge tone={statusTone(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: "pending_count",
      label: "Pending",
      render: (row: PaymentInstallment) => `${row.pending_count ?? 0}`,
    },
    {
      key: "_actions",
      label: "",
      render: (row: PaymentInstallment) => (
        <Tooltip label="View schedule">
          <IconButton size="sm" aria-label="View schedule" onClick={() => setViewId(row.id)}>
            <IconEye size={14} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const itemColumns = [
    {
      key: "installment_number",
      label: "#",
      render: (row: PaymentInstallmentItem) => `${row.installment_number}`,
    },
    { key: "due_date", label: "Due Date", render: (row: PaymentInstallmentItem) => row.due_date },
    {
      key: "amount",
      label: "Amount",
      render: (row: PaymentInstallmentItem) => `₹${row.amount.toLocaleString()}`,
    },
    {
      key: "penalty_amount",
      label: "Penalty",
      render: (row: PaymentInstallmentItem) =>
        row.penalty_amount > 0 ? `₹${row.penalty_amount.toLocaleString()}` : "—",
    },
    {
      key: "status",
      label: "Status",
      render: (row: PaymentInstallmentItem) => (
        <Badge tone={statusTone(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: "_actions",
      label: "",
      render: (row: PaymentInstallmentItem) =>
        row.status === "pending" && viewId ? (
          <Group gap={4}>
            <Tooltip label="Mark paid">
              <IconButton
                size="sm"
                tone="success"
                aria-label="Mark paid"
                onClick={() => payMutation.mutate({ installmentId: viewId, itemId: row.id })}
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Waive">
              <IconButton
                size="sm"
                tone="danger"
                aria-label="Waive"
                onClick={() => waiveMutation.mutate({ installmentId: viewId, itemId: row.id })}
              >
                <IconForbid size={14} />
              </IconButton>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        {canCreate && (
          <Button leftSection={<IconPlus size={14} />} onClick={() => setShowCreate(true)}>
            Create Installment Plan
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={plans}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search by invoice"
      />

      <Drawer
        opened={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Installment Plan"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))}>
          <TextInput
            label="Invoice ID"
            required
            error={createForm.formState.errors.invoice_id?.message}
            {...createForm.register("invoice_id")}
          />
          <Controller
            control={createForm.control}
            name="installment_count"
            render={({ field }) => (
              <NumberInput label="Number of EMIs" required min={2} max={60} {...field} />
            )}
          />
          <Controller
            control={createForm.control}
            name="interest_rate"
            render={({ field }) => (
              <NumberInput label="Interest Rate %" min={0} max={100} decimalScale={2} {...field} />
            )}
          />
          <Controller
            control={createForm.control}
            name="penalty_rate"
            render={({ field }) => (
              <NumberInput label="Penalty Rate %" min={0} max={100} decimalScale={2} {...field} />
            )}
          />
          <Textarea label="Notes" {...createForm.register("notes")} />
          <Button type="submit" loading={createMutation.isPending}>
            Create Plan
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={!!viewId}
        onClose={() => setViewId(null)}
        title="Installment Schedule"
        position="right"
        size="lg"
      >
        {viewLoading ? (
          <Text size="sm" c="dimmed">
            Loading...
          </Text>
        ) : viewPlan ? (
          <Stack gap="md">
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">
                  Total
                </Text>
                <Text fw={600}>₹{viewPlan.total_amount.toLocaleString()}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  EMIs
                </Text>
                <Text fw={600}>{viewPlan.installment_count}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Per EMI
                </Text>
                <Text fw={600}>₹{viewPlan.installment_amount.toLocaleString()}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Status
                </Text>
                <Badge tone={statusTone(viewPlan.status)}>{viewPlan.status}</Badge>
              </div>
            </Group>
            <DataTable columns={itemColumns} data={viewPlan.items ?? []} rowKey={(row) => row.id} />
          </Stack>
        ) : null}
      </Drawer>
    </Stack>
  );
}
