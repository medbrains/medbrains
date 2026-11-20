import { documentsApi } from "@medbrains/api/modules/documents";

export const documentsService = {
  listDocumentTemplates: (...args: Parameters<typeof documentsApi.listDocumentTemplates>) =>
    documentsApi.listDocumentTemplates(...args),
  createDocumentTemplate: (...args: Parameters<typeof documentsApi.createDocumentTemplate>) =>
    documentsApi.createDocumentTemplate(...args),
  updateDocumentTemplate: (...args: Parameters<typeof documentsApi.updateDocumentTemplate>) =>
    documentsApi.updateDocumentTemplate(...args),
  deleteDocumentTemplate: (...args: Parameters<typeof documentsApi.deleteDocumentTemplate>) =>
    documentsApi.deleteDocumentTemplate(...args),
  setDefaultTemplate: (...args: Parameters<typeof documentsApi.setDefaultTemplate>) =>
    documentsApi.setDefaultTemplate(...args),
  listDocumentOutputs: (...args: Parameters<typeof documentsApi.listDocumentOutputs>) =>
    documentsApi.listDocumentOutputs(...args),
  voidDocumentOutput: (...args: Parameters<typeof documentsApi.voidDocumentOutput>) =>
    documentsApi.voidDocumentOutput(...args),
  listReviewSchedule: (...args: Parameters<typeof documentsApi.listReviewSchedule>) =>
    documentsApi.listReviewSchedule(...args),
  createReviewSchedule: (...args: Parameters<typeof documentsApi.createReviewSchedule>) =>
    documentsApi.createReviewSchedule(...args),
  markReviewed: (...args: Parameters<typeof documentsApi.markReviewed>) =>
    documentsApi.markReviewed(...args),
  listPrinters: (...args: Parameters<typeof documentsApi.listPrinters>) =>
    documentsApi.listPrinters(...args),
  createPrinter: (...args: Parameters<typeof documentsApi.createPrinter>) =>
    documentsApi.createPrinter(...args),
  setPrinterActive: (id: string, isActive: boolean) => documentsApi.setPrinterActive(id, isActive),
  listPrintJobs: (...args: Parameters<typeof documentsApi.listPrintJobs>) =>
    documentsApi.listPrintJobs(...args),
  updatePrintJob: (...args: Parameters<typeof documentsApi.updatePrintJob>) =>
    documentsApi.updatePrintJob(...args),
};
