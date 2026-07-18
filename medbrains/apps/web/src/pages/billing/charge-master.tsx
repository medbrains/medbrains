// Billing ChargeMasterTab — split from billing.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import type { BillingChargeMasterFormInput } from "@medbrains/schemas";
import { billingChargeMasterFormSchema } from "@medbrains/schemas";
import type { ChargeMaster, CreateChargeMasterRequest } from "@medbrains/types";
import { IconCheck, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Button, IconButton } from "@/components/ui";
import {
  billingGstCategoryOptions,
  billingNumberOrFallback,
  billingOptionalText,
  billingServiceCategoryOptions,
} from "@/forms/billing.form";
import { confirmDestructive } from "@/lib/confirm-destructive";
import { billingService } from "@/services/billing.service";

export function ChargeMasterTab({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const chargeDefaults: BillingChargeMasterFormInput = {
    code: "",
    name: "",
    category: "consultation",
    base_price: 0,
    tax_percent: 0,
    hsn_sac_code: "",
    gst_category: undefined,
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<BillingChargeMasterFormInput>({
    resolver: zodResolver(billingChargeMasterFormSchema),
    defaultValues: chargeDefaults,
  });

  const { data: charges = [], isLoading } = useQuery({
    queryKey: ["charge-master"],
    queryFn: () => billingService.listChargeMaster(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateChargeMasterRequest) => billingService.createChargeMaster(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["charge-master"] });
      setShowForm(false);
      reset(chargeDefaults);
    },
  });

  const handleCreateCharge = (values: BillingChargeMasterFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      category: values.category,
      base_price: billingNumberOrFallback(values.base_price, 0),
      tax_percent: billingNumberOrFallback(values.tax_percent, 0),
      hsn_sac_code: billingOptionalText(values.hsn_sac_code),
      gst_category: values.gst_category,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => billingService.deleteChargeMaster(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["charge-master"] }),
  });

  const columns = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      searchable: true,
      accessor: (row: ChargeMaster) => row.code,
      render: (row: ChargeMaster) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: ChargeMaster) => row.name,
      render: (row: ChargeMaster) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      searchable: true,
      accessor: (row: ChargeMaster) => row.category || "—",
      render: (row: ChargeMaster) => <Text size="sm">{row.category || "—"}</Text>,
    },
    {
      key: "base_price",
      label: "Price",
      sortable: true,
      sortValue: (row: ChargeMaster) => Number(row.base_price),
      accessor: (row: ChargeMaster) => row.base_price,
      render: (row: ChargeMaster) => <Text size="sm">₹{row.base_price}</Text>,
    },
    {
      key: "hsn_sac_code",
      label: "HSN/SAC",
      render: (row: ChargeMaster) => <Text size="sm">{row.hsn_sac_code ?? "—"}</Text>,
    },
    {
      key: "gst_category",
      label: "GST Cat.",
      render: (row: ChargeMaster) => <Text size="sm">{row.gst_category ?? "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: ChargeMaster) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    {
      key: "actions",
      label: "",
      render: (row: ChargeMaster) =>
        canCreate ? (
          <IconButton
            tone="danger"
            aria-label="Delete"
            onClick={() =>
              confirmDestructive({
                title: "Delete charge",
                message: `Delete charge "${row.name}" from the charge master? This cannot be undone.`,
                confirmLabel: "Delete charge",
                onConfirm: () => deleteMutation.mutate(row.id),
              })
            }
          >
            <IconTrash size={14} />
          </IconButton>
        ) : null,
    },
  ];

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
            Add Charge
          </Button>
        </Group>
      )}
      {showForm && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCharge)}>
          <Group grow>
            <TextInput label="Code" required error={errors.code?.message} {...register("code")} />
            <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
          </Group>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select
                label="Category"
                required
                data={billingServiceCategoryOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "consultation")}
                error={errors.category?.message}
                searchable
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="base_price"
              render={({ field }) => (
                <NumberInput
                  label="Base Price"
                  required
                  min={0}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.base_price?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="tax_percent"
              render={({ field }) => (
                <NumberInput
                  label="Tax %"
                  min={0}
                  max={100}
                  decimalScale={2}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tax_percent?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label="HSN/SAC Code"
              placeholder="e.g. 999312"
              error={errors.hsn_sac_code?.message}
              {...register("hsn_sac_code")}
            />
            <Controller
              control={control}
              name="gst_category"
              render={({ field }) => (
                <Select
                  label="GST Category"
                  data={billingGstCategoryOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  error={errors.gst_category?.message}
                  clearable
                />
              )}
            />
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={charges}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search code, name or category"
        exportable
        exportFileName="charge-master"
      />
    </Stack>
  );
}

// ── Packages Tab ────────────────────────────────────────

// ── Co-pay Calculation Breakdown ──────────────────────────
