import { Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconSearch, IconUserPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { lookupsService } from "../services/lookups.service";
import { MiniRegisterPatient } from "./Patient/MiniRegisterPatient";
import { useProtectedFieldAccess } from "./PermissionedFieldValue";
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
  const patientNameAccess = useProtectedFieldAccess(undefined, [
    "patients.first_name",
    "patients.last_name",
  ]);
  const uhidAccess = useProtectedFieldAccess("patients.uhid");
  const phoneAccess = useProtectedFieldAccess("patients.phone");
  const dobAccess = useProtectedFieldAccess("patients.date_of_birth");

  const { data } = useQuery({
    queryKey: ["patient-search", debounced],
    queryFn: () => lookupsService.listPatients({ search: debounced, per_page: 15 }),
    enabled: canListPatients && debounced.length >= 2,
    staleTime: 30_000,
  });

  const patients = (data?.patients ?? []).filter((patient) => !excludeIds.includes(patient.id));
  const patientDisplay = (patient: (typeof patients)[number]) => {
    const name =
      fieldAccessText(
        patientNameAccess,
        `${patient.first_name} ${patient.last_name}`.trim(),
        "name",
      ) || "Patient";
    const uhid = fieldAccessText(uhidAccess, patient.uhid, "identifier");
    return `${name} (${uhid})`;
  };

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
      getItemDisplay={patientDisplay}
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
              {fieldAccessText(patientNameAccess, `${p.first_name} ${p.last_name}`.trim(), "name")}
            </Text>
            <Group gap={6}>
              <Text size="xs" c="primary" fw={600}>
                {fieldAccessText(uhidAccess, p.uhid, "identifier")}
              </Text>
              {p.date_of_birth && (dobAccess === "edit" || dobAccess === "view") && (
                <Text size="xs" c="dimmed">
                  {formatAge(p.date_of_birth)} - {genderShort(p.gender)}
                </Text>
              )}
              {p.phone && (
                <Text size="xs" c="dimmed">
                  {fieldAccessText(phoneAccess, p.phone, "phone")}
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
