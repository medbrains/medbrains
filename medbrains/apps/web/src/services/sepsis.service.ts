import { api } from "@medbrains/api";

export const sepsisService = {
  computeQsofa: (data: Parameters<typeof api.computeQsofa>[0]) => api.computeQsofa(data),
};
