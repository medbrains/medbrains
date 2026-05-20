import { api } from "@medbrains/api";

export const icuService = {
  createIcuFlowsheet: (...args: Parameters<typeof api.createIcuFlowsheet>) =>
    api.createIcuFlowsheet(...args),
  listIcuFlowsheets: (...args: Parameters<typeof api.listIcuFlowsheets>) =>
    api.listIcuFlowsheets(...args),
  listIcuVentilatorRecords: (...args: Parameters<typeof api.listIcuVentilatorRecords>) =>
    api.listIcuVentilatorRecords(...args),
  createIcuVentilatorRecord: (...args: Parameters<typeof api.createIcuVentilatorRecord>) =>
    api.createIcuVentilatorRecord(...args),
  listIcuScores: (...args: Parameters<typeof api.listIcuScores>) => api.listIcuScores(...args),
  createIcuScore: (...args: Parameters<typeof api.createIcuScore>) => api.createIcuScore(...args),
  listIcuDevices: (...args: Parameters<typeof api.listIcuDevices>) => api.listIcuDevices(...args),
  createIcuDevice: (...args: Parameters<typeof api.createIcuDevice>) =>
    api.createIcuDevice(...args),
  removeIcuDevice: (...args: Parameters<typeof api.removeIcuDevice>) =>
    api.removeIcuDevice(...args),
  listIcuBundleChecks: (...args: Parameters<typeof api.listIcuBundleChecks>) =>
    api.listIcuBundleChecks(...args),
  createIcuBundleCheck: (...args: Parameters<typeof api.createIcuBundleCheck>) =>
    api.createIcuBundleCheck(...args),
  listIcuNutrition: (...args: Parameters<typeof api.listIcuNutrition>) =>
    api.listIcuNutrition(...args),
  createIcuNutrition: (...args: Parameters<typeof api.createIcuNutrition>) =>
    api.createIcuNutrition(...args),
  listIcuNeonatalRecords: (...args: Parameters<typeof api.listIcuNeonatalRecords>) =>
    api.listIcuNeonatalRecords(...args),
  createIcuNeonatalRecord: (...args: Parameters<typeof api.createIcuNeonatalRecord>) =>
    api.createIcuNeonatalRecord(...args),
  getIcuLosAnalytics: (...args: Parameters<typeof api.getIcuLosAnalytics>) =>
    api.getIcuLosAnalytics(...args),
  getIcuDeviceInfectionRates: (...args: Parameters<typeof api.getIcuDeviceInfectionRates>) =>
    api.getIcuDeviceInfectionRates(...args),
};
