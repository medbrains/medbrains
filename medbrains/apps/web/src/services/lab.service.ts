import { labApi } from "@medbrains/api/modules/lab";
import { printDataApi } from "@medbrains/api/modules/print-data";

export const labService = {
  getLabReportDeliveryConfig: () => labApi.getLabReportDeliveryConfig(),
  updateLabReportDeliveryConfig: (
    ...args: Parameters<typeof labApi.updateLabReportDeliveryConfig>
  ) => labApi.updateLabReportDeliveryConfig(...args),
  getLabReportFullPrintData: (...args: Parameters<typeof printDataApi.getLabReportFullPrintData>) =>
    printDataApi.getLabReportFullPrintData(...args),
  listLabOrders: (...args: Parameters<typeof labApi.listLabOrders>) =>
    labApi.listLabOrders(...args),
  listCriticalAlerts: (...args: Parameters<typeof labApi.listCriticalAlerts>) =>
    labApi.listCriticalAlerts(...args),
  createLabOrder: (...args: Parameters<typeof labApi.createLabOrder>) =>
    labApi.createLabOrder(...args),
  getLabOrder: (...args: Parameters<typeof labApi.getLabOrder>) => labApi.getLabOrder(...args),
  collectSample: (...args: Parameters<typeof labApi.collectSample>) =>
    labApi.collectSample(...args),
  startProcessing: (...args: Parameters<typeof labApi.startProcessing>) =>
    labApi.startProcessing(...args),
  completeLabOrder: (...args: Parameters<typeof labApi.completeLabOrder>) =>
    labApi.completeLabOrder(...args),
  verifyResults: (...args: Parameters<typeof labApi.verifyResults>) =>
    labApi.verifyResults(...args),
  cancelLabOrder: (...args: Parameters<typeof labApi.cancelLabOrder>) =>
    labApi.cancelLabOrder(...args),
  rejectSample: (...args: Parameters<typeof labApi.rejectSample>) => labApi.rejectSample(...args),
  addLabResults: (...args: Parameters<typeof labApi.addLabResults>) =>
    labApi.addLabResults(...args),
  listHeldAnalyserResults: (...args: Parameters<typeof labApi.listHeldAnalyserResults>) =>
    labApi.listHeldAnalyserResults(...args),
  listAnalyserCandidateOrders: (...args: Parameters<typeof labApi.listAnalyserCandidateOrders>) =>
    labApi.listAnalyserCandidateOrders(...args),
  attachAnalyserResults: (...args: Parameters<typeof labApi.attachAnalyserResults>) =>
    labApi.attachAnalyserResults(...args),
  dismissAnalyserResults: (...args: Parameters<typeof labApi.dismissAnalyserResults>) =>
    labApi.dismissAnalyserResults(...args),
  updateLabReportStatus: (...args: Parameters<typeof labApi.updateLabReportStatus>) =>
    labApi.updateLabReportStatus(...args),
  getLabReportPrintData: (...args: Parameters<typeof printDataApi.getLabReportPrintData>) =>
    printDataApi.getLabReportPrintData(...args),
  lockLabReport: (...args: Parameters<typeof labApi.lockLabReport>) =>
    labApi.lockLabReport(...args),
  acknowledgeCriticalAlert: (...args: Parameters<typeof labApi.acknowledgeCriticalAlert>) =>
    labApi.acknowledgeCriticalAlert(...args),
  recordCriticalCall: (...args: Parameters<typeof labApi.recordCriticalCall>) =>
    labApi.recordCriticalCall(...args),
  listDoctorCriticalAlerts: (...args: Parameters<typeof labApi.listDoctorCriticalAlerts>) =>
    labApi.listDoctorCriticalAlerts(...args),
  amendLabResult: (...args: Parameters<typeof labApi.amendLabResult>) =>
    labApi.amendLabResult(...args),
  listLabAmendments: (...args: Parameters<typeof labApi.listLabAmendments>) =>
    labApi.listLabAmendments(...args),
  addOnLabTest: (...args: Parameters<typeof labApi.addOnLabTest>) => labApi.addOnLabTest(...args),
  reviewQcResult: (...args: Parameters<typeof labApi.reviewQcResult>) =>
    labApi.reviewQcResult(...args),
  autoValidateResult: (...args: Parameters<typeof labApi.autoValidateResult>) =>
    labApi.autoValidateResult(...args),
  getOrderCrossmatch: (...args: Parameters<typeof labApi.getOrderCrossmatch>) =>
    labApi.getOrderCrossmatch(...args),
  listLabCatalog: (...args: Parameters<typeof labApi.listLabCatalog>) =>
    labApi.listLabCatalog(...args),
  createDirectLabOrder: (...args: Parameters<typeof labApi.createDirectLabOrder>) =>
    labApi.createDirectLabOrder(...args),
  importLabCatalog: (...args: Parameters<typeof labApi.importLabCatalog>) =>
    labApi.importLabCatalog(...args),
  createLabCatalogEntry: (...args: Parameters<typeof labApi.createLabCatalogEntry>) =>
    labApi.createLabCatalogEntry(...args),
  updateLabCatalogEntry: (...args: Parameters<typeof labApi.updateLabCatalogEntry>) =>
    labApi.updateLabCatalogEntry(...args),
  listLabPanels: (...args: Parameters<typeof labApi.listLabPanels>) =>
    labApi.listLabPanels(...args),
  createLabPanel: (...args: Parameters<typeof labApi.createLabPanel>) =>
    labApi.createLabPanel(...args),
  updateLabPanel: (...args: Parameters<typeof labApi.updateLabPanel>) =>
    labApi.updateLabPanel(...args),
  deleteLabPanel: (...args: Parameters<typeof labApi.deleteLabPanel>) =>
    labApi.deleteLabPanel(...args),
  listPhlebotomyQueue: (...args: Parameters<typeof labApi.listPhlebotomyQueue>) =>
    labApi.listPhlebotomyQueue(...args),
  updatePhlebotomyStatus: (...args: Parameters<typeof labApi.updatePhlebotomyStatus>) =>
    labApi.updatePhlebotomyStatus(...args),
  createPhlebotomyEntry: (...args: Parameters<typeof labApi.createPhlebotomyEntry>) =>
    labApi.createPhlebotomyEntry(...args),
  assignPhlebotomist: (...args: Parameters<typeof labApi.assignPhlebotomist>) =>
    labApi.assignPhlebotomist(...args),
  getLabAnalyzerWorklist: (...args: Parameters<typeof labApi.getLabAnalyzerWorklist>) =>
    labApi.getLabAnalyzerWorklist(...args),
  listReagentLots: (...args: Parameters<typeof labApi.listReagentLots>) =>
    labApi.listReagentLots(...args),
  createReagentLot: (...args: Parameters<typeof labApi.createReagentLot>) =>
    labApi.createReagentLot(...args),
  updateReagentLot: (...args: Parameters<typeof labApi.updateReagentLot>) =>
    labApi.updateReagentLot(...args),
  listQcResults: (...args: Parameters<typeof labApi.listQcResults>) =>
    labApi.listQcResults(...args),
  createQcResult: (...args: Parameters<typeof labApi.createQcResult>) =>
    labApi.createQcResult(...args),
  listCalibrations: (...args: Parameters<typeof labApi.listCalibrations>) =>
    labApi.listCalibrations(...args),
  createCalibration: (...args: Parameters<typeof labApi.createCalibration>) =>
    labApi.createCalibration(...args),
  listOutsourcedOrders: (...args: Parameters<typeof labApi.listOutsourcedOrders>) =>
    labApi.listOutsourcedOrders(...args),
  createOutsourcedOrder: (...args: Parameters<typeof labApi.createOutsourcedOrder>) =>
    labApi.createOutsourcedOrder(...args),
  updateOutsourcedOrder: (...args: Parameters<typeof labApi.updateOutsourcedOrder>) =>
    labApi.updateOutsourcedOrder(...args),
  listHomeCollections: (...args: Parameters<typeof labApi.listHomeCollections>) =>
    labApi.listHomeCollections(...args),
  getHomeCollectionStats: (...args: Parameters<typeof labApi.getHomeCollectionStats>) =>
    labApi.getHomeCollectionStats(...args),
  createHomeCollection: (...args: Parameters<typeof labApi.createHomeCollection>) =>
    labApi.createHomeCollection(...args),
  updateHomeCollection: (...args: Parameters<typeof labApi.updateHomeCollection>) =>
    labApi.updateHomeCollection(...args),
  listCollectionCenters: (...args: Parameters<typeof labApi.listCollectionCenters>) =>
    labApi.listCollectionCenters(...args),
  createCollectionCenter: (...args: Parameters<typeof labApi.createCollectionCenter>) =>
    labApi.createCollectionCenter(...args),
  updateCollectionCenter: (...args: Parameters<typeof labApi.updateCollectionCenter>) =>
    labApi.updateCollectionCenter(...args),
  listSampleArchive: (...args: Parameters<typeof labApi.listSampleArchive>) =>
    labApi.listSampleArchive(...args),
  createSampleArchive: (...args: Parameters<typeof labApi.createSampleArchive>) =>
    labApi.createSampleArchive(...args),
  retrieveSampleArchive: (...args: Parameters<typeof labApi.retrieveSampleArchive>) =>
    labApi.retrieveSampleArchive(...args),
  listEqasResults: (...args: Parameters<typeof labApi.listEqasResults>) =>
    labApi.listEqasResults(...args),
  createEqasResult: (...args: Parameters<typeof labApi.createEqasResult>) =>
    labApi.createEqasResult(...args),
  updateEqasResult: (...args: Parameters<typeof labApi.updateEqasResult>) =>
    labApi.updateEqasResult(...args),
  listProficiencyTests: (...args: Parameters<typeof labApi.listProficiencyTests>) =>
    labApi.listProficiencyTests(...args),
  createProficiencyTest: (...args: Parameters<typeof labApi.createProficiencyTest>) =>
    labApi.createProficiencyTest(...args),
  listNablDocuments: (...args: Parameters<typeof labApi.listNablDocuments>) =>
    labApi.listNablDocuments(...args),
  createNablDocument: (...args: Parameters<typeof labApi.createNablDocument>) =>
    labApi.createNablDocument(...args),
  updateNablDocument: (...args: Parameters<typeof labApi.updateNablDocument>) =>
    labApi.updateNablDocument(...args),
  getReagentConsumption: (...args: Parameters<typeof labApi.getReagentConsumption>) =>
    labApi.getReagentConsumption(...args),
  listReportDispatches: (...args: Parameters<typeof labApi.listReportDispatches>) =>
    labApi.listReportDispatches(...args),
  createReportDispatch: (...args: Parameters<typeof labApi.createReportDispatch>) =>
    labApi.createReportDispatch(...args),
  voidReportDispatch: labApi.voidReportDispatch,
  confirmReportDispatch: (...args: Parameters<typeof labApi.confirmReportDispatch>) =>
    labApi.confirmReportDispatch(...args),
  listLabReferralDoctors: (...args: Parameters<typeof labApi.listLabReferralDoctors>) =>
    labApi.listLabReferralDoctors(...args),
  listLabReferralPayouts: (...args: Parameters<typeof labApi.listLabReferralPayouts>) =>
    labApi.listLabReferralPayouts(...args),
  getLabB2bCreditSummary: (...args: Parameters<typeof labApi.getLabB2bCreditSummary>) =>
    labApi.getLabB2bCreditSummary(...args),
  getLabCumulativeReport: (...args: Parameters<typeof labApi.getLabCumulativeReport>) =>
    labApi.getLabCumulativeReport(...args),
  getLabTatMonitoring: (...args: Parameters<typeof labApi.getLabTatMonitoring>) =>
    labApi.getLabTatMonitoring(...args),
  listStatOrders: (...args: Parameters<typeof labApi.listStatOrders>) =>
    labApi.listStatOrders(...args),
  getLabTatAnalytics: (...args: Parameters<typeof labApi.getLabTatAnalytics>) =>
    labApi.getLabTatAnalytics(...args),
  getHistopathReport: (...args: Parameters<typeof labApi.getHistopathReport>) =>
    labApi.getHistopathReport(...args),
  createHistopathReport: (...args: Parameters<typeof labApi.createHistopathReport>) =>
    labApi.createHistopathReport(...args),
  getCytologyReport: (...args: Parameters<typeof labApi.getCytologyReport>) =>
    labApi.getCytologyReport(...args),
  createCytologyReport: (...args: Parameters<typeof labApi.createCytologyReport>) =>
    labApi.createCytologyReport(...args),
  getMolecularReport: (...args: Parameters<typeof labApi.getMolecularReport>) =>
    labApi.getMolecularReport(...args),
  createMolecularReport: (...args: Parameters<typeof labApi.createMolecularReport>) =>
    labApi.createMolecularReport(...args),
  listB2bClients: (...args: Parameters<typeof labApi.listB2bClients>) =>
    labApi.listB2bClients(...args),
  createB2bClient: (...args: Parameters<typeof labApi.createB2bClient>) =>
    labApi.createB2bClient(...args),
  updateB2bClient: (...args: Parameters<typeof labApi.updateB2bClient>) =>
    labApi.updateB2bClient(...args),
  listB2bRates: (...args: Parameters<typeof labApi.listB2bRates>) => labApi.listB2bRates(...args),
  createB2bRate: (...args: Parameters<typeof labApi.createB2bRate>) =>
    labApi.createB2bRate(...args),
};
