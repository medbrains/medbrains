import { accessAlertsApi } from "@medbrains/api/modules/access-alerts";
import { auditApi } from "@medbrains/api/modules/audit";
import { breakGlassApi } from "@medbrains/api/modules/break-glass";
import { dataProcessorsApi } from "@medbrains/api/modules/data-processors";

export const auditService = {
  listModules: auditApi.listAuditModules,
  listEntityTypes: auditApi.listAuditEntityTypes,
  listAccessLog: auditApi.listAccessLog,
  getPatientAccessLog: auditApi.getPatientAccessLog,
  listAuditLog: auditApi.listAuditLog,
  getAuditEntry: auditApi.getAuditEntry,
  getStats: auditApi.getAuditStats,
  exportAuditLogUrl: auditApi.exportAuditLogUrl,
  getEntityTimeline: auditApi.getEntityTimeline,
  getUserActivity: auditApi.getUserActivity,
  startBreakGlass: breakGlassApi.startBreakGlass,
  listAccessAlerts: accessAlertsApi.listAccessAlerts,
  listDataProcessors: dataProcessorsApi.listDataProcessors,
  createDataProcessor: dataProcessorsApi.createDataProcessor,
  updateDataProcessor: dataProcessorsApi.updateDataProcessor,
  acknowledgeAccessAlert: accessAlertsApi.acknowledgeAccessAlert,
  listBreakGlass: breakGlassApi.listBreakGlass,
  getBreakGlass: breakGlassApi.getBreakGlass,
  reviewBreakGlass: breakGlassApi.reviewBreakGlass,
  listAuditChainVerifications: auditApi.listAuditChainVerifications,
};
