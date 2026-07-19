// PROCUREMENT VendorPanel — split from procurement.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Drawer,
  Group,
  MultiSelect,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ProcurementVendorFormInput } from "@medbrains/schemas";
import { procurementVendorFormSchema } from "@medbrains/schemas";
import type { Vendor } from "@medbrains/types";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { procurementService } from "@/services/procurement.service";
import { colorToBadgeTone, optionalText } from "./shared";

function VendorForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcurementVendorFormInput>({
    resolver: zodResolver(procurementVendorFormSchema),
    defaultValues: {
      code: "",
      name: "",
      vendor_type: "supplier",
      contact_person: "",
      phone: "",
      email: "",
      city: "",
      gst_number: "",
      payment_terms: "net_30",
      supply_categories: [],
      drug_license_number: "",
      is_pharmacy_vendor: false,
      product_lines: "",
    },
  });

  const supplyCategories = useWatch({ control, name: "supply_categories" });

  const mutation = useMutation({
    mutationFn: (values: ProcurementVendorFormInput) =>
      procurementService.createVendor({
        code: values.code.trim(),
        name: values.name.trim(),
        vendor_type: values.vendor_type,
        contact_person: optionalText(values.contact_person),
        phone: optionalText(values.phone),
        email: optionalText(values.email),
        city: optionalText(values.city),
        gst_number: optionalText(values.gst_number),
        payment_terms: values.payment_terms,
        supply_categories:
          values.supply_categories.length > 0 ? values.supply_categories : undefined,
        drug_license_number: optionalText(values.drug_license_number),
        is_pharmacy_vendor: values.is_pharmacy_vendor || undefined,
        product_lines: optionalText(values.product_lines),
      }),
    onSuccess: () => {
      toast.success("Vendor registered", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <TextInput label="Vendor Code" required error={errors.code?.message} {...register("code")} />
      <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
      <Controller
        control={control}
        name="vendor_type"
        render={({ field }) => (
          <Select
            label="Type"
            data={[
              { value: "supplier", label: "Supplier" },
              { value: "manufacturer", label: "Manufacturer" },
              { value: "distributor", label: "Distributor" },
              { value: "importer", label: "Importer" },
            ]}
            value={field.value}
            onChange={(value) => field.onChange(value ?? "supplier")}
            error={errors.vendor_type?.message}
          />
        )}
      />
      <TextInput
        label="Contact Person"
        error={errors.contact_person?.message}
        {...register("contact_person")}
      />
      <TextInput label="Phone" error={errors.phone?.message} {...register("phone")} />
      <TextInput label="Email" error={errors.email?.message} {...register("email")} />
      <TextInput label="City" error={errors.city?.message} {...register("city")} />
      <TextInput
        label="GST Number"
        error={errors.gst_number?.message}
        {...register("gst_number")}
      />
      <Controller
        control={control}
        name="payment_terms"
        render={({ field }) => (
          <Select
            label="Payment Terms"
            data={[
              { value: "net_30", label: "Net 30 Days" },
              { value: "net_60", label: "Net 60 Days" },
              { value: "net_90", label: "Net 90 Days" },
              { value: "advance", label: "Advance Payment" },
              { value: "cod", label: "Cash on Delivery" },
            ]}
            value={field.value}
            onChange={(value) => field.onChange(value ?? "net_30")}
            error={errors.payment_terms?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="supply_categories"
        render={({ field }) => (
          <MultiSelect
            label="Supply Categories"
            placeholder="Select categories this vendor supplies"
            data={SUPPLY_CATEGORIES}
            value={field.value}
            onChange={field.onChange}
            searchable
            clearable
            error={errors.supply_categories?.message}
          />
        )}
      />
      {(supplyCategories ?? []).includes("pharmacy") && (
        <TextInput
          label="Drug License Number"
          placeholder="DL-XX-XXXXXXX"
          error={errors.drug_license_number?.message}
          {...register("drug_license_number")}
        />
      )}
      <Controller
        control={control}
        name="is_pharmacy_vendor"
        render={({ field }) => (
          <Switch
            label="Pharmacy Vendor"
            description="Mark if this vendor supplies pharmaceutical products"
            checked={field.value}
            onChange={(event) => field.onChange(event.currentTarget.checked)}
          />
        )}
      />
      <TextInput
        label="Product Lines"
        placeholder="e.g. Antibiotics, Surgical Sutures, Lab Reagents"
        error={errors.product_lines?.message}
        {...register("product_lines")}
      />
      <Button tone="primary" loading={mutation.isPending} type="submit">
        Register Vendor
      </Button>
    </Stack>
  );
}

const SUPPLY_CATEGORIES = [
  { value: "pharmacy", label: "Pharmacy" },
  { value: "surgical", label: "Surgical" },
  { value: "general", label: "General Stores" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "dietary", label: "Dietary / F&B" },
  { value: "it", label: "IT Equipment" },
  { value: "housekeeping", label: "Housekeeping" },
];

export function VendorPanel({ canCreate }: { canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);
  const [detailOpened, { open: openDetail, close: closeDetail }] = useDisclosure(false);

  const { data: vendors, isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => procurementService.listVendors(),
  });

  const columns = [
    { key: "code", label: "Code", render: (row: Vendor) => <Text fw={600}>{row.code}</Text> },
    { key: "name", label: "Name", render: (row: Vendor) => row.name },
    {
      key: "status",
      label: "Status",
      render: (row: Vendor) => (
        <TableValueBadge
          value={row.status}
          kind="status"
          color={statusColor(row.status) ?? "slate"}
        />
      ),
    },
    {
      key: "vendor_type",
      label: "Type",
      render: (row: Vendor) => (
        <TableValueBadge value={row.vendor_type} kind="store" variant="outline" />
      ),
    },
    { key: "contact_person", label: "Contact", render: (row: Vendor) => row.contact_person ?? "-" },
    { key: "phone", label: "Phone", render: (row: Vendor) => row.phone ?? "-" },
    { key: "city", label: "City", render: (row: Vendor) => row.city ?? "-" },
    { key: "gst_number", label: "GST", render: (row: Vendor) => row.gst_number ?? "-" },
    {
      key: "actions",
      label: "",
      render: (row: Vendor) => (
        <Tooltip label="View details">
          <IconButton
            size={44}
            onClick={() => {
              setDetailVendor(row);
              openDetail();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {canCreate && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Vendor
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={vendors ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No vendors found"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Register New Vendor"
        closeButtonProps={{ "aria-label": "Close Register New Vendor" }}
        position="right"
        size="lg"
      >
        <VendorForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["vendors"] });
            closeCreate();
          }}
        />
      </Drawer>

      <Drawer
        opened={detailOpened}
        onClose={closeDetail}
        title="Vendor Details"
        closeButtonProps={{ "aria-label": "Close Vendor Details" }}
        position="right"
        size="lg"
      >
        {detailVendor && (
          <Stack>
            <Group>
              <Badge tone={colorToBadgeTone(statusColor(detailVendor.status))} variant="filled">
                {detailVendor.status}
              </Badge>
              <Badge tone="neutral" variant="outline">
                {detailVendor.vendor_type}
              </Badge>
            </Group>
            <Text fw={600} size="lg">
              {detailVendor.name}
            </Text>
            {detailVendor.contact_person && (
              <Text size="sm">Contact: {detailVendor.contact_person}</Text>
            )}
            {detailVendor.phone && <Text size="sm">Phone: {detailVendor.phone}</Text>}
            {detailVendor.email && <Text size="sm">Email: {detailVendor.email}</Text>}
            {detailVendor.gst_number && <Text size="sm">GST: {detailVendor.gst_number}</Text>}
            {detailVendor.pan_number && <Text size="sm">PAN: {detailVendor.pan_number}</Text>}
            {detailVendor.drug_license_number && (
              <Text size="sm">Drug License: {detailVendor.drug_license_number}</Text>
            )}
            {detailVendor.city && (
              <Text size="sm">
                Location: {[detailVendor.city, detailVendor.state].filter(Boolean).join(", ")}
              </Text>
            )}
            <Text size="sm">Payment Terms: {detailVendor.payment_terms ?? "N/A"}</Text>
            <Text size="sm">
              Credit Limit: ₹{detailVendor.credit_limit} ({detailVendor.credit_days} days)
            </Text>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
