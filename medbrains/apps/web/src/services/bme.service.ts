import { api } from "@medbrains/api";

export const bmeService = {
  listBmeEquipment: (...args: Parameters<typeof api.listBmeEquipment>) =>
    api.listBmeEquipment(...args),
  createBmeEquipment: (...args: Parameters<typeof api.createBmeEquipment>) =>
    api.createBmeEquipment(...args),
  updateBmeEquipment: (...args: Parameters<typeof api.updateBmeEquipment>) =>
    api.updateBmeEquipment(...args),
  listBmePmSchedules: (...args: Parameters<typeof api.listBmePmSchedules>) =>
    api.listBmePmSchedules(...args),
  listBmeWorkOrders: (...args: Parameters<typeof api.listBmeWorkOrders>) =>
    api.listBmeWorkOrders(...args),
  getBmeStats: (...args: Parameters<typeof api.getBmeStats>) => api.getBmeStats(...args),
  createBmePmSchedule: (...args: Parameters<typeof api.createBmePmSchedule>) =>
    api.createBmePmSchedule(...args),
  createBmeWorkOrder: (...args: Parameters<typeof api.createBmeWorkOrder>) =>
    api.createBmeWorkOrder(...args),
  updateBmeWorkOrderStatus: (...args: Parameters<typeof api.updateBmeWorkOrderStatus>) =>
    api.updateBmeWorkOrderStatus(...args),
  listBmeCalibrations: (...args: Parameters<typeof api.listBmeCalibrations>) =>
    api.listBmeCalibrations(...args),
  createBmeCalibration: (...args: Parameters<typeof api.createBmeCalibration>) =>
    api.createBmeCalibration(...args),
  listBmeContracts: (...args: Parameters<typeof api.listBmeContracts>) =>
    api.listBmeContracts(...args),
  listBmeVendorEvaluations: (...args: Parameters<typeof api.listBmeVendorEvaluations>) =>
    api.listBmeVendorEvaluations(...args),
  createBmeContract: (...args: Parameters<typeof api.createBmeContract>) =>
    api.createBmeContract(...args),
  createBmeVendorEvaluation: (...args: Parameters<typeof api.createBmeVendorEvaluation>) =>
    api.createBmeVendorEvaluation(...args),
  listBmeBreakdowns: (...args: Parameters<typeof api.listBmeBreakdowns>) =>
    api.listBmeBreakdowns(...args),
  createBmeBreakdown: (...args: Parameters<typeof api.createBmeBreakdown>) =>
    api.createBmeBreakdown(...args),
  updateBmeBreakdownStatus: (...args: Parameters<typeof api.updateBmeBreakdownStatus>) =>
    api.updateBmeBreakdownStatus(...args),
  getBmeMtbfAnalytics: (...args: Parameters<typeof api.getBmeMtbfAnalytics>) =>
    api.getBmeMtbfAnalytics(...args),
  getBmeUptimeAnalytics: (...args: Parameters<typeof api.getBmeUptimeAnalytics>) =>
    api.getBmeUptimeAnalytics(...args),
};
