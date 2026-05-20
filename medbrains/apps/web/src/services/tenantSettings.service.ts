import { api } from "@medbrains/api";

export type UpdateTenantInput = Parameters<typeof api.updateTenant>[0];
export type UpdateTenantGeoInput = Parameters<typeof api.updateTenantGeo>[0];
export type UpdateBrandingInput = Parameters<typeof api.updateBranding>[0];
export type UpdateTenantSettingInput = Parameters<typeof api.updateTenantSetting>[0];
export type UpsertPrintTemplateInput = Parameters<typeof api.upsertPrintTemplate>[0];

export const tenantSettingsService = {
  getTenant: () => api.getTenant(),
  updateTenant: (data: UpdateTenantInput) => api.updateTenant(data),
  updateTenantGeo: (data: UpdateTenantGeoInput) => api.updateTenantGeo(data),
  geoCountries: () => api.geoCountries(),
  geoStates: (countryId: string) => api.geoStates(countryId),
  geoDistricts: (stateId: string) => api.geoDistricts(stateId),
  getBranding: () => api.getBranding(),
  updateBranding: (data: UpdateBrandingInput) => api.updateBranding(data),
  getTenantSettings: (category: string) => api.getTenantSettings(category),
  updateTenantSetting: (data: UpdateTenantSettingInput) => api.updateTenantSetting(data),
  getPrintTemplates: () => api.getPrintTemplates(),
  upsertPrintTemplate: (data: UpsertPrintTemplateInput) => api.upsertPrintTemplate(data),
};
