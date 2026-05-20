import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type SetupUser } from "@medbrains/types";
import { IconPlus, IconStethoscope } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { lookupsService } from "../services/lookups.service";
import { MiniCreateDoctor } from "./admin/MiniCreateDoctor";
import { SearchOrCreate } from "./SearchOrCreate";

interface DoctorSearchSelectProps {
  value: string;
  onChange: (doctorId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  clearable?: boolean;
}

export function DoctorSearchSelect({
  value,
  onChange,
  label = "Doctor",
  placeholder = "Select doctor...",
  required,
  size = "sm",
  clearable = true,
}: DoctorSearchSelectProps) {
  const [search, setSearch] = useState("");
  const canCreate = useHasPermission(P.ADMIN.USERS.CREATE);

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => lookupsService.listDoctors(),
    staleTime: 300_000,
  });

  const activeDoctors = useMemo(
    () => doctors.filter((doctor: SetupUser) => doctor.is_active),
    [doctors],
  );
  const selectedDoctor = activeDoctors.find((doctor) => doctor.id === value);
  const visibleDoctors = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return activeDoctors;
    }

    return activeDoctors.filter(
      (doctor) =>
        doctor.full_name.toLowerCase().includes(needle) ||
        doctor.email.toLowerCase().includes(needle) ||
        (doctor.specialization ?? "").toLowerCase().includes(needle),
    );
  }, [activeDoctors, search]);

  return (
    <SearchOrCreate<SetupUser>
      label={label}
      placeholder={placeholder}
      value={value}
      selectedDisplay={
        selectedDoctor
          ? `Dr. ${selectedDoctor.full_name}${
              selectedDoctor.specialization ? ` — ${selectedDoctor.specialization}` : ""
            }`
          : undefined
      }
      items={visibleDoctors}
      getItemValue={(doctor) => doctor.id}
      getItemDisplay={(doctor) =>
        `Dr. ${doctor.full_name}${doctor.specialization ? ` — ${doctor.specialization}` : ""}`
      }
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
      size={size}
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
