import { api } from "@medbrains/api";

export const errorTrackingService = {
  getClientConfig: () => api.getErrorTrackingClientConfig(),
  getSummary: () => api.getErrorTrackingSummary(),
};
