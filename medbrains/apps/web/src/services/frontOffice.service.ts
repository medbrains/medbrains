import { api } from "@medbrains/api";

export const frontOfficeService = {
  getQueueStats: api.getQueueStats,
  listVisitors: api.listVisitors,
  listVisitorPasses: api.listVisitorPasses,
  listVisitorLogs: api.listVisitorLogs,
  createVisitor: api.createVisitor,
  createVisitorPass: api.createVisitorPass,
  revokeVisitorPass: api.revokeVisitorPass,
  checkInVisitor: api.checkInVisitor,
  checkOutVisitor: api.checkOutVisitor,
  listQueuePriorityRules: api.listQueuePriorityRules,
  listQueueDisplayConfig: api.listQueueDisplayConfig,
  listVisitingHours: api.listVisitingHours,
  upsertQueuePriorityRule: api.upsertQueuePriorityRule,
  upsertQueueDisplayConfig: api.upsertQueueDisplayConfig,
  upsertVisitingHours: api.upsertVisitingHours,
  listEnquiries: api.listEnquiries,
  createEnquiry: api.createEnquiry,
  resolveEnquiry: api.resolveEnquiry,
  visitorAnalytics: api.visitorAnalytics,
  queueMetrics: api.queueMetrics,
};
