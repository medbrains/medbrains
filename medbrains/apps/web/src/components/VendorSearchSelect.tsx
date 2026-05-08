import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P, type Vendor } from "@medbrains/types";
import { IconPlus, IconTruck } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MiniAddVendor } from "./Procurement/MiniAddVendor";
import { SearchOrCreate } from "./SearchOrCreate";

interface VendorSearchSelectProps {
  value: string;
  onChange: (vendorId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  clearable?: boolean;
  error?: string;
  activeOnly?: boolean;
}

export function VendorSearchSelect({
  value,
  onChange,
  label = "Vendor",
  placeholder = "Search vendor...",
  required,
  size = "sm",
  clearable = true,
  error,
  activeOnly = true,
}: VendorSearchSelectProps) {
  const [search, setSearch] = useState("");
  const canCreate = useHasPermission(P.PROCUREMENT.VENDORS_CREATE);

  const { data: vendors = [] } = useQuery({
    queryKey: ["procurement", "vendors", activeOnly ? "active" : "all"],
    queryFn: () => api.listVendors(activeOnly ? { status: "active" } : undefined),
    staleTime: 300_000,
  });

  const selectedVendor = vendors.find((vendor: Vendor) => vendor.id === value);
  const visibleVendors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return vendors;
    }

    return vendors.filter(
      (vendor: Vendor) =>
        vendor.name.toLowerCase().includes(needle) ||
        vendor.code.toLowerCase().includes(needle) ||
        (vendor.gst_number ?? "").toLowerCase().includes(needle) ||
        (vendor.drug_license_number ?? "").toLowerCase().includes(needle),
    );
  }, [vendors, search]);

  return (
    <SearchOrCreate<Vendor>
      label={label}
      placeholder={placeholder}
      value={value}
      selectedDisplay={
        selectedVendor ? `${selectedVendor.code} - ${selectedVendor.name}` : undefined
      }
      items={visibleVendors}
      getItemValue={(vendor) => vendor.id}
      getItemDisplay={(vendor) => `${vendor.code} - ${vendor.name}`}
      renderItem={(vendor) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {vendor.name}
          </Text>
          <Text size="xs" c="dimmed">
            {vendor.code} · {vendor.vendor_type}
            {vendor.drug_license_number ? ` · DL ${vendor.drug_license_number}` : ""}
          </Text>
        </Stack>
      )}
      onSelect={(vendor) => onChange(vendor.id)}
      onClear={() => {
        if (clearable) {
          onChange("");
        }
      }}
      searchText={search}
      onSearchChange={setSearch}
      minSearchLength={0}
      required={required}
      size={size}
      error={error}
      leftSection={<IconTruck size={14} />}
      emptyLabel="No vendors found"
      typeToSearchLabel="No vendors found"
      canCreate={canCreate}
      createButtonIcon={<IconPlus size={14} />}
      createButtonLabel="Add vendor"
      createModalTitle="Add vendor"
      createModalSize="xl"
      renderCreateForm={({ searchText, close, selectItem }) => (
        <MiniAddVendor searchText={searchText} onCancel={close} onCreated={selectItem} />
      )}
    />
  );
}
