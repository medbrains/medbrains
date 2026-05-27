import { Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconSearch, IconUserPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { lookupsService } from "../services/lookups.service";
import { MiniRegisterPatient } from "./Patient/MiniRegisterPatient";
import { SearchOrCreate } from "./SearchOrCreate";

interface PatientSearchSelectProps {
  value: string;
  onChange: (patientId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  error?: string;
  selectedDisplay?: string;
  /** Patient IDs to exclude from results (e.g. current patient in merge) */
  excludeIds?: string[];
}

function formatAge(dob: string | null): string {
  if (!dob) return "";
  const birth = new Date(dob);
  const now = new Date();
  const years = now.getFullYear() - birth.getFullYear();
  if (years < 1) {
    const months =
      (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
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
  selectedDisplay,
  excludeIds = [],
}: PatientSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 300);
  const canListPatients = useHasPermission(P.PATIENTS.LIST);
  const canCreatePatient = useHasPermission(P.PATIENTS.CREATE);

  const { data } = useQuery({
    queryKey: ["patient-search", debounced],
    queryFn: () => lookupsService.listPatients({ search: debounced, per_page: 15 }),
    enabled: canListPatients && debounced.length >= 2,
    staleTime: 30_000,
  });

  const patients = (data?.patients ?? []).filter((patient) => !excludeIds.includes(patient.id));

  return (
    <SearchOrCreate
      value={value}
      label={label}
      placeholder={placeholder}
      required={required}
      size={size}
      error={error}
      leftSection={<IconSearch size={14} />}
      items={patients}
      searchText={search}
      onSearchChange={setSearch}
      getItemValue={(patient) => patient.id}
      getItemDisplay={(patient) => `${patient.first_name} ${patient.last_name} (${patient.uhid})`}
      selectedDisplay={selectedDisplay}
      onSelect={(patient) => onChange(patient.id)}
      onClear={() => onChange("")}
      emptyLabel={canListPatients ? "No patients found" : "Patient search restricted"}
      canCreate={canCreatePatient}
      createButtonLabel="Register new patient"
      createButtonIcon={<IconUserPlus size={14} />}
      createModalTitle="Register new patient"
      renderItem={(p) => (
        <Group gap={8} wrap="nowrap">
          <div style={{ flex: 1 }}>
            <Text size="sm" fw={500}>
              {p.first_name} {p.last_name}
            </Text>
            <Group gap={6}>
              <Text size="xs" c="primary" fw={600}>
                {p.uhid}
              </Text>
              {p.date_of_birth && (
                <Text size="xs" c="dimmed">
                  {formatAge(p.date_of_birth)} - {genderShort(p.gender)}
                </Text>
              )}
              {p.phone && (
                <Text size="xs" c="dimmed">
                  {p.phone}
                </Text>
              )}
            </Group>
          </div>
        </Group>
      )}
      renderCreateForm={({ searchText, close, selectItem }) => (
        <MiniRegisterPatient searchText={searchText} onCancel={close} onCreated={selectItem} />
      )}
    />
  );
}
