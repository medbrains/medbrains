import { Select } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { SetupUser } from "@medbrains/types";

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
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => api.listDoctors(),
    staleTime: 300_000,
  });

  const options = doctors.map((d: SetupUser) => ({
    value: d.id,
    label: `Dr. ${d.full_name}${d.specialization ? ` — ${d.specialization}` : ""}`,
  }));

  return (
    <Select
      label={label}
      placeholder={placeholder}
      data={options}
      value={value || null}
      onChange={(v) => onChange(v ?? "")}
      searchable
      clearable={clearable}
      required={required}
      size={size}
      nothingFoundMessage="No doctors found"
    />
  );
}
