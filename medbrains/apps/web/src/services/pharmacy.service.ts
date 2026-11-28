import { indentApi } from "@medbrains/api/modules/indent";
import { opdApi } from "@medbrains/api/modules/opd";
import { patientsApi } from "@medbrains/api/modules/patients";
import { pharmacyApi } from "@medbrains/api/modules/pharmacy";
import { procurementApi } from "@medbrains/api/modules/procurement";
import { setupApi } from "@medbrains/api/modules/setup";
import type { CreateSubstitutionInput, FefoBatch, PharmacySubstitution } from "@medbrains/types";

export const pharmacyService = {
  selectFefoBatch: (data: {
    catalog_item_id: string;
    quantity_needed: number;
    store_location_id?: string;
  }) => pharmacyApi.selectFefoBatch(data) as Promise<{ batches: FefoBatch[] }>,
  dispenseRepeat: (...args: Parameters<typeof pharmacyApi.dispenseRepeat>) =>
    pharmacyApi.dispenseRepeat(...args),
  checkRepeatEligibility: (...args: Parameters<typeof pharmacyApi.checkRepeatEligibility>) =>
    pharmacyApi.checkRepeatEligibility(...args),
  createSubstitution: (data: CreateSubstitutionInput) =>
    pharmacyApi.createSubstitution(
      data as unknown as Record<string, unknown>,
    ) as Promise<PharmacySubstitution>,
  listSubstitutionsForItem: (itemId: string) =>
    pharmacyApi.listSubstitutionsForItem(itemId) as Promise<PharmacySubstitution[]>,
  getTenantSettings: (...args: Parameters<typeof setupApi.getTenantSettings>) =>
    setupApi.getTenantSettings(...args),
  listPharmacyOrders: (...args: Parameters<typeof pharmacyApi.listPharmacyOrders>) =>
    pharmacyApi.listPharmacyOrders(...args),
  dispenseOrder: (...args: Parameters<typeof pharmacyApi.dispenseOrder>) =>
    pharmacyApi.dispenseOrder(...args),
  validatePharmacyOrder: (...args: Parameters<typeof pharmacyApi.validatePharmacyOrder>) =>
    pharmacyApi.validatePharmacyOrder(...args),
  getPharmacyDispenseContext: (patientId: string) =>
    pharmacyApi.getPharmacyDispenseContext(patientId),
  listDispenseWitnesses: (q?: string) => pharmacyApi.listDispenseWitnesses(q),
  getPharmacyOrderSafetyRecord: (
    ...args: Parameters<typeof pharmacyApi.getPharmacyOrderSafetyRecord>
  ) => pharmacyApi.getPharmacyOrderSafetyRecord(...args),
  listPatientAllergies: (...args: Parameters<typeof patientsApi.listPatientAllergies>) =>
    patientsApi.listPatientAllergies(...args),
  cancelPharmacyOrder: (...args: Parameters<typeof pharmacyApi.cancelPharmacyOrder>) =>
    pharmacyApi.cancelPharmacyOrder(...args),
  createOtcSale: (...args: Parameters<typeof pharmacyApi.createOtcSale>) =>
    pharmacyApi.createOtcSale(...args),
  createPharmacyOrder: (...args: Parameters<typeof pharmacyApi.createPharmacyOrder>) =>
    pharmacyApi.createPharmacyOrder(...args),
  getPharmacyOrder: (...args: Parameters<typeof pharmacyApi.getPharmacyOrder>) =>
    pharmacyApi.getPharmacyOrder(...args),
  getPrescription: (...args: Parameters<typeof opdApi.getPrescription>) =>
    opdApi.getPrescription(...args),
  updatePharmacyOrderItem: (...args: Parameters<typeof pharmacyApi.updatePharmacyOrderItem>) =>
    pharmacyApi.updatePharmacyOrderItem(...args),
  removePharmacyOrderItem: (...args: Parameters<typeof pharmacyApi.removePharmacyOrderItem>) =>
    pharmacyApi.removePharmacyOrderItem(...args),
  prescriptionAudit: (...args: Parameters<typeof pharmacyApi.prescriptionAudit>) =>
    pharmacyApi.prescriptionAudit(...args),
  checkDrugInteractions: (...args: Parameters<typeof pharmacyApi.checkDrugInteractions>) =>
    pharmacyApi.checkDrugInteractions(...args),
  formularyCheck: (...args: Parameters<typeof pharmacyApi.formularyCheck>) =>
    pharmacyApi.formularyCheck(...args),
  listPharmacyCatalog: (...args: Parameters<typeof pharmacyApi.listPharmacyCatalog>) =>
    pharmacyApi.listPharmacyCatalog(...args),
  importPharmacyCatalog: (...args: Parameters<typeof pharmacyApi.importPharmacyCatalog>) =>
    pharmacyApi.importPharmacyCatalog(...args),
  createPharmacyCatalog: (...args: Parameters<typeof pharmacyApi.createPharmacyCatalog>) =>
    pharmacyApi.createPharmacyCatalog(...args),
  updatePharmacyCatalog: (...args: Parameters<typeof pharmacyApi.updatePharmacyCatalog>) =>
    pharmacyApi.updatePharmacyCatalog(...args),
  listStock: (...args: Parameters<typeof pharmacyApi.listStock>) => pharmacyApi.listStock(...args),
  createStockTransaction: (...args: Parameters<typeof pharmacyApi.createStockTransaction>) =>
    pharmacyApi.createStockTransaction(...args),
  listNdpsEntries: (...args: Parameters<typeof pharmacyApi.listNdpsEntries>) =>
    pharmacyApi.listNdpsEntries(...args),
  getNdpsBalance: (...args: Parameters<typeof pharmacyApi.getNdpsBalance>) =>
    pharmacyApi.getNdpsBalance(...args),
  createNdpsEntry: (...args: Parameters<typeof pharmacyApi.createNdpsEntry>) =>
    pharmacyApi.createNdpsEntry(...args),
  listPharmacyBatches: (...args: Parameters<typeof pharmacyApi.listPharmacyBatches>) =>
    pharmacyApi.listPharmacyBatches(...args),
  createPharmacyBatch: (...args: Parameters<typeof pharmacyApi.createPharmacyBatch>) =>
    pharmacyApi.createPharmacyBatch(...args),
  getNearExpiryReport: (...args: Parameters<typeof pharmacyApi.getNearExpiryReport>) =>
    pharmacyApi.getNearExpiryReport(...args),
  listExpiredBatches: (...args: Parameters<typeof pharmacyApi.listExpiredBatches>) =>
    pharmacyApi.listExpiredBatches(...args),
  writeOffExpired: (...args: Parameters<typeof pharmacyApi.writeOffExpired>) =>
    pharmacyApi.writeOffExpired(...args),
  getLocationStockDashboard: () => pharmacyApi.getLocationStockDashboard(),
  listWardStock: (...args: Parameters<typeof pharmacyApi.listWardStock>) =>
    pharmacyApi.listWardStock(...args),
  setWardPar: (...args: Parameters<typeof pharmacyApi.setWardPar>) =>
    pharmacyApi.setWardPar(...args),
  replenishWard: (...args: Parameters<typeof pharmacyApi.replenishWard>) =>
    pharmacyApi.replenishWard(...args),
  consumeWardStock: (...args: Parameters<typeof pharmacyApi.consumeWardStock>) =>
    pharmacyApi.consumeWardStock(...args),
  getPharmacyDeadStock: (...args: Parameters<typeof pharmacyApi.getPharmacyDeadStock>) =>
    pharmacyApi.getPharmacyDeadStock(...args),
  listPharmacyStoreAssignments: (
    ...args: Parameters<typeof pharmacyApi.listPharmacyStoreAssignments>
  ) => pharmacyApi.listPharmacyStoreAssignments(...args),
  createStoreLocation: (...args: Parameters<typeof procurementApi.createStoreLocation>) =>
    procurementApi.createStoreLocation(...args),
  createPharmacyStoreAssignment: (
    ...args: Parameters<typeof pharmacyApi.createPharmacyStoreAssignment>
  ) => pharmacyApi.createPharmacyStoreAssignment(...args),
  listDepartments: (...args: Parameters<typeof setupApi.listDepartments>) =>
    setupApi.listDepartments(...args),
  listSetupUsers: (...args: Parameters<typeof setupApi.listSetupUsers>) =>
    setupApi.listSetupUsers(...args),
  myPharmacies: (...args: Parameters<typeof pharmacyApi.myPharmacies>) =>
    pharmacyApi.myPharmacies(...args),
  listPharmacyStaff: (...args: Parameters<typeof pharmacyApi.listPharmacyStaff>) =>
    pharmacyApi.listPharmacyStaff(...args),
  assignPharmacyStaff: (...args: Parameters<typeof pharmacyApi.assignPharmacyStaff>) =>
    pharmacyApi.assignPharmacyStaff(...args),
  removePharmacyStaff: (...args: Parameters<typeof pharmacyApi.removePharmacyStaff>) =>
    pharmacyApi.removePharmacyStaff(...args),
  listPharmacyTransfers: (...args: Parameters<typeof pharmacyApi.listPharmacyTransfers>) =>
    pharmacyApi.listPharmacyTransfers(...args),
  createPharmacyTransfer: (...args: Parameters<typeof pharmacyApi.createPharmacyTransfer>) =>
    pharmacyApi.createPharmacyTransfer(...args),
  approvePharmacyTransfer: (...args: Parameters<typeof pharmacyApi.approvePharmacyTransfer>) =>
    pharmacyApi.approvePharmacyTransfer(...args),
  dispatchPharmacyTransfer: (...args: Parameters<typeof pharmacyApi.dispatchPharmacyTransfer>) =>
    pharmacyApi.dispatchPharmacyTransfer(...args),
  receivePharmacyTransfer: (...args: Parameters<typeof pharmacyApi.receivePharmacyTransfer>) =>
    pharmacyApi.receivePharmacyTransfer(...args),
  getPharmacyConsumption: (...args: Parameters<typeof pharmacyApi.getPharmacyConsumption>) =>
    pharmacyApi.getPharmacyConsumption(...args),
  getPharmacyAbcVed: (...args: Parameters<typeof pharmacyApi.getPharmacyAbcVed>) =>
    pharmacyApi.getPharmacyAbcVed(...args),
  getDrugUtilization: (...args: Parameters<typeof pharmacyApi.getDrugUtilization>) =>
    pharmacyApi.getDrugUtilization(...args),
  listRxQueue: (...args: Parameters<typeof pharmacyApi.listRxQueue>) =>
    pharmacyApi.listRxQueue(...args),
  reviewPrescription: (...args: Parameters<typeof pharmacyApi.reviewPrescription>) =>
    pharmacyApi.reviewPrescription(...args),
  getRxDetail: (...args: Parameters<typeof pharmacyApi.getRxDetail>) =>
    pharmacyApi.getRxDetail(...args),
  getPosDaySummary: (...args: Parameters<typeof pharmacyApi.getPosDaySummary>) =>
    pharmacyApi.getPosDaySummary(...args),
  listPosSales: (...args: Parameters<typeof pharmacyApi.listPosSales>) =>
    pharmacyApi.listPosSales(...args),
  getPosSale: (...args: Parameters<typeof pharmacyApi.getPosSale>) =>
    pharmacyApi.getPosSale(...args),
  getPosPrices: (...args: Parameters<typeof pharmacyApi.getPosPrices>) =>
    pharmacyApi.getPosPrices(...args),
  searchCounterPatients: (...args: Parameters<typeof pharmacyApi.searchCounterPatients>) =>
    pharmacyApi.searchCounterPatients(...args),
  listPosSaleItems: (...args: Parameters<typeof pharmacyApi.listPosSaleItems>) =>
    pharmacyApi.listPosSaleItems(...args),
  createPosSale: (...args: Parameters<typeof pharmacyApi.createPosSale>) =>
    pharmacyApi.createPosSale(...args),
  cancelPharmacyPosSale: (...args: Parameters<typeof pharmacyApi.cancelPharmacyPosSale>) =>
    pharmacyApi.cancelPharmacyPosSale(...args),
  returnPosItems: (...args: Parameters<typeof pharmacyApi.returnPosItems>) =>
    pharmacyApi.returnPosItems(...args),
  getPosReturnable: (saleId: string) => pharmacyApi.getPosReturnable(saleId),
  lookupPosReceipt: (number: string) => pharmacyApi.lookupPosReceipt(number),
  listPharmacyCreditNotes: (...args: Parameters<typeof pharmacyApi.listPharmacyCreditNotes>) =>
    pharmacyApi.listPharmacyCreditNotes(...args),
  approvePharmacyCreditNote: (...args: Parameters<typeof pharmacyApi.approvePharmacyCreditNote>) =>
    pharmacyApi.approvePharmacyCreditNote(...args),
  settlePharmacyCreditNote: (...args: Parameters<typeof pharmacyApi.settlePharmacyCreditNote>) =>
    pharmacyApi.settlePharmacyCreditNote(...args),
  cancelPharmacyCreditNote: (...args: Parameters<typeof pharmacyApi.cancelPharmacyCreditNote>) =>
    pharmacyApi.cancelPharmacyCreditNote(...args),
  createPharmacyCreditNote: (...args: Parameters<typeof pharmacyApi.createPharmacyCreditNote>) =>
    pharmacyApi.createPharmacyCreditNote(...args),
  listPharmacyReturns: (...args: Parameters<typeof pharmacyApi.listPharmacyReturns>) =>
    pharmacyApi.listPharmacyReturns(...args),
  createPharmacyReturn: (...args: Parameters<typeof pharmacyApi.createPharmacyReturn>) =>
    pharmacyApi.createPharmacyReturn(...args),
  createPharmacyReturns: (...args: Parameters<typeof pharmacyApi.createPharmacyReturns>) =>
    pharmacyApi.createPharmacyReturns(...args),
  processPharmacyReturn: (...args: Parameters<typeof pharmacyApi.processPharmacyReturn>) =>
    pharmacyApi.processPharmacyReturn(...args),
  listPatientOrdersForReturn: (
    ...args: Parameters<typeof pharmacyApi.listPatientOrdersForReturn>
  ) => pharmacyApi.listPatientOrdersForReturn(...args),
  listPharmacyStoreIndents: (...args: Parameters<typeof pharmacyApi.listPharmacyStoreIndents>) =>
    pharmacyApi.listPharmacyStoreIndents(...args),
  approvePharmacyStoreIndent: (
    ...args: Parameters<typeof pharmacyApi.approvePharmacyStoreIndent>
  ) => pharmacyApi.approvePharmacyStoreIndent(...args),
  issuePharmacyStoreIndent: (...args: Parameters<typeof pharmacyApi.issuePharmacyStoreIndent>) =>
    pharmacyApi.issuePharmacyStoreIndent(...args),
  receivePharmacyStoreIndent: (
    ...args: Parameters<typeof pharmacyApi.receivePharmacyStoreIndent>
  ) => pharmacyApi.receivePharmacyStoreIndent(...args),
  listStoreLocations: (...args: Parameters<typeof procurementApi.listStoreLocations>) =>
    procurementApi.listStoreLocations(...args),
  listStoreCatalog: (...args: Parameters<typeof indentApi.listStoreCatalog>) =>
    indentApi.listStoreCatalog(...args),
  createPharmacyStoreIndent: (...args: Parameters<typeof pharmacyApi.createPharmacyStoreIndent>) =>
    pharmacyApi.createPharmacyStoreIndent(...args),
  // ── Fulfilment ────────────────────────────────────────
  listFulfilmentQueue: (...args: Parameters<typeof pharmacyApi.listFulfilmentQueue>) =>
    pharmacyApi.listFulfilmentQueue(...args),
  getFulfilmentPickList: (...args: Parameters<typeof pharmacyApi.getFulfilmentPickList>) =>
    pharmacyApi.getFulfilmentPickList(...args),
  claimFulfilmentOrder: (...args: Parameters<typeof pharmacyApi.claimFulfilmentOrder>) =>
    pharmacyApi.claimFulfilmentOrder(...args),
  packFulfilmentOrder: (...args: Parameters<typeof pharmacyApi.packFulfilmentOrder>) =>
    pharmacyApi.packFulfilmentOrder(...args),
  verifyFulfilmentLine: (...args: Parameters<typeof pharmacyApi.verifyFulfilmentLine>) =>
    pharmacyApi.verifyFulfilmentLine(...args),
  markFulfilmentVerified: (...args: Parameters<typeof pharmacyApi.markFulfilmentVerified>) =>
    pharmacyApi.markFulfilmentVerified(...args),
  markFulfilmentReady: (...args: Parameters<typeof pharmacyApi.markFulfilmentReady>) =>
    pharmacyApi.markFulfilmentReady(...args),
  collectFulfilmentOrder: (...args: Parameters<typeof pharmacyApi.collectFulfilmentOrder>) =>
    pharmacyApi.collectFulfilmentOrder(...args),
  releaseFulfilmentOrder: (...args: Parameters<typeof pharmacyApi.releaseFulfilmentOrder>) =>
    pharmacyApi.releaseFulfilmentOrder(...args),
  cancelFulfilmentOrder: (...args: Parameters<typeof pharmacyApi.cancelFulfilmentOrder>) =>
    pharmacyApi.cancelFulfilmentOrder(...args),
  lookupPosSale: (...args: Parameters<typeof pharmacyApi.lookupPosSale>) =>
    pharmacyApi.lookupPosSale(...args),
};
