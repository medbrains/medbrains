import type { CampRegistration, FieldAccessLevel } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { campService } from "@/services/camp.service";
import { campRegistrationOptionLabel } from "./shared";

/**
 * The camp's registrations for the screening form: each by id (to find the
 * participant being screened) and as picker options labelled within the
 * caller's access to names and phones. Not fetched without a camp.
 */
export function useCampRegistrationChoices(
  campId: string | undefined,
  access: { name: FieldAccessLevel; phone: FieldAccessLevel },
) {
  const { data: registrations = [] } = useQuery({
    queryKey: ["camp-registrations", campId ?? null, "screening-selector"],
    queryFn: () => campService.listCampRegistrations({ camp_id: campId ?? "" }),
    enabled: Boolean(campId),
  });
  const registrationsById = useMemo(
    () => new Map(registrations.map((r: CampRegistration) => [r.id, r])),
    [registrations],
  );
  const { name, phone } = access;
  const registrationOptions = useMemo(
    () =>
      registrations.map((registration: CampRegistration) => ({
        value: registration.id,
        label: campRegistrationOptionLabel(registration, { name, phone }),
      })),
    [name, phone, registrations],
  );
  return { registrationsById, registrationOptions };
}
