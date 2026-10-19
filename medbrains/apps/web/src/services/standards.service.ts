import { api } from "@medbrains/api";

export const standardsService = {
  fhirMetadata: () => api.fhirMetadata(),
  listFacilityHfr: () => api.listFacilityHfr(),
};
