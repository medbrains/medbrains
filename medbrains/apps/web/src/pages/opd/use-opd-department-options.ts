import type { DepartmentRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { opdService } from "@/services/opd.service";

/**
 * The active clinical and para-clinical departments an OPD visit can be booked into, as picker
 * options, and the message to show when the look-up failed: a failed look-up must read as a
 * fault, not as a hospital with no departments.
 */
export function useOpdDepartmentOptions(): {
  options: { value: string; label: string }[];
  unavailable: string | undefined;
} {
  const { data, isError } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });
  const options = data
    ? (data as DepartmentRow[])
        .filter(
          (department) =>
            department.is_active &&
            ["clinical", "para_clinical"].includes(department.department_type ?? ""),
        )
        .map((department) => ({ value: department.id, label: department.name }))
    : [];
  const unavailable = isError
    ? "Departments could not be loaded. Reload the page to try again."
    : undefined;
  return { options, unavailable };
}
