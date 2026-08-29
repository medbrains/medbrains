import { api } from "@medbrains/api";

export const labService = {
  listLabOrders: (...args: Parameters<typeof api.listLabOrders>) => api.listLabOrders(...args),
  listCriticalAlerts: (...args: Parameters<typeof api.listCriticalAlerts>) =>
    api.listCriticalAlerts(...args),
  createLabOrder: (...args: Parameters<typeof api.createLabOrder>) => api.createLabOrder(...args),
  getLabOrder: (...args: Parameters<typeof api.getLabOrder>) => api.getLabOrder(...args),
  collectSample: (...args: Parameters<typeof api.collectSample>) => api.collectSample(...args),
  startProcessing: (...args: Parameters<typeof api.startProcessing>) =>
    api.startProcessing(...args),
  completeLabOrder: (...args: Parameters<typeof api.completeLabOrder>) =>
    api.completeLabOrder(...args),
  verifyResults: (...args: Parameters<typeof api.verifyResults>) => api.verifyResults(...args),
  cancelLabOrder: (...args: Parameters<typeof api.cancelLabOrder>) => api.cancelLabOrder(...args),
  rejectSample: (...args: Parameters<typeof api.rejectSample>) => api.rejectSample(...args),
  addLabResults: (...args: Parameters<typeof api.addLabResults>) => api.addLabResults(...args),
  updateLabReportStatus: (...args: Parameters<typeof api.updateLabReportStatus>) =>
    api.updateLabReportStatus(...args),
  getLabReportPrintData: (...args: Parameters<typeof api.getLabReportPrintData>) =>
    api.getLabReportPrintData(...args),
  lockLabReport: (...args: Parameters<typeof api.lockLabReport>) => api.lockLabReport(...args),
  acknowledgeCriticalAlert: (...args: Parameters<typeof api.acknowledgeCriticalAlert>) =>
    api.acknowledgeCriticalAlert(...args),
  amendLabResult: (...args: Parameters<typeof api.amendLabResult>) => api.amendLabResult(...args),
  addOnLabTest: (...args: Parameters<typeof api.addOnLabTest>) => api.addOnLabTest(...args),
  reviewQcResult: (...args: Parameters<typeof api.reviewQcResult>) => api.reviewQcResult(...args),
  autoValidateResult: (...args: Parameters<typeof api.autoValidateResult>) =>
    api.autoValidateResult(...args),
  getOrderCrossmatch: (...args: Parameters<typeof api.getOrderCrossmatch>) =>
    api.getOrderCrossmatch(...args),
  listLabCatalog: (...args: Parameters<typeof api.listLabCatalog>) => api.listLabCatalog(...args),
  importLabCatalog: (...args: Parameters<typeof api.importLabCatalog>) =>
    api.importLabCatalog(...args),
  createLabCatalogEntry: (...args: Parameters<typeof api.createLabCatalogEntry>) =>
    api.createLabCatalogEntry(...args),
  updateLabCatalogEntry: (...args: Parameters<typeof api.updateLabCatalogEntry>) =>
    api.updateLabCatalogEntry(...args),
  listLabPanels: (...args: Parameters<typeof api.listLabPanels>) => api.listLabPanels(...args),
  createLabPanel: (...args: Parameters<typeof api.createLabPanel>) => api.createLabPanel(...args),
  deleteLabPanel: (...args: Parameters<typeof api.deleteLabPanel>) => api.deleteLabPanel(...args),
  listPhlebotomyQueue: (...args: Parameters<typeof api.listPhlebotomyQueue>) =>
    api.listPhlebotomyQueue(...args),
  updatePhlebotomyStatus: (...args: Parameters<typeof api.updatePhlebotomyStatus>) =>
    api.updatePhlebotomyStatus(...args),
  listReagentLots: (...args: Parameters<typeof api.listReagentLots>) =>
    api.listReagentLots(...args),
  createReagentLot: (...args: Parameters<typeof api.createReagentLot>) =>
    api.createReagentLot(...args),
  updateReagentLot: (...args: Parameters<typeof api.updateReagentLot>) =>
    api.updateReagentLot(...args),
  listQcResults: (...args: Parameters<typeof api.listQcResults>) => api.listQcResults(...args),
  createQcResult: (...args: Parameters<typeof api.createQcResult>) => api.createQcResult(...args),
  listCalibrations: (...args: Parameters<typeof api.listCalibrations>) =>
    api.listCalibrations(...args),
  createCalibration: (...args: Parameters<typeof api.createCalibration>) =>
    api.createCalibration(...args),
  listOutsourcedOrders: (...args: Parameters<typeof api.listOutsourcedOrders>) =>
    api.listOutsourcedOrders(...args),
  createOutsourcedOrder: (...args: Parameters<typeof api.createOutsourcedOrder>) =>
    api.createOutsourcedOrder(...args),
  updateOutsourcedOrder: (...args: Parameters<typeof api.updateOutsourcedOrder>) =>
    api.updateOutsourcedOrder(...args),
  listHomeCollections: (...args: Parameters<typeof api.listHomeCollections>) =>
    api.listHomeCollections(...args),
  getHomeCollectionStats: (...args: Parameters<typeof api.getHomeCollectionStats>) =>
    api.getHomeCollectionStats(...args),
  createHomeCollection: (...args: Parameters<typeof api.createHomeCollection>) =>
    api.createHomeCollection(...args),
  listCollectionCenters: (...args: Parameters<typeof api.listCollectionCenters>) =>
    api.listCollectionCenters(...args),
  createCollectionCenter: (...args: Parameters<typeof api.createCollectionCenter>) =>
    api.createCollectionCenter(...args),
  updateCollectionCenter: (...args: Parameters<typeof api.updateCollectionCenter>) =>
    api.updateCollectionCenter(...args),
  listSampleArchive: (...args: Parameters<typeof api.listSampleArchive>) =>
    api.listSampleArchive(...args),
  createSampleArchive: (...args: Parameters<typeof api.createSampleArchive>) =>
    api.createSampleArchive(...args),
  retrieveSampleArchive: (...args: Parameters<typeof api.retrieveSampleArchive>) =>
    api.retrieveSampleArchive(...args),
  listEqasResults: (...args: Parameters<typeof api.listEqasResults>) =>
    api.listEqasResults(...args),
  createEqasResult: (...args: Parameters<typeof api.createEqasResult>) =>
    api.createEqasResult(...args),
  updateEqasResult: (...args: Parameters<typeof api.updateEqasResult>) =>
    api.updateEqasResult(...args),
  listProficiencyTests: (...args: Parameters<typeof api.listProficiencyTests>) =>
    api.listProficiencyTests(...args),
  createProficiencyTest: (...args: Parameters<typeof api.createProficiencyTest>) =>
    api.createProficiencyTest(...args),
  listNablDocuments: (...args: Parameters<typeof api.listNablDocuments>) =>
    api.listNablDocuments(...args),
  createNablDocument: (...args: Parameters<typeof api.createNablDocument>) =>
    api.createNablDocument(...args),
  updateNablDocument: (...args: Parameters<typeof api.updateNablDocument>) =>
    api.updateNablDocument(...args),
  getReagentConsumption: (...args: Parameters<typeof api.getReagentConsumption>) =>
    api.getReagentConsumption(...args),
  getLabTatAnalytics: (...args: Parameters<typeof api.getLabTatAnalytics>) =>
    api.getLabTatAnalytics(...args),
  getHistopathReport: (...args: Parameters<typeof api.getHistopathReport>) =>
    api.getHistopathReport(...args),
  createHistopathReport: (...args: Parameters<typeof api.createHistopathReport>) =>
    api.createHistopathReport(...args),
  getCytologyReport: (...args: Parameters<typeof api.getCytologyReport>) =>
    api.getCytologyReport(...args),
  createCytologyReport: (...args: Parameters<typeof api.createCytologyReport>) =>
    api.createCytologyReport(...args),
  getMolecularReport: (...args: Parameters<typeof api.getMolecularReport>) =>
    api.getMolecularReport(...args),
  createMolecularReport: (...args: Parameters<typeof api.createMolecularReport>) =>
    api.createMolecularReport(...args),
  listB2bClients: (...args: Parameters<typeof api.listB2bClients>) => api.listB2bClients(...args),
  createB2bClient: (...args: Parameters<typeof api.createB2bClient>) =>
    api.createB2bClient(...args),
  updateB2bClient: (...args: Parameters<typeof api.updateB2bClient>) =>
    api.updateB2bClient(...args),
  listB2bRates: (...args: Parameters<typeof api.listB2bRates>) => api.listB2bRates(...args),
  createB2bRate: (...args: Parameters<typeof api.createB2bRate>) => api.createB2bRate(...args),
};
