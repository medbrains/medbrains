import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type SetupUser } from "@medbrains/types";
import { IconPlus, IconStethoscope } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { searchErrorText } from "@/lib/search-error";
import { lookupsService } from "@/services/lookups.service";
import { MiniCreateDoctor } from "./admin/MiniCreateDoctor";
import { SearchOrCreate } from "./SearchOrCreate";

interface DoctorSearchSelectProps {
  value: string;
  onChange: (doctorId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  size?: string;
  clearable?: boolean;
  error?: string;
  departmentIds?: string[];
  doctorIds?: string[];
}

function doctorLabel(doctor: SetupUser): string {
  return `Dr. ${doctor.full_name}${doctor.specialization ? ` — ${doctor.specialization}` : ""}`;
}

/** People type "Dr Rao" — the honorific is not part of anyone's name. */
function doctorNeedle(search: string): string {
  return search
    .trim()
    .toLowerCase()
    .replace(/^dr\.?\s*/, "");
}

function doctorHaystack(doctor: SetupUser): string {
  return [doctor.full_name, doctor.email, doctor.specialization, doctor.medical_registration_number]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function DoctorSearchSelect({
  value,
  onChange,
  label = "Doctor",
  placeholder = "Select doctor...",
  required,
  disabled,
  size = "sm",
  clearable = true,
  error,
  departmentIds = [],
  doctorIds = [],
}: DoctorSearchSelectProps) {
  const [search, setSearch] = useState("");
  const canCreate = useHasPermission(P.ADMIN.USERS.CREATE);

  const {
    data: doctors = [],
    isLoading,
    error: listError,
  } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => lookupsService.listDoctors(),
    staleTime: 300_000,
  });

  const activeDoctors = useMemo(
    () => doctors.filter((doctor: SetupUser) => doctor.is_active),
    [doctors],
  );
  const scopedDoctors = useMemo(() => {
    if (doctorIds.length > 0) {
      return activeDoctors.filter((doctor) => doctorIds.includes(doctor.id));
    }

    if (departmentIds.length === 0) {
      return activeDoctors;
    }

    const departmentDoctors = activeDoctors.filter((doctor) =>
      doctor.department_ids.some((departmentId) => departmentIds.includes(departmentId)),
    );

    return departmentDoctors.length > 0 ? departmentDoctors : activeDoctors;
  }, [activeDoctors, departmentIds, doctorIds]);
  const selectedDoctor = activeDoctors.find((doctor) => doctor.id === value);
  const selectedLabel = selectedDoctor ? doctorLabel(selectedDoctor) : undefined;
  const visibleDoctors = useMemo(() => {
    // The box holds the picked doctor's label after a pick; reopening it must
    // list everyone again, not filter on that label and find nobody.
    const needle = search === selectedLabel ? "" : doctorNeedle(search);
    if (!needle) {
      return scopedDoctors;
    }
    return scopedDoctors.filter((doctor) => doctorHaystack(doctor).includes(needle));
  }, [scopedDoctors, search, selectedLabel]);

  return (
    <SearchOrCreate<SetupUser>
      label={label}
      placeholder={placeholder}
      value={value}
      selectedDisplay={selectedLabel}
      items={visibleDoctors}
      getItemValue={(doctor) => doctor.id}
      getItemDisplay={doctorLabel}
      loading={isLoading}
      fetchError={searchErrorText(listError, "doctors")}
      renderItem={(doctor) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            Dr. {doctor.full_name}
          </Text>
          <Text size="xs" c="dimmed">
            {doctor.specialization ?? doctor.role}
            {doctor.medical_registration_number ? ` · ${doctor.medical_registration_number}` : ""}
          </Text>
        </Stack>
      )}
      onSelect={(doctor) => onChange(doctor.id)}
      onClear={() => {
        if (clearable) {
          onChange("");
        }
      }}
      searchText={search}
      onSearchChange={setSearch}
      minSearchLength={0}
      required={required}
      disabled={disabled}
      size={size}
      error={error}
      leftSection={<IconStethoscope size={14} />}
      emptyLabel="No doctors found"
      typeToSearchLabel="No doctors found"
      canCreate={canCreate}
      createButtonIcon={<IconPlus size={14} />}
      createButtonLabel="Create doctor"
      createModalTitle="Create doctor"
      createModalSize="xl"
      renderCreateForm={({ searchText, close, selectItem }) => (
        <MiniCreateDoctor searchText={searchText} onCancel={close} onCreated={selectItem} />
      )}
    />
  );
}
