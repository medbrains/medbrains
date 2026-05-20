import { api } from "@medbrains/api";

export type CreateUrReviewInput = Parameters<typeof api.createUrReview>[0];
export type CreateUrCommunicationInput = Parameters<typeof api.createUrCommunication>[0];
export type CreateUrConversionInput = Parameters<typeof api.createUrConversion>[0];
export type ListUrReviewParams = Parameters<typeof api.listUrReviews>[0];
export type ListUrCommunicationParams = Parameters<typeof api.listUrCommunications>[0];
export type ListUrConversionParams = Parameters<typeof api.listUrConversions>[0];

export const utilizationReviewService = {
  listReviews: (params?: ListUrReviewParams) => api.listUrReviews(params),
  createReview: (data: CreateUrReviewInput) => api.createUrReview(data),
  listOutliers: () => api.listUrOutliers(),
  extractReview: (id: string) => api.aiExtractStub(id),
  listCommunications: (params?: ListUrCommunicationParams) => api.listUrCommunications(params),
  createCommunication: (data: CreateUrCommunicationInput) => api.createUrCommunication(data),
  listConversions: (params?: ListUrConversionParams) => api.listUrConversions(params),
  createConversion: (data: CreateUrConversionInput) => api.createUrConversion(data),
  analyticsSummary: () => api.urAnalyticsSummary(),
  losComparison: () => api.urLosComparison(),
};
