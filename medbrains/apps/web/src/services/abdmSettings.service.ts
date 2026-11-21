import { abdmApi } from "@medbrains/api/modules/abdm";

export const abdmSettingsService = {
  get: () => abdmApi.getAbdmSettings(),
  save: (...args: Parameters<typeof abdmApi.saveAbdmSettings>) => abdmApi.saveAbdmSettings(...args),
  test: () => abdmApi.testAbdmConnection(),
  bridge: () => abdmApi.getAbdmBridge(),
  mentalHealthSharing: () => abdmApi.getAbdmMentalHealthSharing(),
  saveMentalHealthSharing: (...args: Parameters<typeof abdmApi.saveAbdmMentalHealthSharing>) =>
    abdmApi.saveAbdmMentalHealthSharing(...args),
  registerBridge: (...args: Parameters<typeof abdmApi.registerAbdmBridge>) =>
    abdmApi.registerAbdmBridge(...args),
};
