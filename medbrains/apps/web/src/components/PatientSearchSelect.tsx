import { Box, Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { PatientSearchBy } from "@medbrains/types";
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS, PATIENT_UHID_FIELD_ACCESS_KEY } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconSearch, IconUserPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchErrorText } from "@/lib/search-error";
import { lookupsService } from "@/services/lookups.service";
import { MiniRegisterPatient } from "./Patient/MiniRegisterPatient";
import { patientSearchMinChars, usePatientSearchBy } from "./Patient/PatientSearchBox";
import { PatientSearchBySelect, SEARCH_BY } from "./Patient/PatientSearchBySelect";
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
  /** What the search box starts with, e.g. a name the patient shared. */
  initialSearch?: string;
  /** Offer "Register new patient" (default: when the caller may create). */
  allowCreate?: boolean;
  /** Put the patient list's "Search by" choice in front (e.g. the OPD visit form). */
  withSearchBy?: boolean;
}

/** What both lookups return and all this picker ever renders: identity. */
interface PickerPatient {
  id: string;
  uhid: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  phone: string;
  gender: string;
}

/** Age as the picker shows it: months under a year, else years. */
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

/** One-letter sex for the picker row. */
function genderShort(g: string): string {
  if (g === "male") return "M";
  if (g === "female") return "F";
  return g.charAt(0).toUpperCase();
}

/**
 * The picker's lookup for `search` on field `by`: the hospital-wide
 * `patients.find` when held, else the caller's own `patients.list`; nothing
 * is fetched below the field's minimum or without either code.
 */
function usePickerLookup(search: string, by: PatientSearchBy) {
  const [debounced] = useDebouncedValue(search, 300);
  const canListPatients = useHasPermission(P.PATIENTS.LIST);
  // `patients.list` is relationship-scoped: it reaches the patients this user
  // already has something to do with. A desk picking a returning patient needs
  // the hospital, not its own history, so prefer the wide lookup when the
  // caller holds the code for it. Same fields either way — this picker only
  // ever shows identity.
  const canFindPatients = useHasPermission(P.PATIENTS.FIND);
  const canSearch = canFindPatients || canListPatients;
  const query = debounced.trim();
  // Names: three characters for the hospital-wide lookup (the server's floor),
  // two for the scoped list. UHID / OPD number go from one, matched exactly.
  const nameFloor = canFindPatients ? 3 : 2;
  const { data, isFetching, error } = useQuery({
    queryKey: ["patient-search", canFindPatients, by, query],
    queryFn: async (): Promise<PickerPatient[]> =>
      canFindPatients
        ? await lookupsService.findPatients(query, by)
        : (await lookupsService.listPatients({ search: query, by, per_page: 15 })).patients,
    enabled: canSearch && query.length >= patientSearchMinChars(by, query, nameFloor),
    staleTime: 30_000,
  });
  return {
    data,
    searchError: error,
    isSearching: isFetching || search.trim() !== query,
    minChars: patientSearchMinChars(by, search.trim(), nameFloor),
    canFindPatients,
    canSearch,
  };
}

/**
 * Pick a patient by searching the hospital (`patients.find`) or, without that
 * code, the caller's own patients (`patients.list`). With `withSearchBy` the
 * desk picks the field; minimums per field come from `patientSearchMinChars`.
 */
export function PatientSearchSelect({
  value,
  onChange,
  label = "Patient",
  placeholder = "Search by name, phone, UHID or Aadhaar",
  required,
  size = "sm",
  error,
  selectedDisplay,
  excludeIds = [],
  initialSearch = "",
  allowCreate = true,
  withSearchBy = false,
}: PatientSearchSelectProps) {
  const [search, setSearch] = useState(initialSearch);
  const canCreatePatient = useHasPermission(P.PATIENTS.CREATE);
  const patientNameAccess = useProtectedFieldAccess(undefined, PATIENT_NAME_FIELD_ACCESS_KEYS);
  const uhidAccess = useProtectedFieldAccess(PATIENT_UHID_FIELD_ACCESS_KEY);
  const phoneAccess = useProtectedFieldAccess("patients.phone");
  const dobAccess = useProtectedFieldAccess("patients.date_of_birth");
  const searchBy = usePatientSearchBy();
  // Without the selector the picker always searches every field, whatever the
  // desk last chose on another screen.
  const by = withSearchBy ? searchBy.by : "all";
  const { data, searchError, isSearching, minChars, canFindPatients, canSearch } = usePickerLookup(
    search,
    by,
  );

  const patients = (data ?? []).filter((patient) => !excludeIds.includes(patient.id));
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

  const byPlaceholder = SEARCH_BY.find((o) => o.value === by)?.placeholder ?? placeholder;
  const picker = (
    <SearchOrCreate
      value={value}
      label={label}
      placeholder={withSearchBy ? byPlaceholder : placeholder}
      required={required}
      size={size}
      error={error}
      leftSection={<IconSearch size={14} />}
      items={patients}
      searchText={search}
      onSearchChange={setSearch}
      minSearchLength={minChars}
      loading={isSearching}
      fetchError={
        canSearch
          ? searchErrorText(searchError, "patients")
          : "You don't have access to search patients. Ask an administrator for patients.find."
      }
      getItemValue={(patient) => patient.id}
      getItemDisplay={patientDisplay}
      selectedDisplay={selectedDisplay}
      onSelect={(patient) => onChange(patient.id)}
      onClear={() => onChange("")}
      emptyLabel={
        canFindPatients
          ? "No patient in the hospital by that name, UHID or phone"
          : "No patients found among yours — a colleague's registration needs patients.find"
      }
      canCreate={allowCreate && canCreatePatient}
      createButtonLabel="Register new patient"
      createButtonIcon={<IconUserPlus size={14} />}
      createModalTitle="Register new patient"
      renderItem={(p) => (
        <Group gap={8} wrap="nowrap">
          <Box flex={1}>
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
          </Box>
        </Group>
      )}
      renderCreateForm={({ searchText, close, selectItem }) => (
        <MiniRegisterPatient searchText={searchText} onCancel={close} onCreated={selectItem} />
      )}
    />
  );
  if (!withSearchBy) return picker;
  return (
    <Group gap={4} wrap="nowrap" align="flex-end">
      <PatientSearchBySelect
        by={by}
        onByChange={searchBy.setBy}
        opdOn={searchBy.opdOn}
        settingsFailed={searchBy.settingsFailed}
        size={size}
      />
      <Box flex={1}>{picker}</Box>
    </Group>
  );
}
