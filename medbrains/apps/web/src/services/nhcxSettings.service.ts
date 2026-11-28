import { integrationsApi } from "@medbrains/api/modules/integrations";

export const nhcxSettingsService = {
  get: () => integrationsApi.getNhcxSettings(),
  save: (...args: Parameters<typeof integrationsApi.saveNhcxSettings>) =>
    integrationsApi.saveNhcxSettings(...args),
  test: () => integrationsApi.testNhcxConnection(),
  status: () => integrationsApi.getNhcxStatus(),
};
