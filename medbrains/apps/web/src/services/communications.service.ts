import { api } from "@medbrains/api";

export const communicationsService = {
  listCommMessages: (...args: Parameters<typeof api.listCommMessages>) =>
    api.listCommMessages(...args),
  createCommMessage: (...args: Parameters<typeof api.createCommMessage>) =>
    api.createCommMessage(...args),
  listClinicalMessages: (...args: Parameters<typeof api.listClinicalMessages>) =>
    api.listClinicalMessages(...args),
  createClinicalMessage: (...args: Parameters<typeof api.createClinicalMessage>) =>
    api.createClinicalMessage(...args),
  acknowledgeClinicalMessage: (...args: Parameters<typeof api.acknowledgeClinicalMessage>) =>
    api.acknowledgeClinicalMessage(...args),
  listCommAlerts: (...args: Parameters<typeof api.listCommAlerts>) => api.listCommAlerts(...args),
  acknowledgeCommAlert: (...args: Parameters<typeof api.acknowledgeCommAlert>) =>
    api.acknowledgeCommAlert(...args),
  resolveCommAlert: (...args: Parameters<typeof api.resolveCommAlert>) =>
    api.resolveCommAlert(...args),
  listComplaints: (...args: Parameters<typeof api.listComplaints>) => api.listComplaints(...args),
  createComplaint: (...args: Parameters<typeof api.createComplaint>) =>
    api.createComplaint(...args),
  resolveComplaint: (...args: Parameters<typeof api.resolveComplaint>) =>
    api.resolveComplaint(...args),
  listCommFeedback: (...args: Parameters<typeof api.listCommFeedback>) =>
    api.listCommFeedback(...args),
  getCommFeedbackStats: (...args: Parameters<typeof api.getCommFeedbackStats>) =>
    api.getCommFeedbackStats(...args),
  createCommFeedback: (...args: Parameters<typeof api.createCommFeedback>) =>
    api.createCommFeedback(...args),
  listCommTemplates: (...args: Parameters<typeof api.listCommTemplates>) =>
    api.listCommTemplates(...args),
  createCommTemplate: (...args: Parameters<typeof api.createCommTemplate>) =>
    api.createCommTemplate(...args),
  listDltTemplates: (...args: Parameters<typeof api.listDltTemplates>) =>
    api.listDltTemplates(...args),
  createDltTemplate: (...args: Parameters<typeof api.createDltTemplate>) =>
    api.createDltTemplate(...args),
  updateDltTemplate: (...args: Parameters<typeof api.updateDltTemplate>) =>
    api.updateDltTemplate(...args),
  deleteDltTemplate: (...args: Parameters<typeof api.deleteDltTemplate>) =>
    api.deleteDltTemplate(...args),
};
