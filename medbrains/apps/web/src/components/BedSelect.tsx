import { useMemo } from "react";
import { Select } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { AvailableBed } from "@medbrains/types";

interface BedSelectProps {
  value: string;
  onChange: (bedId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  clearable?: boolean;
  error?: string;
  wardId?: string;
}

export function BedSelect({
  value,
  onChange,
  label = "Bed",
  placeholder = "Select available bed...",
  required,
  size = "sm",
  clearable = true,
  error,
  wardId,
}: BedSelectProps) {
  const { data: beds = [] } = useQuery({
    queryKey: ["available-beds", wardId],
    queryFn: () => api.listAvailableBeds(wardId ? { ward_id: wardId } : undefined),
    staleTime: 30_000,
  });

  const options = useMemo(
    () =>
      beds.map((b: AvailableBed) => ({
        value: b.bed_id,
        label: b.ward_name
          ? `${b.bed_number} \u2014 ${b.ward_name}`
          : b.bed_number,
      })),
    [beds],
  );

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
      error={error}
      nothingFoundMessage="No available beds"
    />
  );
}
