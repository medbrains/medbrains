import { api } from "@medbrains/api";

export const securityService = {
  listSecurityZones: (...args: Parameters<typeof api.listSecurityZones>) =>
    api.listSecurityZones(...args),
  createSecurityZone: (...args: Parameters<typeof api.createSecurityZone>) =>
    api.createSecurityZone(...args),
  listSecurityAccessCards: (...args: Parameters<typeof api.listSecurityAccessCards>) =>
    api.listSecurityAccessCards(...args),
  createSecurityAccessCard: (...args: Parameters<typeof api.createSecurityAccessCard>) =>
    api.createSecurityAccessCard(...args),
  deactivateSecurityAccessCard: (...args: Parameters<typeof api.deactivateSecurityAccessCard>) =>
    api.deactivateSecurityAccessCard(...args),
  listSecurityAccessLogs: (...args: Parameters<typeof api.listSecurityAccessLogs>) =>
    api.listSecurityAccessLogs(...args),
  createSecurityAccessLog: (...args: Parameters<typeof api.createSecurityAccessLog>) =>
    api.createSecurityAccessLog(...args),
  listSecurityCameras: (...args: Parameters<typeof api.listSecurityCameras>) =>
    api.listSecurityCameras(...args),
  createSecurityCamera: (...args: Parameters<typeof api.createSecurityCamera>) =>
    api.createSecurityCamera(...args),
  listSecurityIncidents: (...args: Parameters<typeof api.listSecurityIncidents>) =>
    api.listSecurityIncidents(...args),
  createSecurityIncident: (...args: Parameters<typeof api.createSecurityIncident>) =>
    api.createSecurityIncident(...args),
  updateSecurityIncident: (...args: Parameters<typeof api.updateSecurityIncident>) =>
    api.updateSecurityIncident(...args),
  listSecurityPatientTags: (...args: Parameters<typeof api.listSecurityPatientTags>) =>
    api.listSecurityPatientTags(...args),
  createSecurityPatientTag: (...args: Parameters<typeof api.createSecurityPatientTag>) =>
    api.createSecurityPatientTag(...args),
  deactivateSecurityPatientTag: (...args: Parameters<typeof api.deactivateSecurityPatientTag>) =>
    api.deactivateSecurityPatientTag(...args),
  listSecurityTagAlerts: (...args: Parameters<typeof api.listSecurityTagAlerts>) =>
    api.listSecurityTagAlerts(...args),
  resolveSecurityTagAlert: (...args: Parameters<typeof api.resolveSecurityTagAlert>) =>
    api.resolveSecurityTagAlert(...args),
  listSecurityCodeDebriefs: (...args: Parameters<typeof api.listSecurityCodeDebriefs>) =>
    api.listSecurityCodeDebriefs(...args),
  createSecurityCodeDebrief: (...args: Parameters<typeof api.createSecurityCodeDebrief>) =>
    api.createSecurityCodeDebrief(...args),
};
