import { api } from "@medbrains/api";
import type {
  CreateSubstitutionInput,
  FefoBatch,
  PharmacySubstitution,
  RepeatEligibility,
} from "@medbrains/types";

export const pharmacyService = {
  selectFefoBatch: (data: {
    catalog_item_id: string;
    quantity_needed: number;
    store_location_id?: string;
  }) => api.selectFefoBatch(data) as Promise<{ batches: FefoBatch[] }>,
  dispenseRepeat: (...args: Parameters<typeof api.dispenseRepeat>) => api.dispenseRepeat(...args),
  checkRepeatEligibility: (prescriptionId: string) =>
    api.checkRepeatEligibility(prescriptionId) as Promise<RepeatEligibility>,
  createSubstitution: (data: CreateSubstitutionInput) =>
    api.createSubstitution(
      data as unknown as Record<string, unknown>,
    ) as Promise<PharmacySubstitution>,
  listSubstitutionsForItem: (itemId: string) =>
    api.listSubstitutionsForItem(itemId) as Promise<PharmacySubstitution[]>,
  getTenantSettings: (...args: Parameters<typeof api.getTenantSettings>) =>
    api.getTenantSettings(...args),
  listPharmacyOrders: (...args: Parameters<typeof api.listPharmacyOrders>) =>
    api.listPharmacyOrders(...args),
  dispenseOrder: (...args: Parameters<typeof api.dispenseOrder>) => api.dispenseOrder(...args),
  listPatientAllergies: (...args: Parameters<typeof api.listPatientAllergies>) =>
    api.listPatientAllergies(...args),
  cancelPharmacyOrder: (...args: Parameters<typeof api.cancelPharmacyOrder>) =>
    api.cancelPharmacyOrder(...args),
  createOtcSale: (...args: Parameters<typeof api.createOtcSale>) => api.createOtcSale(...args),
  createPharmacyOrder: (...args: Parameters<typeof api.createPharmacyOrder>) =>
    api.createPharmacyOrder(...args),
  getPharmacyOrder: (...args: Parameters<typeof api.getPharmacyOrder>) =>
    api.getPharmacyOrder(...args),
  getPrescription: (...args: Parameters<typeof api.getPrescription>) =>
    api.getPrescription(...args),
  updatePharmacyOrderItem: (...args: Parameters<typeof api.updatePharmacyOrderItem>) =>
    api.updatePharmacyOrderItem(...args),
  removePharmacyOrderItem: (...args: Parameters<typeof api.removePharmacyOrderItem>) =>
    api.removePharmacyOrderItem(...args),
  prescriptionAudit: (...args: Parameters<typeof api.prescriptionAudit>) =>
    api.prescriptionAudit(...args),
  checkDrugInteractions: (...args: Parameters<typeof api.checkDrugInteractions>) =>
    api.checkDrugInteractions(...args),
  formularyCheck: (...args: Parameters<typeof api.formularyCheck>) => api.formularyCheck(...args),
  listPharmacyCatalog: (...args: Parameters<typeof api.listPharmacyCatalog>) =>
    api.listPharmacyCatalog(...args),
  importPharmacyCatalog: (...args: Parameters<typeof api.importPharmacyCatalog>) =>
    api.importPharmacyCatalog(...args),
  createPharmacyCatalog: (...args: Parameters<typeof api.createPharmacyCatalog>) =>
    api.createPharmacyCatalog(...args),
  listStock: (...args: Parameters<typeof api.listStock>) => api.listStock(...args),
  createStockTransaction: (...args: Parameters<typeof api.createStockTransaction>) =>
    api.createStockTransaction(...args),
  listNdpsEntries: (...args: Parameters<typeof api.listNdpsEntries>) =>
    api.listNdpsEntries(...args),
  getNdpsBalance: (...args: Parameters<typeof api.getNdpsBalance>) => api.getNdpsBalance(...args),
  createNdpsEntry: (...args: Parameters<typeof api.createNdpsEntry>) =>
    api.createNdpsEntry(...args),
  listPharmacyBatches: (...args: Parameters<typeof api.listPharmacyBatches>) =>
    api.listPharmacyBatches(...args),
  createPharmacyBatch: (...args: Parameters<typeof api.createPharmacyBatch>) =>
    api.createPharmacyBatch(...args),
  getNearExpiryReport: (...args: Parameters<typeof api.getNearExpiryReport>) =>
    api.getNearExpiryReport(...args),
  writeOffExpired: (...args: Parameters<typeof api.writeOffExpired>) =>
    api.writeOffExpired(...args),
  getPharmacyDeadStock: (...args: Parameters<typeof api.getPharmacyDeadStock>) =>
    api.getPharmacyDeadStock(...args),
  listPharmacyStoreAssignments: (...args: Parameters<typeof api.listPharmacyStoreAssignments>) =>
    api.listPharmacyStoreAssignments(...args),
  createStoreLocation: (...args: Parameters<typeof api.createStoreLocation>) =>
    api.createStoreLocation(...args),
  createPharmacyStoreAssignment: (...args: Parameters<typeof api.createPharmacyStoreAssignment>) =>
    api.createPharmacyStoreAssignment(...args),
  listDepartments: (...args: Parameters<typeof api.listDepartments>) =>
    api.listDepartments(...args),
  listSetupUsers: (...args: Parameters<typeof api.listSetupUsers>) => api.listSetupUsers(...args),
  myPharmacies: (...args: Parameters<typeof api.myPharmacies>) => api.myPharmacies(...args),
  listPharmacyStaff: (...args: Parameters<typeof api.listPharmacyStaff>) =>
    api.listPharmacyStaff(...args),
  assignPharmacyStaff: (...args: Parameters<typeof api.assignPharmacyStaff>) =>
    api.assignPharmacyStaff(...args),
  removePharmacyStaff: (...args: Parameters<typeof api.removePharmacyStaff>) =>
    api.removePharmacyStaff(...args),
  listPharmacyTransfers: (...args: Parameters<typeof api.listPharmacyTransfers>) =>
    api.listPharmacyTransfers(...args),
  approvePharmacyTransfer: (...args: Parameters<typeof api.approvePharmacyTransfer>) =>
    api.approvePharmacyTransfer(...args),
  dispatchPharmacyTransfer: (...args: Parameters<typeof api.dispatchPharmacyTransfer>) =>
    api.dispatchPharmacyTransfer(...args),
  receivePharmacyTransfer: (...args: Parameters<typeof api.receivePharmacyTransfer>) =>
    api.receivePharmacyTransfer(...args),
  getPharmacyConsumption: (...args: Parameters<typeof api.getPharmacyConsumption>) =>
    api.getPharmacyConsumption(...args),
  getPharmacyAbcVed: (...args: Parameters<typeof api.getPharmacyAbcVed>) =>
    api.getPharmacyAbcVed(...args),
  getDrugUtilization: (...args: Parameters<typeof api.getDrugUtilization>) =>
    api.getDrugUtilization(...args),
  listRxQueue: (...args: Parameters<typeof api.listRxQueue>) => api.listRxQueue(...args),
  reviewPrescription: (...args: Parameters<typeof api.reviewPrescription>) =>
    api.reviewPrescription(...args),
  getRxDetail: (...args: Parameters<typeof api.getRxDetail>) => api.getRxDetail(...args),
  getPosDaySummary: (...args: Parameters<typeof api.getPosDaySummary>) =>
    api.getPosDaySummary(...args),
  listPosSales: (...args: Parameters<typeof api.listPosSales>) => api.listPosSales(...args),
  listPosSaleItems: (...args: Parameters<typeof api.listPosSaleItems>) =>
    api.listPosSaleItems(...args),
  createPosSale: (...args: Parameters<typeof api.createPosSale>) => api.createPosSale(...args),
  cancelPharmacyPosSale: (...args: Parameters<typeof api.cancelPharmacyPosSale>) =>
    api.cancelPharmacyPosSale(...args),
  returnPosItems: (...args: Parameters<typeof api.returnPosItems>) => api.returnPosItems(...args),
  listPharmacyCreditNotes: (...args: Parameters<typeof api.listPharmacyCreditNotes>) =>
    api.listPharmacyCreditNotes(...args),
  approvePharmacyCreditNote: (...args: Parameters<typeof api.approvePharmacyCreditNote>) =>
    api.approvePharmacyCreditNote(...args),
  settlePharmacyCreditNote: (...args: Parameters<typeof api.settlePharmacyCreditNote>) =>
    api.settlePharmacyCreditNote(...args),
  cancelPharmacyCreditNote: (...args: Parameters<typeof api.cancelPharmacyCreditNote>) =>
    api.cancelPharmacyCreditNote(...args),
  createPharmacyCreditNote: (...args: Parameters<typeof api.createPharmacyCreditNote>) =>
    api.createPharmacyCreditNote(...args),
  listPharmacyReturns: (...args: Parameters<typeof api.listPharmacyReturns>) =>
    api.listPharmacyReturns(...args),
  createPharmacyReturn: (...args: Parameters<typeof api.createPharmacyReturn>) =>
    api.createPharmacyReturn(...args),
  createPharmacyReturns: (...args: Parameters<typeof api.createPharmacyReturns>) =>
    api.createPharmacyReturns(...args),
  processPharmacyReturn: (...args: Parameters<typeof api.processPharmacyReturn>) =>
    api.processPharmacyReturn(...args),
  listPatientOrdersForReturn: (...args: Parameters<typeof api.listPatientOrdersForReturn>) =>
    api.listPatientOrdersForReturn(...args),
  listPharmacyStoreIndents: (...args: Parameters<typeof api.listPharmacyStoreIndents>) =>
    api.listPharmacyStoreIndents(...args),
  approvePharmacyStoreIndent: (...args: Parameters<typeof api.approvePharmacyStoreIndent>) =>
    api.approvePharmacyStoreIndent(...args),
  issuePharmacyStoreIndent: (...args: Parameters<typeof api.issuePharmacyStoreIndent>) =>
    api.issuePharmacyStoreIndent(...args),
  receivePharmacyStoreIndent: (...args: Parameters<typeof api.receivePharmacyStoreIndent>) =>
    api.receivePharmacyStoreIndent(...args),
  listStoreLocations: (...args: Parameters<typeof api.listStoreLocations>) =>
    api.listStoreLocations(...args),
  listStoreCatalog: (...args: Parameters<typeof api.listStoreCatalog>) =>
    api.listStoreCatalog(...args),
  createPharmacyStoreIndent: (...args: Parameters<typeof api.createPharmacyStoreIndent>) =>
    api.createPharmacyStoreIndent(...args),
  lookupPosSale: (...args: Parameters<typeof api.lookupPosSale>) => api.lookupPosSale(...args),
};
