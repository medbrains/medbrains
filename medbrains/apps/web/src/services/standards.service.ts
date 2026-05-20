import { api } from "@medbrains/api";

export const standardsService = {
  fhirMetadata: () => api.fhirMetadata(),
  getAbdmHfr: () => api.getAbdmHfr(),
  getTenantAbdmHfr: () => api.getTenantAbdmHfr(),
};
