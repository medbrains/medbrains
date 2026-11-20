import { documentsApi } from "@medbrains/api/modules/documents";

export const documentPreviewService = {
  getDocumentOutput: (...args: Parameters<typeof documentsApi.getDocumentOutput>) =>
    documentsApi.getDocumentOutput(...args),
  generateDocument: (...args: Parameters<typeof documentsApi.generateDocument>) =>
    documentsApi.generateDocument(...args),
  recordDocumentPrint: (...args: Parameters<typeof documentsApi.recordDocumentPrint>) =>
    documentsApi.recordDocumentPrint(...args),
  voidDocumentOutput: (...args: Parameters<typeof documentsApi.voidDocumentOutput>) =>
    documentsApi.voidDocumentOutput(...args),
};
