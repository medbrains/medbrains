import { cdsApi } from "@medbrains/api/modules/cds";
import { setupApi } from "@medbrains/api/modules/setup";

export type CreateMasterItemInput = Parameters<typeof setupApi.adminCreateReligion>[0];
export type UpdateMasterItemInput = Parameters<typeof setupApi.adminUpdateReligion>[1];
export type CreateInsuranceProviderInput = Parameters<
  typeof setupApi.adminCreateInsuranceProvider
>[0];
export type UpdateInsuranceProviderInput = Parameters<
  typeof setupApi.adminUpdateInsuranceProvider
>[1];
export type CreateCriticalValueRuleInput = Parameters<typeof cdsApi.createCriticalValueRule>[0];
export type CreateDrugInteractionInput = Parameters<typeof cdsApi.createDrugInteraction>[0];
export type CreateClinicalProtocolInput = Parameters<typeof cdsApi.createClinicalProtocol>[0];

export const clinicalMastersService = {
  listCriticalValueRules: () => cdsApi.listCriticalValueRules(),
  createCriticalValueRule: (data: CreateCriticalValueRuleInput) =>
    cdsApi.createCriticalValueRule(data),
  deleteCriticalValueRule: (id: string) => cdsApi.deleteCriticalValueRule(id),

  listDrugInteractions: () => cdsApi.listDrugInteractions(),
  createDrugInteraction: (data: CreateDrugInteractionInput) => cdsApi.createDrugInteraction(data),
  deleteDrugInteraction: (id: string) => cdsApi.deleteDrugInteraction(id),

  listClinicalProtocols: () => cdsApi.listClinicalProtocols(),
  createClinicalProtocol: (data: CreateClinicalProtocolInput) =>
    cdsApi.createClinicalProtocol(data),
  deleteClinicalProtocol: (id: string) => cdsApi.deleteClinicalProtocol(id),

  listReligions: () => setupApi.adminListReligions(),
  createReligion: (data: CreateMasterItemInput) => setupApi.adminCreateReligion(data),
  updateReligion: (id: string, data: UpdateMasterItemInput) =>
    setupApi.adminUpdateReligion(id, data),
  deleteReligion: (id: string) => setupApi.adminDeleteReligion(id),

  listOccupations: () => setupApi.adminListOccupations(),
  createOccupation: (data: CreateMasterItemInput) => setupApi.adminCreateOccupation(data),
  updateOccupation: (id: string, data: UpdateMasterItemInput) =>
    setupApi.adminUpdateOccupation(id, data),
  deleteOccupation: (id: string) => setupApi.adminDeleteOccupation(id),

  listRelations: () => setupApi.adminListRelations(),
  createRelation: (data: CreateMasterItemInput) => setupApi.adminCreateRelation(data),
  updateRelation: (id: string, data: UpdateMasterItemInput) =>
    setupApi.adminUpdateRelation(id, data),
  deleteRelation: (id: string) => setupApi.adminDeleteRelation(id),

  listInsuranceProviders: () => setupApi.adminListInsuranceProviders(),
  importInsuranceProviders: (data: Parameters<typeof setupApi.adminImportInsuranceProviders>[0]) =>
    setupApi.adminImportInsuranceProviders(data),
  createInsuranceProvider: (data: CreateInsuranceProviderInput) =>
    setupApi.adminCreateInsuranceProvider(data),
  updateInsuranceProvider: (id: string, data: UpdateInsuranceProviderInput) =>
    setupApi.adminUpdateInsuranceProvider(id, data),
  deleteInsuranceProvider: (id: string) => setupApi.adminDeleteInsuranceProvider(id),
};
