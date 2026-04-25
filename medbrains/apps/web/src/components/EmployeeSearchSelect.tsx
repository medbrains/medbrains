import { useState } from "react";
import { Combobox, Group, InputBase, Text, Badge, useCombobox } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { Employee } from "@medbrains/types";

interface EmployeeSearchSelectProps {
  value: string;
  onChange: (employeeId: string, employee?: Employee) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  error?: string;
  excludeIds?: string[];
}

function formatEmployeeName(e: Employee): string {
  return e.last_name ? `${e.first_name} ${e.last_name}` : e.first_name;
}

export function EmployeeSearchSelect({
  value,
  onChange,
  label = "Employee",
  placeholder = "Search by name or employee code...",
  required,
  size = "sm",
  error,
  excludeIds,
}: EmployeeSearchSelectProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [search, setSearch] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [debounced] = useDebouncedValue(search, 300);

  const { data } = useQuery({
    queryKey: ["employee-search", debounced],
    queryFn: () => api.listEmployees({ search: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const employees = (data ?? []).filter(
    (e: Employee) => !excludeIds?.includes(e.id),
  );

  const handleSelect = (employeeId: string) => {
    const emp = employees.find((e: Employee) => e.id === employeeId);
    if (emp) {
      onChange(emp.id, emp);
      const display = `${formatEmployeeName(emp)} (${emp.employee_code})`;
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
          leftSection={<IconSearch size={14} />}
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
          {employees.length > 0 ? (
            employees.slice(0, 15).map((e: Employee) => (
              <Combobox.Option key={e.id} value={e.id}>
                <Group gap={8} wrap="nowrap" justify="space-between">
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>{formatEmployeeName(e)}</Text>
                    <Group gap={6}>
                      <Text size="xs" c="primary" fw={600}>{e.employee_code}</Text>
                      {e.status && (
                        <Badge size="xs" variant="light" color={e.status === "active" ? "green" : "gray"}>
                          {e.status}
                        </Badge>
                      )}
                    </Group>
                  </div>
                </Group>
              </Combobox.Option>
            ))
          ) : debounced.length >= 2 ? (
            <Combobox.Empty>No employees found</Combobox.Empty>
          ) : (
            <Combobox.Empty>Type at least 2 characters...</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
