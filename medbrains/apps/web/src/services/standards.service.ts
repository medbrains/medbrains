import { abdmApi } from "@medbrains/api/modules/abdm";
import { fhirApi } from "@medbrains/api/modules/fhir";

export const standardsService = {
  fhirMetadata: () => fhirApi.fhirMetadata(),
  listFacilityHfr: () => abdmApi.listFacilityHfr(),
};
