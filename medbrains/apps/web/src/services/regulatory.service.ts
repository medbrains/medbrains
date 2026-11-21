import { qualityApi } from "@medbrains/api/modules/quality";
import { regulatoryApi } from "@medbrains/api/modules/regulatory";

export const regulatoryService = {
  getRegulatoryDashboard: (...args: Parameters<typeof regulatoryApi.getRegulatoryDashboard>) =>
    regulatoryApi.getRegulatoryDashboard(...args),
  licenseDashboard: (...args: Parameters<typeof regulatoryApi.licenseDashboard>) =>
    regulatoryApi.licenseDashboard(...args),
  listCalendarEvents: (...args: Parameters<typeof regulatoryApi.listCalendarEvents>) =>
    regulatoryApi.listCalendarEvents(...args),
  createCalendarEvent: (...args: Parameters<typeof regulatoryApi.createCalendarEvent>) =>
    regulatoryApi.createCalendarEvent(...args),
  updateCalendarEvent: (...args: Parameters<typeof regulatoryApi.updateCalendarEvent>) =>
    regulatoryApi.updateCalendarEvent(...args),
  getOverdueCalendarEvents: (...args: Parameters<typeof regulatoryApi.getOverdueCalendarEvents>) =>
    regulatoryApi.getOverdueCalendarEvents(...args),
  listRegulatorySubmissions: (
    ...args: Parameters<typeof regulatoryApi.listRegulatorySubmissions>
  ) => regulatoryApi.listRegulatorySubmissions(...args),
  createRegulatorySubmission: (
    ...args: Parameters<typeof regulatoryApi.createRegulatorySubmission>
  ) => regulatoryApi.createRegulatorySubmission(...args),
  listChecklists: (...args: Parameters<typeof regulatoryApi.listChecklists>) =>
    regulatoryApi.listChecklists(...args),
  createChecklist: (...args: Parameters<typeof regulatoryApi.createChecklist>) =>
    regulatoryApi.createChecklist(...args),
  getChecklist: (...args: Parameters<typeof regulatoryApi.getChecklist>) =>
    regulatoryApi.getChecklist(...args),
  batchChecklistItems: (...args: Parameters<typeof regulatoryApi.batchChecklistItems>) =>
    regulatoryApi.batchChecklistItems(...args),
  updateChecklistItem: (...args: Parameters<typeof regulatoryApi.updateChecklistItem>) =>
    regulatoryApi.updateChecklistItem(...args),
  deleteChecklistItem: (...args: Parameters<typeof regulatoryApi.deleteChecklistItem>) =>
    regulatoryApi.deleteChecklistItem(...args),
  autoPopulateChecklist: (...args: Parameters<typeof regulatoryApi.autoPopulateChecklist>) =>
    regulatoryApi.autoPopulateChecklist(...args),
  getComplianceGaps: (...args: Parameters<typeof regulatoryApi.getComplianceGaps>) =>
    regulatoryApi.getComplianceGaps(...args),
  listPcpndtForms: (...args: Parameters<typeof regulatoryApi.listPcpndtForms>) =>
    regulatoryApi.listPcpndtForms(...args),
  completePcpndtForm: (...args: Parameters<typeof regulatoryApi.completePcpndtForm>) =>
    regulatoryApi.completePcpndtForm(...args),
  createPcpndtForm: (...args: Parameters<typeof regulatoryApi.createPcpndtForm>) =>
    regulatoryApi.createPcpndtForm(...args),
  listAdrReports: (...args: Parameters<typeof regulatoryApi.listAdrReports>) =>
    regulatoryApi.listAdrReports(...args),
  createAdrReport: (...args: Parameters<typeof regulatoryApi.createAdrReport>) =>
    regulatoryApi.createAdrReport(...args),
  submitAdrToPvpi: (...args: Parameters<typeof regulatoryApi.submitAdrToPvpi>) =>
    regulatoryApi.submitAdrToPvpi(...args),
  listMvReports: (...args: Parameters<typeof regulatoryApi.listMvReports>) =>
    regulatoryApi.listMvReports(...args),
  createMvReport: (...args: Parameters<typeof regulatoryApi.createMvReport>) =>
    regulatoryApi.createMvReport(...args),
  submitMvToCdsco: (...args: Parameters<typeof regulatoryApi.submitMvToCdsco>) =>
    regulatoryApi.submitMvToCdsco(...args),
  listMockSurveys: (...args: Parameters<typeof regulatoryApi.listMockSurveys>) =>
    regulatoryApi.listMockSurveys(...args),
  createMockSurvey: (...args: Parameters<typeof regulatoryApi.createMockSurvey>) =>
    regulatoryApi.createMockSurvey(...args),
  listAccreditationStandards: (...args: Parameters<typeof qualityApi.listAccreditationStandards>) =>
    qualityApi.listAccreditationStandards(...args),
  listAccreditationCompliance: (
    ...args: Parameters<typeof qualityApi.listAccreditationCompliance>
  ) => qualityApi.listAccreditationCompliance(...args),
  updateAccreditationCompliance: (
    ...args: Parameters<typeof qualityApi.updateAccreditationCompliance>
  ) => qualityApi.updateAccreditationCompliance(...args),
  nablDocumentTracking: (...args: Parameters<typeof regulatoryApi.nablDocumentTracking>) =>
    regulatoryApi.nablDocumentTracking(...args),
  staffCredentials: (...args: Parameters<typeof regulatoryApi.staffCredentials>) =>
    regulatoryApi.staffCredentials(...args),
};
