import { api } from "@medbrains/api";

export const documentsService = {
  listDocumentTemplates: (...args: Parameters<typeof api.listDocumentTemplates>) =>
    api.listDocumentTemplates(...args),
  createDocumentTemplate: (...args: Parameters<typeof api.createDocumentTemplate>) =>
    api.createDocumentTemplate(...args),
  updateDocumentTemplate: (...args: Parameters<typeof api.updateDocumentTemplate>) =>
    api.updateDocumentTemplate(...args),
  deleteDocumentTemplate: (...args: Parameters<typeof api.deleteDocumentTemplate>) =>
    api.deleteDocumentTemplate(...args),
  setDefaultTemplate: (...args: Parameters<typeof api.setDefaultTemplate>) =>
    api.setDefaultTemplate(...args),
  listDocumentOutputs: (...args: Parameters<typeof api.listDocumentOutputs>) =>
    api.listDocumentOutputs(...args),
  voidDocumentOutput: (...args: Parameters<typeof api.voidDocumentOutput>) =>
    api.voidDocumentOutput(...args),
  listReviewSchedule: (...args: Parameters<typeof api.listReviewSchedule>) =>
    api.listReviewSchedule(...args),
  createReviewSchedule: (...args: Parameters<typeof api.createReviewSchedule>) =>
    api.createReviewSchedule(...args),
  markReviewed: (...args: Parameters<typeof api.markReviewed>) => api.markReviewed(...args),
  listPrinters: (...args: Parameters<typeof api.listPrinters>) => api.listPrinters(...args),
  createPrinter: (...args: Parameters<typeof api.createPrinter>) => api.createPrinter(...args),
  listPrintJobs: (...args: Parameters<typeof api.listPrintJobs>) => api.listPrintJobs(...args),
  updatePrintJob: (...args: Parameters<typeof api.updatePrintJob>) => api.updatePrintJob(...args),
};
