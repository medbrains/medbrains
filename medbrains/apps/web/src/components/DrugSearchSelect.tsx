import { useState } from "react";
import { Combobox, Group, InputBase, Text, Badge, useCombobox } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconPill } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { PharmacyCatalog } from "@medbrains/types";

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
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [search, setSearch] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [debounced] = useDebouncedValue(search, 300);

  const { data } = useQuery({
    queryKey: ["drug-search", debounced],
    queryFn: () => api.listPharmacyCatalog({ search: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const drugs = data ?? [];

  const handleSelect = (drugId: string) => {
    const drug = drugs.find((d: PharmacyCatalog) => d.id === drugId);
    if (drug) {
      onChange(drug.id, drug);
      const display = `${drug.name} (${drug.generic_name || drug.code})`;
      setDisplayValue(display);
      setSearch(display);
    }
    combobox.closeDropdown();
  };

  return (
    <Combobox store={combobox} onOptionSubmit={handleSelect}>
      <Combobox.Target>
        <InputBase
          label={label}
          placeholder={placeholder}
          required={required}
          size={size}
          error={error}
          leftSection={<IconPill size={14} />}
          value={search || displayValue}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setSearch(v);
            if (!v) {
              onChange("");
              setDisplayValue("");
            }
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
          }}
          onFocus={() => {
            if (search.length >= 2) combobox.openDropdown();
          }}
          onBlur={() => {
            combobox.closeDropdown();
            if (!value) setSearch("");
            else setSearch(displayValue);
          }}
          rightSectionPointerEvents="none"
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options>
          {drugs.length > 0 ? (
            drugs.slice(0, 15).map((d: PharmacyCatalog) => (
              <Combobox.Option key={d.id} value={d.id}>
                <Group gap={8} wrap="nowrap" justify="space-between">
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>{d.name}</Text>
                    <Group gap={6}>
                      <Text size="xs" c="dimmed">{d.generic_name || d.code}</Text>
                      {d.manufacturer && (
                        <Text size="xs" c="dimmed">- {d.manufacturer}</Text>
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
                      {"\u20B9"}{d.base_price}
                    </Text>
                    <Text size="xs" c={Number(d.current_stock) <= Number(d.reorder_level) ? "danger" : "dimmed"}>
                      Stock: {d.current_stock}
                    </Text>
                  </Group>
                </Group>
              </Combobox.Option>
            ))
          ) : debounced.length >= 2 ? (
            <Combobox.Empty>No drugs found</Combobox.Empty>
          ) : (
            <Combobox.Empty>Type at least 2 characters...</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
