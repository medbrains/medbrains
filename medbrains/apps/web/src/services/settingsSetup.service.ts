import { api } from "@medbrains/api";

export type CreateBedTypeInput = Parameters<typeof api.createBedType>[0];
export type UpdateBedTypeInput = Parameters<typeof api.updateBedType>[1];
export type CreateFacilityInput = Parameters<typeof api.createFacility>[0];
export type UpdateFacilityInput = Parameters<typeof api.updateFacility>[1];
export type CreateDepartmentInput = Parameters<typeof api.createDepartment>[0];
export type UpdateDepartmentInput = Parameters<typeof api.updateDepartment>[1];
export type CreateServiceInput = Parameters<typeof api.createService>[0];
export type UpdateServiceInput = Parameters<typeof api.updateService>[1];
export type CreateTaxCategoryInput = Parameters<typeof api.createTaxCategory>[0];
export type UpdateTaxCategoryInput = Parameters<typeof api.updateTaxCategory>[1];
export type CreatePaymentMethodInput = Parameters<typeof api.createPaymentMethod>[0];
export type UpdatePaymentMethodInput = Parameters<typeof api.updatePaymentMethod>[1];
export type CreateSequenceInput = Parameters<typeof api.createSequence>[0];
export type UpdateSequenceInput = Parameters<typeof api.updateSequence>[1];
export type CreateLocationInput = Parameters<typeof api.createLocation>[0];
export type UpdateLocationInput = Parameters<typeof api.updateLocation>[1];
export type UpdateModuleInput = Parameters<typeof api.updateModule>[1];
export type ImportConfigInput = Parameters<typeof api.importConfig>[0];
export type UpdateSecureDeviceSettingInput = Parameters<typeof api.updateSecureDeviceSetting>[0];

export const settingsSetupService = {
  completenessCheck: () => api.completenessCheck(),
  systemHealth: () => api.systemHealth(),
  exportConfig: () => api.exportConfig(),
  importConfig: (data: ImportConfigInput) => api.importConfig(data),
  listModules: () => api.listModules(),
  updateModule: (code: string, data: UpdateModuleInput) => api.updateModule(code, data),
  listBedTypes: () => api.listBedTypes(),
  createBedType: (data: CreateBedTypeInput) => api.createBedType(data),
  updateBedType: (id: string, data: UpdateBedTypeInput) => api.updateBedType(id, data),
  deleteBedType: (id: string) => api.deleteBedType(id),
  listDepartments: () => api.listDepartments(),
  createDepartment: (data: CreateDepartmentInput) => api.createDepartment(data),
  updateDepartment: (id: string, data: UpdateDepartmentInput) => api.updateDepartment(id, data),
  deleteDepartment: (id: string) => api.deleteDepartment(id),
  listFacilities: () => api.listFacilities(),
  createFacility: (data: CreateFacilityInput) => api.createFacility(data),
  updateFacility: (id: string, data: UpdateFacilityInput) => api.updateFacility(id, data),
  deleteFacility: (id: string) => api.deleteFacility(id),
  listServices: () => api.listServices(),
  createService: (data: CreateServiceInput) => api.createService(data),
  updateService: (id: string, data: UpdateServiceInput) => api.updateService(id, data),
  deleteService: (id: string) => api.deleteService(id),
  listProcedureCatalog: () => api.listProcedureCatalog(),
  listTaxCategories: () => api.listTaxCategories(),
  createTaxCategory: (data: CreateTaxCategoryInput) => api.createTaxCategory(data),
  updateTaxCategory: (id: string, data: UpdateTaxCategoryInput) => api.updateTaxCategory(id, data),
  deleteTaxCategory: (id: string) => api.deleteTaxCategory(id),
  listPaymentMethods: () => api.listPaymentMethods(),
  createPaymentMethod: (data: CreatePaymentMethodInput) => api.createPaymentMethod(data),
  updatePaymentMethod: (id: string, data: UpdatePaymentMethodInput) =>
    api.updatePaymentMethod(id, data),
  deletePaymentMethod: (id: string) => api.deletePaymentMethod(id),
  listSequences: () => api.listSequences(),
  createSequence: (data: CreateSequenceInput) => api.createSequence(data),
  updateSequence: (seqType: string, data: UpdateSequenceInput) => api.updateSequence(seqType, data),
  deleteSequence: (seqType: string) => api.deleteSequence(seqType),
  listLocations: () => api.listLocations(),
  createLocation: (data: CreateLocationInput) => api.createLocation(data),
  updateLocation: (id: string, data: UpdateLocationInput) => api.updateLocation(id, data),
  deleteLocation: (id: string) => api.deleteLocation(id),
  getSecureDeviceSettings: () => api.getSecureDeviceSettings(),
  updateSecureDeviceSetting: (data: UpdateSecureDeviceSettingInput) =>
    api.updateSecureDeviceSetting(data),
};
