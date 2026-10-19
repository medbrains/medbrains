import { api } from "@medbrains/api";

export const nhcxSettingsService = {
  get: () => api.getNhcxSettings(),
  save: (...args: Parameters<typeof api.saveNhcxSettings>) => api.saveNhcxSettings(...args),
  test: () => api.testNhcxConnection(),
  status: () => api.getNhcxStatus(),
};
