import { clinicalApi } from "@medbrains/api/modules/clinical";
import { icuApi } from "@medbrains/api/modules/icu";

export const icuService = {
  createIcuFlowsheet: (...args: Parameters<typeof icuApi.createIcuFlowsheet>) =>
    icuApi.createIcuFlowsheet(...args),
  listIcuFlowsheets: (...args: Parameters<typeof icuApi.listIcuFlowsheets>) =>
    icuApi.listIcuFlowsheets(...args),
  listIcuVentilatorRecords: (...args: Parameters<typeof icuApi.listIcuVentilatorRecords>) =>
    icuApi.listIcuVentilatorRecords(...args),
  createIcuVentilatorRecord: (...args: Parameters<typeof icuApi.createIcuVentilatorRecord>) =>
    icuApi.createIcuVentilatorRecord(...args),
  lungProtective: (...args: Parameters<typeof clinicalApi.lungProtective>) =>
    clinicalApi.lungProtective(...args),
  listIcuScores: (...args: Parameters<typeof icuApi.listIcuScores>) =>
    icuApi.listIcuScores(...args),
  createIcuScore: (...args: Parameters<typeof icuApi.createIcuScore>) =>
    icuApi.createIcuScore(...args),
  listIcuDevices: (...args: Parameters<typeof icuApi.listIcuDevices>) =>
    icuApi.listIcuDevices(...args),
  createIcuDevice: (...args: Parameters<typeof icuApi.createIcuDevice>) =>
    icuApi.createIcuDevice(...args),
  removeIcuDevice: (...args: Parameters<typeof icuApi.removeIcuDevice>) =>
    icuApi.removeIcuDevice(...args),
  listIcuBundleChecks: (...args: Parameters<typeof icuApi.listIcuBundleChecks>) =>
    icuApi.listIcuBundleChecks(...args),
  createIcuBundleCheck: (...args: Parameters<typeof icuApi.createIcuBundleCheck>) =>
    icuApi.createIcuBundleCheck(...args),
  listIcuNutrition: (...args: Parameters<typeof icuApi.listIcuNutrition>) =>
    icuApi.listIcuNutrition(...args),
  createIcuNutrition: (...args: Parameters<typeof icuApi.createIcuNutrition>) =>
    icuApi.createIcuNutrition(...args),
  listIcuNeonatalRecords: (...args: Parameters<typeof icuApi.listIcuNeonatalRecords>) =>
    icuApi.listIcuNeonatalRecords(...args),
  createIcuNeonatalRecord: (...args: Parameters<typeof icuApi.createIcuNeonatalRecord>) =>
    icuApi.createIcuNeonatalRecord(...args),
  getIcuLosAnalytics: (...args: Parameters<typeof icuApi.getIcuLosAnalytics>) =>
    icuApi.getIcuLosAnalytics(...args),
  getIcuDeviceInfectionRates: (...args: Parameters<typeof icuApi.getIcuDeviceInfectionRates>) =>
    icuApi.getIcuDeviceInfectionRates(...args),
};
