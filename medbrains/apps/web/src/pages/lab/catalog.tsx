// Lab LabCatalogTab — split from lab.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { LabCatalogFormInput } from "@medbrains/schemas";
import { labCatalogFormSchema } from "@medbrains/schemas";
import type { CreateLabCatalogRequest, LabTestCatalog } from "@medbrains/types";
import { IconCheck, IconPencil, IconPlus, IconUpload, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CsvImportModal, DataTable } from "@/components";
import { Button, IconButton, Switch } from "@/components/ui";
import {
  labContainerOptions,
  labMethodOptions,
  labNumberOrFallback,
  labOptionalInteger,
  labOptionalNumber,
  labOptionalText,
  labSampleTypeOptions,
} from "@/forms/lab.form";
import { labService } from "@/services/lab.service";

export function LabCatalogTab({ canCreate }: { canCreate: boolean }) {
  const { t } = useTranslation("lab");

  const queryClient = useQueryClient();
  const [formOpen, formHandlers] = useDisclosure(false);
  const [importOpen, importHandlers] = useDisclosure(false);
  const catalogDefaults: LabCatalogFormInput = {
    code: "",
    name: "",
    sample_type: "",
    normal_range: "",
    unit: "",
    price: 0,
    tat_hours: "",
    loinc_code: "",
    method: "",
    specimen_volume: "",
    container: "",
    fasting_required: false,
    fasting_hours: "",
    critical_low: "",
    critical_high: "",
    delta_check_percent: "",
  };
  const {
    control,
    register,
    reset,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<LabCatalogFormInput>({
    resolver: zodResolver(labCatalogFormSchema),
    defaultValues: catalogDefaults,
  });

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["lab-catalog"],
    queryFn: () => labService.listLabCatalog(),
  });

  // `editing` is the row being changed, or null when adding.
  //
  // The catalogue had no edit path at all: `updateLabCatalogEntry` existed in
  // the client with no caller, `create_catalog_entry` is a plain INSERT with
  // no ON CONFLICT, and there is no DELETE route -- so a test entered with the
  // wrong tube or price could not be corrected, and its code could not be
  // reused. That also made `container` and `fasting_required` unreachable for
  // every test that already existed.
  const [editing, setEditing] = useState<LabTestCatalog | null>(null);

  const closeForm = () => {
    formHandlers.close();
    setEditing(null);
    reset(catalogDefaults);
  };

  const saveMutation = useMutation({
    mutationFn: (data: CreateLabCatalogRequest) =>
      editing
        ? labService.updateLabCatalogEntry(editing.id, data)
        : labService.createLabCatalogEntry(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lab-catalog"] });
      closeForm();
    },
  });

  const openEdit = (row: LabTestCatalog) => {
    setEditing(row);
    reset({
      code: row.code,
      name: row.name,
      sample_type: (row.sample_type ?? "") as LabCatalogFormInput["sample_type"],
      normal_range: row.normal_range ?? "",
      unit: row.unit ?? "",
      price: Number(row.price ?? 0),
      tat_hours: row.tat_hours ?? "",
      loinc_code: row.loinc_code ?? "",
      method: (row.method ?? "") as LabCatalogFormInput["method"],
      specimen_volume: row.specimen_volume ?? "",
      container: (row.container ?? "") as LabCatalogFormInput["container"],
      fasting_required: row.fasting_required,
      fasting_hours: row.fasting_hours ?? "",
      critical_low: row.critical_low ?? "",
      critical_high: row.critical_high ?? "",
      delta_check_percent: row.delta_check_percent ?? "",
    });
    formHandlers.open();
  };

  const handleCreateCatalog = (values: LabCatalogFormInput) => {
    saveMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      sample_type: labOptionalText(values.sample_type),
      normal_range: labOptionalText(values.normal_range),
      unit: labOptionalText(values.unit),
      price: labNumberOrFallback(values.price, 0),
      tat_hours: labOptionalInteger(values.tat_hours),
      loinc_code: labOptionalText(values.loinc_code),
      method: labOptionalText(values.method),
      specimen_volume: labOptionalText(values.specimen_volume),
      container: labOptionalText(values.container),
      fasting_required: values.fasting_required,
      fasting_hours: labOptionalInteger(values.fasting_hours),
      critical_low: labOptionalNumber(values.critical_low),
      critical_high: labOptionalNumber(values.critical_high),
      delta_check_percent: labOptionalNumber(values.delta_check_percent),
    });
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: LabTestCatalog) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      render: (row: LabTestCatalog) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "sample_type",
      label: "Sample",
      render: (row: LabTestCatalog) => <Text size="sm">{row.sample_type ?? "—"}</Text>,
    },
    {
      key: "loinc_code",
      label: "LOINC",
      render: (row: LabTestCatalog) => <Text size="sm">{row.loinc_code ?? "—"}</Text>,
    },
    {
      key: "price",
      label: "Price",
      render: (row: LabTestCatalog) => <Text size="sm">₹{row.price}</Text>,
    },
    {
      key: "tat_hours",
      label: "TAT",
      render: (row: LabTestCatalog) => (
        <Text size="sm">{row.tat_hours ? `${row.tat_hours}h` : "—"}</Text>
      ),
    },
    {
      key: "critical",
      label: "Critical Range",
      render: (row: LabTestCatalog) => (
        <Text size="sm">
          {row.critical_low || row.critical_high
            ? `${row.critical_low ?? "—"} – ${row.critical_high ?? "—"}`
            : "—"}
        </Text>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: LabTestCatalog) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
    ...(canCreate
      ? [
          {
            key: "actions",
            label: "",
            render: (row: LabTestCatalog) => (
              <IconButton
                tone="default"
                aria-label={`Edit ${row.name}`}
                onClick={() => openEdit(row)}
              >
                <IconPencil size={14} />
              </IconButton>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              if (formOpen) {
                closeForm();
                return;
              }
              setEditing(null);
              reset(catalogDefaults);
              formHandlers.open();
            }}
          >
            Add Test
          </Button>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconUpload size={14} />}
            onClick={importHandlers.open}
          >
            Import CSV
          </Button>
        </Group>
      )}
      <CsvImportModal
        opened={importOpen}
        onClose={() => {
          importHandlers.close();
          void queryClient.invalidateQueries({ queryKey: ["lab-catalog"] });
        }}
        title="Import lab test catalog"
        requiredColumns={["code", "name"]}
        optionalColumns={[
          "sample_type",
          "normal_range",
          "unit",
          "price",
          "tat_hours",
          "loinc_code",
          "critical_low",
          "critical_high",
          "container",
          "fasting_required",
          "fasting_hours",
        ]}
        onImport={(data) => labService.importLabCatalog(data)}
      />
      {formOpen && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCatalog)}>
          <Group grow>
            <TextInput
              label={t("label.code")}
              required
              error={errors.code?.message}
              {...register("code")}
            />
            <TextInput
              label={t("label.name")}
              required
              error={errors.name?.message}
              {...register("name")}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="sample_type"
              render={({ field }) => (
                <Select
                  label={t("label.sampleType")}
                  data={labSampleTypeOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.sample_type?.message}
                  clearable
                  searchable
                />
              )}
            />
            <TextInput
              label={t("label.normalRange")}
              placeholder={t("placeholder.e.g.70100")}
              error={errors.normal_range?.message}
              {...register("normal_range")}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("unit")}
              placeholder={t("placeholder.e.g.MgDl")}
              error={errors.unit?.message}
              {...register("unit")}
            />
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <NumberInput
                  label={t("label.price")}
                  required
                  min={0}
                  decimalScale={2}
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
                <NumberInput
                  label={t("label.tat(hours)")}
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.tat_hours?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t("label.loincCode")}
              placeholder={t("placeholder.e.g.23457")}
              error={errors.loinc_code?.message}
              {...register("loinc_code")}
            />
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <Select
                  label={t("label.method")}
                  data={labMethodOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.method?.message}
                  clearable
                  searchable
                />
              )}
            />
            <TextInput
              label={t("label.specimenVolume")}
              placeholder={t("placeholder.e.g.5Ml")}
              error={errors.specimen_volume?.message}
              {...register("specimen_volume")}
            />
          </Group>
          <Group grow align="flex-start">
            <Controller
              control={control}
              name="container"
              render={({ field }) => (
                <Select
                  label={t("label.container")}
                  description={t("description.containerDecidesTheAssay")}
                  data={labContainerOptions}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.container?.message}
                  clearable
                  searchable
                />
              )}
            />
            <Controller
              control={control}
              name="fasting_required"
              render={({ field }) => (
                <Switch
                  label={t("label.fastingRequired")}
                  checked={field.value}
                  onChange={(event) => field.onChange(event.currentTarget.checked)}
                />
              )}
            />
            <Controller
              control={control}
              name="fasting_hours"
              render={({ field }) => (
                <NumberInput
                  label={t("label.fastingHours")}
                  min={0}
                  // Hours mean nothing unless fasting is required, and a
                  // number left behind after the switch is turned off would
                  // print on the slip as an instruction.
                  disabled={!watch("fasting_required")}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.fasting_hours?.message}
                />
              )}
            />
          </Group>
          <Group grow>
            <Controller
              control={control}
              name="critical_low"
              render={({ field }) => (
                <NumberInput
                  label={t("label.criticalLow")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.critical_low?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="critical_high"
              render={({ field }) => (
                <NumberInput
                  label={t("label.criticalHigh")}
                  decimalScale={4}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.critical_high?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="delta_check_percent"
              render={({ field }) => (
                <NumberInput
                  label={t("label.deltaCheck%")}
                  min={0}
                  max={100}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.delta_check_percent?.message}
                />
              )}
            />
          </Group>
          <Button tone="primary" size="xs" type="submit" loading={saveMutation.isPending}>
            {editing ? "Save changes" : "Add test"}
          </Button>
        </Stack>
      )}
      <DataTable columns={columns} data={catalog} loading={isLoading} rowKey={(row) => row.id} />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Panels Tab (unchanged from Phase 1)
// ══════════════════════════════════════════════════════════
