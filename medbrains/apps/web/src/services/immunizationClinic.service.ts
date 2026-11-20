import { immunizationsApi } from "@medbrains/api/modules/immunizations";

export const immunizationClinicService = {
  listDueList: (...args: Parameters<typeof immunizationsApi.listImmunizationDueList>) =>
    immunizationsApi.listImmunizationDueList(...args),
  getSettings: () => immunizationsApi.getImmunizationSettings(),
  updateSettings: (...args: Parameters<typeof immunizationsApi.updateImmunizationSettings>) =>
    immunizationsApi.updateImmunizationSettings(...args),
};
