import type { DepartmentRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { opdService } from "@/services/opd.service";

/** The active clinical and para-clinical departments an OPD visit can be booked into, as picker options. */
export function useOpdDepartmentOptions() {
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });
  return (departments as DepartmentRow[])
    .filter(
      (department) =>
        department.is_active &&
        ["clinical", "para_clinical"].includes(department.department_type ?? ""),
    )
    .map((department) => ({ value: department.id, label: department.name }));
}
