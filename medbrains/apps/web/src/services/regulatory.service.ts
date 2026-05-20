import { api } from "@medbrains/api";

export const regulatoryService = {
  getRegulatoryDashboard: (...args: Parameters<typeof api.getRegulatoryDashboard>) =>
    api.getRegulatoryDashboard(...args),
  licenseDashboard: (...args: Parameters<typeof api.licenseDashboard>) =>
    api.licenseDashboard(...args),
  listCalendarEvents: (...args: Parameters<typeof api.listCalendarEvents>) =>
    api.listCalendarEvents(...args),
  createCalendarEvent: (...args: Parameters<typeof api.createCalendarEvent>) =>
    api.createCalendarEvent(...args),
  updateCalendarEvent: (...args: Parameters<typeof api.updateCalendarEvent>) =>
    api.updateCalendarEvent(...args),
  getOverdueCalendarEvents: (...args: Parameters<typeof api.getOverdueCalendarEvents>) =>
    api.getOverdueCalendarEvents(...args),
  listRegulatorySubmissions: (...args: Parameters<typeof api.listRegulatorySubmissions>) =>
    api.listRegulatorySubmissions(...args),
  createRegulatorySubmission: (...args: Parameters<typeof api.createRegulatorySubmission>) =>
    api.createRegulatorySubmission(...args),
  listChecklists: (...args: Parameters<typeof api.listChecklists>) => api.listChecklists(...args),
  createChecklist: (...args: Parameters<typeof api.createChecklist>) =>
    api.createChecklist(...args),
  autoPopulateChecklist: (...args: Parameters<typeof api.autoPopulateChecklist>) =>
    api.autoPopulateChecklist(...args),
  getComplianceGaps: (...args: Parameters<typeof api.getComplianceGaps>) =>
    api.getComplianceGaps(...args),
  listPcpndtForms: (...args: Parameters<typeof api.listPcpndtForms>) =>
    api.listPcpndtForms(...args),
  createPcpndtForm: (...args: Parameters<typeof api.createPcpndtForm>) =>
    api.createPcpndtForm(...args),
  listAdrReports: (...args: Parameters<typeof api.listAdrReports>) => api.listAdrReports(...args),
  createAdrReport: (...args: Parameters<typeof api.createAdrReport>) =>
    api.createAdrReport(...args),
  submitAdrToPvpi: (...args: Parameters<typeof api.submitAdrToPvpi>) =>
    api.submitAdrToPvpi(...args),
  listMvReports: (...args: Parameters<typeof api.listMvReports>) => api.listMvReports(...args),
  createMvReport: (...args: Parameters<typeof api.createMvReport>) => api.createMvReport(...args),
  submitMvToCdsco: (...args: Parameters<typeof api.submitMvToCdsco>) =>
    api.submitMvToCdsco(...args),
  listMockSurveys: (...args: Parameters<typeof api.listMockSurveys>) =>
    api.listMockSurveys(...args),
  createMockSurvey: (...args: Parameters<typeof api.createMockSurvey>) =>
    api.createMockSurvey(...args),
  listAccreditationStandards: (...args: Parameters<typeof api.listAccreditationStandards>) =>
    api.listAccreditationStandards(...args),
  listAccreditationCompliance: (...args: Parameters<typeof api.listAccreditationCompliance>) =>
    api.listAccreditationCompliance(...args),
  updateAccreditationCompliance: (...args: Parameters<typeof api.updateAccreditationCompliance>) =>
    api.updateAccreditationCompliance(...args),
  nablDocumentTracking: (...args: Parameters<typeof api.nablDocumentTracking>) =>
    api.nablDocumentTracking(...args),
  staffCredentials: (...args: Parameters<typeof api.staffCredentials>) =>
    api.staffCredentials(...args),
};
