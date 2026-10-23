import { api } from "@medbrains/api";

export const abdmSettingsService = {
  get: () => api.getAbdmSettings(),
  save: (...args: Parameters<typeof api.saveAbdmSettings>) => api.saveAbdmSettings(...args),
  test: () => api.testAbdmConnection(),
  bridge: () => api.getAbdmBridge(),
  registerBridge: (...args: Parameters<typeof api.registerAbdmBridge>) =>
    api.registerAbdmBridge(...args),
};
