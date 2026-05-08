import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { type DepartmentRow, P } from "@medbrains/types";
import { IconBuilding, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MiniAddDepartment } from "./admin/MiniAddDepartment";
import { SearchOrCreate } from "./SearchOrCreate";

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
  const [search, setSearch] = useState("");
  const canCreate = useHasPermission(P.ADMIN.SETTINGS.DEPARTMENTS.CREATE);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-list"],
    queryFn: () => api.listDepartments(),
    staleTime: 300_000,
  });

  const availableDepartments = useMemo(() => {
    const filtered = departmentType
      ? departments.filter((d: DepartmentRow) => d.department_type === departmentType)
      : departments;

    return filtered.filter((d: DepartmentRow) => d.is_active);
  }, [departments, departmentType]);

  const selectedDepartment = availableDepartments.find((department) => department.id === value);
  const visibleDepartments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return availableDepartments;
    }

    return availableDepartments.filter(
      (department) =>
        department.name.toLowerCase().includes(needle) ||
        department.code.toLowerCase().includes(needle),
    );
  }, [availableDepartments, search]);

  return (
    <SearchOrCreate<DepartmentRow>
      label={label}
      placeholder={placeholder}
      value={value}
      selectedDisplay={selectedDepartment?.name}
      items={visibleDepartments}
      getItemValue={(department) => department.id}
      getItemDisplay={(department) => department.name}
      renderItem={(department) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {department.name}
          </Text>
          <Text size="xs" c="dimmed">
            {department.code} · {department.department_type}
          </Text>
        </Stack>
      )}
      onSelect={(department) => onChange(department.id)}
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
      error={error}
      leftSection={<IconBuilding size={14} />}
      emptyLabel="No departments found"
      typeToSearchLabel="No departments found"
      canCreate={canCreate}
      createButtonIcon={<IconPlus size={14} />}
      createButtonLabel="Add department"
      createModalTitle="Add department"
      renderCreateForm={({ searchText, close, selectItem }) => (
        <MiniAddDepartment
          searchText={searchText}
          departmentType={departmentType}
          onCancel={close}
          onCreated={selectItem}
        />
      )}
    />
  );
}
