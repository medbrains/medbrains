import { useHasPermission, useLocaleConfig } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { completedYears, hospitalToday } from "@/lib/paediatric-vital-bands";
import { patientsService } from "@/services/patients.service";

/**
 * The patient's age in completed years on the hospital's date, for grading
 * vitals by age. A caller that already knows the age (a camp registration)
 * passes `knownAgeYears`; otherwise it is read from the patient's date of
 * birth. `null` means no age: no date of birth, no permission to read the
 * record, or the read failed — the recorder then grades nothing by age.
 */
export function usePatientAgeYears(
  patientId: string | null | undefined,
  knownAgeYears: number | null | undefined,
): number | null {
  const canViewPatient = useHasPermission(P.PATIENTS.VIEW);
  const { timezone } = useLocaleConfig();
  const hasKnownAge = typeof knownAgeYears === "number";
  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => patientsService.getPatient(patientId ?? ""),
    enabled: !hasKnownAge && !!patientId && canViewPatient,
    retry: 1,
  });
  if (hasKnownAge) return knownAgeYears;
  return completedYears(patient?.date_of_birth, hospitalToday(timezone));
}
