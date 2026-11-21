import { cdsApi } from "@medbrains/api/modules/cds";
import { opdApi } from "@medbrains/api/modules/opd";
import { pharmacyApi } from "@medbrains/api/modules/pharmacy";
import { radiologyApi } from "@medbrains/api/modules/radiology";
import { setupApi } from "@medbrains/api/modules/setup";
import { terminologyApi } from "@medbrains/api/modules/terminology";

export const clinicalSupportService = {
  listLiveStewardshipRequests: (...args: Parameters<typeof opdApi.listLiveStewardshipRequests>) =>
    opdApi.listLiveStewardshipRequests(...args),
  listRadiologyExams: (...args: Parameters<typeof radiologyApi.listRadiologyExams>) =>
    radiologyApi.listRadiologyExams(...args),
  listRadiologyModalities: (...args: Parameters<typeof radiologyApi.listRadiologyModalities>) =>
    radiologyApi.listRadiologyModalities(...args),
  getTenantSettings: (...args: Parameters<typeof setupApi.getTenantSettings>) =>
    setupApi.getTenantSettings(...args),
  listPharmacyCatalog: (...args: Parameters<typeof pharmacyApi.listPharmacyCatalog>) =>
    pharmacyApi.listPharmacyCatalog(...args),
  listPrescriptionTemplates: (...args: Parameters<typeof opdApi.listPrescriptionTemplates>) =>
    opdApi.listPrescriptionTemplates(...args),
  createPrescriptionTemplate: (...args: Parameters<typeof opdApi.createPrescriptionTemplate>) =>
    opdApi.createPrescriptionTemplate(...args),
  deletePrescriptionTemplate: (...args: Parameters<typeof opdApi.deletePrescriptionTemplate>) =>
    opdApi.deletePrescriptionTemplate(...args),
  checkDrugSafety: (...args: Parameters<typeof cdsApi.checkDrugSafety>) =>
    cdsApi.checkDrugSafety(...args),
  searchIcd11: (...args: Parameters<typeof opdApi.searchIcd11>) => opdApi.searchIcd11(...args),
  searchClinicalCorpus: (...args: Parameters<typeof opdApi.searchClinicalCorpus>) =>
    opdApi.searchClinicalCorpus(...args),
  createClinicalCorpusEntry: (...args: Parameters<typeof opdApi.createClinicalCorpusEntry>) =>
    opdApi.createClinicalCorpusEntry(...args),
  updateClinicalCorpusEntry: (...args: Parameters<typeof opdApi.updateClinicalCorpusEntry>) =>
    opdApi.updateClinicalCorpusEntry(...args),
  searchTerminology: (...args: Parameters<typeof terminologyApi.searchTerminology>) =>
    terminologyApi.searchTerminology(...args),
  searchTerminologyWithSuggestions: (
    ...args: Parameters<typeof terminologyApi.searchTerminologyWithSuggestions>
  ) => terminologyApi.searchTerminologyWithSuggestions(...args),
  lookupTerminology: (...args: Parameters<typeof terminologyApi.lookupTerminology>) =>
    terminologyApi.lookupTerminology(...args),
  searchSnomed: (...args: Parameters<typeof opdApi.searchSnomed>) => opdApi.searchSnomed(...args),
};
