import { utilizationReviewApi } from "@medbrains/api/modules/utilization-review";

export type CreateUrReviewInput = Parameters<typeof utilizationReviewApi.createUrReview>[0];
export type CreateUrCommunicationInput = Parameters<
  typeof utilizationReviewApi.createUrCommunication
>[0];
export type CreateUrConversionInput = Parameters<typeof utilizationReviewApi.createUrConversion>[0];
export type ListUrReviewParams = Parameters<typeof utilizationReviewApi.listUrReviews>[0];
export type ListUrCommunicationParams = Parameters<
  typeof utilizationReviewApi.listUrCommunications
>[0];
export type ListUrConversionParams = Parameters<typeof utilizationReviewApi.listUrConversions>[0];

export const utilizationReviewService = {
  listReviews: (params?: ListUrReviewParams) => utilizationReviewApi.listUrReviews(params),
  createReview: (data: CreateUrReviewInput) => utilizationReviewApi.createUrReview(data),
  listOutliers: () => utilizationReviewApi.listUrOutliers(),
  extractReview: (id: string) => utilizationReviewApi.aiExtractStub(id),
  listCommunications: (params?: ListUrCommunicationParams) =>
    utilizationReviewApi.listUrCommunications(params),
  createCommunication: (data: CreateUrCommunicationInput) =>
    utilizationReviewApi.createUrCommunication(data),
  listConversions: (params?: ListUrConversionParams) =>
    utilizationReviewApi.listUrConversions(params),
  createConversion: (data: CreateUrConversionInput) =>
    utilizationReviewApi.createUrConversion(data),
  analyticsSummary: () => utilizationReviewApi.urAnalyticsSummary(),
  losComparison: () => utilizationReviewApi.urLosComparison(),
};
