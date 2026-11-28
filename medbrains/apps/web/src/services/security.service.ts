import { securityApi } from "@medbrains/api/modules/security";
import { vulnerabilitiesApi } from "@medbrains/api/modules/vulnerabilities";

export const securityService = {
  listVulnerabilities: (...args: Parameters<typeof vulnerabilitiesApi.listVulnerabilities>) =>
    vulnerabilitiesApi.listVulnerabilities(...args),
  updateVulnerability: (...args: Parameters<typeof vulnerabilitiesApi.updateVulnerability>) =>
    vulnerabilitiesApi.updateVulnerability(...args),
  listSecurityChecks: () => securityApi.listSecurityChecks(),
  getSecurityPosture: () => securityApi.getSecurityPosture(),
  openIncidentFromFinding: (...args: Parameters<typeof securityApi.openIncidentFromFinding>) =>
    securityApi.openIncidentFromFinding(...args),
  listSecurityZones: (...args: Parameters<typeof securityApi.listSecurityZones>) =>
    securityApi.listSecurityZones(...args),
  createSecurityZone: (...args: Parameters<typeof securityApi.createSecurityZone>) =>
    securityApi.createSecurityZone(...args),
  listSecurityAccessCards: (...args: Parameters<typeof securityApi.listSecurityAccessCards>) =>
    securityApi.listSecurityAccessCards(...args),
  createSecurityAccessCard: (...args: Parameters<typeof securityApi.createSecurityAccessCard>) =>
    securityApi.createSecurityAccessCard(...args),
  deactivateSecurityAccessCard: (
    ...args: Parameters<typeof securityApi.deactivateSecurityAccessCard>
  ) => securityApi.deactivateSecurityAccessCard(...args),
  listSecurityAccessLogs: (...args: Parameters<typeof securityApi.listSecurityAccessLogs>) =>
    securityApi.listSecurityAccessLogs(...args),
  createSecurityAccessLog: (...args: Parameters<typeof securityApi.createSecurityAccessLog>) =>
    securityApi.createSecurityAccessLog(...args),
  listSecurityCameras: (...args: Parameters<typeof securityApi.listSecurityCameras>) =>
    securityApi.listSecurityCameras(...args),
  createSecurityCamera: (...args: Parameters<typeof securityApi.createSecurityCamera>) =>
    securityApi.createSecurityCamera(...args),
  listSecurityIncidents: (...args: Parameters<typeof securityApi.listSecurityIncidents>) =>
    securityApi.listSecurityIncidents(...args),
  createSecurityIncident: (...args: Parameters<typeof securityApi.createSecurityIncident>) =>
    securityApi.createSecurityIncident(...args),
  updateSecurityIncident: (...args: Parameters<typeof securityApi.updateSecurityIncident>) =>
    securityApi.updateSecurityIncident(...args),
  assessIncidentBreach: (...args: Parameters<typeof securityApi.assessIncidentBreach>) =>
    securityApi.assessIncidentBreach(...args),
  recordIncidentNotice: (...args: Parameters<typeof securityApi.recordIncidentNotice>) =>
    securityApi.recordIncidentNotice(...args),
  getIncidentUpdates: (id: string) => securityApi.getIncidentUpdates(id),
  addIncidentUpdate: (...args: Parameters<typeof securityApi.addIncidentUpdate>) =>
    securityApi.addIncidentUpdate(...args),
  listSecurityPatientTags: (...args: Parameters<typeof securityApi.listSecurityPatientTags>) =>
    securityApi.listSecurityPatientTags(...args),
  createSecurityPatientTag: (...args: Parameters<typeof securityApi.createSecurityPatientTag>) =>
    securityApi.createSecurityPatientTag(...args),
  deactivateSecurityPatientTag: (
    ...args: Parameters<typeof securityApi.deactivateSecurityPatientTag>
  ) => securityApi.deactivateSecurityPatientTag(...args),
  listSecurityTagAlerts: (...args: Parameters<typeof securityApi.listSecurityTagAlerts>) =>
    securityApi.listSecurityTagAlerts(...args),
  resolveSecurityTagAlert: (...args: Parameters<typeof securityApi.resolveSecurityTagAlert>) =>
    securityApi.resolveSecurityTagAlert(...args),
  verifySecurityBandMatch: (...args: Parameters<typeof securityApi.verifySecurityBandMatch>) =>
    securityApi.verifySecurityBandMatch(...args),
  recordSecurityTagEvent: (...args: Parameters<typeof securityApi.recordSecurityTagEvent>) =>
    securityApi.recordSecurityTagEvent(...args),
  listSecurityCodeDebriefs: (...args: Parameters<typeof securityApi.listSecurityCodeDebriefs>) =>
    securityApi.listSecurityCodeDebriefs(...args),
  createSecurityCodeDebrief: (...args: Parameters<typeof securityApi.createSecurityCodeDebrief>) =>
    securityApi.createSecurityCodeDebrief(...args),
};
