// Billing InsuranceClaimsTab — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type {
  BillingInsuranceClaimFormInput,
  BillingTpaRateCardFormInput,
} from "@medbrains/schemas";
import { billingInsuranceClaimFormSchema, billingTpaRateCardFormSchema } from "@medbrains/schemas";
import type {
  CreateInsuranceClaimRequest,
  CreateTpaRateCardRequest,
  InsuranceClaim,
  TpaRateCard,
} from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { NhcxPayerDirectory } from "@/components/Nhcx/NhcxPayerDirectory";
import { SubmitToNhcxModal } from "@/components/Nhcx/SubmitToNhcxModal";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import type { BadgeTone } from "@/components/ui";
import { Badge, Button, IconButton } from "@/components/ui";
import {
  billingInsuranceClaimTypeOptions,
  billingInsuranceSchemeTypeOptions,
  billingOptionalNumber,
  billingOptionalText,
} from "@/forms/billing.form";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { billingService } from "@/services/billing.service";
import { ClaimDetailDrawer } from "./claim-detail-drawer";

export function InsuranceClaimsTab({
  canCreate,
  canWriteOff: _cwo,
}: {
  canCreate: boolean;
  canWriteOff: boolean;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showTpa, setShowTpa] = useState(false);
  const insuranceClaimDefaults: BillingInsuranceClaimFormInput = {
    invoice_id: "",
    patient_id: "",
    insurance_provider: "",
    policy_number: "",
    claim_type: "cashless",
    pre_auth_amount: "",
    scheme_type: "",
    tpa_name: "",
    co_pay_percent: "",
    deductible_amount: "",
    member_id: "",
    scheme_card_number: "",
    notes: "",
  };
  const tpaRateCardDefaults: BillingTpaRateCardFormInput = {
    tpa_name: "",
    insurance_provider: "",
    scheme_type: "",
    rate_plan_id: "",
    valid_from: "",
    valid_to: "",
    is_active: true,
  };
  const {
    control: claimControl,
    register: registerClaim,
    reset: resetClaim,
    handleSubmit: handleSubmitClaim,
    formState: { errors: claimErrors },
  } = useForm<BillingInsuranceClaimFormInput>({
    resolver: zodResolver(billingInsuranceClaimFormSchema),
    defaultValues: insuranceClaimDefaults,
  });
  const {
    control: tpaControl,
    register: registerTpa,
    reset: resetTpa,
    handleSubmit: handleSubmitTpa,
    formState: { errors: tpaErrors },
  } = useForm<BillingTpaRateCardFormInput>({
    resolver: zodResolver(billingTpaRateCardFormSchema),
    defaultValues: tpaRateCardDefaults,
  });
  const [detailClaim, setDetailClaim] = useState<InsuranceClaim | null>(null);
  const [nhcxAction, setNhcxAction] = useState<{
    id: string;
    mode: "submit" | "eligibility";
  } | null>(null);

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["insurance-claims"],
    queryFn: () => billingService.listInsuranceClaims(),
  });

  const { data: nhcxCallbacks = [] } = useQuery({
    queryKey: ["nhcx-callbacks", detailClaim?.id],
    queryFn: () => billingService.listNhcxCallbacks({ matched_id: detailClaim?.id }),
    enabled: !!detailClaim,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateInsuranceClaimRequest) => billingService.createInsuranceClaim(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] });
      setShowForm(false);
      resetClaim(insuranceClaimDefaults);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      billingService.updateInsuranceClaim(id, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["insurance-claims"] }),
  });

  const { data: tpaCards = [] } = useQuery({
    queryKey: ["tpa-rate-cards"],
    queryFn: () => billingService.listTpaRateCards(),
  });

  const tpaMutation = useMutation({
    mutationFn: (data: CreateTpaRateCardRequest) => billingService.createTpaRateCard(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tpa-rate-cards"] });
      setShowTpa(false);
      resetTpa(tpaRateCardDefaults);
    },
  });

  const deleteTpaMutation = useMutation({
    mutationFn: (id: string) => billingService.deleteTpaRateCard(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tpa-rate-cards"] }),
  });

  const tpaColumns = [
    {
      key: "tpa_name",
      label: "TPA Name",
      sortable: true,
      searchable: true,
      accessor: (row: TpaRateCard) => row.tpa_name,
      render: (row: TpaRateCard) => <Text fw={500}>{row.tpa_name}</Text>,
    },
    {
      key: "insurance_provider",
      label: "Provider",
      sortable: true,
      searchable: true,
      accessor: (row: TpaRateCard) => row.insurance_provider,
      render: (row: TpaRateCard) => <Text size="sm">{row.insurance_provider}</Text>,
    },
    {
      key: "scheme_type",
      label: "Scheme",
      sortable: true,
      accessor: (row: TpaRateCard) => row.scheme_type ?? "—",
      render: (row: TpaRateCard) => <Badge tone="neutral">{row.scheme_type ?? "—"}</Badge>,
    },
    {
      key: "valid_from",
      label: "Valid From",
      render: (row: TpaRateCard) => <Text size="sm">{row.valid_from ?? "—"}</Text>,
    },
    {
      key: "valid_to",
      label: "Valid To",
      render: (row: TpaRateCard) => <Text size="sm">{row.valid_to ?? "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: TpaRateCard) => (
        <Badge tone={row.is_active ? "success" : "neutral"}>{row.is_active ? "Yes" : "No"}</Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: TpaRateCard) =>
        canCreate ? (
          <Tooltip label="Delete">
            <IconButton
              tone="danger"
              aria-label="Delete"
              size="sm"
              onClick={() =>
                confirmDestructive({
                  title: "Delete TPA rate card",
                  message:
                    "Delete this TPA rate card? Insurance billing will fall back to standard rates.",
                  confirmLabel: "Delete rate card",
                  onConfirm: () => deleteTpaMutation.mutate(row.id),
                })
              }
            >
              <IconTrash size={14} />
            </IconButton>
          </Tooltip>
        ) : null,
    },
  ];

  const claimStatusColors: Record<string, BadgeTone> = {
    initiated: "neutral",
    pre_auth_requested: "primary",
    pre_auth_approved: "success",
    pre_auth_rejected: "danger",
    claim_submitted: "primary",
    claim_approved: "success",
    claim_rejected: "danger",
    settled: "success",
    partially_settled: "warning",
  };

  const handleCreateInsuranceClaim = (values: BillingInsuranceClaimFormInput) => {
    const payload: CreateInsuranceClaimRequest = {
      invoice_id: values.invoice_id.trim(),
      patient_id: values.patient_id.trim(),
      insurance_provider: values.insurance_provider.trim(),
      policy_number: billingOptionalText(values.policy_number),
      claim_type: values.claim_type,
      pre_auth_amount: billingOptionalNumber(values.pre_auth_amount),
      tpa_name: billingOptionalText(values.tpa_name),
      notes: billingOptionalText(values.notes),
      scheme_type: values.scheme_type || undefined,
      co_pay_percent: billingOptionalNumber(values.co_pay_percent),
      deductible_amount: billingOptionalNumber(values.deductible_amount),
      member_id: billingOptionalText(values.member_id),
      scheme_card_number: billingOptionalText(values.scheme_card_number),
    };
    createMutation.mutate(payload);
  };

  const handleCreateTpaRateCard = (values: BillingTpaRateCardFormInput) => {
    const payload: CreateTpaRateCardRequest = {
      tpa_name: values.tpa_name.trim(),
      insurance_provider: values.insurance_provider.trim(),
      rate_plan_id: billingOptionalText(values.rate_plan_id),
      scheme_type: values.scheme_type || undefined,
      valid_from: billingOptionalText(values.valid_from),
      valid_to: billingOptionalText(values.valid_to),
      is_active: values.is_active,
    };
    tpaMutation.mutate(payload);
  };

  const columns = [
    {
      key: "insurance_provider",
      label: "Provider",
      sortable: true,
      searchable: true,
      accessor: (row: InsuranceClaim) => row.insurance_provider,
      render: (row: InsuranceClaim) => <Text fw={500}>{row.insurance_provider}</Text>,
    },
    {
      key: "claim_type",
      label: "Type",
      sortable: true,
      searchable: true,
      accessor: (row: InsuranceClaim) => row.claim_type,
      render: (row: InsuranceClaim) => <Badge tone="neutral">{row.claim_type}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      accessor: (row: InsuranceClaim) => row.status.replace(/_/g, " "),
      render: (row: InsuranceClaim) => (
        <Badge tone={claimStatusColors[row.status] ?? "neutral"}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "pre_auth_amount",
      label: "Pre-Auth",
      sortable: true,
      sortValue: (row: InsuranceClaim) => Number(row.pre_auth_amount ?? 0),
      accessor: (row: InsuranceClaim) => (row.pre_auth_amount ? `₹${row.pre_auth_amount}` : "—"),
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.pre_auth_amount ? `₹${row.pre_auth_amount}` : "—"}</Text>
      ),
    },
    {
      key: "approved_amount",
      label: "Approved",
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.approved_amount ? `₹${row.approved_amount}` : "—"}</Text>
      ),
    },
    {
      key: "settled_amount",
      label: "Settled",
      render: (row: InsuranceClaim) => (
        <Text size="sm">{row.settled_amount ? `₹${row.settled_amount}` : "—"}</Text>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: InsuranceClaim) =>
        canCreate && row.status === "initiated" ? (
          <Button
            tone="secondary"
            size="compact-xs"
            onClick={() => updateMutation.mutate({ id: row.id, status: "pre_auth_requested" })}
          >
            Request Pre-Auth
          </Button>
        ) : null,
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) resetClaim(insuranceClaimDefaults);
            }}
          >
            New Claim
          </Button>
          {showForm && (
            <Stack
              component="form"
              gap="xs"
              onSubmit={handleSubmitClaim(handleCreateInsuranceClaim)}
            >
              <Group grow>
                <TextInput
                  label="Invoice ID"
                  required
                  error={claimErrors.invoice_id?.message}
                  {...registerClaim("invoice_id")}
                />
                <Controller
                  name="patient_id"
                  control={claimControl}
                  render={({ field }) => (
                    <PatientSearchSelect value={field.value ?? ""} onChange={field.onChange} />
                  )}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Insurance Provider"
                  required
                  error={claimErrors.insurance_provider?.message}
                  {...registerClaim("insurance_provider")}
                />
                <TextInput
                  label="Policy Number"
                  error={claimErrors.policy_number?.message}
                  {...registerClaim("policy_number")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="claim_type"
                  render={({ field }) => (
                    <Select
                      label="Claim Type"
                      data={billingInsuranceClaimTypeOptions}
                      value={field.value}
                      onChange={(value) => field.onChange(value ?? "cashless")}
                      error={claimErrors.claim_type?.message}
                    />
                  )}
                />
                <Controller
                  control={claimControl}
                  name="pre_auth_amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Pre-Auth Amount"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.pre_auth_amount?.message}
                    />
                  )}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="scheme_type"
                  render={({ field }) => (
                    <Select
                      label="Scheme Type"
                      data={billingInsuranceSchemeTypeOptions}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={claimErrors.scheme_type?.message}
                      clearable
                      searchable
                    />
                  )}
                />
                <TextInput
                  label="TPA Name"
                  error={claimErrors.tpa_name?.message}
                  {...registerClaim("tpa_name")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={claimControl}
                  name="co_pay_percent"
                  render={({ field }) => (
                    <NumberInput
                      label="Co-Pay %"
                      min={0}
                      max={100}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.co_pay_percent?.message}
                    />
                  )}
                />
                <Controller
                  control={claimControl}
                  name="deductible_amount"
                  render={({ field }) => (
                    <NumberInput
                      label="Deductible Amount"
                      min={0}
                      decimalScale={2}
                      value={field.value}
                      onChange={field.onChange}
                      error={claimErrors.deductible_amount?.message}
                    />
                  )}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Member ID"
                  error={claimErrors.member_id?.message}
                  {...registerClaim("member_id")}
                />
                <TextInput
                  label="Scheme Card Number"
                  error={claimErrors.scheme_card_number?.message}
                  {...registerClaim("scheme_card_number")}
                />
              </Group>
              <Textarea
                label="Notes"
                error={claimErrors.notes?.message}
                {...registerClaim("notes")}
              />
              <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
                Create Claim
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={columns}
        data={claims}
        loading={isLoading}
        rowKey={(row) => row.id}
        onRowClick={(row) => setDetailClaim(row)}
        searchable
        searchPlaceholder="Search provider or claim type"
        exportable
        exportFileName="insurance-claims"
      />

      <ClaimDetailDrawer
        claim={detailClaim}
        callbacks={nhcxCallbacks}
        onClose={() => setDetailClaim(null)}
        onNhcxAction={(c, mode) => {
          setDetailClaim(null);
          setNhcxAction({ id: c.id, mode });
        }}
      />

      <SubmitToNhcxModal
        claimId={nhcxAction?.id ?? ""}
        mode={nhcxAction?.mode ?? "submit"}
        opened={!!nhcxAction}
        onClose={() => setNhcxAction(null)}
      />

      <Text fw={600} mt="lg">
        NHCX
      </Text>
      <NhcxPayerDirectory />

      <Text fw={600} mt="lg">
        TPA Rate Cards
      </Text>
      {canCreate && (
        <>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              setShowTpa(!showTpa);
              if (showTpa) resetTpa(tpaRateCardDefaults);
            }}
          >
            Add TPA Rate Card
          </Button>
          {showTpa && (
            <Stack component="form" gap="xs" onSubmit={handleSubmitTpa(handleCreateTpaRateCard)}>
              <Group grow>
                <TextInput
                  label="TPA Name"
                  required
                  error={tpaErrors.tpa_name?.message}
                  {...registerTpa("tpa_name")}
                />
                <TextInput
                  label="Insurance Provider"
                  required
                  error={tpaErrors.insurance_provider?.message}
                  {...registerTpa("insurance_provider")}
                />
              </Group>
              <Group grow>
                <Controller
                  control={tpaControl}
                  name="scheme_type"
                  render={({ field }) => (
                    <Select
                      label="Scheme Type"
                      data={billingInsuranceSchemeTypeOptions}
                      value={field.value || null}
                      onChange={(value) => field.onChange(value ?? "")}
                      error={tpaErrors.scheme_type?.message}
                      clearable
                      searchable
                    />
                  )}
                />
                <TextInput
                  label="Rate Plan ID"
                  error={tpaErrors.rate_plan_id?.message}
                  {...registerTpa("rate_plan_id")}
                />
              </Group>
              <Group grow>
                <TextInput
                  label="Valid From"
                  type="date"
                  error={tpaErrors.valid_from?.message}
                  {...registerTpa("valid_from")}
                />
                <TextInput
                  label="Valid To"
                  type="date"
                  error={tpaErrors.valid_to?.message}
                  {...registerTpa("valid_to")}
                />
              </Group>
              <Controller
                control={tpaControl}
                name="is_active"
                render={({ field }) => (
                  <Switch
                    label="Active rate card"
                    checked={field.value}
                    onChange={(event) => field.onChange(event.currentTarget.checked)}
                  />
                )}
              />
              <Button tone="primary" size="xs" type="submit" loading={tpaMutation.isPending}>
                Save TPA Rate Card
              </Button>
            </Stack>
          )}
        </>
      )}
      <DataTable
        columns={tpaColumns}
        data={tpaCards}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search TPA or provider"
        exportable
        exportFileName="tpa-rate-cards"
      />
    </Stack>
  );
}
