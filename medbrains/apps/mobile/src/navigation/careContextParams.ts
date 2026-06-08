import type {
  AdmissionRow,
  CampRegistration,
  PatientJourneyMobileCareContextModule,
  PatientJourneyMobileCareContextParams,
} from "@medbrains/types";

export type CareContextModule = PatientJourneyMobileCareContextModule;
export type CareContextHandoff = NonNullable<PatientJourneyMobileCareContextParams["handoff"]>;
export type PatientCareContextRouteParams = PatientJourneyMobileCareContextParams;

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
