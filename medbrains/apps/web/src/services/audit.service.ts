import { api } from "@medbrains/api";

export const auditService = {
  listModules: api.listAuditModules,
  listEntityTypes: api.listAuditEntityTypes,
  listAccessLog: api.listAccessLog,
  getPatientAccessLog: api.getPatientAccessLog,
  listAuditLog: api.listAuditLog,
  getAuditEntry: api.getAuditEntry,
  getStats: api.getAuditStats,
  verifyIntegrity: api.verifyAuditIntegrity,
  exportAuditLogUrl: api.exportAuditLogUrl,
  getEntityTimeline: api.getEntityTimeline,
  getUserActivity: api.getUserActivity,
  listBreakGlass: api.listBreakGlass,
  getBreakGlass: api.getBreakGlass,
  reviewBreakGlass: api.reviewBreakGlass,
  listAuditChainVerifications: api.listAuditChainVerifications,
};
