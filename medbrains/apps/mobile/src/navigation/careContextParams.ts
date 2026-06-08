import type { AdmissionRow, CampRegistration, ClinicalJourneyContext } from "@medbrains/types";

export type CareContextModule = "camp" | "emergency" | "ipd";
export type CareContextHandoff =
  | "admit"
  | "open_admission"
  | "open_context"
  | "open_mlc"
  | "open_visit";

export type PatientCareContextRouteParams = {
  admissionId?: string;
  campId?: string;
  campRegistrationId?: string;
  erVisitId?: string;
  handoff?: CareContextHandoff;
  module: CareContextModule;
  patientId: string;
} & Record<string, unknown>;

export function mobileIpdCareContextParams(
  context: ClinicalJourneyContext,
): PatientCareContextRouteParams {
  return {
    admissionId: context.activeAdmissionId ?? undefined,
    handoff: context.activeAdmissionId ? "open_admission" : "admit",
    module: "ipd",
    patientId: context.patientId,
  };
}

export function mobileCampCareContextParams(
  context: ClinicalJourneyContext,
): PatientCareContextRouteParams {
  return {
    campId: context.activeCampId ?? undefined,
    campRegistrationId: context.activeCampRegistrationId ?? undefined,
    handoff: "open_context",
    module: "camp",
    patientId: context.patientId,
  };
}

export function prioritizeAdmissionsForRoute(
  admissions: readonly AdmissionRow[],
  routeContext: Pick<PatientCareContextRouteParams, "admissionId">,
): AdmissionRow[] {
  if (!routeContext.admissionId) {
    return [...admissions];
  }

  return admissions
    .map((admission, index) => ({
      admission,
      index,
      score: admission.id === routeContext.admissionId ? 0 : 1,
    }))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ admission }) => admission);
}

function campRegistrationRouteScore(
  registration: CampRegistration,
  routeContext: Pick<PatientCareContextRouteParams, "campId" | "campRegistrationId">,
) {
  if (routeContext.campRegistrationId && registration.id === routeContext.campRegistrationId) {
    return 0;
  }
  if (routeContext.campId && registration.camp_id === routeContext.campId) {
    return 1;
  }
  return 2;
}

export function prioritizeCampRegistrationsForRoute(
  registrations: readonly CampRegistration[],
  routeContext: Pick<PatientCareContextRouteParams, "campId" | "campRegistrationId">,
): CampRegistration[] {
  return registrations
    .map((registration, index) => ({
      index,
      registration,
      score: campRegistrationRouteScore(registration, routeContext),
    }))
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ registration }) => registration);
}
