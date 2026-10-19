import { api } from "@medbrains/api";

/** SNOMED CT store: releases, search, hierarchy, ECL and analytics. */
export const snomedService = {
  getStatus: api.getSnomedStatus,
  search: api.searchSnomedConcepts,
  getConcept: api.getSnomedConcept,
  getHierarchy: api.getSnomedHierarchy,
  checkSubsumption: api.checkSnomedSubsumption,
  evaluateEcl: api.evaluateSnomedEcl,
  countCodedRecords: api.countSnomedCodedRecords,
  rollupCodedRecords: api.rollupSnomedCodedRecords,
  listReleases: api.listSnomedReleases,
  getRelease: api.getSnomedRelease,
  uploadRelease: api.uploadSnomedRelease,
  listImportFiles: api.listSnomedImportFiles,
  importFromPath: api.importSnomedReleaseFromPath,
};

/** Shown wherever SNOMED CT is missing, instead of an empty result. */
export const SNOMED_NOT_LOADED =
  "SNOMED CT is not loaded yet — upload the release when the licence is approved.";
