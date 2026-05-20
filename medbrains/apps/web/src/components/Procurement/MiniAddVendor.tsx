import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Checkbox, Group, MultiSelect, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type {
  MiniAddVendorFormInput,
  SupplyCategoryFormValue,
  VendorTypeFormValue,
} from "@medbrains/schemas";
import {
  miniAddVendorFormSchema,
  toSupplyCategoryFormValues,
  toVendorTypeFormValue,
} from "@medbrains/schemas";
import type { Vendor } from "@medbrains/types";
import { IconCheck, IconTruck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { procurementService } from "../../services/procurement.service";

interface MiniAddVendorProps {
  searchText: string;
  onCreated: (vendor: Vendor) => void;
  onCancel: () => void;
}

const supplyCategories: Array<{ value: SupplyCategoryFormValue; label: string }> = [
  { value: "pharmacy", label: "Pharmacy" },
  { value: "surgical", label: "Surgical" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "general", label: "General stores" },
  { value: "dietary", label: "Dietary / F&B" },
  { value: "it", label: "IT equipment" },
  { value: "housekeeping", label: "Housekeeping" },
];

const VENDOR_TYPE_OPTIONS: Array<{ value: VendorTypeFormValue; label: string }> = [
  { value: "supplier", label: "Supplier" },
  { value: "manufacturer", label: "Manufacturer" },
  { value: "distributor", label: "Distributor" },
  { value: "importer", label: "Importer" },
];

function inferName(searchText: string): string {
  return searchText.trim();
}

function inferCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return code || "VENDOR";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to add vendor";
}

export function MiniAddVendor({ searchText, onCreated, onCancel }: MiniAddVendorProps) {
  const initialName = useMemo(() => inferName(searchText), [searchText]);
  const queryClient = useQueryClient();
  const {
    control,
    getValues,
    handleSubmit,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm<MiniAddVendorFormInput>({
    resolver: zodResolver(miniAddVendorFormSchema),
    defaultValues: {
      name: initialName,
      code: inferCode(initialName),
      vendor_type: "supplier",
      contact_person: "",
      phone: "",
      email: "",
      gst_number: "",
      supply_categories: [],
      is_pharmacy_vendor: false,
      drug_license_number: "",
    },
    mode: "onTouched",
  });

  const values = watch();
  const requiresDrugLicense =
    values.is_pharmacy_vendor || values.supply_categories.includes("pharmacy");

  const mutation = useMutation({
    mutationFn: (formValues: MiniAddVendorFormInput) =>
      procurementService.createVendor({
        code: formValues.code.trim(),
        name: formValues.name.trim(),
        vendor_type: formValues.vendor_type,
        contact_person: formValues.contact_person.trim() || undefined,
        phone: formValues.phone.trim() || undefined,
        email: formValues.email.trim() || undefined,
        gst_number: formValues.gst_number.trim() || undefined,
        categories:
          formValues.supply_categories.length > 0 ? formValues.supply_categories : undefined,
        supply_categories:
          formValues.supply_categories.length > 0 ? formValues.supply_categories : undefined,
        is_pharmacy_vendor:
          formValues.is_pharmacy_vendor || formValues.supply_categories.includes("pharmacy")
            ? true
            : undefined,
        drug_license_number: formValues.drug_license_number.trim() || undefined,
      }),
    onSuccess: (vendor) => {
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
      void queryClient.invalidateQueries({ queryKey: ["procurement", "vendors"] });
      notifications.show({
        title: "Vendor added",
        message: `${vendor.name} is now selected`,
        color: "success",
        icon: <IconCheck size={16} />,
      });
      onCreated(vendor);
    },
    onError: (error) => {
      notifications.show({
        title: "Vendor add failed",
        message: errorMessage(error),
        color: "danger",
      });
    },
  });

  const canSubmit =
    values.name.trim().length >= 2 &&
    values.code.trim().length >= 2 &&
    (!requiresDrugLicense || values.drug_license_number.trim().length > 0);
  const submitVendor = handleSubmit((formValues) => mutation.mutate(formValues));

  return (
    <Stack gap="sm">
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextInput
            label="Vendor name"
            required
            value={field.value}
            onChange={(event) => {
              const next = event.currentTarget.value;
              const currentCode = getValues("code");
              if (!currentCode || currentCode === inferCode(field.value)) {
                setValue("code", inferCode(next), { shouldValidate: true });
                void trigger("code");
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
              onChange={(event) => field.onChange(event.currentTarget.value.toUpperCase())}
              error={errors.code?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="vendor_type"
          render={({ field }) => (
            <Select
              allowDeselect={false}
              data={VENDOR_TYPE_OPTIONS}
              label="Type"
              value={field.value}
              onChange={(value) => field.onChange(toVendorTypeFormValue(value))}
            />
          )}
        />
      </Group>
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="contact_person"
          render={({ field }) => (
            <TextInput label="Contact person" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextInput label="Phone" value={field.value} onChange={field.onChange} />
          )}
        />
      </Group>
      <Group grow align="flex-start">
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <TextInput label="Email" type="email" value={field.value} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="gst_number"
          render={({ field }) => (
            <TextInput label="GST number" value={field.value} onChange={field.onChange} />
          )}
        />
      </Group>
      <Controller
        control={control}
        name="supply_categories"
        render={({ field }) => (
          <MultiSelect
            clearable
            data={supplyCategories}
            label="Supply categories"
            searchable
            value={field.value}
            onChange={(nextValues) => {
              field.onChange(toSupplyCategoryFormValues(nextValues));
              void trigger("drug_license_number");
            }}
          />
        )}
      />
      <Controller
        control={control}
        name="is_pharmacy_vendor"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            label="Pharmacy vendor"
            onChange={(event) => {
              field.onChange(event.currentTarget.checked);
              void trigger("drug_license_number");
            }}
          />
        )}
      />
      {requiresDrugLicense && (
        <Controller
          control={control}
          name="drug_license_number"
          render={({ field }) => (
            <TextInput
              label="Drug license number"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.drug_license_number?.message}
            />
          )}
        />
      )}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftSection={<IconTruck size={16} />}
          loading={mutation.isPending}
          disabled={!canSubmit}
          onClick={() => void submitVendor()}
        >
          Add & select
        </Button>
      </Group>
    </Stack>
  );
}
