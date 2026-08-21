import { api } from "@medbrains/api";

export type ListQueueTokensInput = Parameters<typeof api.listQueueTokens>[0];

export const tvQueueService = {
  listQueueTokens: (params?: ListQueueTokensInput) => api.listQueueTokens(params),
  getQueueMetrics: (departmentId: string) => api.getQueueMetricsRealtime(departmentId),
  getErQueueDisplay: () => api.getErQueueDisplay(),
  getBedAvailabilityDisplay: (wardType: string) => api.getBedAvailabilityDisplay(wardType),
  getLabQueueDisplay: () => api.getLabQueueDisplay(),
  getPharmacyQueueDisplay: () => api.getPharmacyQueueDisplay(),
  getRadiologyQueueDisplay: (modality: string) => api.getRadiologyQueueDisplay(modality),
  getBillingQueueDisplay: () => api.getBillingQueueDisplay(),
  getCampBoard: (campId: string) => api.getCampBoard(campId),
  getNurseCallBoard: (wardId?: string) => api.getNurseCallBoard(wardId),

  /** The unified token board — the queue the doctor actually advances. */
  listOpdBoard: (params: Parameters<typeof api.listTokenBoard>[0]) => api.listTokenBoard(params),
  opdBoardMetrics: (params: Parameters<typeof api.tokenBoardMetrics>[0]) =>
    api.tokenBoardMetrics(params),
};
