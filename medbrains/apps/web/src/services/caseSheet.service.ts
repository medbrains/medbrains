import { caseSheetsApi } from "@medbrains/api/modules/case-sheets";
import { uploadApi } from "@medbrains/api/modules/upload";

export const caseSheetService = {
  listScans: caseSheetsApi.listCaseSheetScans,
  getScan: caseSheetsApi.getCaseSheetScan,
  createScan: caseSheetsApi.createCaseSheetScan,
  submitScan: caseSheetsApi.submitCaseSheetScan,
  saveReview: caseSheetsApi.saveCaseSheetReview,
  commitScan: caseSheetsApi.commitCaseSheetScan,
  presignDownload: uploadApi.presignDownload,
};
