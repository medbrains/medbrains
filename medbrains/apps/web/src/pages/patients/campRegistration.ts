import type { PatientRegistrationInitialValues } from "@medbrains/schemas";
import type { Camp } from "@medbrains/types";

/**
 * The form's starting values for a registration made at a camp: files the patient against the
 * camp and, only while the EMR is on, opens their OPD visit — never a visit nobody can open.
 */
export function campRegistrationValues(
  campId: string,
  camp: Pick<Camp, "name" | "organizing_department_id" | "venue_name"> | undefined,
  opdOn: boolean,
): PatientRegistrationInitialValues {
  return {
    registration_type: "camp",
    registration_source: "camp",
    camp_id: campId,
    camp_name: camp?.name,
    department_id: camp?.organizing_department_id ?? undefined,
    referred_by_facility: camp?.venue_name ?? camp?.name,
    create_opd_visit: opdOn,
    open_opd_after_registration: opdOn,
  };
}
