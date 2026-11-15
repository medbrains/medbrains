import { api } from "@medbrains/api";
import type {
  HfrDetailedInformation,
  HfrFacilityInformation,
  HfrFacilitySearch,
  HfrLinkedProgramIds,
  HfrMasterKind,
  HprSignInRequest,
  LinkHfrRequest,
  SetHprRequest,
} from "@medbrains/types";

export const abdmRegistryService = {
  listFacilityHfr: () => api.listFacilityHfr(),
  linkFacilityHfr: (id: string, data: LinkHfrRequest) => api.linkFacilityHfr(id, data),
  signInHpr: (data: HprSignInRequest) => api.signInHpr(data),
  getHfrMaster: (kind: HfrMasterKind, code?: string, code2?: string) =>
    api.getHfrMaster(kind, code, code2),
  searchHfrFacilities: (data: HfrFacilitySearch) => api.searchHfrFacilities(data),
  getHfrOnboarding: (id: string) => api.getHfrOnboarding(id),
  saveHfrBasic: (id: string, data: HfrFacilityInformation) => api.saveHfrBasic(id, data),
  saveHfrAdditional: (id: string, data: HfrLinkedProgramIds) => api.saveHfrAdditional(id, data),
  saveHfrDetailed: (id: string, data: HfrDetailedInformation) => api.saveHfrDetailed(id, data),
  submitHfrFacility: (id: string) => api.submitHfrFacility(id),
  getHprCoverage: () => api.getHprCoverage(),
  setDoctorHprId: (id: string, data: SetHprRequest) => api.setDoctorHprId(id, data),
  verifyDoctorHprId: (id: string) => api.verifyDoctorHprId(id),
};
