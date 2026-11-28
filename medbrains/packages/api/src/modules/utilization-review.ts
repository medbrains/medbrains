/** The `/utilization-review` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CreateUrCommunicationRequest,
  CreateUrConversionRequest,
  CreateUrReviewRequest,
  LosComparisonRow,
  UpdateUrReviewRequest,
  UrAnalyticsSummary,
  UrPayerCommunication,
  UrStatusConversion,
  UtilizationReview,
} from "@medbrains/types";
import { request } from "../client.js";

export const utilizationReviewApi = {
  // ══════════════════════════════════════════════════════════
  //  Utilization Review
  // ══════════════════════════════════════════════════════════

  listUrReviews: (params?: {
    admission_id?: string;
    review_type?: string;
    decision?: string;
    is_outlier?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params?.admission_id) sp.set("admission_id", params.admission_id);
    if (params?.review_type) sp.set("review_type", params.review_type);
    if (params?.decision) sp.set("decision", params.decision);
    if (params?.is_outlier) sp.set("is_outlier", params.is_outlier);
    const qs = sp.toString();
    return request<UtilizationReview[]>(`/utilization-review/reviews${qs ? `?${qs}` : ""}`);
  },

  createUrReview: (data: CreateUrReviewRequest) =>
    request<UtilizationReview>("/utilization-review/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listUrOutliers: () => request<UtilizationReview[]>("/utilization-review/reviews/outliers"),

  getUrReview: (id: string) => request<UtilizationReview>(`/utilization-review/reviews/${id}`),

  updateUrReview: (id: string, data: UpdateUrReviewRequest) =>
    request<UtilizationReview>(`/utilization-review/reviews/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  aiExtractStub: (id: string) =>
    request<{ status: string; message: string }>(`/utilization-review/reviews/${id}/ai-extract`, {
      method: "POST",
    }),

  listUrByAdmission: (admissionId: string) =>
    request<UtilizationReview[]>(`/utilization-review/reviews/admission/${admissionId}`),

  listUrCommunications: (params?: { review_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.review_id) sp.set("review_id", params.review_id);
    const qs = sp.toString();
    return request<UrPayerCommunication[]>(
      `/utilization-review/communications${qs ? `?${qs}` : ""}`,
    );
  },

  createUrCommunication: (data: CreateUrCommunicationRequest) =>
    request<UrPayerCommunication>("/utilization-review/communications", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateUrCommunication: (id: string, data: Partial<CreateUrCommunicationRequest>) =>
    request<UrPayerCommunication>(`/utilization-review/communications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  listUrConversions: (params?: { admission_id?: string }) => {
    const sp = new URLSearchParams();
    if (params?.admission_id) sp.set("admission_id", params.admission_id);
    const qs = sp.toString();
    return request<UrStatusConversion[]>(`/utilization-review/conversions${qs ? `?${qs}` : ""}`);
  },

  createUrConversion: (data: CreateUrConversionRequest) =>
    request<UrStatusConversion>("/utilization-review/conversions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  urAnalyticsSummary: () => request<UrAnalyticsSummary>("/utilization-review/analytics"),

  urLosComparison: () =>
    request<LosComparisonRow[]>("/utilization-review/analytics/los-comparison"),
};
