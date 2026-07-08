import { api } from "@medbrains/api";

export const caseSheetService = {
  listScans: api.listCaseSheetScans,
  getScan: api.getCaseSheetScan,
  createScan: api.createCaseSheetScan,
  submitScan: api.submitCaseSheetScan,
  saveReview: api.saveCaseSheetReview,
  commitScan: api.commitCaseSheetScan,
  presignDownload: api.presignDownload,
};
