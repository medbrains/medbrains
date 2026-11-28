import { indentApi } from "@medbrains/api/modules/indent";
import { procurementApi } from "@medbrains/api/modules/procurement";
import { setupApi } from "@medbrains/api/modules/setup";

export const indentService = {
  listIndentRequisitions: (...args: Parameters<typeof indentApi.listIndentRequisitions>) =>
    indentApi.listIndentRequisitions(...args),
  getIndentRequisition: (...args: Parameters<typeof indentApi.getIndentRequisition>) =>
    indentApi.getIndentRequisition(...args),
  createIndentRequisition: (...args: Parameters<typeof indentApi.createIndentRequisition>) =>
    indentApi.createIndentRequisition(...args),
  submitIndentRequisition: (...args: Parameters<typeof indentApi.submitIndentRequisition>) =>
    indentApi.submitIndentRequisition(...args),
  createReorderIndent: (...args: Parameters<typeof indentApi.createReorderIndent>) =>
    indentApi.createReorderIndent(...args),
  approveIndentRequisition: (...args: Parameters<typeof indentApi.approveIndentRequisition>) =>
    indentApi.approveIndentRequisition(...args),
  rejectIndentRequisition: (...args: Parameters<typeof indentApi.rejectIndentRequisition>) =>
    indentApi.rejectIndentRequisition(...args),
  issueIndentRequisition: (...args: Parameters<typeof indentApi.issueIndentRequisition>) =>
    indentApi.issueIndentRequisition(...args),
  cancelIndentRequisition: (...args: Parameters<typeof indentApi.cancelIndentRequisition>) =>
    indentApi.cancelIndentRequisition(...args),
  listDepartments: (...args: Parameters<typeof setupApi.listDepartments>) =>
    setupApi.listDepartments(...args),
  listPurchaseOrders: (...args: Parameters<typeof procurementApi.listPurchaseOrders>) =>
    procurementApi.listPurchaseOrders(...args),
  listStoreCatalog: (...args: Parameters<typeof indentApi.listStoreCatalog>) =>
    indentApi.listStoreCatalog(...args),
  createStoreCatalogItem: (...args: Parameters<typeof indentApi.createStoreCatalogItem>) =>
    indentApi.createStoreCatalogItem(...args),
  updateStoreCatalogItem: (...args: Parameters<typeof indentApi.updateStoreCatalogItem>) =>
    indentApi.updateStoreCatalogItem(...args),
  listStoreStockMovements: (...args: Parameters<typeof indentApi.listStoreStockMovements>) =>
    indentApi.listStoreStockMovements(...args),
  createStoreStockMovement: (...args: Parameters<typeof indentApi.createStoreStockMovement>) =>
    indentApi.createStoreStockMovement(...args),
  getConsumptionAnalysis: (...args: Parameters<typeof indentApi.getConsumptionAnalysis>) =>
    indentApi.getConsumptionAnalysis(...args),
  getAbcAnalysis: (...args: Parameters<typeof indentApi.getAbcAnalysis>) =>
    indentApi.getAbcAnalysis(...args),
  getVedAnalysis: (...args: Parameters<typeof indentApi.getVedAnalysis>) =>
    indentApi.getVedAnalysis(...args),
  getFsnAnalysis: (...args: Parameters<typeof indentApi.getFsnAnalysis>) =>
    indentApi.getFsnAnalysis(...args),
  getDeadStockReport: (...args: Parameters<typeof indentApi.getDeadStockReport>) =>
    indentApi.getDeadStockReport(...args),
  getPurchaseConsumptionTrend: (
    ...args: Parameters<typeof indentApi.getPurchaseConsumptionTrend>
  ) => indentApi.getPurchaseConsumptionTrend(...args),
  getInventoryValuation: (...args: Parameters<typeof indentApi.getInventoryValuation>) =>
    indentApi.getInventoryValuation(...args),
  getComplianceReport: (...args: Parameters<typeof indentApi.getComplianceReport>) =>
    indentApi.getComplianceReport(...args),
  listPatientConsumables: (...args: Parameters<typeof indentApi.listPatientConsumables>) =>
    indentApi.listPatientConsumables(...args),
  issueToPatient: (...args: Parameters<typeof indentApi.issueToPatient>) =>
    indentApi.issueToPatient(...args),
  listImplantRegistry: (...args: Parameters<typeof indentApi.listImplantRegistry>) =>
    indentApi.listImplantRegistry(...args),
  createImplantEntry: (...args: Parameters<typeof indentApi.createImplantEntry>) =>
    indentApi.createImplantEntry(...args),
  listCondemnations: (...args: Parameters<typeof indentApi.listCondemnations>) =>
    indentApi.listCondemnations(...args),
  createCondemnation: (...args: Parameters<typeof indentApi.createCondemnation>) =>
    indentApi.createCondemnation(...args),
  updateCondemnationStatus: (...args: Parameters<typeof indentApi.updateCondemnationStatus>) =>
    indentApi.updateCondemnationStatus(...args),
};
