import type { DepartmentRow } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { patientsService } from "@/services/patients.service";

/** A department as a picker option. */
interface DepartmentOption {
  value: string;
  label: string;
}

/**
 * The active departments registration can file a patient under, as picker options, and the
 * message to show when the look-up failed: a failed look-up must read as a fault, not as a
 * hospital with no departments.
 */
export function useRegistrationDepartments(): {
  options: DepartmentOption[];
  unavailable: string | undefined;
} {
  const { t } = useTranslation("patients");
  const query = useQuery<DepartmentRow[]>({
    queryKey: ["setup-departments"],
    queryFn: () => patientsService.listDepartments(),
    staleTime: 5 * 60 * 1000,
  });
  const { data, isError } = query;
  const options = useMemo(
    () =>
      data
        ? data
            .filter((department) => department.is_active)
            .map((department) => ({
              value: department.id,
              label: `${department.name} (${department.code})`,
            }))
        : [],
    [data],
  );
  return {
    options,
    unavailable: isError ? t("registrationForm.departmentsUnavailable") : undefined,
  };
}
