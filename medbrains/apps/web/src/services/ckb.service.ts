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
};
