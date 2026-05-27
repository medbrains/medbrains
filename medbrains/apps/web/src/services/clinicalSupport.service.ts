import { api } from "@medbrains/api";

export const clinicalSupportService = {
  listRadiologyModalities: (...args: Parameters<typeof api.listRadiologyModalities>) =>
    api.listRadiologyModalities(...args),
  getTenantSettings: (...args: Parameters<typeof api.getTenantSettings>) =>
    api.getTenantSettings(...args),
  listPharmacyCatalog: (...args: Parameters<typeof api.listPharmacyCatalog>) =>
    api.listPharmacyCatalog(...args),
  listPrescriptionTemplates: (...args: Parameters<typeof api.listPrescriptionTemplates>) =>
    api.listPrescriptionTemplates(...args),
  createPrescriptionTemplate: (...args: Parameters<typeof api.createPrescriptionTemplate>) =>
    api.createPrescriptionTemplate(...args),
  deletePrescriptionTemplate: (...args: Parameters<typeof api.deletePrescriptionTemplate>) =>
    api.deletePrescriptionTemplate(...args),
  checkDrugSafety: (...args: Parameters<typeof api.checkDrugSafety>) =>
    api.checkDrugSafety(...args),
  searchIcd10: (...args: Parameters<typeof api.searchIcd10>) => api.searchIcd10(...args),
  searchIcd11: (...args: Parameters<typeof api.searchIcd11>) => api.searchIcd11(...args),
  searchClinicalCorpus: (...args: Parameters<typeof api.searchClinicalCorpus>) =>
    api.searchClinicalCorpus(...args),
  createClinicalCorpusEntry: (...args: Parameters<typeof api.createClinicalCorpusEntry>) =>
    api.createClinicalCorpusEntry(...args),
  updateClinicalCorpusEntry: (...args: Parameters<typeof api.updateClinicalCorpusEntry>) =>
    api.updateClinicalCorpusEntry(...args),
  searchTerminology: (...args: Parameters<typeof api.searchTerminology>) =>
    api.searchTerminology(...args),
  searchTerminologyWithSuggestions: (
    ...args: Parameters<typeof api.searchTerminologyWithSuggestions>
  ) => api.searchTerminologyWithSuggestions(...args),
  lookupTerminology: (...args: Parameters<typeof api.lookupTerminology>) =>
    api.lookupTerminology(...args),
  searchSnomed: (...args: Parameters<typeof api.searchSnomed>) => api.searchSnomed(...args),
};
