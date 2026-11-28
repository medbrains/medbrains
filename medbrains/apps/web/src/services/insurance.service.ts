import { insuranceApi } from "@medbrains/api/modules/insurance";

export const insuranceService = {
  listVerifications: (...args: Parameters<typeof insuranceApi.listVerifications>) =>
    insuranceApi.listVerifications(...args),
  runVerification: (...args: Parameters<typeof insuranceApi.runVerification>) =>
    insuranceApi.runVerification(...args),
  listPriorAuths: (...args: Parameters<typeof insuranceApi.listPriorAuths>) =>
    insuranceApi.listPriorAuths(...args),
  getPriorAuth: (...args: Parameters<typeof insuranceApi.getPriorAuth>) =>
    insuranceApi.getPriorAuth(...args),
  createPriorAuth: (...args: Parameters<typeof insuranceApi.createPriorAuth>) =>
    insuranceApi.createPriorAuth(...args),
  submitPriorAuth: (...args: Parameters<typeof insuranceApi.submitPriorAuth>) =>
    insuranceApi.submitPriorAuth(...args),
  cancelPriorAuth: (...args: Parameters<typeof insuranceApi.cancelPriorAuth>) =>
    insuranceApi.cancelPriorAuth(...args),
  respondPriorAuth: (...args: Parameters<typeof insuranceApi.respondPriorAuth>) =>
    insuranceApi.respondPriorAuth(...args),
  listAppeals: (...args: Parameters<typeof insuranceApi.listAppeals>) =>
    insuranceApi.listAppeals(...args),
  createAppeal: (...args: Parameters<typeof insuranceApi.createAppeal>) =>
    insuranceApi.createAppeal(...args),
  updateAppeal: (...args: Parameters<typeof insuranceApi.updateAppeal>) =>
    insuranceApi.updateAppeal(...args),
  listPaRules: (...args: Parameters<typeof insuranceApi.listPaRules>) =>
    insuranceApi.listPaRules(...args),
  createPaRule: (...args: Parameters<typeof insuranceApi.createPaRule>) =>
    insuranceApi.createPaRule(...args),
  updatePaRule: (...args: Parameters<typeof insuranceApi.updatePaRule>) =>
    insuranceApi.updatePaRule(...args),
  getInsuranceDashboard: (...args: Parameters<typeof insuranceApi.getInsuranceDashboard>) =>
    insuranceApi.getInsuranceDashboard(...args),
};
