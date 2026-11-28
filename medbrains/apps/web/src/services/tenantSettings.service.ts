import { geoApi } from "@medbrains/api/modules/geo";
import { setupApi } from "@medbrains/api/modules/setup";

export type UpdateTenantInput = Parameters<typeof setupApi.updateTenant>[0];
export type UpdateTenantGeoInput = Parameters<typeof setupApi.updateTenantGeo>[0];
export type UpdateBrandingInput = Parameters<typeof setupApi.updateBranding>[0];
export type UpdateTenantSettingInput = Parameters<typeof setupApi.updateTenantSetting>[0];
export type UpsertPrintTemplateInput = Parameters<typeof setupApi.upsertPrintTemplate>[0];

export const tenantSettingsService = {
  getTenant: () => setupApi.getTenant(),
  updateTenant: (data: UpdateTenantInput) => setupApi.updateTenant(data),
  updateTenantGeo: (data: UpdateTenantGeoInput) => setupApi.updateTenantGeo(data),
  geoCountries: () => geoApi.geoCountries(),
  geoStates: (countryId: string) => geoApi.geoStates(countryId),
  geoDistricts: (stateId: string) => geoApi.geoDistricts(stateId),
  getBranding: () => setupApi.getBranding(),
  updateBranding: (data: UpdateBrandingInput) => setupApi.updateBranding(data),
  getTenantSettings: (category: string) => setupApi.getTenantSettings(category),
  updateTenantSetting: (data: UpdateTenantSettingInput) => setupApi.updateTenantSetting(data),
  getPrintTemplates: () => setupApi.getPrintTemplates(),
  upsertPrintTemplate: (data: UpsertPrintTemplateInput) => setupApi.upsertPrintTemplate(data),
};
