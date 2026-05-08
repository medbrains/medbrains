import { Badge, Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P, type PharmacyCatalog } from "@medbrains/types";
import { IconPill } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MiniAddDrug } from "./Pharmacy/MiniAddDrug";
import { SearchOrCreate } from "./SearchOrCreate";

interface DrugSearchSelectProps {
  value: string;
  onChange: (drugId: string, drug?: PharmacyCatalog) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  error?: string;
}

const SCHEDULE_COLORS: Record<string, string> = {
  H: "orange",
  H1: "warning",
  X: "danger",
  G: "teal",
  OTC: "success",
  NDPS: "danger",
};

export function DrugSearchSelect({
  value,
  onChange,
  label = "Drug",
  placeholder = "Search by drug name, generic name, or code...",
  required,
  size = "sm",
  error,
}: DrugSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const canCreateDrug = useHasPermission(P.PHARMACY.STOCK_MANAGE);

  const { data } = useQuery({
    queryKey: ["drug-search", debounced],
    queryFn: () => api.listPharmacyCatalog({ search: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const drugs = data ?? [];

  return (
    <SearchOrCreate
      value={value}
      label={label}
      placeholder={placeholder}
      required={required}
      size={size}
      error={error}
      leftSection={<IconPill size={14} />}
      items={drugs.slice(0, 15)}
      searchText={search}
      onSearchChange={setSearch}
      getItemValue={(drug) => drug.id}
      getItemDisplay={(drug) => `${drug.name} (${drug.generic_name || drug.code})`}
      onSelect={(drug) => onChange(drug.id, drug)}
      onClear={() => onChange("")}
      emptyLabel="No drugs found"
      canCreate={canCreateDrug}
      createButtonLabel="Add to formulary"
      createButtonIcon={<IconPill size={14} />}
      createModalTitle="Add drug to formulary"
      renderItem={(d) => (
        <Group gap={8} wrap="nowrap" justify="space-between">
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              {d.name}
            </Text>
            <Group gap={6}>
              <Text size="xs" c="dimmed">
                {d.generic_name || d.code}
              </Text>
              {d.manufacturer && (
                <Text size="xs" c="dimmed">
                  - {d.manufacturer}
                </Text>
              )}
            </Group>
          </div>
          <Group gap={4}>
            {d.drug_schedule && (
              <Badge size="xs" variant="light" color={SCHEDULE_COLORS[d.drug_schedule] ?? "gray"}>
                {d.drug_schedule}
              </Badge>
            )}
            <Text size="xs" fw={600} c="primary">
              {"\u20B9"}
              {d.base_price}
            </Text>
            <Text
              size="xs"
              c={Number(d.current_stock) <= Number(d.reorder_level) ? "danger" : "dimmed"}
            >
              Stock: {d.current_stock}
            </Text>
          </Group>
        </Group>
      )}
      renderCreateForm={({ searchText, close, selectItem }) => (
        <MiniAddDrug searchText={searchText} onCancel={close} onCreated={selectItem} />
      )}
    />
  );
}
