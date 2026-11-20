import { frontOfficeApi } from "@medbrains/api/modules/front-office";
import { printDataApi } from "@medbrains/api/modules/print-data";
import { tokensApi } from "@medbrains/api/modules/tokens";
import { tvApi } from "@medbrains/api/modules/tv";

export const frontOfficeService = {
  scanVisitorPass: (...args: Parameters<typeof frontOfficeApi.scanVisitorPass>) =>
    frontOfficeApi.scanVisitorPass(...args),
  getVisitorPassPrintData: (...args: Parameters<typeof printDataApi.getVisitorPassPrintData>) =>
    printDataApi.getVisitorPassPrintData(...args),
  listTokenBoard: (params: Parameters<typeof tokensApi.listTokenBoard>[0]) =>
    tokensApi.listTokenBoard(params),
  requeueToken: (id: string) => tokensApi.requeueToken(id),
  getQueueStats: frontOfficeApi.getQueueStats,
  listVisitors: frontOfficeApi.listVisitors,
  listVisitorPasses: frontOfficeApi.listVisitorPasses,
  listVisitorLogs: frontOfficeApi.listVisitorLogs,
  createVisitor: frontOfficeApi.createVisitor,
  createVisitorPass: frontOfficeApi.createVisitorPass,
  revokeVisitorPass: frontOfficeApi.revokeVisitorPass,
  checkInVisitor: frontOfficeApi.checkInVisitor,
  checkOutVisitor: frontOfficeApi.checkOutVisitor,
  listQueuePriorityRules: frontOfficeApi.listQueuePriorityRules,
  listQueueDisplayConfig: frontOfficeApi.listQueueDisplayConfig,
  listVisitingHours: frontOfficeApi.listVisitingHours,
  upsertQueuePriorityRule: frontOfficeApi.upsertQueuePriorityRule,
  upsertQueueDisplayConfig: frontOfficeApi.upsertQueueDisplayConfig,
  upsertVisitingHours: frontOfficeApi.upsertVisitingHours,
  listEnquiries: frontOfficeApi.listEnquiries,
  createEnquiry: frontOfficeApi.createEnquiry,
  resolveEnquiry: frontOfficeApi.resolveEnquiry,
  visitorAnalytics: frontOfficeApi.visitorAnalytics,
  queueMetrics: frontOfficeApi.queueMetrics,
  listOpdTokenBoard: () => tokensApi.listTokenBoard({ include_finished: true, module: "opd" }),
  getBillingQueueDisplay: tvApi.getBillingQueueDisplay,
  getErQueueDisplay: tvApi.getErQueueDisplay,
  getLabQueueDisplay: tvApi.getLabQueueDisplay,
  getPharmacyQueueDisplay: tvApi.getPharmacyQueueDisplay,
  getRadiologyQueueDisplay: tvApi.getRadiologyQueueDisplay,
};
