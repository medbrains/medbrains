import { api } from "@medbrains/api";

export const ckbService = {
  listCkbDiagnoses: (...args: Parameters<typeof api.listCkbDiagnoses>) =>
    api.listCkbDiagnoses(...args),
  listCkbFormulary: (...args: Parameters<typeof api.listCkbFormulary>) =>
    api.listCkbFormulary(...args),
  listCkbLabReference: (...args: Parameters<typeof api.listCkbLabReference>) =>
    api.listCkbLabReference(...args),
  listNlemGenerics: (...args: Parameters<typeof api.listNlemGenerics>) =>
    api.listNlemGenerics(...args),
  listCkbStateSchemes: (...args: Parameters<typeof api.listCkbStateSchemes>) =>
    api.listCkbStateSchemes(...args),
  listCkbStateFormulary: (...args: Parameters<typeof api.listCkbStateFormulary>) =>
    api.listCkbStateFormulary(...args),
  listNotifiableReports: (...args: Parameters<typeof api.listNotifiableReports>) =>
    api.listNotifiableReports(...args),
  updateNotifiableReport: (...args: Parameters<typeof api.updateNotifiableReport>) =>
    api.updateNotifiableReport(...args),
  getNotifiableList: () => api.getNotifiableList(),
  listNotifiableOverrides: () => api.listNotifiableOverrides(),
  upsertNotifiableOverride: (...args: Parameters<typeof api.upsertNotifiableOverride>) =>
    api.upsertNotifiableOverride(...args),
  deleteNotifiableOverride: (id: string) => api.deleteNotifiableOverride(id),
  listTbCases: (status?: string) => api.listTbCases(status),
  saveTbDetails: (...args: Parameters<typeof api.saveTbDetails>) => api.saveTbDetails(...args),
  getNikshaySheet: () => api.getNikshaySheet(),
  getPublicHealthFacility: () => api.getPublicHealthFacility(),
  setPublicHealthFacilityCodes: (...args: Parameters<typeof api.setPublicHealthFacilityCodes>) =>
    api.setPublicHealthFacilityCodes(...args),
};
