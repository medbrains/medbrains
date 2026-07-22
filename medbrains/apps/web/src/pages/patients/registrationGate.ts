import type { CheckResult } from "@/lib/advisoryCheck";

/**
 * What registration should do after the duplicate-patient (MPI) check.
 *
 * Three outcomes, and the third is the one that used to be missing:
 *
 *   confirm             possible duplicates found — ask before creating
 *   proceed             checked, nobody matched
 *   proceedUnverified   the check could not run, so nobody has been compared
 *
 * Registration must not be blocked when the MPI service is unavailable —
 * during a camp intake, people are queued in front of the desk and the record
 * has to be created. But "checked, no match" and "never checked" led to the
 * same silent create, and a missed match means a second UHID for someone who
 * already has one: allergies, history and prior results end up split across
 * two records.
 *
 * Nothing downstream catches it. `POST /api/patients/match` is advisory,
 * `create_patient` does no matching of its own, and the only UNIQUE constraint
 * on `patients` is `(tenant_id, uhid)` — which a fresh registration satisfies
 * by construction. So the registrar is the last line, and has to be told.
 */
export type RegistrationAction = "confirm" | "proceed" | "proceedUnverified";

export function registrationAction<T>(check: CheckResult<T[]>): RegistrationAction {
  if (check.unavailable) {
    return "proceedUnverified";
  }
  return check.findings.length > 0 ? "confirm" : "proceed";
}
