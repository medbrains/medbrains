import { patientJourneyActionRoute } from "@medbrains/types";

interface PatientRegistrationOpdHandoffRouteInput {
  campId?: string | null;
  campRegistrationId?: string | null;
  encounterId: string;
  patientId: string;
}

export function patientRegistrationOpdHandoffRoute({
  campId,
  campRegistrationId,
  encounterId,
  patientId,
}: PatientRegistrationOpdHandoffRouteInput): string {
  const baseRoute =
    patientJourneyActionRoute("opd.open_visit", {
      activeEncounterId: encounterId,
      completedEvents: ["patient.created", "opd.encounter.created"],
      patientId,
    }) ?? `/opd/encounters/${encounterId}#consultation`;

  const [pathAndSearch = `/opd/encounters/${encounterId}`, hash = "consultation"] =
    baseRoute.split("#");
  const [pathname, existingSearch = ""] = pathAndSearch.split("?");
  const searchParams = new URLSearchParams(existingSearch);

  if (campId) {
    searchParams.set("source", "camp");
    searchParams.set("campId", campId);
  }

  if (campRegistrationId) {
    searchParams.set("registrationId", campRegistrationId);
  }

  const search = searchParams.toString();
  return `${pathname}${search ? `?${search}` : ""}#${hash}`;
}
