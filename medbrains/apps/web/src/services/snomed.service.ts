import { terminologyApi } from "@medbrains/api/modules/terminology";

/** SNOMED CT store: releases, search, hierarchy, ECL and analytics. */
export const snomedService = {
  getStatus: terminologyApi.getSnomedStatus,
  search: terminologyApi.searchSnomedConcepts,
  getConcept: terminologyApi.getSnomedConcept,
  getHierarchy: terminologyApi.getSnomedHierarchy,
  checkSubsumption: terminologyApi.checkSnomedSubsumption,
  evaluateEcl: terminologyApi.evaluateSnomedEcl,
  countCodedRecords: terminologyApi.countSnomedCodedRecords,
  rollupCodedRecords: terminologyApi.rollupSnomedCodedRecords,
  listReleases: terminologyApi.listSnomedReleases,
  getRelease: terminologyApi.getSnomedRelease,
  uploadRelease: terminologyApi.uploadSnomedRelease,
  listImportFiles: terminologyApi.listSnomedImportFiles,
  importFromPath: terminologyApi.importSnomedReleaseFromPath,
};

/** Shown wherever SNOMED CT is missing, instead of an empty result. */
export const SNOMED_NOT_LOADED =
  "SNOMED CT is not loaded yet — upload the release when the licence is approved.";
