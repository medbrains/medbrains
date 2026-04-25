import { useState } from "react";
import { Combobox, Group, InputBase, Text, useCombobox } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconMicroscope } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { LabTestCatalog } from "@medbrains/types";

interface LabTestSearchSelectProps {
  value: string;
  onChange: (testId: string, test?: LabTestCatalog) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  error?: string;
}

export function LabTestSearchSelect({
  value,
  onChange,
  label = "Lab Test",
  placeholder = "Search by test name, code, or LOINC...",
  required,
  size = "sm",
  error,
}: LabTestSearchSelectProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [search, setSearch] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [debounced] = useDebouncedValue(search, 300);

  const { data } = useQuery({
    queryKey: ["lab-test-search", debounced],
    queryFn: () => api.listLabCatalog({ search: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const tests = data ?? [];

  const handleSelect = (testId: string) => {
    const test = tests.find((t: LabTestCatalog) => t.id === testId);
    if (test) {
      onChange(test.id, test);
      const display = `${test.name} (${test.code})`;
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
          leftSection={<IconMicroscope size={14} />}
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
          {tests.length > 0 ? (
            tests.slice(0, 15).map((t: LabTestCatalog) => (
              <Combobox.Option key={t.id} value={t.id}>
                <Group gap={8} wrap="nowrap" justify="space-between">
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>{t.name}</Text>
                    <Group gap={6}>
                      <Text size="xs" c="primary" fw={600}>{t.code}</Text>
                      {t.loinc_code && (
                        <Text size="xs" c="dimmed">LOINC: {t.loinc_code}</Text>
                      )}
                    </Group>
                  </div>
                  <Text size="xs" fw={600} c="primary">
                    {"\u20B9"}{t.price}
                  </Text>
                </Group>
              </Combobox.Option>
            ))
          ) : debounced.length >= 2 ? (
            <Combobox.Empty>No tests found</Combobox.Empty>
          ) : (
            <Combobox.Empty>Type at least 2 characters...</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
