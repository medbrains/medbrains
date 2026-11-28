import { abdmApi } from "@medbrains/api/modules/abdm";
import type { LinkHfrRequest, RegisterHfrRequest, SetHprRequest } from "@medbrains/types";

export const abdmRegistryService = {
  listFacilityHfr: () => abdmApi.listFacilityHfr(),
  linkFacilityHfr: (id: string, data: LinkHfrRequest) => abdmApi.linkFacilityHfr(id, data),
  registerFacilityHfr: (id: string, data: RegisterHfrRequest) =>
    abdmApi.registerFacilityHfr(id, data),
  getHprCoverage: () => abdmApi.getHprCoverage(),
  setDoctorHprId: (id: string, data: SetHprRequest) => abdmApi.setDoctorHprId(id, data),
  verifyDoctorHprId: (id: string) => abdmApi.verifyDoctorHprId(id),
};
