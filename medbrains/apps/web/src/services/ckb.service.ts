import { ckbApi } from "@medbrains/api/modules/ckb";

export const ckbService = {
  listCkbDiagnoses: (...args: Parameters<typeof ckbApi.listCkbDiagnoses>) =>
    ckbApi.listCkbDiagnoses(...args),
  listCkbFormulary: (...args: Parameters<typeof ckbApi.listCkbFormulary>) =>
    ckbApi.listCkbFormulary(...args),
  listCkbLabReference: (...args: Parameters<typeof ckbApi.listCkbLabReference>) =>
    ckbApi.listCkbLabReference(...args),
  listNlemGenerics: (...args: Parameters<typeof ckbApi.listNlemGenerics>) =>
    ckbApi.listNlemGenerics(...args),
  listCkbStateSchemes: (...args: Parameters<typeof ckbApi.listCkbStateSchemes>) =>
    ckbApi.listCkbStateSchemes(...args),
  listCkbStateFormulary: (...args: Parameters<typeof ckbApi.listCkbStateFormulary>) =>
    ckbApi.listCkbStateFormulary(...args),
  listNotifiableReports: (...args: Parameters<typeof ckbApi.listNotifiableReports>) =>
    ckbApi.listNotifiableReports(...args),
  updateNotifiableReport: (...args: Parameters<typeof ckbApi.updateNotifiableReport>) =>
    ckbApi.updateNotifiableReport(...args),
  getNotifiableList: () => ckbApi.getNotifiableList(),
  listNotifiableOverrides: () => ckbApi.listNotifiableOverrides(),
  upsertNotifiableOverride: (...args: Parameters<typeof ckbApi.upsertNotifiableOverride>) =>
    ckbApi.upsertNotifiableOverride(...args),
  deleteNotifiableOverride: (id: string) => ckbApi.deleteNotifiableOverride(id),
  listTbCases: (status?: string) => ckbApi.listTbCases(status),
  saveTbDetails: (...args: Parameters<typeof ckbApi.saveTbDetails>) =>
    ckbApi.saveTbDetails(...args),
  getNikshaySheet: () => ckbApi.getNikshaySheet(),
  getPublicHealthFacility: () => ckbApi.getPublicHealthFacility(),
  getIhipLineList: (...args: Parameters<typeof ckbApi.getIhipLineList>) =>
    ckbApi.getIhipLineList(...args),
  submitIhipLineList: (...args: Parameters<typeof ckbApi.submitIhipLineList>) =>
    ckbApi.submitIhipLineList(...args),
  setPublicHealthFacilityCodes: (...args: Parameters<typeof ckbApi.setPublicHealthFacilityCodes>) =>
    ckbApi.setPublicHealthFacilityCodes(...args),
};
