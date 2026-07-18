// Billing AdvancesTab — split from billing.tsx (pure move).

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
import type {
  BillingAdvanceAdjustmentFormInput,
  BillingAdvanceFormInput,
  BillingAdvanceRefundFormInput,
} from "@medbrains/schemas";
import {
  billingAdvanceAdjustmentFormSchema,
  billingAdvanceFormSchema,
  billingAdvanceRefundFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdjustAdvanceRequest,
  CreateAdvanceRequest,
  PatientAdvance,
  RefundAdvanceRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { EncounterSelect } from "@/components/EncounterSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import {
  billingAdvancePurposeOptions,
  billingNumberOrFallback,
  billingOptionalText,
  billingPaymentModeOptions,
} from "@/forms/billing.form";
import { statusColor } from "@/lib/status-colors";
import { billingService } from "@/services/billing.service";
import { toBadgeTone } from "./shared";

export function AdvancesTab() {
  const canCreate = useHasPermission(P.BILLING.ADVANCES_CREATE);
  const canAdjust = useHasPermission(P.BILLING.ADVANCES_ADJUST);
  const canRefund = useHasPermission(P.BILLING.ADVANCES_REFUND);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const advanceDefaults: BillingAdvanceFormInput = {
    patient_id: "",
    encounter_id: "",
    amount: 0,
    payment_mode: "cash",
    reference_number: "",
    purpose: "general",
    notes: "",
  };
  const adjustmentDefaults: BillingAdvanceAdjustmentFormInput = {
    invoice_id: "",
    amount: 0,
    notes: "",
  };
  const advanceRefundDefaults: BillingAdvanceRefundFormInput = {
    amount: 0,
    reason: "",
    mode: "cash",
    reference_number: "",
  };
  const {
    control: advanceControl,
    register: registerAdvance,
    reset: resetAdvance,
    handleSubmit: handleSubmitAdvance,
    formState: { errors: advanceErrors },
  } = useForm<BillingAdvanceFormInput>({
    resolver: zodResolver(billingAdvanceFormSchema),
    defaultValues: advanceDefaults,
  });
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const {
    control: adjustmentControl,
    register: registerAdjustment,
    reset: resetAdjustment,
    handleSubmit: handleSubmitAdjustment,
    formState: { errors: adjustmentErrors },
  } = useForm<BillingAdvanceAdjustmentFormInput>({
    resolver: zodResolver(billingAdvanceAdjustmentFormSchema),
    defaultValues: adjustmentDefaults,
  });
  const [refundId, setRefundId] = useState<string | null>(null);
  const {
    control: advanceRefundControl,
    register: registerAdvanceRefund,
    reset: resetAdvanceRefund,
    handleSubmit: handleSubmitAdvanceRefund,
    formState: { errors: advanceRefundErrors },
  } = useForm<BillingAdvanceRefundFormInput>({
    resolver: zodResolver(billingAdvanceRefundFormSchema),
    defaultValues: advanceRefundDefaults,
  });

  const { data: advances = [], isLoading } = useQuery({
    queryKey: ["advances"],
    queryFn: () => billingService.listAdvances(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateAdvanceRequest) => billingService.createAdvance(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Patient advance recorded", { title: "Advance created" });
      setShowForm(false);
      resetAdvance(advanceDefaults);
    },
    onError: () => toast.error("Failed to create advance", { title: "Error" }),
  });

  const adjustMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdjustAdvanceRequest }) =>
      billingService.adjustAdvance(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Advance adjusted against invoice", { title: "Adjusted" });
      setAdjustId(null);
      resetAdjustment(adjustmentDefaults);
    },
    onError: () => toast.error("Failed to adjust advance", { title: "Error" }),
  });

  const refundMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RefundAdvanceRequest }) =>
      billingService.refundAdvance(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["advances"] });
      toast.success("Advance refunded", { title: "Refunded" });
      setRefundId(null);
      resetAdvanceRefund(advanceRefundDefaults);
    },
    onError: () => toast.error("Failed to refund advance", { title: "Error" }),
  });

  const columns = [
    {
      key: "advance_number",
      label: "Advance #",
      sortable: true,
      searchable: true,
      accessor: (row: PatientAdvance) => row.advance_number,
      render: (row: PatientAdvance) => <Text fw={600}>{row.advance_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: PatientAdvance) => Number(row.amount),
      accessor: (row: PatientAdvance) => row.amount,
      render: (row: PatientAdvance) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "balance",
      label: "Balance",
      sortable: true,
      sortValue: (row: PatientAdvance) => Number(row.balance),
      accessor: (row: PatientAdvance) => row.balance,
      render: (row: PatientAdvance) => (
        <Text size="sm" c={Number(row.balance) > 0 ? "success" : "dimmed"}>
          ₹{row.balance}
        </Text>
      ),
    },
    {
      key: "purpose",
      label: "Purpose",
      searchable: true,
      accessor: (row: PatientAdvance) => row.purpose,
      render: (row: PatientAdvance) => <Badge tone="neutral">{row.purpose}</Badge>,
    },
    {
      key: "payment_mode",
      label: "Mode",
      render: (row: PatientAdvance) => <Text size="sm">{row.payment_mode}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: PatientAdvance) => row.status.replace(/_/g, " "),
      render: (row: PatientAdvance) => (
        <Badge tone={toBadgeTone(statusColor(row.status))}>{row.status.replace(/_/g, " ")}</Badge>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      sortable: true,
      sortValue: (row: PatientAdvance) => new Date(row.created_at).getTime(),
      accessor: (row: PatientAdvance) => new Date(row.created_at).toLocaleDateString(),
      render: (row: PatientAdvance) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: PatientAdvance) => {
        if (Number(row.balance) <= 0) return null;
        return (
          <Group gap={4}>
            {canAdjust && (
              <Button tone="secondary" size="compact-xs" onClick={() => setAdjustId(row.id)}>
                Adjust
              </Button>
            )}
            {canRefund && (
              <Button tone="secondary" size="compact-xs" onClick={() => setRefundId(row.id)}>
                Refund
              </Button>
            )}
          </Group>
        );
      },
    },
  ];

  const handleCreateAdvance = (values: BillingAdvanceFormInput) => {
    createMutation.mutate({
      patient_id: values.patient_id.trim(),
      encounter_id: billingOptionalText(values.encounter_id),
      amount: billingNumberOrFallback(values.amount, 0),
      payment_mode: values.payment_mode,
      reference_number: billingOptionalText(values.reference_number),
      purpose: values.purpose,
      notes: billingOptionalText(values.notes),
    });
  };

  const handleAdjustAdvance = (values: BillingAdvanceAdjustmentFormInput) => {
    if (!adjustId) return;
    adjustMutation.mutate({
      id: adjustId,
      data: {
        invoice_id: values.invoice_id.trim(),
        amount: billingNumberOrFallback(values.amount, 0),
        notes: billingOptionalText(values.notes),
      },
    });
  };

  const handleRefundAdvance = (values: BillingAdvanceRefundFormInput) => {
    if (!refundId) return;
    refundMutation.mutate({
      id: refundId,
      data: {
        amount: billingNumberOrFallback(values.amount, 0),
        reason: values.reason.trim(),
        mode: values.mode,
        reference_number: billingOptionalText(values.reference_number),
      },
    });
  };

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowForm(!showForm)}
          >
            Collect Advance
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmitAdvance(handleCreateAdvance)}>
          <Group grow>
            <Controller
              name="patient_id"
              control={advanceControl}
              render={({ field }) => (
                <PatientSearchSelect value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
            <Controller
              control={advanceControl}
              name="encounter_id"
              render={({ field }) => (
                <EncounterSelect
                  label="Encounter"
                  value={field.value}
                  onChange={field.onChange}
                  error={advanceErrors.encounter_id?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={advanceControl}
              name="amount"
              render={({ field }) => (
                <NumberInput
                  label="Amount"
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={advanceErrors.amount?.message}
                />
              )}
            />
            <Controller
              control={advanceControl}
              name="payment_mode"
              render={({ field }) => (
                <Select
                  label="Payment Mode"
                  data={billingPaymentModeOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "cash")}
                  error={advanceErrors.payment_mode?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={advanceControl}
              name="purpose"
              render={({ field }) => (
                <Select
                  label="Purpose"
                  data={billingAdvancePurposeOptions}
                  value={field.value}
                  onChange={(value) => field.onChange(value ?? "general")}
                  error={advanceErrors.purpose?.message}
                />
              )}
            />
            <TextInput
              label="Reference #"
              error={advanceErrors.reference_number?.message}
              {...registerAdvance("reference_number")}
            />
          </Group>
          <Textarea
            label="Notes"
            error={advanceErrors.notes?.message}
            {...registerAdvance("notes")}
          />
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save Advance
          </Button>
        </Stack>
      )}

      <DataTable
        columns={columns}
        data={advances}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search advance # or purpose"
        exportable
        exportFileName="patient-advances"
      />

      <Drawer
        opened={adjustId !== null}
        onClose={() => setAdjustId(null)}
        title="Adjust Advance Against Invoice"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSubmitAdjustment(handleAdjustAdvance)}>
          <TextInput
            label="Invoice ID"
            required
            error={adjustmentErrors.invoice_id?.message}
            {...registerAdjustment("invoice_id")}
          />
          <Controller
            control={adjustmentControl}
            name="amount"
            render={({ field }) => (
              <NumberInput
                label="Amount"
                required
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={adjustmentErrors.amount?.message}
              />
            )}
          />
          <Textarea
            label="Notes"
            error={adjustmentErrors.notes?.message}
            {...registerAdjustment("notes")}
          />
          <Button tone="primary" type="submit" loading={adjustMutation.isPending}>
            Apply Adjustment
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={refundId !== null}
        onClose={() => setRefundId(null)}
        title="Refund Advance"
        position="right"
        size="sm"
      >
        <Stack component="form" onSubmit={handleSubmitAdvanceRefund(handleRefundAdvance)}>
          <Controller
            control={advanceRefundControl}
            name="amount"
            render={({ field }) => (
              <NumberInput
                label="Refund Amount"
                required
                min={0}
                decimalScale={2}
                value={field.value}
                onChange={field.onChange}
                error={advanceRefundErrors.amount?.message}
              />
            )}
          />
          <TextInput
            label="Reason"
            required
            error={advanceRefundErrors.reason?.message}
            {...registerAdvanceRefund("reason")}
          />
          <Controller
            control={advanceRefundControl}
            name="mode"
            render={({ field }) => (
              <Select
                label="Refund Mode"
                data={billingPaymentModeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "cash")}
                error={advanceRefundErrors.mode?.message}
              />
            )}
          />
          <TextInput
            label="Reference #"
            error={advanceRefundErrors.reference_number?.message}
            {...registerAdvanceRefund("reference_number")}
          />
          <Button tone="primary" type="submit" loading={refundMutation.isPending}>
            Process Refund
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ── Corporate Tab ───────────────────────────────────────
