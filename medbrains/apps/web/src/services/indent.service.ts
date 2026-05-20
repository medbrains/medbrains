import { api } from "@medbrains/api";

export const indentService = {
  listIndentRequisitions: (...args: Parameters<typeof api.listIndentRequisitions>) =>
    api.listIndentRequisitions(...args),
  getIndentRequisition: (...args: Parameters<typeof api.getIndentRequisition>) =>
    api.getIndentRequisition(...args),
  createIndentRequisition: (...args: Parameters<typeof api.createIndentRequisition>) =>
    api.createIndentRequisition(...args),
  submitIndentRequisition: (...args: Parameters<typeof api.submitIndentRequisition>) =>
    api.submitIndentRequisition(...args),
  approveIndentRequisition: (...args: Parameters<typeof api.approveIndentRequisition>) =>
    api.approveIndentRequisition(...args),
  rejectIndentRequisition: (...args: Parameters<typeof api.rejectIndentRequisition>) =>
    api.rejectIndentRequisition(...args),
  issueIndentRequisition: (...args: Parameters<typeof api.issueIndentRequisition>) =>
    api.issueIndentRequisition(...args),
  cancelIndentRequisition: (...args: Parameters<typeof api.cancelIndentRequisition>) =>
    api.cancelIndentRequisition(...args),
  listDepartments: (...args: Parameters<typeof api.listDepartments>) =>
    api.listDepartments(...args),
  listPurchaseOrders: (...args: Parameters<typeof api.listPurchaseOrders>) =>
    api.listPurchaseOrders(...args),
  listStoreCatalog: (...args: Parameters<typeof api.listStoreCatalog>) =>
    api.listStoreCatalog(...args),
  createStoreCatalogItem: (...args: Parameters<typeof api.createStoreCatalogItem>) =>
    api.createStoreCatalogItem(...args),
  updateStoreCatalogItem: (...args: Parameters<typeof api.updateStoreCatalogItem>) =>
    api.updateStoreCatalogItem(...args),
  listStoreStockMovements: (...args: Parameters<typeof api.listStoreStockMovements>) =>
    api.listStoreStockMovements(...args),
  createStoreStockMovement: (...args: Parameters<typeof api.createStoreStockMovement>) =>
    api.createStoreStockMovement(...args),
  getConsumptionAnalysis: (...args: Parameters<typeof api.getConsumptionAnalysis>) =>
    api.getConsumptionAnalysis(...args),
  getAbcAnalysis: (...args: Parameters<typeof api.getAbcAnalysis>) => api.getAbcAnalysis(...args),
  getVedAnalysis: (...args: Parameters<typeof api.getVedAnalysis>) => api.getVedAnalysis(...args),
  getFsnAnalysis: (...args: Parameters<typeof api.getFsnAnalysis>) => api.getFsnAnalysis(...args),
  getDeadStockReport: (...args: Parameters<typeof api.getDeadStockReport>) =>
    api.getDeadStockReport(...args),
  getPurchaseConsumptionTrend: (...args: Parameters<typeof api.getPurchaseConsumptionTrend>) =>
    api.getPurchaseConsumptionTrend(...args),
  getInventoryValuation: (...args: Parameters<typeof api.getInventoryValuation>) =>
    api.getInventoryValuation(...args),
  getComplianceReport: (...args: Parameters<typeof api.getComplianceReport>) =>
    api.getComplianceReport(...args),
  listPatientConsumables: (...args: Parameters<typeof api.listPatientConsumables>) =>
    api.listPatientConsumables(...args),
  issueToPatient: (...args: Parameters<typeof api.issueToPatient>) => api.issueToPatient(...args),
  listImplantRegistry: (...args: Parameters<typeof api.listImplantRegistry>) =>
    api.listImplantRegistry(...args),
  createImplantEntry: (...args: Parameters<typeof api.createImplantEntry>) =>
    api.createImplantEntry(...args),
  listCondemnations: (...args: Parameters<typeof api.listCondemnations>) =>
    api.listCondemnations(...args),
  createCondemnation: (...args: Parameters<typeof api.createCondemnation>) =>
    api.createCondemnation(...args),
  updateCondemnationStatus: (...args: Parameters<typeof api.updateCondemnationStatus>) =>
    api.updateCondemnationStatus(...args),
};
