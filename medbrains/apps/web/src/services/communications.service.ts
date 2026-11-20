import { communicationsApi } from "@medbrains/api/modules/communications";

export const communicationsService = {
  listCommMessages: (...args: Parameters<typeof communicationsApi.listCommMessages>) =>
    communicationsApi.listCommMessages(...args),
  createCommMessage: (...args: Parameters<typeof communicationsApi.createCommMessage>) =>
    communicationsApi.createCommMessage(...args),
  listClinicalMessages: (...args: Parameters<typeof communicationsApi.listClinicalMessages>) =>
    communicationsApi.listClinicalMessages(...args),
  createClinicalMessage: (...args: Parameters<typeof communicationsApi.createClinicalMessage>) =>
    communicationsApi.createClinicalMessage(...args),
  acknowledgeClinicalMessage: (
    ...args: Parameters<typeof communicationsApi.acknowledgeClinicalMessage>
  ) => communicationsApi.acknowledgeClinicalMessage(...args),
  listCommAlerts: (...args: Parameters<typeof communicationsApi.listCommAlerts>) =>
    communicationsApi.listCommAlerts(...args),
  acknowledgeCommAlert: (...args: Parameters<typeof communicationsApi.acknowledgeCommAlert>) =>
    communicationsApi.acknowledgeCommAlert(...args),
  resolveCommAlert: (...args: Parameters<typeof communicationsApi.resolveCommAlert>) =>
    communicationsApi.resolveCommAlert(...args),
  listComplaints: (...args: Parameters<typeof communicationsApi.listComplaints>) =>
    communicationsApi.listComplaints(...args),
  createComplaint: (...args: Parameters<typeof communicationsApi.createComplaint>) =>
    communicationsApi.createComplaint(...args),
  resolveComplaint: (...args: Parameters<typeof communicationsApi.resolveComplaint>) =>
    communicationsApi.resolveComplaint(...args),
  listCommFeedback: (...args: Parameters<typeof communicationsApi.listCommFeedback>) =>
    communicationsApi.listCommFeedback(...args),
  getCommFeedbackStats: (...args: Parameters<typeof communicationsApi.getCommFeedbackStats>) =>
    communicationsApi.getCommFeedbackStats(...args),
  createCommFeedback: (...args: Parameters<typeof communicationsApi.createCommFeedback>) =>
    communicationsApi.createCommFeedback(...args),
  listCommTemplates: (...args: Parameters<typeof communicationsApi.listCommTemplates>) =>
    communicationsApi.listCommTemplates(...args),
  createCommTemplate: (...args: Parameters<typeof communicationsApi.createCommTemplate>) =>
    communicationsApi.createCommTemplate(...args),
  listDltTemplates: (...args: Parameters<typeof communicationsApi.listDltTemplates>) =>
    communicationsApi.listDltTemplates(...args),
  createDltTemplate: (...args: Parameters<typeof communicationsApi.createDltTemplate>) =>
    communicationsApi.createDltTemplate(...args),
  updateDltTemplate: (...args: Parameters<typeof communicationsApi.updateDltTemplate>) =>
    communicationsApi.updateDltTemplate(...args),
  deleteDltTemplate: (...args: Parameters<typeof communicationsApi.deleteDltTemplate>) =>
    communicationsApi.deleteDltTemplate(...args),
};
