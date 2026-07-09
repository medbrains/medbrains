import { api } from "@medbrains/api";

export const pewsService = {
  computePews: (data: Parameters<typeof api.computePews>[0]) => api.computePews(data),
};
