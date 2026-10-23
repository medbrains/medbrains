import { api } from "@medbrains/api";

export const abdmSettingsService = {
  get: () => api.getAbdmSettings(),
  save: (...args: Parameters<typeof api.saveAbdmSettings>) => api.saveAbdmSettings(...args),
  test: () => api.testAbdmConnection(),
  bridge: () => api.getAbdmBridge(),
  mentalHealthSharing: () => api.getAbdmMentalHealthSharing(),
  saveMentalHealthSharing: (...args: Parameters<typeof api.saveAbdmMentalHealthSharing>) =>
    api.saveAbdmMentalHealthSharing(...args),
  registerBridge: (...args: Parameters<typeof api.registerAbdmBridge>) =>
    api.registerAbdmBridge(...args),
};
