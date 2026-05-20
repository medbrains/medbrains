import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Group, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { MiniAddLabTestFormInput } from "@medbrains/schemas";
import { miniAddLabTestFormSchema } from "@medbrains/schemas";
import type { LabTestCatalog } from "@medbrains/types";
import { IconCheck, IconMicroscope } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { type CreateLabCatalogInput, labCatalogService } from "../../services/labCatalog.service";

interface MiniAddLabTestProps {
  searchText: string;
  onCreated: (test: LabTestCatalog) => void;
  onCancel: () => void;
}

function inferName(searchText: string): string {
  return searchText.replace(/\([^)]*\)/g, " ").trim();
}

function inferCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return code || "LAB";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add lab test";
}

export function MiniAddLabTest({ searchText, onCreated, onCancel }: MiniAddLabTestProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const {
    control,
    getValues,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MiniAddLabTestFormInput>({
    resolver: zodResolver(miniAddLabTestFormSchema),
    defaultValues: {
      name: initialName,
      code: inferCode(initialName),
      sample_type: "",
      unit: "",
      price: "0",
      tat_hours: "24",
      loinc_code: "",
    },
    mode: "onTouched",
  });
  const values = watch();

  const mutation = useMutation({
    mutationFn: (payload: CreateLabCatalogInput) =>
      labCatalogService.createLabCatalogEntry(payload),
    onSuccess: (test) => {
      queryClient.invalidateQueries({ queryKey: ["lab-test-search"] });
      notifications.show({
        title: "Lab test added",
        message: `${test.name} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(test);
    },
    onError: (error) => {
      notifications.show({
        title: "Lab test add failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const canSubmit = values.name.trim().length > 0 && values.code.trim().length > 0;

  const submitLabTest = handleSubmit((formValues) => {
    if (!canSubmit) {
      return;
    }

    const payload: CreateLabCatalogInput = {
      code: formValues.code.trim(),
      name: formValues.name.trim(),
      price: Number(formValues.price) || 0,
      tat_hours: Number(formValues.tat_hours) || 24,
    };

    if (formValues.sample_type.trim()) {
      payload.sample_type = formValues.sample_type.trim();
    }
    if (formValues.unit.trim()) {
      payload.unit = formValues.unit.trim();
    }
    if (formValues.loinc_code.trim()) {
      payload.loinc_code = formValues.loinc_code.trim();
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
            label="Test name"
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
          name="loinc_code"
          render={({ field }) => (
            <TextInput label="LOINC code" value={field.value} onChange={field.onChange} />
          )}
        />
      </Group>
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="sample_type"
          render={({ field }) => (
            <TextInput label="Sample type" value={field.value} onChange={field.onChange} />
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
          name="price"
          render={({ field }) => (
            <TextInput
              label="Price"
              inputMode="decimal"
              value={field.value}
              onChange={field.onChange}
              error={errors.price?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="tat_hours"
          render={({ field }) => (
            <TextInput
              label="TAT hours"
              inputMode="numeric"
              value={field.value}
              onChange={field.onChange}
              error={errors.tat_hours?.message}
            />
          )}
        />
      </Group>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconMicroscope size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={() => void submitLabTest()}
        >
          Add & select
        </Button>
      </Group>
    </Stack>
  );
}
