import { api } from "@medbrains/api";

export const cpotService = {
  computeCpot: (data: Parameters<typeof api.computeCpot>[0]) => api.computeCpot(data),
};
