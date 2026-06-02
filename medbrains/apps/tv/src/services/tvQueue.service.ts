import { api } from "@medbrains/api";

export type ListQueueTokensInput = Parameters<typeof api.listQueueTokens>[0];

export const tvQueueService = {
  listQueueTokens: (params?: ListQueueTokensInput) => api.listQueueTokens(params),
  getQueueMetrics: (departmentId: string) => api.getQueueMetricsRealtime(departmentId),
  getErQueueDisplay: () => api.getErQueueDisplay(),
  getPharmacyQueueDisplay: () => api.getPharmacyQueueDisplay(),
  getBillingQueueDisplay: () => api.getBillingQueueDisplay(),
};
