// Billing CreditPatientsTab — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  Drawer,
  Group,
  NumberInput,
  Progress,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { BillingCreditPatientFormInput } from "@medbrains/schemas";
import { billingCreditPatientFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCreditPatientRequest,
  CreditAgingRow,
  CreditPatient,
  UpdateCreditPatientRequest,
} from "@medbrains/types";
import {
  P,
  PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
  PATIENT_NAME_FIELD_ACCESS_KEYS,
} from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { Column } from "@/components";
import { DataTable } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import {
  billingCreditPatientStatusOptions,
  billingNumberOrFallback,
  billingOptionalText,
} from "@/forms/billing.form";
import { billingService } from "@/services/billing.service";

export function CreditPatientsTab() {
  const canManage = useHasPermission(P.BILLING.CREDIT_MANAGE);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showAging, setShowAging] = useState(false);
  const queryClient = useQueryClient();
  const creditPatientDefaults: BillingCreditPatientFormInput = {
    patient_id: "",
    credit_limit: 0,
    notes: "",
    status: "",
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingCreditPatientFormInput>({
    resolver: zodResolver(billingCreditPatientFormSchema),
    defaultValues: creditPatientDefaults,
  });

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const { data: allCreditPatients, isLoading } = useQuery({
    queryKey: ["credit-patients", params],
    queryFn: () => billingService.listCreditPatients(params),
  });

  const creditPatients = allCreditPatients ?? [];

  const { data: agingRaw } = useQuery({
    queryKey: ["credit-aging"],
    queryFn: () => billingService.reportCreditAging(),
    enabled: showAging,
  });
  const agingData = agingRaw ?? [];

  const createMut = useMutation({
    mutationFn: (data: CreateCreditPatientRequest) => billingService.createCreditPatient(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-patients"] });
      close();
      reset(creditPatientDefaults);
      toast.success("Credit patient added", { title: "Created" });
    },
    onError: () => toast.error("Failed to create", { title: "Error" }),
  });

  const updateMut = useMutation({
    mutationFn: (data: { id: string; req: UpdateCreditPatientRequest }) =>
      billingService.updateCreditPatient(data.id, data.req),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["credit-patients"] });
      close();
      setEditId(null);
      reset(creditPatientDefaults);
      toast.success("Credit patient updated", { title: "Updated" });
    },
    onError: () => toast.error("Update failed", { title: "Error" }),
  });

  const creditStatusColors: Record<string, BadgeTone> = {
    active: "success",
    overdue: "danger",
    suspended: "warning",
    closed: "neutral",
  };

  const columns = [
    {
      key: "patient_id",
      label: "Patient",
      fieldAccessKeys: PATIENT_BASIC_IDENTITY_FIELD_ACCESS_KEYS,
      accessor: (r: CreditPatient) => r.patient_id,
      fieldKind: "identifier",
      hiddenLabel: "Patient restricted",
      render: (r: CreditPatient) => <PatientNameCell patientId={r.patient_id} showUhid={false} />,
    },
    {
      key: "status",
      label: "Status",
      render: (r: CreditPatient) => (
        <Badge size="sm" tone={creditStatusColors[r.status] ?? "neutral"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "credit_limit",
      label: "Limit",
      fieldAccessKey: "billing.amount",
      accessor: (r: CreditPatient) => r.credit_limit,
      fieldKind: "money",
      render: (r: CreditPatient) => <Text size="sm">₹{r.credit_limit.toLocaleString()}</Text>,
    },
    {
      key: "current_balance",
      label: "Balance",
      fieldAccessKey: "billing.amount",
      accessor: (r: CreditPatient) => r.current_balance,
      fieldKind: "money",
      render: (r: CreditPatient) => (
        <Text size="sm" c={r.current_balance > r.credit_limit * 0.8 ? "danger" : undefined}>
          ₹{r.current_balance.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "overdue_since",
      label: "Overdue Since",
      render: (r: CreditPatient) => (
        <Text size="sm">
          {r.overdue_since ? new Date(r.overdue_since).toLocaleDateString() : "—"}
        </Text>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            label: "",
            render: (r: CreditPatient) => (
              <IconButton
                tone="default"
                aria-label="Edit"
                onClick={() => {
                  setEditId(r.id);
                  reset({
                    patient_id: r.patient_id,
                    credit_limit: r.credit_limit,
                    notes: r.notes ?? "",
                    status: r.status,
                  });
                  open();
                }}
              >
                <IconPencil size={16} />
              </IconButton>
            ),
          },
        ]
      : []),
  ] satisfies Column<CreditPatient>[];

  const agingColumns = [
    {
      key: "patient_id",
      label: "Patient",
      fieldAccessKeys: PATIENT_NAME_FIELD_ACCESS_KEYS,
      accessor: (r: CreditAgingRow) => r.patient_name ?? r.patient_id,
      fieldKind: "name",
      hiddenLabel: "Patient restricted",
      render: (r: CreditAgingRow) =>
        r.patient_name ? (
          <Text size="sm">{r.patient_name}</Text>
        ) : (
          <PatientNameCell patientId={r.patient_id} showUhid={false} />
        ),
    },
    {
      key: "credit_limit",
      label: "Credit Limit",
      fieldAccessKey: "billing.amount",
      accessor: (r: CreditAgingRow) => r.credit_limit,
      fieldKind: "money",
      render: (r: CreditAgingRow) => <Text size="sm">₹{r.credit_limit.toLocaleString()}</Text>,
    },
    {
      key: "current_balance",
      label: "Balance",
      fieldAccessKey: "billing.amount",
      accessor: (r: CreditAgingRow) => r.current_balance,
      fieldKind: "money",
      render: (r: CreditAgingRow) => (
        <Text size="sm" fw={600}>
          ₹{r.current_balance.toLocaleString()}
        </Text>
      ),
    },
    {
      key: "utilization",
      label: "Utilization",
      render: (r: CreditAgingRow) => {
        const pct = r.credit_limit > 0 ? (r.current_balance / r.credit_limit) * 100 : 0;
        return (
          <Progress
            value={pct}
            size="sm"
            color={pct > 90 ? "danger" : pct > 70 ? "orange" : "success"}
          />
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r: CreditAgingRow) => (
        <Badge size="sm" tone={creditStatusColors[r.status] ?? "neutral"}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "days_overdue",
      label: "Days Overdue",
      render: (r: CreditAgingRow) => (
        <Text size="sm" c={r.days_overdue && r.days_overdue > 30 ? "danger" : undefined}>
          {r.days_overdue ?? "—"}
        </Text>
      ),
    },
    {
      key: "overdue_since",
      label: "Overdue Since",
      render: (r: CreditAgingRow) => (
        <Text size="sm">
          {r.overdue_since ? new Date(r.overdue_since).toLocaleDateString() : "—"}
        </Text>
      ),
    },
  ] satisfies Column<CreditAgingRow>[];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Select
            placeholder="Status"
            data={["active", "overdue", "suspended", "closed"].map((s) => ({ value: s, label: s }))}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            w={160}
          />
          <Button tone="secondary" onClick={() => setShowAging(!showAging)}>
            {showAging ? "Hide Aging" : "Show Aging Report"}
          </Button>
        </Group>
        {canManage && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setEditId(null);
              reset(creditPatientDefaults);
              open();
            }}
          >
            Add Credit Patient
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={creditPatients}
        loading={isLoading}
        page={page}
        totalPages={Math.ceil(creditPatients.length / 20) || 1}
        onPageChange={setPage}
        rowKey={(r) => r.id}
      />

      {showAging && agingData.length > 0 && (
        <Card withBorder mt="md">
          <Title order={5} mb="sm">
            Credit Aging Report
          </Title>
          <DataTable
            columns={agingColumns}
            data={agingData}
            loading={false}
            page={1}
            totalPages={1}
            onPageChange={() => {}}
            rowKey={(r) => r.patient_id}
          />
        </Card>
      )}

      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setEditId(null);
          reset(creditPatientDefaults);
        }}
        title={editId ? "Edit Credit Patient" : "Add Credit Patient"}
        position="right"
        size="xl"
      >
        <Stack
          component="form"
          onSubmit={handleSubmit((values) => {
            if (editId) {
              updateMut.mutate({
                id: editId,
                req: {
                  credit_limit: billingNumberOrFallback(values.credit_limit, 0),
                  notes: billingOptionalText(values.notes),
                  ...(values.status ? { status: values.status } : {}),
                },
              });
              return;
            }
            createMut.mutate({
              patient_id: values.patient_id.trim(),
              credit_limit: billingNumberOrFallback(values.credit_limit, 0),
              notes: billingOptionalText(values.notes),
            });
          })}
        >
          {!editId && (
            <Controller
              name="patient_id"
              control={control}
              render={({ field }) => (
                <PatientSearchSelect value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
          )}
          <Controller
            control={control}
            name="credit_limit"
            render={({ field }) => (
              <NumberInput
                label="Credit Limit (₹)"
                value={field.value}
                onChange={field.onChange}
                error={errors.credit_limit?.message}
                min={0}
                required
              />
            )}
          />
          <Textarea label="Notes" error={errors.notes?.message} {...register("notes")} />
          {editId && (
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  label="Status"
                  data={billingCreditPatientStatusOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.status?.message}
                  clearable
                />
              )}
            />
          )}
          <Button tone="primary" type="submit" loading={createMut.isPending || updateMut.isPending}>
            {editId ? "Update" : "Create"}
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
