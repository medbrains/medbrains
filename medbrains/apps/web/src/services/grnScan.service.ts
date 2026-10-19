import { api } from "@medbrains/api";

export const grnScanService = {
  listScans: api.listGrnScans,
  createScan: api.createGrnScan,
  getReview: api.getGrnScanReview,
  saveDraft: api.saveGrnScanDraft,
  submitScan: api.submitGrnScan,
  discardScan: api.discardGrnScan,
  commitScan: api.commitGrnScan,
  searchItems: api.searchGrnScanItems,
  getAccuracy: api.getGrnScanAccuracy,
  presignUpload: api.presignUpload,
  listCatalogDuplicates: api.listPharmacyCatalogDuplicates,
  mergeCatalogItems: api.mergePharmacyCatalogItems,
};
