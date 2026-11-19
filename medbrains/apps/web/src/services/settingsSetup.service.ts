import { backupsApi } from "@medbrains/api/modules/backups";
import { opdApi } from "@medbrains/api/modules/opd";
import { setupApi } from "@medbrains/api/modules/setup";

export type CreateBedTypeInput = Parameters<typeof setupApi.createBedType>[0];
export type UpdateBedTypeInput = Parameters<typeof setupApi.updateBedType>[1];
export type CreateFacilityInput = Parameters<typeof setupApi.createFacility>[0];
export type UpdateFacilityInput = Parameters<typeof setupApi.updateFacility>[1];
export type CreateDepartmentInput = Parameters<typeof setupApi.createDepartment>[0];
export type UpdateDepartmentInput = Parameters<typeof setupApi.updateDepartment>[1];
export type CreateServiceInput = Parameters<typeof setupApi.createService>[0];
export type UpdateServiceInput = Parameters<typeof setupApi.updateService>[1];
export type CreateTaxCategoryInput = Parameters<typeof setupApi.createTaxCategory>[0];
export type UpdateTaxCategoryInput = Parameters<typeof setupApi.updateTaxCategory>[1];
export type CreatePaymentMethodInput = Parameters<typeof setupApi.createPaymentMethod>[0];
export type UpdatePaymentMethodInput = Parameters<typeof setupApi.updatePaymentMethod>[1];
export type CreateSequenceInput = Parameters<typeof setupApi.createSequence>[0];
export type UpdateSequenceInput = Parameters<typeof setupApi.updateSequence>[1];
export type CreateLocationInput = Parameters<typeof setupApi.createLocation>[0];
export type UpdateLocationInput = Parameters<typeof setupApi.updateLocation>[1];
export type UpdateModuleInput = Parameters<typeof setupApi.updateModule>[1];
export type ImportConfigInput = Parameters<typeof setupApi.importConfig>[0];
export type UpdateSecureDeviceSettingInput = Parameters<
  typeof setupApi.updateSecureDeviceSetting
>[0];

export const settingsSetupService = {
  getOnboardingWorkbook: () => setupApi.getOnboardingWorkbook(),
  importOnboardingWorkbook: (...args: Parameters<typeof setupApi.importOnboardingWorkbook>) =>
    setupApi.importOnboardingWorkbook(...args),
  completenessCheck: () => setupApi.completenessCheck(),
  systemHealth: () => setupApi.systemHealth(),
  listBackups: () => backupsApi.listBackups(),
  exportConfig: () => setupApi.exportConfig(),
  importConfig: (data: ImportConfigInput) => setupApi.importConfig(data),
  listModules: () => setupApi.listModules(),
  updateModule: (code: string, data: UpdateModuleInput) => setupApi.updateModule(code, data),
  getEdition: () => setupApi.getEdition(),
  applyEdition: (hospitalType: string) => setupApi.applyEdition(hospitalType),
  listBedTypes: () => setupApi.listBedTypes(),
  createBedType: (data: CreateBedTypeInput) => setupApi.createBedType(data),
  updateBedType: (id: string, data: UpdateBedTypeInput) => setupApi.updateBedType(id, data),
  deleteBedType: (id: string) => setupApi.deleteBedType(id),
  listDepartments: () => setupApi.listDepartments(),
  createDepartment: (data: CreateDepartmentInput) => setupApi.createDepartment(data),
  updateDepartment: (id: string, data: UpdateDepartmentInput) =>
    setupApi.updateDepartment(id, data),
  deleteDepartment: (id: string) => setupApi.deleteDepartment(id),
  listFacilities: () => setupApi.listFacilities(),
  createFacility: (data: CreateFacilityInput) => setupApi.createFacility(data),
  updateFacility: (id: string, data: UpdateFacilityInput) => setupApi.updateFacility(id, data),
  deleteFacility: (id: string) => setupApi.deleteFacility(id),
  listServices: () => setupApi.listServices(),
  createService: (data: CreateServiceInput) => setupApi.createService(data),
  updateService: (id: string, data: UpdateServiceInput) => setupApi.updateService(id, data),
  deleteService: (id: string) => setupApi.deleteService(id),
  listProcedureCatalog: () => opdApi.listProcedureCatalog(),
  importProcedureCatalog: (data: Parameters<typeof opdApi.importProcedureCatalog>[0]) =>
    opdApi.importProcedureCatalog(data),
  listTaxCategories: () => setupApi.listTaxCategories(),
  createTaxCategory: (data: CreateTaxCategoryInput) => setupApi.createTaxCategory(data),
  updateTaxCategory: (id: string, data: UpdateTaxCategoryInput) =>
    setupApi.updateTaxCategory(id, data),
  deleteTaxCategory: (id: string) => setupApi.deleteTaxCategory(id),
  listPaymentMethods: () => setupApi.listPaymentMethods(),
  createPaymentMethod: (data: CreatePaymentMethodInput) => setupApi.createPaymentMethod(data),
  updatePaymentMethod: (id: string, data: UpdatePaymentMethodInput) =>
    setupApi.updatePaymentMethod(id, data),
  deletePaymentMethod: (id: string) => setupApi.deletePaymentMethod(id),
  listSequences: () => setupApi.listSequences(),
  createSequence: (data: CreateSequenceInput) => setupApi.createSequence(data),
  updateSequence: (seqType: string, data: UpdateSequenceInput) =>
    setupApi.updateSequence(seqType, data),
  deleteSequence: (seqType: string) => setupApi.deleteSequence(seqType),
  listLocations: () => setupApi.listLocations(),
  listLocationDirectory: () => setupApi.listLocationDirectory(),
  createLocation: (data: CreateLocationInput) => setupApi.createLocation(data),
  updateLocation: (id: string, data: UpdateLocationInput) => setupApi.updateLocation(id, data),
  deleteLocation: (id: string) => setupApi.deleteLocation(id),
  listSetupUsers: () => setupApi.listSetupUsers(),
  listLocationStaff: (locationId: string) => setupApi.listLocationStaff(locationId),
  assignLocationStaff: (
    locationId: string,
    data: { user_id: string; role_label?: string; is_primary?: boolean },
  ) => setupApi.assignLocationStaff(locationId, data),
  removeLocationStaff: (locationId: string, userId: string) =>
    setupApi.removeLocationStaff(locationId, userId),
  getSecureDeviceSettings: () => setupApi.getSecureDeviceSettings(),
  updateSecureDeviceSetting: (data: UpdateSecureDeviceSettingInput) =>
    setupApi.updateSecureDeviceSetting(data),
};
