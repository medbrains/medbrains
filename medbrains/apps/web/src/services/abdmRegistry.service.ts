import { api } from "@medbrains/api";
import type { LinkHfrRequest, RegisterHfrRequest, SetHprRequest } from "@medbrains/types";

export const abdmRegistryService = {
  listFacilityHfr: () => api.listFacilityHfr(),
  linkFacilityHfr: (id: string, data: LinkHfrRequest) => api.linkFacilityHfr(id, data),
  registerFacilityHfr: (id: string, data: RegisterHfrRequest) => api.registerFacilityHfr(id, data),
  getHprCoverage: () => api.getHprCoverage(),
  setDoctorHprId: (id: string, data: SetHprRequest) => api.setDoctorHprId(id, data),
  verifyDoctorHprId: (id: string) => api.verifyDoctorHprId(id),
};
