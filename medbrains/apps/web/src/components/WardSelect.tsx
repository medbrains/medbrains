import { useMemo } from "react";
import { Select } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { WardListRow } from "@medbrains/types";

interface WardSelectProps {
  value: string;
  onChange: (wardId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  clearable?: boolean;
  error?: string;
}

export function WardSelect({
  value,
  onChange,
  label = "Ward",
  placeholder = "Select ward...",
  required,
  size = "sm",
  clearable = true,
  error,
}: WardSelectProps) {
  const { data: wards = [] } = useQuery({
    queryKey: ["wards-list"],
    queryFn: () => api.listWards(),
    staleTime: 300_000,
  });

  const options = useMemo(
    () =>
      wards
        .filter((w: WardListRow) => w.is_active)
        .map((w: WardListRow) => ({
          value: w.id,
          label: `${w.name} (${w.ward_type})`,
        })),
    [wards],
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
      nothingFoundMessage="No wards found"
    />
  );
}
