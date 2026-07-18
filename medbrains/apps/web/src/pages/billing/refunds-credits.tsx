// Billing RefundsCreditsTab — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type {
  BillingCreditNoteFormInput,
  BillingRefundFormInput,
  BillingWriteOffFormInput,
} from "@medbrains/schemas";
import {
  billingCreditNoteFormSchema,
  billingRefundFormSchema,
  billingWriteOffFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  ApproveWriteOffRequest,
  BadDebtWriteOff,
  CreateCreditNoteRequest,
  CreateRefundRequest,
  CreateWriteOffRequest,
  CreditNote,
  Refund,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, Button, IconButton } from "@/components/ui";
import {
  billingNumberOrFallback,
  billingOptionalText,
  billingPaymentModeOptions,
} from "@/forms/billing.form";
import { billingService } from "@/services/billing.service";

export function RefundsCreditsTab({
  canCreate,
  canWriteOff,
}: {
  canCreate: boolean;
  canWriteOff: boolean;
}) {
  const queryClient = useQueryClient();
  const canApproveWriteOff = useHasPermission(P.BILLING.WRITE_OFF_APPROVE);
  const [showRefund, setShowRefund] = useState(false);
  const [showCredit, setShowCredit] = useState(false);
  const [showWriteOff, setShowWriteOff] = useState(false);
  const refundDefaults: BillingRefundFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
    mode: "cash",
    reference_number: "",
  };
  const creditDefaults: BillingCreditNoteFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
  };
  const writeOffDefaults: BillingWriteOffFormInput = {
    invoice_id: "",
    amount: 0,
    reason: "",
    notes: "",
  };
  const {
    control: refundControl,
    register: registerRefund,
    reset: resetRefund,
    handleSubmit: handleSubmitRefund,
    formState: { errors: refundErrors },
  } = useForm<BillingRefundFormInput>({
    resolver: zodResolver(billingRefundFormSchema),
    defaultValues: refundDefaults,
  });
  const {
    control: creditControl,
    register: registerCredit,
    reset: resetCredit,
    handleSubmit: handleSubmitCredit,
    formState: { errors: creditErrors },
  } = useForm<BillingCreditNoteFormInput>({
    resolver: zodResolver(billingCreditNoteFormSchema),
    defaultValues: creditDefaults,
  });
  const {
    control: writeOffControl,
    register: registerWriteOff,
    reset: resetWriteOff,
    handleSubmit: handleSubmitWriteOff,
    formState: { errors: writeOffErrors },
  } = useForm<BillingWriteOffFormInput>({
    resolver: zodResolver(billingWriteOffFormSchema),
    defaultValues: writeOffDefaults,
  });

  const [refundsPage, setRefundsPage] = useState(1);
  const { data: refunds } = useQuery({
    queryKey: ["refunds", refundsPage],
    queryFn: () => billingService.listRefunds({ page: String(refundsPage), limit: "50" }),
  });

  const [creditNotesPage, setCreditNotesPage] = useState(1);
  const { data: creditNotes } = useQuery({
    queryKey: ["credit-notes", creditNotesPage],
    queryFn: () => billingService.listCreditNotes({ page: String(creditNotesPage), limit: "50" }),
  });

  const refundMutation = useMutation({
    mutationFn: (data: CreateRefundRequest) => billingService.createRefund(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["refunds"] });
      setShowRefund(false);
      resetRefund(refundDefaults);
    },
  });

  const creditMutation = useMutation({
    mutationFn: (data: CreateCreditNoteRequest) => billingService.createCreditNote(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-notes"] });
      setShowCredit(false);
      resetCredit(creditDefaults);
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({ noteId, invoiceId }: { noteId: string; invoiceId: string }) =>
      billingService.applyCreditNote(noteId, invoiceId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["credit-notes"] }),
  });

  const [writeOffsPage, setWriteOffsPage] = useState(1);
  const { data: writeOffs } = useQuery({
    queryKey: ["write-offs", writeOffsPage],
    queryFn: () => billingService.listWriteOffs({ page: String(writeOffsPage), limit: "50" }),
  });

  const writeOffMutation = useMutation({
    mutationFn: (data: CreateWriteOffRequest) => billingService.createWriteOff(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["write-offs"] });
      setShowWriteOff(false);
      resetWriteOff(writeOffDefaults);
    },
  });

  const handleCreateRefund = (values: BillingRefundFormInput) => {
    refundMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
      mode: values.mode,
      reference_number: billingOptionalText(values.reference_number),
    });
  };

  const handleCreateCreditNote = (values: BillingCreditNoteFormInput) => {
    creditMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
    });
  };

  const handleCreateWriteOff = (values: BillingWriteOffFormInput) => {
    writeOffMutation.mutate({
      invoice_id: values.invoice_id.trim(),
      amount: billingNumberOrFallback(values.amount, 0),
      reason: values.reason.trim(),
      notes: billingOptionalText(values.notes),
    });
  };

  const approveWriteOffMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApproveWriteOffRequest }) =>
      billingService.approveWriteOff(id, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["write-offs"] }),
  });

  const writeOffColumns = [
    {
      key: "write_off_number",
      label: "WO #",
      sortable: true,
      searchable: true,
      accessor: (row: BadDebtWriteOff) => row.write_off_number,
      render: (row: BadDebtWriteOff) => <Text fw={500}>{row.write_off_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: BadDebtWriteOff) => Number(row.amount),
      accessor: (row: BadDebtWriteOff) => row.amount,
      render: (row: BadDebtWriteOff) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: BadDebtWriteOff) => row.reason,
      render: (row: BadDebtWriteOff) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: BadDebtWriteOff) => row.status,
      render: (row: BadDebtWriteOff) => (
        <Badge
          tone={
            row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "warning"
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: BadDebtWriteOff) =>
        row.status === "pending" && canApproveWriteOff ? (
          <Group gap={4}>
            <Tooltip label="Approve">
              <IconButton
                tone="success"
                aria-label="Approve"
                size="sm"
                onClick={() =>
                  approveWriteOffMutation.mutate({ id: row.id, data: { approved: true } })
                }
              >
                <IconCheck size={14} />
              </IconButton>
            </Tooltip>
            <Tooltip label="Reject">
              <IconButton
                tone="danger"
                aria-label="Reject"
                size="sm"
                onClick={() =>
                  approveWriteOffMutation.mutate({ id: row.id, data: { approved: false } })
                }
              >
                <IconX size={14} />
              </IconButton>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  const refundColumns = [
    {
      key: "refund_number",
      label: "Refund #",
      sortable: true,
      searchable: true,
      accessor: (row: Refund) => row.refund_number,
      render: (row: Refund) => <Text fw={500}>{row.refund_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: Refund) => Number(row.amount),
      accessor: (row: Refund) => row.amount,
      render: (row: Refund) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: Refund) => row.reason,
      render: (row: Refund) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "mode",
      label: "Mode",
      render: (row: Refund) => <Badge tone="neutral">{row.mode}</Badge>,
    },
    {
      key: "refunded_at",
      label: "Date",
      sortable: true,
      sortValue: (row: Refund) => new Date(row.refunded_at).getTime(),
      accessor: (row: Refund) => new Date(row.refunded_at).toLocaleDateString(),
      render: (row: Refund) => (
        <Text size="sm">{new Date(row.refunded_at).toLocaleDateString()}</Text>
      ),
    },
  ];

  const creditColumns = [
    {
      key: "credit_note_number",
      label: "CN #",
      sortable: true,
      searchable: true,
      accessor: (row: CreditNote) => row.credit_note_number,
      render: (row: CreditNote) => <Text fw={500}>{row.credit_note_number}</Text>,
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      sortValue: (row: CreditNote) => Number(row.amount),
      accessor: (row: CreditNote) => row.amount,
      render: (row: CreditNote) => <Text size="sm">₹{row.amount}</Text>,
    },
    {
      key: "reason",
      label: "Reason",
      searchable: true,
      accessor: (row: CreditNote) => row.reason,
      render: (row: CreditNote) => <Text size="sm">{row.reason}</Text>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: CreditNote) => row.status,
      render: (row: CreditNote) => (
        <Badge
          tone={row.status === "active" ? "success" : row.status === "used" ? "primary" : "danger"}
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: CreditNote) =>
        row.status === "active" && canCreate ? (
          <Button
            tone="secondary"
            size="compact-xs"
            onClick={() => {
              const invoiceId = prompt("Enter Invoice ID to apply credit note:");
              if (invoiceId) applyMutation.mutate({ noteId: row.id, invoiceId });
            }}
          >
            Apply
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      <Text fw={600}>Refunds</Text>
      {canCreate && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowRefund(!showRefund)}
          >
            Create Refund
          </Button>
          {showRefund && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitRefund(handleCreateRefund)}>
              <Group grow>
                <TextInput
                  label="Invoice ID"
                  required
                  error={refundErrors.invoice_id?.message}
                  {...registerRefund("invoice_id")}
                />
                <Controller
                  control={refundControl}
                  name="amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Amount"
                      required
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={refundErrors.amount?.message}
                    />
                  )}
                />
              </Group>
              <TextInput
                label="Reason"
                required
                error={refundErrors.reason?.message}
                {...registerRefund("reason")}
              />
              <Controller
                control={refundControl}
                name="mode"
                render={({ field }) => (
                  <Select
                    label="Mode"
                    data={billingPaymentModeOptions}
                    value={field.value}
                    onChange={(value) => field.onChange(value ?? "cash")}
                    error={refundErrors.mode?.message}
                  />
                )}
              />
              <TextInput
                label="Reference #"
                error={refundErrors.reference_number?.message}
                {...registerRefund("reference_number")}
              />
              <Button tone="primary" size="xs" type="submit" loading={refundMutation.isPending}>
                Process Refund
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={refundColumns}
        data={refunds?.data ?? []}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search refund # or reason"
        exportable
        exportFileName="refunds"
        page={refundsPage}
        perPage={50}
        total={refunds?.meta.total}
        totalPages={refunds ? Math.ceil(refunds.meta.total / refunds.meta.limit) : 0}
        onPageChange={setRefundsPage}
      />

      <Text fw={600} mt="lg">
        Credit Notes
      </Text>
      {canCreate && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowCredit(!showCredit)}
          >
            Create Credit Note
          </Button>
          {showCredit && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitCredit(handleCreateCreditNote)}>
              <TextInput
                label="Invoice ID"
                required
                error={creditErrors.invoice_id?.message}
                {...registerCredit("invoice_id")}
              />
              <Controller
                control={creditControl}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    label="Amount"
                    required
                    min={0}
                    decimalScale={2}
                    value={field.value}
                    onChange={field.onChange}
                    error={creditErrors.amount?.message}
                  />
                )}
              />
              <TextInput
                label="Reason"
                required
                error={creditErrors.reason?.message}
                {...registerCredit("reason")}
              />
              <Button tone="primary" size="xs" type="submit" loading={creditMutation.isPending}>
                Issue Credit Note
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={creditColumns}
        data={creditNotes?.data ?? []}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search CN # or reason"
        exportable
        exportFileName="credit-notes"
        page={creditNotesPage}
        perPage={50}
        total={creditNotes?.meta.total}
        totalPages={creditNotes ? Math.ceil(creditNotes.meta.total / creditNotes.meta.limit) : 0}
        onPageChange={setCreditNotesPage}
      />

      <Text fw={600} mt="lg">
        Write-Offs
      </Text>
      {canWriteOff && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setShowWriteOff(!showWriteOff)}
          >
            Request Write-Off
          </Button>
          {showWriteOff && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitWriteOff(handleCreateWriteOff)}>
              <TextInput
                label="Invoice ID"
                required
                error={writeOffErrors.invoice_id?.message}
                {...registerWriteOff("invoice_id")}
              />
              <Controller
                control={writeOffControl}
                name="amount"
                render={({ field }) => (
                  <NumberInput
                    label="Amount"
                    required
                    min={0}
                    decimalScale={2}
                    value={field.value}
                    onChange={field.onChange}
                    error={writeOffErrors.amount?.message}
                  />
                )}
              />
              <TextInput
                label="Reason"
                required
                error={writeOffErrors.reason?.message}
                {...registerWriteOff("reason")}
              />
              <Textarea
                label="Notes"
                error={writeOffErrors.notes?.message}
                {...registerWriteOff("notes")}
              />
              <Button tone="primary" size="xs" type="submit" loading={writeOffMutation.isPending}>
                Submit Write-Off
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={writeOffColumns}
        data={writeOffs?.data ?? []}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search WO # or reason"
        exportable
        exportFileName="write-offs"
        page={writeOffsPage}
        perPage={50}
        total={writeOffs?.meta.total}
        totalPages={writeOffs ? Math.ceil(writeOffs.meta.total / writeOffs.meta.limit) : 0}
        onPageChange={setWriteOffsPage}
      />
    </Stack>
  );
}

// ── Insurance Claims Tab ────────────────────────────────
