import type { DepartmentRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { patientsService } from "@/services/patients.service";

/** The active departments registration can file a patient under, as picker options. */
export function useRegistrationDepartments() {
  const { data: departments = [] } = useQuery<DepartmentRow[]>({
    queryKey: ["setup-departments"],
    queryFn: () => patientsService.listDepartments(),
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(
    () =>
      departments
        .filter((department) => department.is_active)
        .map((department) => ({
          value: department.id,
          label: `${department.name} (${department.code})`,
        })),
    [departments],
  );
}
