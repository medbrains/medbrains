import { api } from "@medbrains/api";

export const insuranceService = {
  listVerifications: (...args: Parameters<typeof api.listVerifications>) =>
    api.listVerifications(...args),
  runVerification: (...args: Parameters<typeof api.runVerification>) =>
    api.runVerification(...args),
  listPriorAuths: (...args: Parameters<typeof api.listPriorAuths>) => api.listPriorAuths(...args),
  getPriorAuth: (...args: Parameters<typeof api.getPriorAuth>) => api.getPriorAuth(...args),
  createPriorAuth: (...args: Parameters<typeof api.createPriorAuth>) =>
    api.createPriorAuth(...args),
  submitPriorAuth: (...args: Parameters<typeof api.submitPriorAuth>) =>
    api.submitPriorAuth(...args),
  cancelPriorAuth: (...args: Parameters<typeof api.cancelPriorAuth>) =>
    api.cancelPriorAuth(...args),
  respondPriorAuth: (...args: Parameters<typeof api.respondPriorAuth>) =>
    api.respondPriorAuth(...args),
  listAppeals: (...args: Parameters<typeof api.listAppeals>) => api.listAppeals(...args),
  createAppeal: (...args: Parameters<typeof api.createAppeal>) => api.createAppeal(...args),
  updateAppeal: (...args: Parameters<typeof api.updateAppeal>) => api.updateAppeal(...args),
  listPaRules: (...args: Parameters<typeof api.listPaRules>) => api.listPaRules(...args),
  createPaRule: (...args: Parameters<typeof api.createPaRule>) => api.createPaRule(...args),
  updatePaRule: (...args: Parameters<typeof api.updatePaRule>) => api.updatePaRule(...args),
  getInsuranceDashboard: (...args: Parameters<typeof api.getInsuranceDashboard>) =>
    api.getInsuranceDashboard(...args),
};
