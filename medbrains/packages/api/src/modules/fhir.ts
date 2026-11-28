/** The `/fhir` API area. Moved from `client.ts`; one module per first path segment. */
import { request } from "../client.js";

export const fhirApi = {
  fhirMetadata: () => request<unknown>("/fhir/metadata"),
  readFhirPatient: (id: string) => request<unknown>(`/fhir/Patient/${id}`),
  readFhirPatientEverything: (id: string) => request<unknown>(`/fhir/Patient/${id}/$everything`),
  readFhirEncounter: (id: string) => request<unknown>(`/fhir/Encounter/${id}`),
  readFhirDiagnosticReport: (id: string) => request<unknown>(`/fhir/DiagnosticReport/${id}`),
  readFhirObservation: (id: string) => request<unknown>(`/fhir/Observation/${id}`),
  searchFhirCompositions: (encounterId: string) =>
    request<unknown>(`/fhir/Composition?encounter=${encounterId}`),
  readFhirComposition: (id: string) => request<unknown>(`/fhir/Composition/${id}`),
};
