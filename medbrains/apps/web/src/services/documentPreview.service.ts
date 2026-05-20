import { api } from "@medbrains/api";

export const documentPreviewService = {
  getDocumentOutput: (...args: Parameters<typeof api.getDocumentOutput>) =>
    api.getDocumentOutput(...args),
  generateDocument: (...args: Parameters<typeof api.generateDocument>) =>
    api.generateDocument(...args),
  recordDocumentPrint: (...args: Parameters<typeof api.recordDocumentPrint>) =>
    api.recordDocumentPrint(...args),
  voidDocumentOutput: (...args: Parameters<typeof api.voidDocumentOutput>) =>
    api.voidDocumentOutput(...args),
};
