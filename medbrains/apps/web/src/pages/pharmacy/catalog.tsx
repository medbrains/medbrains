// IPD PharmacyCatalogTab — split from pharmacy.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, NumberInput, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PharmacyCatalogFormInput } from "@medbrains/schemas";
import { pharmacyCatalogFormSchema } from "@medbrains/schemas";
import { useFieldAccess } from "@medbrains/stores";
import type {
  ComplianceSettings,
  CreatePharmacyCatalogRequest,
  PharmacyCatalog,
} from "@medbrains/types";
import { IconAlertTriangle, IconCheck, IconPlus, IconUpload, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CsvImportModal, DataTable, TableValueBadge } from "@/components";
import { Badge, Button } from "@/components/ui";
import {
  awareCategoryOptions,
  drugScheduleOptions,
  formIntegerOrFallback,
  formNumberOrFallback,
  formularyStatusOptions,
  optionalFormText,
} from "@/forms/pharmacy.form";
import { pharmacyService } from "@/services/pharmacy.service";
import { renderPharmacySensitiveCurrency } from "./shared";

const DRUG_CATEGORIES = [
  { value: "alimentary", label: "Alimentary Tract & Metabolism" },
  { value: "blood", label: "Blood & Blood-Forming Organs" },
  { value: "cardiovascular", label: "Cardiovascular System" },
  { value: "dermatologicals", label: "Dermatologicals" },
  { value: "genitourinary", label: "Genitourinary & Sex Hormones" },
  { value: "hormones", label: "Systemic Hormones" },
  { value: "antiinfectives", label: "Antiinfectives for Systemic Use" },
  { value: "antineoplastic", label: "Antineoplastic & Immunomodulating" },
  { value: "musculoskeletal", label: "Musculoskeletal System" },
  { value: "nervous", label: "Nervous System" },
  { value: "antiparasitic", label: "Antiparasitic Products" },
  { value: "respiratory", label: "Respiratory System" },
  { value: "sensory", label: "Sensory Organs" },
  { value: "various", label: "Various" },
  { value: "consumables", label: "Medical Consumables" },
  { value: "other", label: "Other" },
];

export function PharmacyCatalogTab({
  canManage,
  compliance,
}: {
  canManage: boolean;
  compliance: ComplianceSettings;
}) {
  const queryClient = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [importOpened, importHandlers] = useDisclosure(false);
  const [formularyFilter, setFormularyFilter] = useState<string | null>(null);
  const priceAccess = useFieldAccess("pharmacy.catalog.base_price");
  const catalogDefaults: PharmacyCatalogFormInput = {
    code: "",
    name: "",
    generic_name: "",
    category: "",
    manufacturer: "",
    unit: "",
    base_price: 0,
    tax_percent: 0,
    reorder_level: 0,
    drug_schedule: undefined,
    formulary_status: "approved",
    aware_category: undefined,
    inn_name: "",
    atc_code: "",
    is_controlled: false,
  };
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm<PharmacyCatalogFormInput>({
    resolver: zodResolver(pharmacyCatalogFormSchema),
    defaultValues: catalogDefaults,
  });

  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => pharmacyService.listPharmacyCatalog(),
  });

  const filtered = useMemo(() => {
    if (!formularyFilter) return catalog;
    return catalog.filter((d) => d.formulary_status === formularyFilter);
  }, [catalog, formularyFilter]);

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyCatalogRequest) => pharmacyService.createPharmacyCatalog(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] });
      formHandlers.close();
      reset(catalogDefaults);
    },
  });

  const handleCreateCatalog = (values: PharmacyCatalogFormInput) => {
    createMutation.mutate({
      code: values.code.trim(),
      name: values.name.trim(),
      generic_name: optionalFormText(values.generic_name),
      category: optionalFormText(values.category),
      manufacturer: optionalFormText(values.manufacturer),
      unit: optionalFormText(values.unit),
      base_price: formNumberOrFallback(values.base_price, 0),
      tax_percent: formNumberOrFallback(values.tax_percent, 0),
      reorder_level: formIntegerOrFallback(values.reorder_level, 0),
      drug_schedule: values.drug_schedule,
      formulary_status: values.formulary_status,
      aware_category: values.aware_category,
      inn_name: optionalFormText(values.inn_name),
      atc_code: optionalFormText(values.atc_code),
      is_controlled: values.is_controlled || undefined,
    });
  };

  const columns = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyCatalog) => row.code,
      render: (row: PharmacyCatalog) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyCatalog) => row.name,
      render: (row: PharmacyCatalog) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "generic_name",
      label: "Generic",
      searchable: true,
      accessor: (row: PharmacyCatalog) => row.generic_name ?? "",
      render: (row: PharmacyCatalog) => <Text size="sm">{row.generic_name ?? "\u2014"}</Text>,
    },
    {
      key: "category",
      label: "Category",
      render: (row: PharmacyCatalog) =>
        row.category ? <TableValueBadge value={row.category} kind="pharmacy" /> : "\u2014",
    },
    {
      key: "base_price",
      label: "Price",
      sortable: true,
      sortValue: (row: PharmacyCatalog) => Number(row.base_price),
      accessor: (row: PharmacyCatalog) => Number(row.base_price),
      render: (row: PharmacyCatalog) => (
        <Text size="sm">{renderPharmacySensitiveCurrency(priceAccess, row.base_price)}</Text>
      ),
    },
    {
      key: "current_stock",
      label: "Stock",
      sortable: true,
      sortValue: (row: PharmacyCatalog) => row.current_stock,
      accessor: (row: PharmacyCatalog) => row.current_stock,
      render: (row: PharmacyCatalog) => (
        <Text
          size="sm"
          c={row.current_stock < row.reorder_level ? "danger" : undefined}
          fw={row.current_stock < row.reorder_level ? 700 : undefined}
        >
          {row.current_stock}
          {row.current_stock < row.reorder_level && (
            <IconAlertTriangle size={12} style={{ marginLeft: 4, verticalAlign: "middle" }} />
          )}
        </Text>
      ),
    },
    {
      key: "regulatory",
      label: "Regulatory",
      render: (row: PharmacyCatalog) => (
        <Group gap={2}>
          {compliance.show_schedule_badges && row.drug_schedule && (
            <Badge
              size="xs"
              tone={
                row.drug_schedule === "X" || row.drug_schedule === "NDPS"
                  ? "danger"
                  : row.drug_schedule === "H1"
                    ? "warning"
                    : "primary"
              }
            >
              Sch-{row.drug_schedule}
            </Badge>
          )}
          {compliance.show_controlled_warnings && row.is_controlled && (
            <Badge size="xs" variant="filled" tone="danger">
              CTRL
            </Badge>
          )}
          {compliance.show_formulary_status && row.formulary_status !== "approved" && (
            <Badge size="xs" tone={row.formulary_status === "restricted" ? "warning" : "neutral"}>
              {row.formulary_status === "restricted" ? "Restricted" : "Non-Formulary"}
            </Badge>
          )}
          {compliance.show_aware_category && row.aware_category && (
            <Badge
              size="xs"
              tone={
                row.aware_category === "reserve"
                  ? "danger"
                  : row.aware_category === "watch"
                    ? "warning"
                    : "success"
              }
            >
              AWaRe: {row.aware_category}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: PharmacyCatalog) =>
        row.is_active ? (
          <IconCheck size={14} color="success" />
        ) : (
          <IconX size={14} color="danger" />
        ),
    },
  ];

  return (
    <Stack>
      <Group>
        {canManage && (
          <Button
            size="xs"
            tone="primary"
            leftSection={<IconPlus size={14} />}
            onClick={formHandlers.toggle}
          >
            Add formulary medicine
          </Button>
        )}
        {canManage && (
          <Button
            size="xs"
            tone="secondary"
            leftSection={<IconUpload size={14} />}
            onClick={importHandlers.open}
          >
            Import CSV
          </Button>
        )}
        <Select
          placeholder="Formulary filter"
          data={[
            { value: "approved", label: "Approved" },
            { value: "restricted", label: "Restricted" },
            { value: "non_formulary", label: "Non-Formulary" },
          ]}
          value={formularyFilter}
          onChange={setFormularyFilter}
          clearable
          w={180}
        />
      </Group>
      <CsvImportModal
        opened={importOpened}
        onClose={() => {
          importHandlers.close();
          void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] });
        }}
        title="Import drug formulary"
        requiredColumns={["code", "name"]}
        optionalColumns={[
          "generic_name",
          "category",
          "manufacturer",
          "unit",
          "base_price",
          "tax_percent",
          "reorder_level",
          "drug_schedule",
          "inn_name",
          "atc_code",
          "mrp",
        ]}
        onImport={(data) => pharmacyService.importPharmacyCatalog(data)}
      />
      {formOpened && (
        <Stack component="form" gap="xs" onSubmit={handleSubmit(handleCreateCatalog)}>
          <Group grow>
            <TextInput label="Code" required error={errors.code?.message} {...register("code")} />
            <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
          </Group>
          <Group grow>
            <TextInput
              label="Generic Name"
              error={errors.generic_name?.message}
              {...register("generic_name")}
            />
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <Select
                  label="Category"
                  data={DRUG_CATEGORIES}
                  value={field.value || null}
                  onChange={(value) => field.onChange(value ?? "")}
                  error={errors.category?.message}
                  clearable
                  searchable
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Manufacturer"
              error={errors.manufacturer?.message}
              {...register("manufacturer")}
            />
            <TextInput label="Unit" error={errors.unit?.message} {...register("unit")} />
          </Group>
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
            <Controller
              control={control}
              name="reorder_level"
              render={({ field }) => (
                <NumberInput
                  label="Reorder Level"
                  min={0}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.reorder_level?.message}
                />
              )}
            />
          </Group>
          <Text fw={600} size="sm" mt="xs">
            Regulatory Classification
          </Text>
          <Group grow>
            <Controller
              control={control}
              name="drug_schedule"
              render={({ field }) => (
                <Select
                  label="Drug Schedule"
                  placeholder="Select schedule"
                  data={drugScheduleOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  error={errors.drug_schedule?.message}
                  clearable
                />
              )}
            />
            <Controller
              control={control}
              name="formulary_status"
              render={({ field }) => (
                <Select
                  label="Formulary Status"
                  placeholder="Select status"
                  data={formularyStatusOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  error={errors.formulary_status?.message}
                  clearable
                />
              )}
            />
            <Controller
              control={control}
              name="aware_category"
              render={({ field }) => (
                <Select
                  label="AWaRe Category"
                  description="For antibiotics only"
                  placeholder="Select category"
                  data={awareCategoryOptions}
                  value={field.value ?? null}
                  onChange={(value) => field.onChange(value ?? undefined)}
                  error={errors.aware_category?.message}
                  clearable
                />
              )}
            />
          </Group>
          <Group grow>
            <TextInput
              label="INN Name"
              placeholder="International Nonproprietary Name"
              error={errors.inn_name?.message}
              {...register("inn_name")}
            />
            <TextInput
              label="ATC Code"
              placeholder="e.g. J01CA04"
              error={errors.atc_code?.message}
              {...register("atc_code")}
            />
          </Group>
          <Controller
            control={control}
            name="is_controlled"
            render={({ field }) => (
              <Switch
                label="Controlled Substance"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
                error={errors.is_controlled?.message}
              />
            )}
          />
          <Button size="xs" tone="primary" type="submit" loading={createMutation.isPending}>
            Save
          </Button>
        </Stack>
      )}
      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search formulary"
        exportable
        exportFileName="pharmacy-catalog"
      />
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Stock Tab
// ══════════════════════════════════════════════════════════
