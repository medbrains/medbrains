import { api } from "@medbrains/api";

export type CreateMasterItemInput = Parameters<typeof api.adminCreateReligion>[0];
export type UpdateMasterItemInput = Parameters<typeof api.adminUpdateReligion>[1];
export type CreateInsuranceProviderInput = Parameters<typeof api.adminCreateInsuranceProvider>[0];
export type UpdateInsuranceProviderInput = Parameters<typeof api.adminUpdateInsuranceProvider>[1];
export type CreateCriticalValueRuleInput = Parameters<typeof api.createCriticalValueRule>[0];
export type CreateDrugInteractionInput = Parameters<typeof api.createDrugInteraction>[0];
export type CreateClinicalProtocolInput = Parameters<typeof api.createClinicalProtocol>[0];

export const clinicalMastersService = {
  listCriticalValueRules: () => api.listCriticalValueRules(),
  createCriticalValueRule: (data: CreateCriticalValueRuleInput) =>
    api.createCriticalValueRule(data),
  deleteCriticalValueRule: (id: string) => api.deleteCriticalValueRule(id),

  listDrugInteractions: () => api.listDrugInteractions(),
  createDrugInteraction: (data: CreateDrugInteractionInput) => api.createDrugInteraction(data),
  deleteDrugInteraction: (id: string) => api.deleteDrugInteraction(id),

  listClinicalProtocols: () => api.listClinicalProtocols(),
  createClinicalProtocol: (data: CreateClinicalProtocolInput) => api.createClinicalProtocol(data),
  deleteClinicalProtocol: (id: string) => api.deleteClinicalProtocol(id),

  listReligions: () => api.adminListReligions(),
  createReligion: (data: CreateMasterItemInput) => api.adminCreateReligion(data),
  updateReligion: (id: string, data: UpdateMasterItemInput) => api.adminUpdateReligion(id, data),
  deleteReligion: (id: string) => api.adminDeleteReligion(id),

  listOccupations: () => api.adminListOccupations(),
  createOccupation: (data: CreateMasterItemInput) => api.adminCreateOccupation(data),
  updateOccupation: (id: string, data: UpdateMasterItemInput) =>
    api.adminUpdateOccupation(id, data),
  deleteOccupation: (id: string) => api.adminDeleteOccupation(id),

  listRelations: () => api.adminListRelations(),
  createRelation: (data: CreateMasterItemInput) => api.adminCreateRelation(data),
  updateRelation: (id: string, data: UpdateMasterItemInput) => api.adminUpdateRelation(id, data),
  deleteRelation: (id: string) => api.adminDeleteRelation(id),

  listInsuranceProviders: () => api.adminListInsuranceProviders(),
  createInsuranceProvider: (data: CreateInsuranceProviderInput) =>
    api.adminCreateInsuranceProvider(data),
  updateInsuranceProvider: (id: string, data: UpdateInsuranceProviderInput) =>
    api.adminUpdateInsuranceProvider(id, data),
  deleteInsuranceProvider: (id: string) => api.adminDeleteInsuranceProvider(id),
};
