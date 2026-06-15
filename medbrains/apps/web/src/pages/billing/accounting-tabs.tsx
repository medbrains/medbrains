// Billing accounting/back-office tabs, extracted from billing.tsx (split phase 1).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  type BillingErpExportFormInput,
  type BillingGstrFormInput,
  type BillingJournalEntryFormInput,
  type BillingJournalLineFormInput,
  type BillingTdsFormInput,
  billingErpExportFormSchema,
  billingGstrFormSchema,
  billingJournalEntryFormSchema,
  billingTdsFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import {
  type AutoConcessionRule,
  type BankTransaction,
  type BillingConcession,
  type CreateJournalEntryRequest,
  type CreateTdsRequest,
  type ErpExportLog,
  type ErpExportRequest,
  type GenerateGstrRequest,
  type GlAccount,
  type GstReturnSummary,
  type HsnSummaryRow,
  type ImportBankTransactionsRequest,
  type JournalEntry,
  P,
  type ProfitLossDeptRow,
  type TdsDeduction,
} from "@medbrains/types";
import {
  IconCheck,
  IconDatabase,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Button, Table } from "@/components/ui";
import {
  billingErpExportTypeOptions,
  billingErpTargetSystemOptions,
  billingGstrReturnTypeOptions,
  billingNumberOrFallback,
  billingOptionalText,
  billingTdsQuarterOptions,
  billingTdsSectionOptions,
} from "@/forms/billing.form";
import { statusColor } from "@/lib/status-colors";
import { billingService } from "@/services/billing.service";

function colorToBadgeTone(color: string | null | undefined): BadgeTone {
  switch (color) {
    case "primary":
      return "primary";
    case "info":
    case "blue":
      return "info";
    case "warning":
    case "orange":
    case "yellow":
      return "warning";
    case "teal":
    case "green":
    case "success":
      return "success";
    case "danger":
    case "red":
      return "danger";
    case "violet":
    case "grape":
    case "rose":
    case "cinnabar":
      return "accent";
    default:
      return "neutral";
  }
}

/* ─── GST & TDS Tab ──────────────────────────────────────────────── */

export function GstTdsTab({ canTds }: { canTds: boolean }) {
  const canManageGst = useHasPermission(P.BILLING.GST_RETURNS_MANAGE);
  const canManageTds = useHasPermission(P.BILLING.TDS_MANAGE);
  const [view, setView] = useState("gstr");

  return (
    <Stack>
      <SegmentedControl
        value={view}
        onChange={setView}
        data={[
          { value: "gstr", label: "GST Returns" },
          ...(canTds ? [{ value: "tds", label: "TDS Management" }] : []),
          { value: "hsn", label: "HSN Summary" },
        ]}
      />
      {view === "gstr" && <GstrSubView canManage={canManageGst} />}
      {view === "tds" && canTds && <TdsSubView canManage={canManageTds} />}
      {view === "hsn" && <HsnSubView />}
    </Stack>
  );
}

function GstrSubView({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const gstrDefaults: BillingGstrFormInput = {
    return_type: "GSTR-1",
    period: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingGstrFormInput>({
    resolver: zodResolver(billingGstrFormSchema),
    defaultValues: gstrDefaults,
  });
  const [genOpened, { open: openGen, close: closeGen }] = useDisclosure(false);

  const { data: gstrSummaries, isLoading } = useQuery({
    queryKey: ["gstr-summaries"],
    queryFn: () => billingService.listGstrSummaries(),
  });

  const generateMut = useMutation({
    mutationFn: (data: GenerateGstrRequest) => billingService.generateGstrSummary(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gstr-summaries"] });
      closeGen();
      reset(gstrDefaults);
      notifications.show({ title: "Generated", message: "GSTR summary created", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Failed to generate", color: "danger" }),
  });

  const fileMut = useMutation({
    mutationFn: (id: string) => billingService.fileGstr(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["gstr-summaries"] });
      notifications.show({ title: "Filed", message: "GSTR marked as filed", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Filing failed", color: "danger" }),
  });

  const gstrStatusColors: Record<string, BadgeTone> = {
    draft: "neutral",
    validated: "primary",
    filed: "success",
    accepted: "success",
    error: "danger",
  };

  const columns = [
    {
      key: "return_type",
      label: "Type",
      render: (r: GstReturnSummary) => (
        <Badge size="sm" tone="neutral">
          {r.return_type}
        </Badge>
      ),
    },
    {
      key: "period",
      label: "Period",
      render: (r: GstReturnSummary) => <Text size="sm">{r.period}</Text>,
    },
    {
      key: "filing_status",
      label: "Status",
      render: (r: GstReturnSummary) => (
        <Badge size="sm" tone={gstrStatusColors[r.filing_status] ?? "neutral"}>
          {r.filing_status}
        </Badge>
      ),
    },
    {
      key: "total_taxable",
      label: "Taxable",
      render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_taxable.toLocaleString()}</Text>,
    },
    {
      key: "cgst",
      label: "CGST",
      render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_cgst.toLocaleString()}</Text>,
    },
    {
      key: "sgst",
      label: "SGST",
      render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_sgst.toLocaleString()}</Text>,
    },
    {
      key: "igst",
      label: "IGST",
      render: (r: GstReturnSummary) => <Text size="sm">₹{r.total_igst.toLocaleString()}</Text>,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (r: GstReturnSummary) =>
              r.filing_status === "validated" ? (
                <Button tone="secondary" size="xs" onClick={() => fileMut.mutate(r.id)}>
                  File
                </Button>
              ) : (
                <Text size="sm">—</Text>
              ),
          },
        ]
      : []),
  ];

  const handleGenerateGstr = (values: BillingGstrFormInput) => {
    generateMut.mutate({
      return_type: values.return_type,
      period: values.period.trim(),
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>GST Return Summaries</Text>
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(gstrDefaults);
              openGen();
            }}
          >
            Generate Summary
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={gstrSummaries ?? []}
        loading={isLoading}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={genOpened}
        onClose={() => {
          closeGen();
          reset(gstrDefaults);
        }}
        title="Generate GSTR Summary"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleGenerateGstr)}>
          <Controller
            control={control}
            name="return_type"
            render={({ field }) => (
              <Select
                label="Return Type"
                data={billingGstrReturnTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "GSTR-1")}
                error={errors.return_type?.message}
              />
            )}
          />
          <TextInput
            label="Period (e.g. 2026-03)"
            error={errors.period?.message}
            {...register("period")}
            required
          />
          <Button tone="primary" type="submit" loading={generateMut.isPending}>
            Generate
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function TdsSubView({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [opened, { open, close }] = useDisclosure(false);
  const tdsDefaults: BillingTdsFormInput = {
    invoice_id: "",
    deductee_name: "",
    deductee_pan: "",
    tds_section: "194J",
    tds_rate: 10,
    base_amount: 0,
    deducted_date: new Date().toISOString().slice(0, 10),
    financial_year: "2025-26",
    quarter: "Q4",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BillingTdsFormInput>({
    resolver: zodResolver(billingTdsFormSchema),
    defaultValues: tdsDefaults,
  });
  const watchedTds = watch();
  const estimatedTds = Math.round(
    (billingNumberOrFallback(watchedTds.base_amount, 0) *
      billingNumberOrFallback(watchedTds.tds_rate, 0)) /
      100,
  );

  const { data: tdsItems, isLoading } = useQuery({
    queryKey: ["tds-deductions"],
    queryFn: () => billingService.listTdsDeductions(),
  });

  const createMut = useMutation({
    mutationFn: (data: CreateTdsRequest) => billingService.createTdsDeduction(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      close();
      reset(tdsDefaults);
      notifications.show({ title: "Created", message: "TDS deduction recorded", color: "success" });
    },
    onError: () => notifications.show({ title: "Error", message: "Failed", color: "danger" }),
  });

  const depositMut = useMutation({
    mutationFn: (args: { id: string; challan: string }) =>
      billingService.depositTds(args.id, {
        challan_number: args.challan,
        challan_date: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      notifications.show({ title: "Deposited", message: "TDS challan recorded", color: "success" });
    },
  });

  const certMut = useMutation({
    mutationFn: (args: { id: string; cert: string }) =>
      billingService.issueTdsCertificate(args.id, {
        certificate_number: args.cert,
        certificate_date: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tds-deductions"] });
      notifications.show({ title: "Issued", message: "Certificate recorded", color: "success" });
    },
  });

  const columns = [
    {
      key: "deductee_name",
      label: "Deductee",
      render: (r: TdsDeduction) => <Text size="sm">{r.deductee_name}</Text>,
    },
    {
      key: "deductee_pan",
      label: "PAN",
      render: (r: TdsDeduction) => (
        <Text size="sm" ff="monospace">
          {r.deductee_pan}
        </Text>
      ),
    },
    {
      key: "tds_section",
      label: "Section",
      render: (r: TdsDeduction) => (
        <Badge size="sm" variant="outline" tone="neutral">
          {r.tds_section}
        </Badge>
      ),
    },
    {
      key: "tds_rate",
      label: "Rate %",
      render: (r: TdsDeduction) => <Text size="sm">{r.tds_rate}%</Text>,
    },
    {
      key: "base_amount",
      label: "Base",
      render: (r: TdsDeduction) => <Text size="sm">₹{r.base_amount.toLocaleString()}</Text>,
    },
    {
      key: "tds_amount",
      label: "TDS",
      render: (r: TdsDeduction) => (
        <Text size="sm" fw={600}>
          ₹{r.tds_amount.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: TdsDeduction) => (
        <Badge size="sm" tone={colorToBadgeTone(statusColor(r.status))}>
          {r.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "fy",
      label: "FY / Q",
      render: (r: TdsDeduction) => (
        <Text size="sm">
          {r.financial_year} {r.quarter}
        </Text>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (r: TdsDeduction) => (
              <Group gap={4}>
                {r.status === "deducted" && (
                  <Tooltip label="Deposit">
                    <ActionIcon
                      variant="subtle"
                      color="teal"
                      onClick={() => depositMut.mutate({ id: r.id, challan: `CH-${Date.now()}` })}
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {r.status === "deposited" && (
                  <Tooltip label="Issue Certificate">
                    <ActionIcon
                      variant="subtle"
                      color="success"
                      onClick={() => certMut.mutate({ id: r.id, cert: `CERT-${Date.now()}` })}
                    >
                      <IconShieldCheck size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  const handleCreateTds = (values: BillingTdsFormInput) => {
    const payload: CreateTdsRequest = {
      invoice_id: billingOptionalText(values.invoice_id),
      deductee_name: values.deductee_name.trim(),
      deductee_pan: values.deductee_pan.trim().toUpperCase(),
      tds_section: values.tds_section,
      tds_rate: billingNumberOrFallback(values.tds_rate, 0),
      base_amount: billingNumberOrFallback(values.base_amount, 0),
      deducted_date: values.deducted_date.trim(),
      financial_year: values.financial_year.trim(),
      quarter: values.quarter,
    };
    createMut.mutate(payload);
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Text fw={600}>TDS Deductions</Text>
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(tdsDefaults);
              open();
            }}
          >
            Record TDS
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={tdsItems ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((tdsItems?.length ?? 0) / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={opened}
        onClose={() => {
          close();
          reset(tdsDefaults);
        }}
        title="Record TDS Deduction"
        position="right"
        size="xl"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateTds)}>
          <TextInput
            label="Invoice ID"
            error={errors.invoice_id?.message}
            {...register("invoice_id")}
          />
          <TextInput
            label="Deductee Name"
            error={errors.deductee_name?.message}
            {...register("deductee_name")}
            required
          />
          <TextInput
            label="PAN"
            error={errors.deductee_pan?.message}
            {...register("deductee_pan")}
            required
            maxLength={10}
          />
          <Controller
            control={control}
            name="tds_section"
            render={({ field }) => (
              <Select
                label="Section"
                data={billingTdsSectionOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "194J")}
                error={errors.tds_section?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="tds_rate"
            render={({ field }) => (
              <NumberInput
                label="TDS Rate %"
                value={field.value}
                onChange={field.onChange}
                error={errors.tds_rate?.message}
                min={0}
                max={100}
              />
            )}
          />
          <Controller
            control={control}
            name="base_amount"
            render={({ field }) => (
              <NumberInput
                label="Base Amount"
                value={field.value}
                onChange={field.onChange}
                error={errors.base_amount?.message}
                min={0}
              />
            )}
          />
          <Text size="sm" c="dimmed">
            Estimated TDS: ₹{estimatedTds.toLocaleString()}
          </Text>
          <TextInput
            label="Deducted Date"
            type="date"
            error={errors.deducted_date?.message}
            {...register("deducted_date")}
            required
          />
          <TextInput
            label="Financial Year"
            placeholder="2025-26"
            error={errors.financial_year?.message}
            {...register("financial_year")}
          />
          <Controller
            control={control}
            name="quarter"
            render={({ field }) => (
              <Select
                label="Quarter"
                data={billingTdsQuarterOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "Q4")}
                error={errors.quarter?.message}
              />
            )}
          />
          <Button tone="primary" type="submit" loading={createMut.isPending}>
            Record
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function HsnSubView() {
  const [period, setPeriod] = useState("");
  const { data: hsnRows, isLoading } = useQuery({
    queryKey: ["hsn-summary", period],
    queryFn: () => billingService.reportHsnSummary(period),
    enabled: period.length >= 7,
  });

  const columns = [
    {
      key: "hsn_code",
      label: "HSN Code",
      render: (r: HsnSummaryRow) => (
        <Text size="sm" ff="monospace">
          {r.hsn_code}
        </Text>
      ),
    },
    {
      key: "item_count",
      label: "Items",
      render: (r: HsnSummaryRow) => <Text size="sm">{r.item_count}</Text>,
    },
    {
      key: "taxable_amount",
      label: "Taxable Amount",
      render: (r: HsnSummaryRow) => <Text size="sm">₹{r.taxable_amount.toLocaleString()}</Text>,
    },
    {
      key: "cgst_amount",
      label: "CGST",
      render: (r: HsnSummaryRow) => <Text size="sm">₹{r.cgst_amount.toLocaleString()}</Text>,
    },
    {
      key: "sgst_amount",
      label: "SGST",
      render: (r: HsnSummaryRow) => <Text size="sm">₹{r.sgst_amount.toLocaleString()}</Text>,
    },
    {
      key: "igst_amount",
      label: "IGST",
      render: (r: HsnSummaryRow) => <Text size="sm">₹{r.igst_amount.toLocaleString()}</Text>,
    },
    {
      key: "total_tax",
      label: "Total Tax",
      render: (r: HsnSummaryRow) => (
        <Text size="sm" fw={600}>
          ₹{r.total_tax.toLocaleString()}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        <TextInput
          label="Period (YYYY-MM)"
          placeholder="2026-03"
          value={period}
          onChange={(e) => setPeriod(e.currentTarget.value)}
          w={180}
        />
      </Group>
      {hsnRows && (
        <DataTable
          columns={columns}
          data={hsnRows}
          loading={isLoading}
          page={1}
          totalPages={1}
          onPageChange={() => {}}
          rowKey={(r) => r.hsn_code}
        />
      )}
    </Stack>
  );
}

/* ─── Journal Entries Tab ────────────────────────────────────────── */

export function JournalEntriesTab() {
  const canCreate = useHasPermission(P.BILLING.JOURNAL_CREATE);
  const canPost = useHasPermission(P.BILLING.JOURNAL_POST);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const queryClient = useQueryClient();
  const journalLineDefaults: BillingJournalLineFormInput = {
    account_id: "",
    department_id: "",
    debit_amount: 0,
    credit_amount: 0,
    narration: "",
  };
  const journalDefaults: BillingJournalEntryFormInput = {
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    reference_type: "",
    reference_id: "",
    lines: [{ ...journalLineDefaults }, { ...journalLineDefaults }],
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BillingJournalEntryFormInput>({
    resolver: zodResolver(billingJournalEntryFormSchema),
    defaultValues: journalDefaults,
  });
  const {
    fields: journalLines,
    append: appendJournalLine,
    remove: removeJournalLine,
  } = useFieldArray({
    control,
    name: "lines",
  });

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.status = statusFilter;

  const { data: jeItems, isLoading } = useQuery({
    queryKey: ["journal-entries", params],
    queryFn: () => billingService.listJournalEntries(params),
  });

  const { data: glAccounts } = useQuery({
    queryKey: ["gl-accounts"],
    queryFn: () => billingService.listGlAccounts(),
    enabled: opened,
  });

  const glOptions = (glAccounts ?? []).map((a: GlAccount) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
  }));

  const watchedLines = watch("lines");
  const totalDebit = watchedLines.reduce(
    (sum, line) => sum + billingNumberOrFallback(line.debit_amount, 0),
    0,
  );
  const totalCredit = watchedLines.reduce(
    (sum, line) => sum + billingNumberOrFallback(line.credit_amount, 0),
    0,
  );
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const createMut = useMutation({
    mutationFn: (data: CreateJournalEntryRequest) => billingService.createJournalEntry(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      close();
      reset(journalDefaults);
      notifications.show({ title: "Created", message: "Journal entry created", color: "success" });
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Failed — ensure debits equal credits",
        color: "danger",
      }),
  });

  const postMut = useMutation({
    mutationFn: (id: string) => billingService.postJournalEntry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notifications.show({
        title: "Posted",
        message: "Journal entry posted to ledger",
        color: "success",
      });
    },
    onError: () => notifications.show({ title: "Error", message: "Post failed", color: "danger" }),
  });

  const reverseMut = useMutation({
    mutationFn: (id: string) => billingService.reverseJournalEntry(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      notifications.show({
        title: "Reversed",
        message: "Reversal entry created",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Reversal failed", color: "danger" }),
  });

  const columns = [
    {
      key: "entry_number",
      label: "JE #",
      render: (r: JournalEntry) => (
        <Text size="sm" fw={600}>
          {r.entry_number}
        </Text>
      ),
    },
    {
      key: "entry_date",
      label: "Date",
      render: (r: JournalEntry) => (
        <Text size="sm">{new Date(r.entry_date).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "entry_type",
      label: "Type",
      render: (r: JournalEntry) => (
        <Badge size="sm" tone="neutral">
          {r.entry_type.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: JournalEntry) => (
        <Badge size="sm" tone={colorToBadgeTone(statusColor(r.status))}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "total_debit",
      label: "Debit",
      render: (r: JournalEntry) => <Text size="sm">₹{r.total_debit.toLocaleString()}</Text>,
    },
    {
      key: "total_credit",
      label: "Credit",
      render: (r: JournalEntry) => <Text size="sm">₹{r.total_credit.toLocaleString()}</Text>,
    },
    {
      key: "description",
      label: "Description",
      render: (r: JournalEntry) => (
        <Text size="sm" lineClamp={1}>
          {r.description ?? "—"}
        </Text>
      ),
    },
    ...(canPost
      ? [
          {
            key: "actions",
            label: "",
            render: (r: JournalEntry) => (
              <Group gap={4}>
                {r.status === "draft" && (
                  <Tooltip label="Post to ledger">
                    <ActionIcon
                      variant="subtle"
                      color="success"
                      onClick={() => postMut.mutate(r.id)}
                    >
                      <IconCheck size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
                {r.status === "posted" && (
                  <Tooltip label="Reverse entry">
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      onClick={() => reverseMut.mutate(r.id)}
                    >
                      <IconX size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  const handleCreateJournalEntry = (values: BillingJournalEntryFormInput) => {
    createMut.mutate({
      entry_date: values.entry_date.trim(),
      description: billingOptionalText(values.description),
      reference_type: billingOptionalText(values.reference_type),
      reference_id: billingOptionalText(values.reference_id),
      lines: values.lines.map((line) => ({
        account_id: line.account_id.trim(),
        department_id: billingOptionalText(line.department_id),
        debit_amount: billingNumberOrFallback(line.debit_amount, 0),
        credit_amount: billingNumberOrFallback(line.credit_amount, 0),
        narration: billingOptionalText(line.narration),
      })),
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Select
          placeholder="Status"
          data={["draft", "posted", "reversed"].map((s) => ({ value: s, label: s }))}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={160}
        />
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              reset(journalDefaults);
              open();
            }}
          >
            New Journal Entry
          </Button>
        )}
      </Group>
      <DataTable
        columns={columns}
        data={jeItems ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((jeItems?.length ?? 0) / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={opened}
        onClose={() => {
          close();
          reset(journalDefaults);
        }}
        title="Create Journal Entry"
        position="right"
        size="lg"
      >
        <Stack component="form" onSubmit={handleSubmit(handleCreateJournalEntry)}>
          <TextInput
            label="Entry Date"
            type="date"
            error={errors.entry_date?.message}
            {...register("entry_date")}
            required
          />
          <Textarea
            label="Description"
            error={errors.description?.message}
            {...register("description")}
          />

          <Group justify="space-between">
            <Text fw={600}>Lines</Text>
            <Button
              tone="secondary"
              size="xs"
              onClick={() => appendJournalLine({ ...journalLineDefaults })}
            >
              Add Line
            </Button>
          </Group>

          {journalLines.map((line, idx) => (
            <Card key={line.id} withBorder p="xs">
              <Group>
                <Controller
                  control={control}
                  name={`lines.${idx}.account_id`}
                  render={({ field }) => (
                    <Select
                      placeholder="Account"
                      data={glOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={errors.lines?.[idx]?.account_id?.message}
                      searchable
                      style={{ flex: 1 }}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`lines.${idx}.debit_amount`}
                  render={({ field }) => (
                    <NumberInput
                      placeholder="Debit"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.lines?.[idx]?.debit_amount?.message}
                      min={0}
                      w={120}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`lines.${idx}.credit_amount`}
                  render={({ field }) => (
                    <NumberInput
                      placeholder="Credit"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.lines?.[idx]?.credit_amount?.message}
                      min={0}
                      w={120}
                    />
                  )}
                />
                {journalLines.length > 2 && (
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    onClick={() => removeJournalLine(idx)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                )}
              </Group>
            </Card>
          ))}

          <Group justify="space-between">
            <Text size="sm">Total Debit: ₹{totalDebit.toLocaleString()}</Text>
            <Text size="sm">Total Credit: ₹{totalCredit.toLocaleString()}</Text>
          </Group>
          {!balanced && totalDebit > 0 && (
            <Alert color="danger" title="Unbalanced">
              Debits must equal credits before saving.
            </Alert>
          )}
          {errors.lines?.message && (
            <Alert color="danger" title="Journal validation">
              {errors.lines.message}
            </Alert>
          )}

          <Button tone="primary" type="submit" loading={createMut.isPending} disabled={!balanced}>
            Create Journal Entry
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

/* ─── Bank Reconciliation Tab ────────────────────────────────────── */

export function BankReconTab() {
  const canManage = useHasPermission(P.BILLING.BANK_RECON_MANAGE);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [importOpened, { open: openImport, close: closeImport }] = useDisclosure(false);
  const queryClient = useQueryClient();

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (statusFilter) params.recon_status = statusFilter;

  const { data: bankTxns, isLoading } = useQuery({
    queryKey: ["bank-transactions", params],
    queryFn: () => billingService.listBankTransactions(params),
  });

  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [importTxns, setImportTxns] = useState<ImportBankTransactionsRequest["transactions"]>([]);

  const [manualTxn, setManualTxn] = useState({
    transaction_date: "",
    description: "",
    debit_amount: 0,
    credit_amount: 0,
    reference_number: "",
  });

  const importMut = useMutation({
    mutationFn: () => billingService.importBankTransactions({ transactions: importTxns }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      closeImport();
      notifications.show({
        title: "Imported",
        message: "Bank transactions imported",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Import failed", color: "danger" }),
  });

  const autoReconMut = useMutation({
    mutationFn: () => billingService.autoReconcile(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      notifications.show({
        title: "Auto-Reconciled",
        message: `${res.matched_count ?? 0} transactions matched`,
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Auto-reconcile failed", color: "danger" }),
  });

  // TPA recon (priority #4) — matches unmatched credits to insurance_claims
  // by reference / claim_number / amount-window heuristics.
  const autoMatchTpaMut = useMutation({
    mutationFn: () => billingService.autoMatchBankTransactions(),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["insurance-receivables-aging"] });
      notifications.show({
        title: "TPA Auto-match",
        message: `${res.matched} matched · ${res.variance_flagged} variance · ${res.still_unmatched} unmatched`,
        color: "success",
      });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "TPA auto-match failed", color: "danger" }),
  });

  const { data: insAging = [] } = useQuery({
    queryKey: ["insurance-receivables-aging"],
    queryFn: () => billingService.listInsuranceReceivablesAging(),
  });

  const columns = [
    {
      key: "transaction_date",
      label: "Date",
      render: (r: BankTransaction) => (
        <Text size="sm">{new Date(r.transaction_date).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "bank_name",
      label: "Bank",
      render: (r: BankTransaction) => <Text size="sm">{r.bank_name}</Text>,
    },
    {
      key: "description",
      label: "Description",
      render: (r: BankTransaction) => (
        <Text size="sm" lineClamp={1}>
          {r.description}
        </Text>
      ),
    },
    {
      key: "debit_amount",
      label: "Debit",
      render: (r: BankTransaction) => (
        <Text size="sm">{r.debit_amount ? `₹${r.debit_amount.toLocaleString()}` : "—"}</Text>
      ),
    },
    {
      key: "credit_amount",
      label: "Credit",
      render: (r: BankTransaction) => (
        <Text size="sm">{r.credit_amount ? `₹${r.credit_amount.toLocaleString()}` : "—"}</Text>
      ),
    },
    {
      key: "reference_number",
      label: "Reference",
      render: (r: BankTransaction) => (
        <Text size="sm" ff="monospace">
          {r.reference_number ?? "—"}
        </Text>
      ),
    },
    {
      key: "recon_status",
      label: "Status",
      render: (r: BankTransaction) => (
        <Badge size="sm" tone={colorToBadgeTone(statusColor(r.recon_status))}>
          {r.recon_status}
        </Badge>
      ),
    },
  ];

  const addManualTxn = () => {
    if (!manualTxn.transaction_date || !manualTxn.description || !bankName) return;
    setImportTxns([
      ...importTxns,
      {
        bank_name: bankName,
        account_number: accountNumber,
        transaction_date: manualTxn.transaction_date,
        description: manualTxn.description,
        debit_amount: manualTxn.debit_amount,
        credit_amount: manualTxn.credit_amount,
        reference_number: manualTxn.reference_number,
      },
    ]);
    setManualTxn({
      transaction_date: "",
      description: "",
      debit_amount: 0,
      credit_amount: 0,
      reference_number: "",
    });
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["unmatched", "matched", "discrepancy", "excluded"].map((s) => ({
              value: s,
              label: s,
            }))}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
        </Group>
        <Group>
          {canManage && (
            <>
              <Button
                tone="secondary"
                leftSection={<IconRefresh size={16} />}
                onClick={() => autoReconMut.mutate()}
                loading={autoReconMut.isPending}
              >
                Auto-Reconcile
              </Button>
              <Button
                tone="secondary"
                leftSection={<IconRefresh size={16} />}
                onClick={() => autoMatchTpaMut.mutate()}
                loading={autoMatchTpaMut.isPending}
              >
                TPA Auto-match
              </Button>
              <Button tone="primary" leftSection={<IconUpload size={16} />} onClick={openImport}>
                Import Transactions
              </Button>
            </>
          )}
        </Group>
      </Group>

      {insAging.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="xs">
            Insurance Receivables Aging (per payer)
          </Text>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>TPA</Table.Th>
                <Table.Th ta="right">Claims</Table.Th>
                <Table.Th ta="right">0-30 days</Table.Th>
                <Table.Th ta="right">30-60</Table.Th>
                <Table.Th ta="right">60-90</Table.Th>
                <Table.Th ta="right">90+</Table.Th>
                <Table.Th ta="right">Total Outstanding</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {insAging.map((b) => (
                <Table.Tr key={b.tpa_name ?? "—"}>
                  <Table.Td>{b.tpa_name ?? "—"}</Table.Td>
                  <Table.Td ta="right">{b.claim_count}</Table.Td>
                  <Table.Td ta="right">₹{Number(b.bucket_0_30).toLocaleString()}</Table.Td>
                  <Table.Td ta="right">₹{Number(b.bucket_30_60).toLocaleString()}</Table.Td>
                  <Table.Td ta="right">₹{Number(b.bucket_60_90).toLocaleString()}</Table.Td>
                  <Table.Td ta="right" c="red">
                    ₹{Number(b.bucket_90_plus).toLocaleString()}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    ₹{Number(b.total_outstanding).toLocaleString()}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={bankTxns ?? []}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil((bankTxns?.length ?? 0) / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={importOpened}
        onClose={closeImport}
        title="Import Bank Transactions"
        position="right"
        size="lg"
      >
        <Stack>
          <TextInput
            label="Bank Name"
            value={bankName}
            onChange={(e) => setBankName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.currentTarget.value)}
            required
          />

          <Card withBorder>
            <Text fw={600} mb="sm">
              Add Transaction
            </Text>
            <Stack gap="xs">
              <TextInput
                label="Date"
                type="date"
                value={manualTxn.transaction_date}
                onChange={(e) =>
                  setManualTxn({ ...manualTxn, transaction_date: e.currentTarget.value })
                }
              />
              <TextInput
                label="Description"
                value={manualTxn.description}
                onChange={(e) => setManualTxn({ ...manualTxn, description: e.currentTarget.value })}
              />
              <Group grow>
                <NumberInput
                  label="Debit"
                  value={manualTxn.debit_amount}
                  onChange={(v) => setManualTxn({ ...manualTxn, debit_amount: Number(v) })}
                  min={0}
                />
                <NumberInput
                  label="Credit"
                  value={manualTxn.credit_amount}
                  onChange={(v) => setManualTxn({ ...manualTxn, credit_amount: Number(v) })}
                  min={0}
                />
              </Group>
              <TextInput
                label="Reference #"
                value={manualTxn.reference_number}
                onChange={(e) =>
                  setManualTxn({ ...manualTxn, reference_number: e.currentTarget.value })
                }
              />
              <Button tone="secondary" size="xs" onClick={addManualTxn}>
                Add to Batch
              </Button>
            </Stack>
          </Card>

          {importTxns.length > 0 && (
            <Text size="sm">{importTxns.length} transaction(s) in batch</Text>
          )}

          <Button
            tone="primary"
            onClick={() => importMut.mutate()}
            loading={importMut.isPending}
            disabled={importTxns.length === 0}
          >
            Import {importTxns.length} Transaction(s)
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

/* ─── Financial MIS Tab ──────────────────────────────────────────── */

export function FinancialMisTab() {
  const [dateFrom, setDateFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: misData } = useQuery({
    queryKey: ["financial-mis", dateFrom, dateTo],
    queryFn: () => billingService.reportFinancialMis(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo),
  });

  const { data: plRows, isLoading: plLoading } = useQuery({
    queryKey: ["profit-loss", dateFrom, dateTo],
    queryFn: () => billingService.reportProfitLoss(dateFrom, dateTo),
    enabled: Boolean(dateFrom && dateTo),
  });

  const plColumns = [
    {
      key: "department_name",
      label: "Department",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" fw={500}>
          {r.department_name ?? "Unassigned"}
        </Text>
      ),
    },
    {
      key: "revenue",
      label: "Revenue",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" c="success">
          ₹{r.revenue.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "expenses",
      label: "Expenses",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" c="danger">
          ₹{r.expenses.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "profit",
      label: "Profit/Loss",
      render: (r: ProfitLossDeptRow) => (
        <Text size="sm" fw={600} c={r.profit >= 0 ? "success" : "danger"}>
          ₹{r.profit.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "margin",
      label: "Margin %",
      render: (r: ProfitLossDeptRow) => {
        const margin = r.revenue > 0 ? ((r.revenue - r.expenses) / r.revenue) * 100 : 0;
        return <Text size="sm">{margin.toFixed(1)}%</Text>;
      },
    },
  ];

  return (
    <Stack>
      <Group>
        <TextInput
          label="From"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.currentTarget.value)}
        />
        <TextInput
          label="To"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.currentTarget.value)}
        />
      </Group>

      {misData && (
        <SimpleGrid cols={4}>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">
              Total Revenue
            </Text>
            <Text size="xl" fw={700} c="success">
              ₹{misData.total_revenue.toLocaleString()}
            </Text>
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">
              Total Collections
            </Text>
            <Text size="xl" fw={700} c="teal">
              ₹{misData.total_collections.toLocaleString()}
            </Text>
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">
              Collection Rate
            </Text>
            <Text size="xl" fw={700}>
              {Number(misData.collection_rate).toFixed(1)}%
            </Text>
            <Progress
              value={Number(misData.collection_rate)}
              size="sm"
              mt="xs"
              color={Number(misData.collection_rate) >= 80 ? "success" : "orange"}
            />
          </Card>
          <Card withBorder p="md">
            <Text size="xs" c="dimmed">
              Outstanding
            </Text>
            <Text size="xl" fw={700} c="orange">
              ₹{misData.total_outstanding.toLocaleString()}
            </Text>
          </Card>
        </SimpleGrid>
      )}

      {misData && (
        <Card withBorder>
          <Title order={5} mb="sm">
            Financial Summary
          </Title>
          <SimpleGrid cols={4}>
            <div>
              <Text size="xs" c="dimmed">
                Refunds
              </Text>
              <Text fw={600}>₹{misData.total_refunds.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Write-Offs
              </Text>
              <Text fw={600}>₹{misData.total_write_offs.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Advances
              </Text>
              <Text fw={600}>₹{misData.total_advances.toLocaleString()}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">
                Period
              </Text>
              <Text fw={600}>
                {misData.period_from} → {misData.period_to}
              </Text>
            </div>
          </SimpleGrid>
        </Card>
      )}

      <Title order={5}>Profit & Loss by Department</Title>
      <DataTable
        columns={plColumns}
        data={plRows ?? []}
        loading={plLoading}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        rowKey={(r) => r.department_name ?? r.department_id ?? "unknown"}
      />
    </Stack>
  );
}

/* ─── ERP Export Tab ─────────────────────────────────────────────── */

export function ErpExportTab() {
  const erpExportDefaults: BillingErpExportFormInput = {
    target_system: "tally",
    export_type: "invoices",
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    date_to: new Date().toISOString().slice(0, 10),
  };
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingErpExportFormInput>({
    resolver: zodResolver(billingErpExportFormSchema),
    defaultValues: erpExportDefaults,
  });
  const queryClient = useQueryClient();

  const { data: erpExports, isLoading } = useQuery({
    queryKey: ["erp-exports"],
    queryFn: () => billingService.listErpExports(),
  });

  const exportMut = useMutation({
    mutationFn: (data: ErpExportRequest) => billingService.exportToErp(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["erp-exports"] });
      notifications.show({ title: "Exported", message: "Data exported to ERP", color: "success" });
    },
    onError: () =>
      notifications.show({ title: "Error", message: "Export failed", color: "danger" }),
  });

  const handleExportToErp = (values: BillingErpExportFormInput) => {
    exportMut.mutate({
      target_system: values.target_system,
      export_type: values.export_type,
      date_from: billingOptionalText(values.date_from),
      date_to: billingOptionalText(values.date_to),
    });
  };

  const erpStatusColors: Record<string, BadgeTone> = {
    pending: "warning",
    exported: "success",
    failed: "danger",
    acknowledged: "success",
  };

  const columns = [
    {
      key: "target_system",
      label: "System",
      render: (r: ErpExportLog) => (
        <Badge size="sm" tone="neutral">
          {r.target_system}
        </Badge>
      ),
    },
    {
      key: "export_type",
      label: "Type",
      render: (r: ErpExportLog) => <Text size="sm">{r.export_type}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r: ErpExportLog) => (
        <Badge size="sm" tone={erpStatusColors[r.status] ?? "neutral"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "record_count",
      label: "Records",
      render: (r: ErpExportLog) => <Text size="sm">{r.record_ids?.length ?? 0}</Text>,
    },
    {
      key: "created_at",
      label: "Exported At",
      render: (r: ErpExportLog) => <Text size="sm">{new Date(r.created_at).toLocaleString()}</Text>,
    },
    {
      key: "error_message",
      label: "Error",
      render: (r: ErpExportLog) => (
        <Text size="sm" c="danger" lineClamp={1}>
          {r.error_message ?? "—"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Card withBorder>
        <Text fw={600} mb="sm">
          Export to ERP
        </Text>
        <Group component="form" align="end" onSubmit={handleSubmit(handleExportToErp)}>
          <Controller
            control={control}
            name="target_system"
            render={({ field }) => (
              <Select
                label="Target System"
                data={billingErpTargetSystemOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "tally")}
                error={errors.target_system?.message}
                w={180}
              />
            )}
          />
          <Controller
            control={control}
            name="export_type"
            render={({ field }) => (
              <Select
                label="Export Type"
                data={billingErpExportTypeOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "invoices")}
                error={errors.export_type?.message}
                w={200}
              />
            )}
          />
          <TextInput
            label="From"
            type="date"
            error={errors.date_from?.message}
            {...register("date_from")}
            w={160}
          />
          <TextInput
            label="To"
            type="date"
            error={errors.date_to?.message}
            {...register("date_to")}
            w={160}
          />
          <Button
            tone="primary"
            leftSection={<IconDatabase size={16} />}
            type="submit"
            loading={exportMut.isPending}
          >
            Export
          </Button>
        </Group>
      </Card>

      <Title order={5}>Export History</Title>
      <DataTable
        columns={columns}
        data={erpExports ?? []}
        loading={isLoading}
        page={1}
        totalPages={1}
        onPageChange={() => {}}
        rowKey={(r) => r.id}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Concessions Tab
// ══════════════════════════════════════════════════════════

export function ConcessionsTab({ canApprove }: { canApprove: boolean }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "rules">("list");

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["billing", "concessions", params],
    queryFn: () =>
      billingService.listConcessions(Object.keys(params).length > 0 ? params : undefined),
  });

  const { data: rulesData } = useQuery({
    queryKey: ["billing", "concessions", "auto-rules"],
    queryFn: () => billingService.getAutoConcessionRules(),
    enabled: view === "rules",
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => billingService.approveConcession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "concessions"] });
      notifications.show({ title: "Approved", message: "Concession approved", color: "success" });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => billingService.rejectConcession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "concessions"] });
      notifications.show({ title: "Rejected", message: "Concession rejected", color: "danger" });
    },
  });

  const [rulesDraft, setRulesDraft] = useState("");
  const saveRulesMut = useMutation({
    mutationFn: () => {
      const parsed = JSON.parse(rulesDraft) as AutoConcessionRule[];
      return billingService.updateAutoConcessionRules({ rules: parsed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "concessions", "auto-rules"] });
      notifications.show({
        title: "Saved",
        message: "Auto-concession rules updated",
        color: "success",
      });
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Invalid JSON or save failed",
        color: "danger",
      }),
  });

  const statusColors: Record<string, BadgeTone> = {
    pending: "warning",
    approved: "success",
    rejected: "danger",
    auto_applied: "success",
  };

  const columns = [
    {
      key: "concession_type",
      label: "Type",
      render: (r: BillingConcession) => <Text size="sm">{r.concession_type}</Text>,
    },
    {
      key: "original_amount",
      label: "Original",
      render: (r: BillingConcession) => (
        <Text size="sm">{Number(r.original_amount).toFixed(2)}</Text>
      ),
    },
    {
      key: "concession_amount",
      label: "Discount",
      render: (r: BillingConcession) => (
        <Text size="sm" c="danger">
          -{Number(r.concession_amount).toFixed(2)}
        </Text>
      ),
    },
    {
      key: "final_amount",
      label: "Final",
      render: (r: BillingConcession) => (
        <Text size="sm" fw={600}>
          {Number(r.final_amount).toFixed(2)}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r: BillingConcession) => (
        <Badge size="sm" tone={statusColors[r.status] ?? "neutral"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (r: BillingConcession) => (
        <Text size="sm" lineClamp={1}>
          {r.reason ?? r.auto_rule ?? "—"}
        </Text>
      ),
    },
    {
      key: "source_module",
      label: "Source",
      render: (r: BillingConcession) => <Text size="sm">{r.source_module ?? "manual"}</Text>,
    },
    {
      key: "created_at",
      label: "Date",
      render: (r: BillingConcession) => (
        <Text size="sm">{new Date(r.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r: BillingConcession) =>
        r.status === "pending" && canApprove ? (
          <Group gap={4}>
            <Tooltip label="Approve">
              <ActionIcon variant="subtle" color="success" onClick={() => approveMut.mutate(r.id)}>
                <IconCheck size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Reject">
              <ActionIcon variant="subtle" color="danger" onClick={() => rejectMut.mutate(r.id)}>
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ) : null,
    },
  ];

  return (
    <Stack>
      <SegmentedControl
        data={[
          { value: "list", label: "Pending Concessions" },
          { value: "rules", label: "Auto-Concession Rules" },
        ]}
        value={view}
        onChange={(v) => setView(v as "list" | "rules")}
        w={360}
      />

      {view === "list" && (
        <>
          <Group>
            <Select
              placeholder="Filter by status"
              data={[
                { value: "pending", label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "auto_applied", label: "Auto-Applied" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              w={200}
            />
          </Group>
          <DataTable
            columns={columns}
            data={data?.concessions ?? []}
            loading={isLoading}
            page={1}
            totalPages={Math.ceil((data?.total ?? 0) / 20)}
            onPageChange={() => {}}
            rowKey={(r) => r.id}
          />
        </>
      )}

      {view === "rules" && (
        <Card withBorder>
          <Text fw={600} mb="sm">
            Auto-Concession Rules
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            Define rules as JSON array. Each rule: name, concession_type, percent, reason,
            is_active, applicable_modules[], patient_categories[].
          </Text>
          <Textarea
            minRows={10}
            value={rulesDraft || JSON.stringify(rulesData?.rules ?? [], null, 2)}
            onChange={(e) => setRulesDraft(e.currentTarget.value)}
            mb="md"
            styles={{ input: { fontFamily: "JetBrains Mono, monospace", fontSize: 13 } }}
          />
          <Button
            tone="primary"
            onClick={() => saveRulesMut.mutate()}
            loading={saveRulesMut.isPending}
          >
            Save Rules
          </Button>
        </Card>
      )}
    </Stack>
  );
}
