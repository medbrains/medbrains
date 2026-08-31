// IPD NdpsRegisterTab — split from pharmacy.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PharmacyNdpsEntryFormInput } from "@medbrains/schemas";
import { pharmacyNdpsEntryFormSchema } from "@medbrains/schemas";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type { CreateNdpsEntryRequest, NdpsRegisterEntry } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconLock, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import type { DataTableFilter } from "@/components";
import { DataTable, useClinicalEmit } from "@/components";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import type { BadgeTone } from "@/components/ui";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { formIntegerOrFallback, ndpsActionOptions } from "@/forms/pharmacy.form";
import { pharmacyService } from "@/services/pharmacy.service";
import {
  canEditPharmacyField,
  canViewPharmacyField,
  renderPharmacySensitiveNumber,
  renderPharmacySensitiveShortIdentifier,
} from "./shared";

export function NdpsRegisterTab() {
  const emit = useClinicalEmit();
  const canManage = useHasPermission(P.PHARMACY.NDPS_MANAGE);
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const balanceAccess = useFieldAccess("pharmacy.ndps.balance_after");
  const userAccess = useFieldAccess("pharmacy.ndps.user_ids");
  const witnessAccess = useFieldAccess("pharmacy.ndps.witnessed_by");
  const canEditWitness = canEditPharmacyField(witnessAccess);
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<PharmacyNdpsEntryFormInput>({
    resolver: zodResolver(pharmacyNdpsEntryFormSchema),
    defaultValues: {
      catalog_item_id: "",
      action: "receipt",
      quantity: 1,
      notes: "",
      witnessed_by: "",
    },
  });

  const {
    data,
    isLoading,
    isError: registerFailed,
  } = useQuery({
    queryKey: ["pharmacy-ndps"],
    queryFn: () => pharmacyService.listNdpsEntries(),
  });

  const { data: balance, isError: balanceFailed } = useQuery({
    queryKey: ["pharmacy-ndps-balance"],
    queryFn: () => pharmacyService.getNdpsBalance(),
  });

  const createMutation = useMutation({
    mutationFn: (d: CreateNdpsEntryRequest) => pharmacyService.createNdpsEntry(d),
    onSuccess: (entry) => {
      emit("pharmacy.ndps.movement.created", {
        action: entry.action,
        catalog_item_id: entry.catalog_item_id,
        created_at: entry.created_at,
        entry_id: entry.id,
        quantity: entry.quantity,
        register_number: entry.register_number,
        source_record_id: entry.id,
      });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-ndps"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-ndps-balance"] });
      toast.success("Register entry recorded", { title: "NDPS Entry" });
      formHandlers.close();
      reset({
        catalog_item_id: "",
        action: "receipt",
        quantity: 1,
        notes: "",
        witnessed_by: "",
      });
    },
  });

  const handleCreateNdpsEntry = (values: PharmacyNdpsEntryFormInput) => {
    createMutation.mutate({
      catalog_item_id: values.catalog_item_id,
      action: values.action,
      quantity: formIntegerOrFallback(values.quantity, 1),
      notes: values.notes.trim() || undefined,
      witnessed_by: canEditWitness ? values.witnessed_by.trim() || undefined : undefined,
    });
  };

  const actionColors: Record<string, BadgeTone> = {
    receipt: "success",
    dispensed: "primary",
    destroyed: "danger",
    transferred: "warning",
    adjustment: "neutral",
  };

  const columns = [
    {
      key: "action",
      label: "Action",
      sortable: true,
      accessor: (row: NdpsRegisterEntry) => row.action,
      render: (row: NdpsRegisterEntry) => (
        <Badge size="xs" tone={actionColors[row.action] ?? "neutral"}>
          {row.action}
        </Badge>
      ),
    },
    {
      key: "quantity",
      label: "Qty",
      sortable: true,
      sortValue: (row: NdpsRegisterEntry) => row.quantity,
      accessor: (row: NdpsRegisterEntry) => row.quantity,
      render: (row: NdpsRegisterEntry) => <Text size="sm">{row.quantity}</Text>,
    },
    {
      key: "balance_after",
      label: "Balance",
      render: (row: NdpsRegisterEntry) => (
        <Text size="sm" fw={700}>
          {renderPharmacySensitiveNumber(balanceAccess, row.balance_after)}
        </Text>
      ),
    },
    {
      key: "dispensed_by",
      label: "By",
      render: (row: NdpsRegisterEntry) => (
        <Text size="sm">
          {renderPharmacySensitiveShortIdentifier(userAccess, row.dispensed_by)}
        </Text>
      ),
    },
    {
      key: "witnessed_by",
      label: "Witness",
      render: (row: NdpsRegisterEntry) => (
        <Text size="sm">
          {renderPharmacySensitiveShortIdentifier(witnessAccess, row.witnessed_by)}
        </Text>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      sortable: true,
      sortValue: (row: NdpsRegisterEntry) => row.created_at,
      accessor: (row: NdpsRegisterEntry) => new Date(row.created_at).toLocaleDateString(),
      render: (row: NdpsRegisterEntry) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
  ];

  const ndpsFilters: DataTableFilter<NdpsRegisterEntry>[] = [
    {
      key: "action",
      label: "Action",
      options: ndpsActionOptions.map((option) => ({ value: option.value, label: option.label })),
      matches: (row, value) => row.action === value,
    },
  ];

  return (
    <Stack>
      {/* This is a statutory register under the NDPS Act, and both reads fail
          quietly: the table falls back to [] and the balance strip is hidden
          when `balance` is undefined. An empty register reads as "no
          controlled-drug transactions" and a missing balance strip as "none
          held" — neither of which anyone should conclude from an outage,
          least of all during a stock reconciliation or an inspection. */}
      {(registerFailed || balanceFailed) && (
        <Alert tone="danger" title="The narcotics register could not be read">
          This is a fault, not an empty register. Do not treat what is shown as a record of
          controlled-drug movements or of stock in hand.
        </Alert>
      )}
      {balance?.entries && balance.entries.length > 0 && (
        <Group gap="sm">
          {balance.entries.map((b) => (
            <Badge key={b.catalog_item_id} size="lg" leftSection={<IconLock size={12} />}>
              {b.drug_name}: {renderPharmacySensitiveNumber(balanceAccess, b.balance)}
            </Badge>
          ))}
        </Group>
      )}
      {canManage && (
        <Group>
          <Button
            size="xs"
            tone="primary"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.toggle}
          >
            Manual Entry
          </Button>
        </Group>
      )}
      {formOpened && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateNdpsEntry)}>
          <Controller
            control={control}
            name="catalog_item_id"
            render={({ field }) => (
              <DrugSearchSelect
                value={field.value}
                onChange={field.onChange}
                error={errors.catalog_item_id?.message}
                required
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="action"
              render={({ field }) => (
                <Select
                  label="Action"
                  data={ndpsActionOptions}
                  value={field.value}
                  onChange={(value) => value && field.onChange(value)}
                />
              )}
            />
            <Controller
              control={control}
              name="quantity"
              render={({ field }) => (
                <NumberInput
                  label="Quantity"
                  required
                  min={1}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.quantity?.message}
                />
              )}
            />
          </Group>
          {canViewPharmacyField(witnessAccess) && (
            <TextInput
              label="Witnessed by"
              disabled={!canEditWitness}
              {...register("witnessed_by")}
            />
          )}
          <TextInput label="Notes" {...register("notes")} />
          <Button size="xs" tone="primary" type="submit" loading={createMutation.isPending}>
            Record
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={data?.entries ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search register"
        exportable
        exportFileName="ndps-register"
        filters={ndpsFilters}
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Batch & Expiry Tab
// ══════════════════════════════════════════════════════════
