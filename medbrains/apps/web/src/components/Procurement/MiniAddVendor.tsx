import { Button, Checkbox, Group, MultiSelect, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type { Vendor } from "@medbrains/types";
import { IconCheck, IconTruck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

interface MiniAddVendorProps {
  searchText: string;
  onCreated: (vendor: Vendor) => void;
  onCancel: () => void;
}

const supplyCategories = [
  { value: "pharmacy", label: "Pharmacy" },
  { value: "surgical", label: "Surgical" },
  { value: "lab", label: "Laboratory" },
  { value: "radiology", label: "Radiology" },
  { value: "general", label: "General stores" },
  { value: "dietary", label: "Dietary / F&B" },
  { value: "it", label: "IT equipment" },
  { value: "housekeeping", label: "Housekeeping" },
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
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(() => inferCode(initialName));
  const [vendorType, setVendorType] = useState("supplier");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [isPharmacyVendor, setIsPharmacyVendor] = useState(false);
  const [drugLicenseNumber, setDrugLicenseNumber] = useState("");

  const requiresDrugLicense = isPharmacyVendor || categories.includes("pharmacy");

  const mutation = useMutation({
    mutationFn: () =>
      api.createVendor({
        code: code.trim(),
        name: name.trim(),
        vendor_type: vendorType,
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gst_number: gstNumber.trim() || undefined,
        supply_categories: categories.length > 0 ? categories : undefined,
        is_pharmacy_vendor: isPharmacyVendor || undefined,
        drug_license_number: drugLicenseNumber.trim() || undefined,
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
    name.trim().length >= 2 &&
    code.trim().length >= 2 &&
    (!requiresDrugLicense || drugLicenseNumber.trim().length > 0);

  return (
    <Stack gap="sm">
      <TextInput
        label="Vendor name"
        required
        value={name}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setName(next);
          if (!code || code === inferCode(name)) {
            setCode(inferCode(next));
          }
        }}
      />
      <Group grow align="flex-start">
        <TextInput
          label="Code"
          required
          value={code}
          onChange={(event) => setCode(event.currentTarget.value.toUpperCase())}
        />
        <Select
          allowDeselect={false}
          data={[
            { value: "supplier", label: "Supplier" },
            { value: "manufacturer", label: "Manufacturer" },
            { value: "distributor", label: "Distributor" },
            { value: "importer", label: "Importer" },
          ]}
          label="Type"
          value={vendorType}
          onChange={(value) => setVendorType(value ?? "supplier")}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label="Contact person"
          value={contactPerson}
          onChange={(event) => setContactPerson(event.currentTarget.value)}
        />
        <TextInput
          label="Phone"
          value={phone}
          onChange={(event) => setPhone(event.currentTarget.value)}
        />
      </Group>
      <Group grow align="flex-start">
        <TextInput
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
        <TextInput
          label="GST number"
          value={gstNumber}
          onChange={(event) => setGstNumber(event.currentTarget.value)}
        />
      </Group>
      <MultiSelect
        clearable
        data={supplyCategories}
        label="Supply categories"
        searchable
        value={categories}
        onChange={setCategories}
      />
      <Checkbox
        checked={isPharmacyVendor}
        label="Pharmacy vendor"
        onChange={(event) => setIsPharmacyVendor(event.currentTarget.checked)}
      />
      {requiresDrugLicense && (
        <TextInput
          label="Drug license number"
          required
          value={drugLicenseNumber}
          onChange={(event) => setDrugLicenseNumber(event.currentTarget.value)}
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
          onClick={() => mutation.mutate()}
        >
          Add & select
        </Button>
      </Group>
    </Stack>
  );
}
