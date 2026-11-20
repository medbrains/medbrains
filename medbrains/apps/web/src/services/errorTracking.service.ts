import { adminApi } from "@medbrains/api/modules/admin";
import { publicApi } from "@medbrains/api/modules/public";

export const errorTrackingService = {
  getClientConfig: () => publicApi.getErrorTrackingClientConfig(),
  getSummary: () => adminApi.getErrorTrackingSummary(),
};
