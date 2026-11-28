import { pharmacyApi } from "@medbrains/api/modules/pharmacy";
import { procurementApi } from "@medbrains/api/modules/procurement";
import { uploadApi } from "@medbrains/api/modules/upload";

export const grnScanService = {
  listScans: procurementApi.listGrnScans,
  createScan: procurementApi.createGrnScan,
  getReview: procurementApi.getGrnScanReview,
  saveDraft: procurementApi.saveGrnScanDraft,
  submitScan: procurementApi.submitGrnScan,
  discardScan: procurementApi.discardGrnScan,
  commitScan: procurementApi.commitGrnScan,
  searchItems: procurementApi.searchGrnScanItems,
  getAccuracy: procurementApi.getGrnScanAccuracy,
  presignUpload: uploadApi.presignUpload,
  listCatalogDuplicates: pharmacyApi.listPharmacyCatalogDuplicates,
  mergeCatalogItems: pharmacyApi.mergePharmacyCatalogItems,
};
