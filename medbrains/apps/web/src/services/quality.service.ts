import { qualityApi } from "@medbrains/api/modules/quality";
import { setupApi } from "@medbrains/api/modules/setup";

export const qualityService = {
  listQualityIndicators: (...args: Parameters<typeof qualityApi.listQualityIndicators>) =>
    qualityApi.listQualityIndicators(...args),
  createQualityIndicator: (...args: Parameters<typeof qualityApi.createQualityIndicator>) =>
    qualityApi.createQualityIndicator(...args),
  listIndicatorValues: (...args: Parameters<typeof qualityApi.listIndicatorValues>) =>
    qualityApi.listIndicatorValues(...args),
  recordIndicatorValue: (...args: Parameters<typeof qualityApi.recordIndicatorValue>) =>
    qualityApi.recordIndicatorValue(...args),
  setQualityIndicatorDirection: (
    ...args: Parameters<typeof qualityApi.setQualityIndicatorDirection>
  ) => qualityApi.setQualityIndicatorDirection(...args),
  listQualityIncidents: (...args: Parameters<typeof qualityApi.listQualityIncidents>) =>
    qualityApi.listQualityIncidents(...args),
  getQualityIncident: (...args: Parameters<typeof qualityApi.getQualityIncident>) =>
    qualityApi.getQualityIncident(...args),
  createQualityIncident: (...args: Parameters<typeof qualityApi.createQualityIncident>) =>
    qualityApi.createQualityIncident(...args),
  updateQualityIncident: (...args: Parameters<typeof qualityApi.updateQualityIncident>) =>
    qualityApi.updateQualityIncident(...args),
  listCapa: (...args: Parameters<typeof qualityApi.listCapa>) => qualityApi.listCapa(...args),
  createCapa: (...args: Parameters<typeof qualityApi.createCapa>) => qualityApi.createCapa(...args),
  listQualityAudits: (...args: Parameters<typeof qualityApi.listQualityAudits>) =>
    qualityApi.listQualityAudits(...args),
  createQualityAudit: (...args: Parameters<typeof qualityApi.createQualityAudit>) =>
    qualityApi.createQualityAudit(...args),
  scheduleAudits: (...args: Parameters<typeof qualityApi.scheduleAudits>) =>
    qualityApi.scheduleAudits(...args),
  listAuditFindings: (...args: Parameters<typeof qualityApi.listAuditFindings>) =>
    qualityApi.listAuditFindings(...args),
  createAuditFinding: (...args: Parameters<typeof qualityApi.createAuditFinding>) =>
    qualityApi.createAuditFinding(...args),
  listQualityCommittees: (...args: Parameters<typeof qualityApi.listQualityCommittees>) =>
    qualityApi.listQualityCommittees(...args),
  createQualityCommittee: (...args: Parameters<typeof qualityApi.createQualityCommittee>) =>
    qualityApi.createQualityCommittee(...args),
  listCommitteeMeetings: (...args: Parameters<typeof qualityApi.listCommitteeMeetings>) =>
    qualityApi.listCommitteeMeetings(...args),
  createCommitteeMeeting: (...args: Parameters<typeof qualityApi.createCommitteeMeeting>) =>
    qualityApi.createCommitteeMeeting(...args),
  autoScheduleMeetings: (...args: Parameters<typeof qualityApi.autoScheduleMeetings>) =>
    qualityApi.autoScheduleMeetings(...args),
  committeeDashboard: (...args: Parameters<typeof qualityApi.committeeDashboard>) =>
    qualityApi.committeeDashboard(...args),
  listQualityDocuments: (...args: Parameters<typeof qualityApi.listQualityDocuments>) =>
    qualityApi.listQualityDocuments(...args),
  createQualityDocument: (...args: Parameters<typeof qualityApi.createQualityDocument>) =>
    qualityApi.createQualityDocument(...args),
  updateDocumentStatus: (...args: Parameters<typeof qualityApi.updateDocumentStatus>) =>
    qualityApi.updateDocumentStatus(...args),
  acknowledgeDocument: (...args: Parameters<typeof qualityApi.acknowledgeDocument>) =>
    qualityApi.acknowledgeDocument(...args),
  listPendingAcks: (...args: Parameters<typeof qualityApi.listPendingAcks>) =>
    qualityApi.listPendingAcks(...args),
  listAccreditationStandards: (...args: Parameters<typeof qualityApi.listAccreditationStandards>) =>
    qualityApi.listAccreditationStandards(...args),
  createAccreditationStandard: (
    ...args: Parameters<typeof qualityApi.createAccreditationStandard>
  ) => qualityApi.createAccreditationStandard(...args),
  listAccreditationCompliance: (
    ...args: Parameters<typeof qualityApi.listAccreditationCompliance>
  ) => qualityApi.listAccreditationCompliance(...args),
  updateAccreditationCompliance: (
    ...args: Parameters<typeof qualityApi.updateAccreditationCompliance>
  ) => qualityApi.updateAccreditationCompliance(...args),
  compileEvidence: (...args: Parameters<typeof qualityApi.compileEvidence>) =>
    qualityApi.compileEvidence(...args),
  listDepartments: (...args: Parameters<typeof setupApi.listDepartments>) =>
    setupApi.listDepartments(...args),
  listOverdueCapas: (...args: Parameters<typeof qualityApi.listOverdueCapas>) =>
    qualityApi.listOverdueCapas(...args),
  listSentinelEvents: (...args: Parameters<typeof qualityApi.listSentinelEvents>) =>
    qualityApi.listSentinelEvents(...args),
  patientSafetyIndicators: (...args: Parameters<typeof qualityApi.patientSafetyIndicators>) =>
    qualityApi.patientSafetyIndicators(...args),
  departmentScorecard: (...args: Parameters<typeof qualityApi.departmentScorecard>) =>
    qualityApi.departmentScorecard(...args),
  listActionItems: (...args: Parameters<typeof qualityApi.listActionItems>) =>
    qualityApi.listActionItems(...args),
  createMortalityReview: (...args: Parameters<typeof qualityApi.createMortalityReview>) =>
    qualityApi.createMortalityReview(...args),
};
