import { useMemo } from "react";
import { Select } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import type { DepartmentRow } from "@medbrains/types";

interface DepartmentSelectProps {
  value: string;
  onChange: (departmentId: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  size?: string;
  clearable?: boolean;
  error?: string;
  departmentType?: "clinical" | "para_clinical" | "administrative" | "support";
}

export function DepartmentSelect({
  value,
  onChange,
  label = "Department",
  placeholder = "Select department...",
  required,
  size = "sm",
  clearable = true,
  error,
  departmentType,
}: DepartmentSelectProps) {
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: () => api.listDepartments(),
    staleTime: 300_000,
  });

  const options = useMemo(() => {
    const filtered = departmentType
      ? departments.filter((d: DepartmentRow) => d.department_type === departmentType)
      : departments;

    return filtered
      .filter((d: DepartmentRow) => d.is_active)
      .map((d: DepartmentRow) => ({
        value: d.id,
        label: d.name,
      }));
  }, [departments, departmentType]);

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
      nothingFoundMessage="No departments found"
    />
  );
}
