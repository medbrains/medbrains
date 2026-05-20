import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { DrugScheduleFormValue, MiniAddDrugFormInput } from "@medbrains/schemas";
import { miniAddDrugFormSchema, toDrugScheduleFormValue } from "@medbrains/schemas";
import type { PharmacyCatalog } from "@medbrains/types";
import { IconCheck, IconPill } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  type CreatePharmacyCatalogInput,
  pharmacyCatalogService,
} from "../../services/pharmacyCatalog.service";

interface MiniAddDrugProps {
  searchText: string;
  onCreated: (drug: PharmacyCatalog) => void;
  onCancel: () => void;
}

const scheduleOptions: { value: DrugScheduleFormValue; label: string }[] = [
  { value: "OTC", label: "OTC" },
  { value: "H", label: "Schedule H" },
  { value: "H1", label: "Schedule H1" },
  { value: "X", label: "Schedule X" },
  { value: "G", label: "Schedule G" },
  { value: "NDPS", label: "NDPS" },
];

function inferName(searchText: string): string {
  return searchText.replace(/\([^)]*\)/g, " ").trim();
}

function inferCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return code || "DRUG";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add drug";
}

export function MiniAddDrug({ searchText, onCreated, onCancel }: MiniAddDrugProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const {
    control,
    getValues,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MiniAddDrugFormInput>({
    resolver: zodResolver(miniAddDrugFormSchema),
    defaultValues: {
      name: initialName,
      generic_name: "",
      code: inferCode(initialName),
      unit: "tablet",
      base_price: "0",
      reorder_level: "0",
      drug_schedule: "OTC",
    },
    mode: "onTouched",
  });
  const values = watch();

  const mutation = useMutation({
    mutationFn: (payload: CreatePharmacyCatalogInput) =>
      pharmacyCatalogService.createPharmacyCatalog(payload),
    onSuccess: (drug) => {
      queryClient.invalidateQueries({ queryKey: ["drug-search"] });
      notifications.show({
        title: "Drug added",
        message: `${drug.name} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(drug);
    },
    onError: (error) => {
      notifications.show({
        title: "Drug add failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const canSubmit = values.name.trim().length > 0 && values.code.trim().length > 0;

  const submitDrug = handleSubmit((formValues) => {
    if (!canSubmit) {
      return;
    }

    const payload: CreatePharmacyCatalogInput = {
      code: formValues.code.trim(),
      name: formValues.name.trim(),
      base_price: Number(formValues.base_price) || 0,
      tax_percent: 0,
      reorder_level: Number(formValues.reorder_level) || 0,
      drug_schedule: formValues.drug_schedule,
      formulary_status: "approved",
      unit: formValues.unit.trim() || "unit",
    };

    if (formValues.generic_name.trim()) {
      payload.generic_name = formValues.generic_name.trim();
    }

    mutation.mutate(payload);
  });

  return (
    <Stack gap="sm">
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextInput
            label="Drug name"
            required
            value={field.value}
            onChange={(event) => {
              const next = event.currentTarget.value;
              const currentCode = getValues("code");
              if (!currentCode || currentCode === inferCode(field.value)) {
                setValue("code", inferCode(next), { shouldValidate: true });
              }
              field.onChange(next);
            }}
            error={errors.name?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="generic_name"
        render={({ field }) => (
          <TextInput label="Generic / INN" value={field.value} onChange={field.onChange} />
        )}
      />
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <TextInput
              label="Code"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.code?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="unit"
          render={({ field }) => (
            <TextInput label="Unit" value={field.value} onChange={field.onChange} />
          )}
        />
      </Group>
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="base_price"
          render={({ field }) => (
            <TextInput
              label="Base price"
              inputMode="decimal"
              value={field.value}
              onChange={field.onChange}
              error={errors.base_price?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="reorder_level"
          render={({ field }) => (
            <TextInput
              label="Reorder level"
              inputMode="numeric"
              value={field.value}
              onChange={field.onChange}
              error={errors.reorder_level?.message}
            />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="drug_schedule"
        render={({ field }) => (
          <Select
            allowDeselect={false}
            data={scheduleOptions}
            label="Drug schedule"
            value={field.value}
            onChange={(value) => field.onChange(toDrugScheduleFormValue(value))}
          />
        )}
      />
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconPill size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={() => void submitDrug()}
        >
          Add & select
        </Button>
      </Group>
    </Stack>
  );
}
