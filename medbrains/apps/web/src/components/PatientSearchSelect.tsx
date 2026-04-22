import { useState } from "react";
import { Combobox, Group, InputBase, Text, useCombobox } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { Patient } from "@medbrains/types";

interface PatientSearchSelectProps {
  value: string;
  onChange: (patientId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  error?: string;
}

function formatAge(dob: string | null): string {
  if (!dob) return "";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  if (years < 1) {
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
    return `${months}mo`;
  }
  return `${years}y`;
}

function genderShort(g: string): string {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return g.charAt(0).toUpperCase();
}

export function PatientSearchSelect({
  value,
  onChange,
  label = "Patient",
  placeholder = "Search by name, UHID, or phone...",
  required,
  size = "sm",
  error,
}: PatientSearchSelectProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [search, setSearch] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [debounced] = useDebouncedValue(search, 300);

  const { data } = useQuery({
    queryKey: ["patient-search", debounced],
    queryFn: () => api.listPatients({ search: debounced, per_page: 15 }),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const patients = data?.patients ?? [];

  const handleSelect = (patientId: string) => {
    const patient = patients.find((p: Patient) => p.id === patientId);
    if (patient) {
      onChange(patient.id);
      const display = `${patient.first_name} ${patient.last_name} (${patient.uhid})`;
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
          {patients.length > 0 ? (
            patients.map((p: Patient) => (
              <Combobox.Option key={p.id} value={p.id}>
                <Group gap={8} wrap="nowrap">
                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>
                      {p.first_name} {p.last_name}
                    </Text>
                    <Group gap={6}>
                      <Text size="xs" c="primary" fw={600}>{p.uhid}</Text>
                      {p.date_of_birth && (
                        <Text size="xs" c="dimmed">{formatAge(p.date_of_birth)} · {genderShort(p.gender)}</Text>
                      )}
                      {p.phone && (
                        <Text size="xs" c="dimmed">{p.phone}</Text>
                      )}
                    </Group>
                  </div>
                </Group>
              </Combobox.Option>
            ))
          ) : debounced.length >= 2 ? (
            <Combobox.Empty>No patients found</Combobox.Empty>
          ) : (
            <Combobox.Empty>Type at least 2 characters...</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
