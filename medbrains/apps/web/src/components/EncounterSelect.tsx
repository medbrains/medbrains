import { useState } from "react";
import { Combobox, Badge, Group, InputBase, Text, useCombobox } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconStethoscope } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { PatientVisitRow } from "@medbrains/types";

interface EncounterSelectProps {
  value: string;
  onChange: (encounterId: string, encounter?: PatientVisitRow) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  error?: string;
  patientId?: string;
}

const ENCOUNTER_COLORS: Record<string, string> = {
  opd: "blue",
  ipd: "teal",
  emergency: "red",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function EncounterSelect({
  value,
  onChange,
  label = "Encounter",
  placeholder = "Search encounters...",
  required,
  size = "sm",
  error,
  patientId,
}: EncounterSelectProps) {
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const [search, setSearch] = useState("");
  const [displayValue, setDisplayValue] = useState("");
  const [debounced] = useDebouncedValue(search, 300);

  const { data } = useQuery({
    queryKey: ["encounter-search", patientId],
    queryFn: () => {
      if (!patientId) return Promise.resolve([]);
      return api.listPatientVisits(patientId);
    },
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });

  const encounters = (data ?? []).filter((e: PatientVisitRow) => {
    if (!debounced || debounced.length < 2) return true;
    const term = debounced.toLowerCase();
    return (
      e.encounter_type.toLowerCase().includes(term) ||
      (e.doctor_name?.toLowerCase().includes(term) ?? false) ||
      (e.department_name?.toLowerCase().includes(term) ?? false) ||
      (e.chief_complaint?.toLowerCase().includes(term) ?? false) ||
      formatDate(e.encounter_date).toLowerCase().includes(term)
    );
  });

  const handleSelect = (encounterId: string) => {
    const enc = encounters.find((e: PatientVisitRow) => e.id === encounterId);
    if (enc) {
      onChange(enc.id, enc);
      const display = `${formatDate(enc.encounter_date)} \u2014 ${enc.encounter_type.toUpperCase()}${enc.doctor_name ? ` \u2014 ${enc.doctor_name}` : ""}`;
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
          placeholder={patientId ? placeholder : "Select a patient first..."}
          required={required}
          size={size}
          error={error}
          disabled={!patientId}
          leftSection={<IconStethoscope size={14} />}
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
          onFocus={() => combobox.openDropdown()}
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
          {encounters.length > 0 ? (
            encounters.slice(0, 20).map((e: PatientVisitRow) => (
              <Combobox.Option key={e.id} value={e.id}>
                <Group gap={8} wrap="nowrap" justify="space-between">
                  <div style={{ flex: 1 }}>
                    <Group gap={6}>
                      <Text size="sm" fw={500}>{formatDate(e.encounter_date)}</Text>
                      <Badge size="xs" variant="light" color={ENCOUNTER_COLORS[e.encounter_type] ?? "gray"}>
                        {e.encounter_type.toUpperCase()}
                      </Badge>
                      <Badge size="xs" variant="dot" color={e.status === "completed" ? "green" : "blue"}>
                        {e.status}
                      </Badge>
                    </Group>
                    <Group gap={6}>
                      {e.department_name && (
                        <Text size="xs" c="dimmed">{e.department_name}</Text>
                      )}
                      {e.doctor_name && (
                        <Text size="xs" c="dimmed">{"\u2022"} {e.doctor_name}</Text>
                      )}
                      {e.chief_complaint && (
                        <Text size="xs" c="dimmed" lineClamp={1}>{"\u2022"} {e.chief_complaint}</Text>
                      )}
                    </Group>
                  </div>
                </Group>
              </Combobox.Option>
            ))
          ) : patientId ? (
            <Combobox.Empty>No encounters found</Combobox.Empty>
          ) : (
            <Combobox.Empty>Select a patient first</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
