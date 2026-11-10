import { api } from "@medbrains/api";

export const immunizationClinicService = {
  listDueList: (...args: Parameters<typeof api.listImmunizationDueList>) =>
    api.listImmunizationDueList(...args),
  getSettings: () => api.getImmunizationSettings(),
  updateSettings: (...args: Parameters<typeof api.updateImmunizationSettings>) =>
    api.updateImmunizationSettings(...args),
};
