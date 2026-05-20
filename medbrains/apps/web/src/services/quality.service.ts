import { api } from "@medbrains/api";

export const qualityService = {
  listQualityIndicators: (...args: Parameters<typeof api.listQualityIndicators>) =>
    api.listQualityIndicators(...args),
  createQualityIndicator: (...args: Parameters<typeof api.createQualityIndicator>) =>
    api.createQualityIndicator(...args),
  listIndicatorValues: (...args: Parameters<typeof api.listIndicatorValues>) =>
    api.listIndicatorValues(...args),
  recordIndicatorValue: (...args: Parameters<typeof api.recordIndicatorValue>) =>
    api.recordIndicatorValue(...args),
  calculateIndicator: (...args: Parameters<typeof api.calculateIndicator>) =>
    api.calculateIndicator(...args),
  listQualityIncidents: (...args: Parameters<typeof api.listQualityIncidents>) =>
    api.listQualityIncidents(...args),
  createQualityIncident: (...args: Parameters<typeof api.createQualityIncident>) =>
    api.createQualityIncident(...args),
  updateQualityIncident: (...args: Parameters<typeof api.updateQualityIncident>) =>
    api.updateQualityIncident(...args),
  listCapa: (...args: Parameters<typeof api.listCapa>) => api.listCapa(...args),
  createCapa: (...args: Parameters<typeof api.createCapa>) => api.createCapa(...args),
  listQualityAudits: (...args: Parameters<typeof api.listQualityAudits>) =>
    api.listQualityAudits(...args),
  createQualityAudit: (...args: Parameters<typeof api.createQualityAudit>) =>
    api.createQualityAudit(...args),
  scheduleAudits: (...args: Parameters<typeof api.scheduleAudits>) => api.scheduleAudits(...args),
  listAuditFindings: (...args: Parameters<typeof api.listAuditFindings>) =>
    api.listAuditFindings(...args),
  createAuditFinding: (...args: Parameters<typeof api.createAuditFinding>) =>
    api.createAuditFinding(...args),
  listQualityCommittees: (...args: Parameters<typeof api.listQualityCommittees>) =>
    api.listQualityCommittees(...args),
  createQualityCommittee: (...args: Parameters<typeof api.createQualityCommittee>) =>
    api.createQualityCommittee(...args),
  listCommitteeMeetings: (...args: Parameters<typeof api.listCommitteeMeetings>) =>
    api.listCommitteeMeetings(...args),
  createCommitteeMeeting: (...args: Parameters<typeof api.createCommitteeMeeting>) =>
    api.createCommitteeMeeting(...args),
  autoScheduleMeetings: (...args: Parameters<typeof api.autoScheduleMeetings>) =>
    api.autoScheduleMeetings(...args),
  committeeDashboard: (...args: Parameters<typeof api.committeeDashboard>) =>
    api.committeeDashboard(...args),
  listQualityDocuments: (...args: Parameters<typeof api.listQualityDocuments>) =>
    api.listQualityDocuments(...args),
  createQualityDocument: (...args: Parameters<typeof api.createQualityDocument>) =>
    api.createQualityDocument(...args),
  updateDocumentStatus: (...args: Parameters<typeof api.updateDocumentStatus>) =>
    api.updateDocumentStatus(...args),
  acknowledgeDocument: (...args: Parameters<typeof api.acknowledgeDocument>) =>
    api.acknowledgeDocument(...args),
  listPendingAcks: (...args: Parameters<typeof api.listPendingAcks>) =>
    api.listPendingAcks(...args),
  listAccreditationStandards: (...args: Parameters<typeof api.listAccreditationStandards>) =>
    api.listAccreditationStandards(...args),
  createAccreditationStandard: (...args: Parameters<typeof api.createAccreditationStandard>) =>
    api.createAccreditationStandard(...args),
  listAccreditationCompliance: (...args: Parameters<typeof api.listAccreditationCompliance>) =>
    api.listAccreditationCompliance(...args),
  updateAccreditationCompliance: (...args: Parameters<typeof api.updateAccreditationCompliance>) =>
    api.updateAccreditationCompliance(...args),
  compileEvidence: (...args: Parameters<typeof api.compileEvidence>) =>
    api.compileEvidence(...args),
  listDepartments: (...args: Parameters<typeof api.listDepartments>) =>
    api.listDepartments(...args),
  listOverdueCapas: (...args: Parameters<typeof api.listOverdueCapas>) =>
    api.listOverdueCapas(...args),
  listSentinelEvents: (...args: Parameters<typeof api.listSentinelEvents>) =>
    api.listSentinelEvents(...args),
  patientSafetyIndicators: (...args: Parameters<typeof api.patientSafetyIndicators>) =>
    api.patientSafetyIndicators(...args),
  departmentScorecard: (...args: Parameters<typeof api.departmentScorecard>) =>
    api.departmentScorecard(...args),
  listActionItems: (...args: Parameters<typeof api.listActionItems>) =>
    api.listActionItems(...args),
  createMortalityReview: (...args: Parameters<typeof api.createMortalityReview>) =>
    api.createMortalityReview(...args),
};
