import { bmeApi } from "@medbrains/api/modules/bme";

export const bmeService = {
  listBmeEquipment: (...args: Parameters<typeof bmeApi.listBmeEquipment>) =>
    bmeApi.listBmeEquipment(...args),
  createBmeEquipment: (...args: Parameters<typeof bmeApi.createBmeEquipment>) =>
    bmeApi.createBmeEquipment(...args),
  updateBmeEquipment: (...args: Parameters<typeof bmeApi.updateBmeEquipment>) =>
    bmeApi.updateBmeEquipment(...args),
  listBmePmSchedules: (...args: Parameters<typeof bmeApi.listBmePmSchedules>) =>
    bmeApi.listBmePmSchedules(...args),
  listBmeWorkOrders: (...args: Parameters<typeof bmeApi.listBmeWorkOrders>) =>
    bmeApi.listBmeWorkOrders(...args),
  getBmeStats: (...args: Parameters<typeof bmeApi.getBmeStats>) => bmeApi.getBmeStats(...args),
  createBmePmSchedule: (...args: Parameters<typeof bmeApi.createBmePmSchedule>) =>
    bmeApi.createBmePmSchedule(...args),
  createBmeWorkOrder: (...args: Parameters<typeof bmeApi.createBmeWorkOrder>) =>
    bmeApi.createBmeWorkOrder(...args),
  updateBmeWorkOrderStatus: (...args: Parameters<typeof bmeApi.updateBmeWorkOrderStatus>) =>
    bmeApi.updateBmeWorkOrderStatus(...args),
  listBmeCalibrations: (...args: Parameters<typeof bmeApi.listBmeCalibrations>) =>
    bmeApi.listBmeCalibrations(...args),
  createBmeCalibration: (...args: Parameters<typeof bmeApi.createBmeCalibration>) =>
    bmeApi.createBmeCalibration(...args),
  updateBmeCalibration: (...args: Parameters<typeof bmeApi.updateBmeCalibration>) =>
    bmeApi.updateBmeCalibration(...args),
  listBmeContracts: (...args: Parameters<typeof bmeApi.listBmeContracts>) =>
    bmeApi.listBmeContracts(...args),
  listBmeVendorEvaluations: (...args: Parameters<typeof bmeApi.listBmeVendorEvaluations>) =>
    bmeApi.listBmeVendorEvaluations(...args),
  createBmeContract: (...args: Parameters<typeof bmeApi.createBmeContract>) =>
    bmeApi.createBmeContract(...args),
  createBmeVendorEvaluation: (...args: Parameters<typeof bmeApi.createBmeVendorEvaluation>) =>
    bmeApi.createBmeVendorEvaluation(...args),
  listBmeBreakdowns: (...args: Parameters<typeof bmeApi.listBmeBreakdowns>) =>
    bmeApi.listBmeBreakdowns(...args),
  createBmeBreakdown: (...args: Parameters<typeof bmeApi.createBmeBreakdown>) =>
    bmeApi.createBmeBreakdown(...args),
  updateBmeBreakdownStatus: (...args: Parameters<typeof bmeApi.updateBmeBreakdownStatus>) =>
    bmeApi.updateBmeBreakdownStatus(...args),
  getBmeMtbfAnalytics: (...args: Parameters<typeof bmeApi.getBmeMtbfAnalytics>) =>
    bmeApi.getBmeMtbfAnalytics(...args),
  getBmeUptimeAnalytics: (...args: Parameters<typeof bmeApi.getBmeUptimeAnalytics>) =>
    bmeApi.getBmeUptimeAnalytics(...args),
};
